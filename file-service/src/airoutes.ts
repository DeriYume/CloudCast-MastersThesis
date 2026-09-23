import { accessibleFile, notifyUser } from "./routes";
import { Router, Response } from "express";
import express from "express";
import { promises as fs } from "fs";
import path from "path";
import { pool } from "./db";
import { sniffMime } from "./sniff";
import { requireAuth, AuthedRequest } from "./auth";
import * as cc from "./sodiumcrypto";
import { decryptFile } from "./filecrypto";
import { serverPublic, serverSecret } from "./serverkey";
import { AiEmptyResultError,
  aiEnabled, semanticEnabled, analyzeText, analyzeImage,
  classifyText, classifyImage, embed, suggestFolderName, AiUnavailableError,
} from "./ai";
import { extractText, NoTextError } from "./extractor";
import { extractKeywords } from "./keywords";
import { envStr, envNum } from "./env";

export const aiRouter = Router();
const json = express.json({ limit: "2mb" });
aiRouter.use(requireAuth);

const STORAGE_DIR = envStr("STORAGE_DIR");
const MAX_TEXT_CHARS = envNum("AI_MAX_TEXT_CHARS");
const MAX_IMAGE_BYTES = envNum("AI_MAX_IMAGE_MB") * 1024 * 1024;

const b64 = (b: Buffer | null): string | null => (b ? b.toString("base64") : null);
const fromB64 = (s: unknown): Buffer | null => (typeof s === "string" && s.length > 0 ? Buffer.from(s, "base64") : null);
const isImage = (m: string) => m.startsWith("image/");
const isTextLike = (m: string) => m.startsWith("text/") || m === "application/json" || m === "application/xml";

aiRouter.get("/ai/server-key", (_req, res) => res.json({ public_key: b64(serverPublic()) }));

interface Prefs { auto_file_mode: "off" | "type" | "smart"; analysis: boolean; semantic_search: boolean; }
const PREFS_OFF: Prefs = { auto_file_mode: "off", analysis: false, semantic_search: false };
async function getPrefs(userId: string): Promise<Prefs> {

  try {
    const r = await pool.query(
      "SELECT auto_file_mode, analysis, semantic_search FROM ai_preferences WHERE user_id=$1", [userId]);
    return r.rows[0] ?? PREFS_OFF;
  } catch (e) {
    console.error("[ai] getPrefs failed (defaulting to all-off):", (e as Error).message);
    return PREFS_OFF;
  }
}

aiRouter.get("/ai/config", async (req: AuthedRequest, res: Response) => {
  res.json({
    ai: aiEnabled(),
    semantic: semanticEnabled(),
    preferences: await getPrefs(req.userId as string),
  });
});
aiRouter.put("/ai/preferences", json, async (req: AuthedRequest, res: Response) => {
  const b = req.body ?? {};
  const mode = ["off", "type", "smart"].includes(b.auto_file_mode) ? b.auto_file_mode : "off";
  const semantic = !!b.semantic_search;
  await pool.query(
    `INSERT INTO ai_preferences (user_id, auto_file_mode, analysis, semantic_search, updated_at)
     VALUES ($1,$2,$3,$4,now())
     ON CONFLICT (user_id) DO UPDATE SET auto_file_mode=EXCLUDED.auto_file_mode,
       analysis=EXCLUDED.analysis, semantic_search=EXCLUDED.semantic_search, updated_at=now()`,
    [req.userId, mode, !!b.analysis, semantic]);

  if (!semantic) {
    await pool.query(
      `DELETE FROM file_keywords WHERE file_id IN (SELECT id FROM files WHERE user_id=$1)`,
      [req.userId]);
  }
  notifyUser(req.userId as string, "prefs");
  res.json({ ok: true });
});

interface GrantCtx { plain: Buffer; mime: string; userPk: Buffer; fileId: string; }
async function openGrant(
  req: AuthedRequest,
  res: Response,
  purpose: "summary" | "embed" | "classify" | "keywords",
  allowShared = false,
): Promise<GrantCtx | null> {
  const userId = req.userId as string;
  const fileId = req.params.id;
  const wrapped = fromB64(req.body?.wrapped_dek_for_server);
  if (!wrapped) { res.status(400).json({ error: "wrapped_dek_for_server (base64) required" }); return null; }

  let file: { stored_name: string } | null;
  if (allowShared) {
    const row = await accessibleFile(userId, fileId);
    if (row && row.access_permission !== "owner" && row.access_permission !== "save") {
      res.status(403).json({ error: "AI analysis needs view & save access to this file" });
      return null;
    }
    file = row ? { stored_name: row.stored_name } : null;
  } else {
    const fr = await pool.query(
      "SELECT stored_name FROM files WHERE id=$1 AND user_id=$2 AND (expires_at IS NULL OR expires_at>now())",
      [fileId, userId]);
    file = fr.rows[0] ?? null;
  }
  if (!file) { res.status(404).json({ error: "Not found" }); return null; }

  const ur = await pool.query("SELECT public_key FROM users WHERE id=$1", [userId]);
  const userPk: Buffer | undefined = ur.rows[0]?.public_key;
  if (!userPk) { res.status(404).json({ error: "User not found" }); return null; }

  const grant = await pool.query(
    `INSERT INTO ai_processing_requests (user_id, file_id, wrapped_dek_for_server, purpose, expires_at)
     VALUES ($1,$2,$3,$4, now() + interval '60 seconds') RETURNING id`,
    [userId, fileId, wrapped, purpose]);

  let dek: Buffer;
  try { dek = cc.sealOpen(wrapped, serverPublic(), serverSecret()); }
  catch { res.status(400).json({ error: "Invalid grant" }); return null; }

  let plain: Buffer;
  try { plain = decryptFile(await fs.readFile(path.join(STORAGE_DIR, file.stored_name)), dek); }
  catch { dek.fill(0); res.status(500).json({ error: "Could not read file" }); return null; }
  dek.fill(0);

  await pool.query(
    "UPDATE ai_processing_requests SET consumed=true, wrapped_dek_for_server=NULL WHERE id=$1",
    [grant.rows[0].id]);

  return { plain, mime: sniffMime(plain), userPk, fileId };
}

aiRouter.post("/:id/analyze", json, async (req: AuthedRequest, res: Response) => {
  if (!aiEnabled()) return res.status(503).json({ error: "AI features are not enabled" });
  if (!(await getPrefs(req.userId as string)).analysis)
    return res.status(403).json({ error: "Turn on AI analysis in your AI settings to use this" });
  const ctx = await openGrant(req, res, "summary", true);
  if (!ctx) return;
  try {
    let summary: string;
    if (isImage(ctx.mime)) {
      if (ctx.plain.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: "Image too large" });
      summary = (await analyzeImage(ctx.plain.toString("base64"))).summary;
    } else if (isTextLike(ctx.mime)) {
      const t = ctx.plain.toString("utf8").slice(0, MAX_TEXT_CHARS);
      if (!t.trim()) return res.status(415).json({ error: "No text to analyze" });
      summary = (await analyzeText(t)).summary;
    } else return res.status(415).json({ error: "No AI analysis for this file type" });
    res.json({ summary_sealed: b64(cc.sealTo(Buffer.from(summary, "utf8"), ctx.userPk)) });
  } catch (e) {
    if (e instanceof AiEmptyResultError)
      return res.status(422).json({ error: "The model couldn't describe this file" });
    if (e instanceof AiUnavailableError) return res.status(503).json({ error: "AI model is unavailable" });
    console.error("[analyze] failed:", (e as Error).message);
    res.status(500).json({ error: "Could not analyze file" });
  } finally { ctx.plain.fill(0); }
});

aiRouter.post("/:id/classify", json, async (req: AuthedRequest, res: Response) => {
  if (!aiEnabled()) return res.status(503).json({ error: "AI features are not enabled" });
  if ((await getPrefs(req.userId as string)).auto_file_mode !== "smart")
    return res.status(403).json({ error: "Smart filing is turned off" });
  const ctx = await openGrant(req, res, "classify");
  if (!ctx) return;
  try {
    let category: string;
    if (isImage(ctx.mime)) {
      if (ctx.plain.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: "Image too large" });
      category = await classifyImage(ctx.plain.toString("base64"));
    } else if (isTextLike(ctx.mime)) {
      const t = ctx.plain.toString("utf8").slice(0, MAX_TEXT_CHARS);
      if (!t.trim()) return res.status(415).json({ error: "No text to classify" });
      category = await classifyText(t);
    } else return res.status(415).json({ error: "No AI classification for this file type" });
    res.json({ category_sealed: b64(cc.sealTo(Buffer.from(category, "utf8"), ctx.userPk)) });
  } catch (e) {
    if (e instanceof AiEmptyResultError)
      return res.status(422).json({ error: "The model couldn't describe this file" });
    if (e instanceof AiUnavailableError) return res.status(503).json({ error: "AI model is unavailable" });
    console.error("[classify] failed:", (e as Error).message);
    res.status(500).json({ error: "Could not classify file" });
  } finally { ctx.plain.fill(0); }
});

aiRouter.post("/:id/embed", json, async (req: AuthedRequest, res: Response) => {
  if (!semanticEnabled()) return res.status(503).json({ error: "Semantic search is not enabled" });
  if (!(await getPrefs(req.userId as string)).semantic_search)
    return res.status(403).json({ error: "Semantic search is turned off" });
  const ctx = await openGrant(req, res, "embed");
  if (!ctx) return;
  try {
    let text: string, source: string;
    if (isImage(ctx.mime)) {
      if (ctx.plain.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: "Image too large" });
      text = (await analyzeImage(ctx.plain.toString("base64"))).summary; source = "image";
    } else if (isTextLike(ctx.mime)) {
      text = ctx.plain.toString("utf8").slice(0, MAX_TEXT_CHARS); source = "text";
    } else {

      try { text = (await extractText(ctx.plain)).slice(0, MAX_TEXT_CHARS); source = "text"; }
      catch (e) {
        if (e instanceof NoTextError) return res.status(415).json({ error: "No embedding for this file type" });
        return res.status(503).json({ error: "Document extractor unavailable" });
      }
    }
    if (!text.trim()) return res.status(415).json({ error: "Nothing to embed" });
    const sealed = cc.sealTo(Buffer.from(new Float32Array(await embed(text, "document")).buffer), ctx.userPk);
    await pool.query(
      `INSERT INTO file_embeddings (file_id, embedding_enc, source) VALUES ($1,$2,$3)
       ON CONFLICT (file_id) DO UPDATE SET embedding_enc=EXCLUDED.embedding_enc, source=EXCLUDED.source, created_at=now()`,
      [ctx.fileId, sealed, source]);
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof AiEmptyResultError)
      return res.status(422).json({ error: "The model couldn't describe this file" });
    if (e instanceof AiUnavailableError) return res.status(503).json({ error: "AI model is unavailable" });
    console.error("[embed] failed:", (e as Error).message);
    res.status(500).json({ error: "Could not embed file" });
  } finally { ctx.plain.fill(0); }
});

aiRouter.post("/:id/filing", json, async (req: AuthedRequest, res: Response) => {
  if (!aiEnabled()) return res.status(503).json({ error: "AI features are not enabled" });
  if ((await getPrefs(req.userId as string)).auto_file_mode !== "smart")
    return res.status(403).json({ error: "Smart filing is turned off" });
  const ctx = await openGrant(req, res, "classify");
  if (!ctx) return;
  try {
    let text: string;
    let source = "text";
    if (isImage(ctx.mime)) {
      if (ctx.plain.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: "Image too large" });
      text = (await analyzeImage(ctx.plain.toString("base64"))).summary; source = "image";
    } else if (isTextLike(ctx.mime)) {
      text = ctx.plain.toString("utf8");
    } else {

      try {
        text = await extractText(ctx.plain);
      } catch (e) {
        if (e instanceof NoTextError) return res.status(415).json({ error: "No text to file on" });
        return res.status(503).json({ error: "Document extractor unavailable" });
      }
    }
    text = text.slice(0, MAX_TEXT_CHARS);
    if (!text.trim()) return res.status(415).json({ error: "No text to file on" });

    const [vector, name] = await Promise.all([embed(text, "document"), suggestFolderName(text)]);
    const sealedVec = cc.sealTo(Buffer.from(new Float32Array(vector).buffer), ctx.userPk);
    await pool.query(
      `INSERT INTO file_embeddings (file_id, embedding_enc, source) VALUES ($1,$2,$3)
       ON CONFLICT (file_id) DO UPDATE SET embedding_enc=EXCLUDED.embedding_enc, source=EXCLUDED.source, created_at=now()`,
      [ctx.fileId, sealedVec, source]);
    res.json({
      embedding_enc: b64(sealedVec),
      suggested_name_enc: b64(cc.sealTo(Buffer.from(name, "utf8"), ctx.userPk)),
    });
  } catch (e) {
    if (e instanceof AiEmptyResultError)
      return res.status(422).json({ error: "The model couldn't describe this file" });
    if (e instanceof AiUnavailableError) return res.status(503).json({ error: "AI model is unavailable" });
    console.error("[filing] failed:", (e as Error).message);
    res.status(500).json({ error: "Could not prepare filing suggestion" });
  } finally { ctx.plain.fill(0); }
});

aiRouter.post("/:id/keywords", json, async (req: AuthedRequest, res: Response) => {
  if (!semanticEnabled()) return res.status(503).json({ error: "Semantic search is not enabled" });
  if (!(await getPrefs(req.userId as string)).semantic_search)
    return res.status(403).json({ error: "Semantic search is turned off" });
  const ctx = await openGrant(req, res, "keywords");
  if (!ctx) return;
  try {
    let text: string;
    if (isImage(ctx.mime)) {

      return res.json({ ok: true, skipped: "image" });
    } else if (isTextLike(ctx.mime)) {
      text = ctx.plain.toString("utf8");
    } else {
      try {
        text = await extractText(ctx.plain);
      } catch (e) {
        if (e instanceof NoTextError) return res.status(415).json({ error: "No text to index" });
        return res.status(503).json({ error: "Document extractor unavailable" });
      }
    }
    text = text.slice(0, MAX_TEXT_CHARS);
    const words = extractKeywords(text);
    if (words.length === 0) return res.status(415).json({ error: "No text to index" });

    const sealed = cc.sealTo(Buffer.from(JSON.stringify(words), "utf8"), ctx.userPk);
    await pool.query(
      `INSERT INTO file_keywords (file_id, keywords_enc) VALUES ($1,$2)
       ON CONFLICT (file_id) DO UPDATE SET keywords_enc=EXCLUDED.keywords_enc, created_at=now()`,
      [ctx.fileId, sealed]);
    res.json({ ok: true, count: words.length });
  } catch (e) {
    console.error("[keywords] failed:", (e as Error).message);
    res.status(500).json({ error: "Could not extract keywords" });
  } finally {

    ctx.plain.fill(0);
  }
});

aiRouter.get("/ai/keywords", async (req: AuthedRequest, res: Response) => {
  const r = await pool.query(
    `SELECT k.file_id, k.keywords_enc FROM file_keywords k
       JOIN files f ON f.id = k.file_id
      WHERE f.user_id=$1 AND (f.expires_at IS NULL OR f.expires_at > now())`, [req.userId]);
  res.json({ keywords: r.rows.map((x) => ({ file_id: x.file_id, keywords_enc: b64(x.keywords_enc) })) });
});

aiRouter.get("/ai/embeddings", async (req: AuthedRequest, res: Response) => {
  const r = await pool.query(
    `SELECT e.file_id, e.embedding_enc, e.source FROM file_embeddings e
       JOIN files f ON f.id = e.file_id
      WHERE f.user_id=$1 AND (f.expires_at IS NULL OR f.expires_at > now())`, [req.userId]);
  res.json({ embeddings: r.rows.map((x) => ({ file_id: x.file_id, embedding_enc: b64(x.embedding_enc), source: x.source })) });
});

aiRouter.post("/ai/embed-query", json, async (req: AuthedRequest, res: Response) => {
  if (!semanticEnabled()) return res.status(503).json({ error: "Semantic search is not enabled" });
  if (!(await getPrefs(req.userId as string)).semantic_search)
    return res.status(403).json({ error: "Semantic search is turned off" });
  const text = typeof req.body?.q === "string" ? req.body.q.trim() : "";
  if (!text) return res.status(400).json({ error: "q is required" });
  try { res.json({ vector: await embed(text, "query") }); }
  catch (e) {
    if (e instanceof AiEmptyResultError)
      return res.status(422).json({ error: "The model couldn't describe this file" });
    if (e instanceof AiUnavailableError) return res.status(503).json({ error: "AI model is unavailable" });
    console.error("[embed-query] failed:", (e as Error).message);
    res.status(500).json({ error: "Could not embed query" });
  }
});

export default aiRouter;
