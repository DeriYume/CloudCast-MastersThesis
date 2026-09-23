import { Router, Response } from "express";
import express from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { promises as fs, mkdirSync, createReadStream } from "fs";
import path from "path";
import { pool } from "./db";
import { requireAuth, AuthedRequest } from "./auth";
import { envStr, envNum } from "./env";

export const router = Router();

const STORAGE_DIR = envStr("STORAGE_DIR");
const TEMP_DIR = "/tmp/cloudcast-uploads";
mkdirSync(STORAGE_DIR, { recursive: true });
mkdirSync(TEMP_DIR, { recursive: true });

const json = express.json({ limit: "2mb" });

const upload = multer({
  storage: multer.diskStorage({ destination: STORAGE_DIR, filename: (_r, _f, cb) => cb(null, randomUUID()) }),
  limits: { fileSize: envNum("MAX_UPLOAD_MB") * 1024 * 1024 },
});

router.use(requireAuth);

const b64 = (b: Buffer | null): string | null => (b ? b.toString("base64") : null);
const fromB64 = (s: unknown): Buffer | null =>
  typeof s === "string" && s.length > 0 ? Buffer.from(s, "base64") : null;

const sseClients = new Map<string, Set<Response>>();
export function notifyUser(userId: string, event = "notification"): void {
  const set = sseClients.get(userId);
  if (!set) return;
  for (const res of set) { try { res.write(`event: ${event}\ndata: {}\n\n`); } catch {  } }
}

function fileToApi(row: any, wrappedDek?: Buffer | null, metaSealed?: Buffer | null) {
  return {
    id: row.id,
    folder_id: row.folder_id,
    meta_enc: b64(row.meta_enc ?? null),
    meta_sealed: metaSealed !== undefined ? b64(metaSealed) : undefined,
    wrapped_dek: wrappedDek !== undefined ? b64(wrappedDek) : undefined,
    size_bytes: Number(row.size_bytes),
    expires_at: row.expires_at,
    created_at: row.created_at,
  };
}

const folderToApi = (r: any, nameSealed?: Buffer | null) => ({
  id: r.id, parent_id: r.parent_id, name_enc: b64(r.name_enc ?? null),
  name_sealed: nameSealed !== undefined ? b64(nameSealed) : undefined,
  expires_at: r.expires_at, created_at: r.created_at,
});

function parseExpiry(raw: unknown): { value: Date | null } | { error: string } {
  if (raw === null) return { value: null };
  if (typeof raw !== "string") return { error: "expires_at must be an ISO date string or null" };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { error: "expires_at is not a valid date" };
  if (d.getTime() <= Date.now()) return { error: "expires_at must be in the future" };
  return { value: d };
}

const parsePermission = (raw: unknown): "view" | "save" =>
  raw === "save" ? "save" : "view";

async function userOwnsFolder(userId: string, folderId: string): Promise<boolean> {
  try {
    const r = await pool.query("SELECT 1 FROM folders WHERE id = $1 AND user_id = $2", [folderId, userId]);
    return (r.rowCount ?? 0) > 0;
  } catch { return false; }
}

export async function accessibleFile(requesterId: string, fileId: string) {
  try {
    const r = await pool.query(
      `WITH RECURSIVE ancestors AS (
          SELECT folder_id AS fid FROM files WHERE id = $1
          UNION ALL
          SELECT fo.parent_id FROM folders fo JOIN ancestors a ON fo.id = a.fid WHERE a.fid IS NOT NULL
       )
       SELECT f.id, f.user_id, f.folder_id, f.meta_enc, f.stored_name, f.size_bytes,
              f.expires_at, f.created_at,
              sk.wrapped_dek AS caller_wrapped_dek,
              sk.meta_sealed AS caller_meta_sealed,
              CASE WHEN f.user_id = $2 THEN 'owner' ELSE (
                SELECT s.permission FROM shares s
                 WHERE s.shared_with = $2 AND (s.expires_at IS NULL OR s.expires_at > now())
                   AND (s.file_id = f.id OR s.folder_id IN (SELECT fid FROM ancestors WHERE fid IS NOT NULL))
                 ORDER BY CASE s.permission WHEN 'save' THEN 2 ELSE 1 END DESC LIMIT 1
              ) END AS access_permission,
              (SELECT s.sharer_label FROM shares s
                 WHERE s.shared_with = $2 AND (s.expires_at IS NULL OR s.expires_at > now())
                   AND (s.file_id = f.id OR s.folder_id IN (SELECT fid FROM ancestors WHERE fid IS NOT NULL))
                 ORDER BY CASE s.permission WHEN 'save' THEN 2 ELSE 1 END DESC LIMIT 1
              ) AS caller_sharer_label,
              -- Effective end of a recipient's access: the share's own expiry, or the owner's
              -- pending deletion, whichever comes first. Same rule as /shared-with-me; NULL for
              -- the owner's own file. LEAST() ignores NULLs, so either side alone still works.
              CASE WHEN f.user_id = $2 THEN NULL ELSE (
                SELECT LEAST(s.expires_at, ou.purge_after) FROM shares s
                  JOIN users ou ON ou.id = s.owner_id
                 WHERE s.shared_with = $2 AND (s.expires_at IS NULL OR s.expires_at > now())
                   AND (s.file_id = f.id OR s.folder_id IN (SELECT fid FROM ancestors WHERE fid IS NOT NULL))
                 ORDER BY CASE s.permission WHEN 'save' THEN 2 ELSE 1 END DESC LIMIT 1
              ) END AS caller_share_expires_at
         FROM files f
         LEFT JOIN file_keys sk ON sk.file_id = f.id AND sk.user_id = $2
        WHERE f.id = $1
          AND (f.expires_at IS NULL OR f.expires_at > now())
          AND NOT EXISTS (
            SELECT 1 FROM folders af
             WHERE af.id IN (SELECT fid FROM ancestors WHERE fid IS NOT NULL)
               AND af.expires_at IS NOT NULL AND af.expires_at <= now())
          AND (f.user_id = $2 OR EXISTS (
            SELECT 1 FROM shares s WHERE s.shared_with = $2
               AND (s.expires_at IS NULL OR s.expires_at > now())
               AND (s.file_id = f.id OR s.folder_id IN (SELECT fid FROM ancestors WHERE fid IS NOT NULL))))`,
      [fileId, requesterId]
    );
    return r.rows[0] ?? null;
  } catch { return null; }
}

async function accessibleFolder(requesterId: string, folderId: string) {
  try {
    const r = await pool.query(
      `WITH RECURSIVE chain AS (
          SELECT id, parent_id, expires_at FROM folders WHERE id = $1
          UNION ALL
          SELECT fo.id, fo.parent_id, fo.expires_at FROM folders fo JOIN chain c ON fo.id = c.parent_id
       )
       SELECT id, parent_id, name_enc, expires_at, created_at,
              (SELECT s.meta_sealed FROM shares s
                 WHERE s.folder_id = folders.id AND s.shared_with = $2
                   AND (s.expires_at IS NULL OR s.expires_at > now()) LIMIT 1) AS caller_name_sealed,
              CASE WHEN folders.user_id = $2 THEN 'owner' ELSE (
                SELECT s.permission FROM shares s
                 WHERE s.shared_with = $2 AND (s.expires_at IS NULL OR s.expires_at > now())
                   AND s.folder_id IN (SELECT id FROM chain)
                 ORDER BY CASE s.permission WHEN 'save' THEN 2 ELSE 1 END DESC LIMIT 1
              ) END AS access_permission
         FROM folders
        WHERE id = $1
          AND NOT EXISTS (SELECT 1 FROM chain WHERE expires_at IS NOT NULL AND expires_at <= now())
          AND (user_id = $2 OR EXISTS (
            SELECT 1 FROM shares s WHERE s.shared_with = $2
               AND (s.expires_at IS NULL OR s.expires_at > now())
               AND s.folder_id IN (SELECT id FROM chain)))`,
      [folderId, requesterId]
    );
    return r.rows[0] ?? null;
  } catch { return null; }
}

async function unlinkBlob(storedName: string): Promise<void> {
  await fs.unlink(path.join(STORAGE_DIR, storedName)).catch(() => {});
}

router.get("/folders", async (req: AuthedRequest, res: Response) => {
  const r = await pool.query(
    "SELECT id, parent_id, name_enc, expires_at, created_at FROM folders WHERE user_id = $1 ORDER BY created_at",
    [req.userId]
  );
  res.json({ folders: r.rows.map((f) => folderToApi(f)) });
});

router.post("/folders", json, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const nameEnc = fromB64(req.body?.name_enc);
  if (!nameEnc) return res.status(400).json({ error: "name_enc (base64) required" });
  const parentId = req.body?.parent_id ? String(req.body.parent_id) : null;
  if (parentId && !(await userOwnsFolder(userId, parentId)))
    return res.status(404).json({ error: "Parent folder not found" });
  const r = await pool.query(
    "INSERT INTO folders (user_id, parent_id, name_enc) VALUES ($1,$2,$3) RETURNING id, parent_id, name_enc, expires_at, created_at",
    [userId, parentId, nameEnc]
  );
  notifyUser(userId, "files");
  res.status(201).json({ folder: folderToApi(r.rows[0]) });
});

router.patch("/folders/:id", json, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const id = req.params.id;
  const body = req.body ?? {};
  const sets: string[] = [];
  const vals: (Buffer | string | Date | null)[] = [];
  let i = 1;
  if ("name_enc" in body) {
    const n = fromB64(body.name_enc);
    if (!n) return res.status(400).json({ error: "name_enc must be base64" });
    sets.push(`name_enc = $${i++}`); vals.push(n);
  }
  if ("parent_id" in body) {
    const dest = body.parent_id ? String(body.parent_id) : null;
    if (dest) {
      if (dest === id) return res.status(400).json({ error: "A folder can't be its own parent" });
      if (!(await userOwnsFolder(userId, dest))) return res.status(404).json({ error: "Parent folder not found" });
      const cycle = await pool.query(
        `WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id=$1 AND user_id=$2
           UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id)
         SELECT 1 FROM sub WHERE id=$3`, [id, userId, dest]);
      if (cycle.rowCount) return res.status(400).json({ error: "Can't move a folder inside itself" });
    }
    sets.push(`parent_id = $${i++}`); vals.push(dest);
  }
  if ("expires_at" in body) {
    const p = parseExpiry(body.expires_at);
    if ("error" in p) return res.status(400).json({ error: p.error });
    sets.push(`expires_at = $${i++}`); vals.push(p.value);
  }
  if (!sets.length) return res.status(400).json({ error: "Nothing to update" });
  vals.push(id, userId);
  const r = await pool.query(
    `UPDATE folders SET ${sets.join(", ")} WHERE id=$${i++} AND user_id=$${i} RETURNING id, parent_id, name_enc, expires_at, created_at`,
    vals
  );
  if (!r.rows[0]) return res.status(404).json({ error: "Not found" });
  notifyUser(userId, "files");
  res.json({ folder: folderToApi(r.rows[0]) });
});

router.delete("/folders/:id", async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const id = req.params.id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query("SELECT 1 FROM folders WHERE id=$1 AND user_id=$2", [id, userId]);
    if (!owned.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
    const blobs = await client.query(
      `WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id=$1 AND user_id=$2
         UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id)
       SELECT stored_name FROM files WHERE user_id=$2 AND folder_id IN (SELECT id FROM sub)`,
      [id, userId]);
    await client.query("DELETE FROM folders WHERE id=$1 AND user_id=$2", [id, userId]);
    await client.query("COMMIT");
    await Promise.all(blobs.rows.map((b: { stored_name: string }) => unlinkBlob(b.stored_name)));
    notifyUser(userId, "files");
    res.json({ deleted: true });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: "Failed to delete folder" });
  } finally { client.release(); }
});

router.get("/folders/:id", async (req: AuthedRequest, res: Response) => {
  const folder = await accessibleFolder(req.userId as string, req.params.id);
  if (!folder) return res.status(404).json({ error: "Not found" });

  res.json({ folder: { ...folderToApi(folder, folder.caller_name_sealed ?? null), permission: folder.access_permission } });
});

router.get("/folders/:id/files", async (req: AuthedRequest, res: Response) => {
  const folder = await accessibleFolder(req.userId as string, req.params.id);
  if (!folder) return res.status(404).json({ error: "Not found" });

  const r = await pool.query(
    `SELECT f.id, f.folder_id, f.meta_enc, f.size_bytes,
            f.expires_at, f.created_at, sk.meta_sealed AS caller_meta_sealed
       FROM files f LEFT JOIN file_keys sk ON sk.file_id=f.id AND sk.user_id=$2
      WHERE f.folder_id=$1 AND (f.expires_at IS NULL OR f.expires_at > now()) ORDER BY f.created_at DESC`,
    [req.params.id, req.userId]);
  res.json({ files: r.rows.map((row) => fileToApi(row, undefined, row.caller_meta_sealed ?? null)) });
});

router.get("/folders/:id/subfolders", async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const parent = await accessibleFolder(userId, req.params.id);
  if (!parent) return res.status(404).json({ error: "Not found" });
  const r = await pool.query(
    `SELECT fo.id, fo.parent_id, fo.name_enc, fo.expires_at, fo.created_at,
            (SELECT s.meta_sealed FROM shares s
               WHERE s.folder_id = fo.id AND s.shared_with = $2
                 AND (s.expires_at IS NULL OR s.expires_at > now()) LIMIT 1) AS caller_name_sealed
       FROM folders fo
      WHERE fo.parent_id = $1
        AND (fo.expires_at IS NULL OR fo.expires_at > now())
        AND (fo.user_id = $2 OR EXISTS (
              SELECT 1 FROM shares s WHERE s.folder_id = fo.id AND s.shared_with = $2
                AND (s.expires_at IS NULL OR s.expires_at > now())))
      ORDER BY fo.created_at`,
    [req.params.id, userId]);
  res.json({ folders: r.rows.map((row) => folderToApi(row, row.caller_name_sealed ?? null)) });
});

router.get("/", async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const all = req.query.all === "true";
  const folder = typeof req.query.folder === "string" ? req.query.folder : null;
  const notExpired = "(expires_at IS NULL OR expires_at > now())";
  const cols = "id, folder_id, meta_enc, size_bytes, expires_at, created_at";
  let r;
  if (all)

    r = await pool.query(`SELECT ${cols} FROM files WHERE user_id=$1 AND ${notExpired} ORDER BY created_at DESC`, [userId]);

  else if (folder) {
    if (!(await userOwnsFolder(userId, folder))) return res.status(404).json({ error: "Not found" });
    r = await pool.query(`SELECT ${cols} FROM files WHERE user_id=$1 AND folder_id=$2 AND ${notExpired} ORDER BY created_at DESC`, [userId, folder]);
  } else
    r = await pool.query(`SELECT ${cols} FROM files WHERE user_id=$1 AND folder_id IS NULL AND ${notExpired} ORDER BY created_at DESC`, [userId]);
  res.json({ files: r.rows.map((row) => fileToApi(row)) });
});

async function deletionScheduled(userId: string): Promise<boolean> {
  const r = await pool.query(
    "SELECT 1 FROM users WHERE id=$1 AND purge_after IS NOT NULL AND purge_after > now()",
    [userId]);
  return (r.rowCount ?? 0) > 0;
}

router.post("/", upload.single("file"), async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });
  if (await deletionScheduled(userId)) {
    await fs.unlink(file.path).catch(() => {});
    return res.status(409).json({ error: "Account deletion is scheduled. Cancel it before uploading new files." });
  }
  const metaEnc = fromB64(req.body?.meta_enc);
  const wrappedDek = fromB64(req.body?.wrapped_dek);
  const size = Number(req.body?.size_bytes);
  const folderId = req.body?.folder_id ? String(req.body.folder_id) : null;
  if (!metaEnc || !wrappedDek || !Number.isFinite(size)) {
    await fs.unlink(file.path).catch(() => {});
    return res.status(400).json({ error: "meta_enc, wrapped_dek and size_bytes are required" });
  }
  if (folderId && !(await userOwnsFolder(userId, folderId))) {
    await fs.unlink(file.path).catch(() => {});
    return res.status(404).json({ error: "Folder not found" });
  }

  const storedName = file.filename;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      `INSERT INTO files (user_id, folder_id, meta_enc, stored_name, size_bytes)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, folder_id, meta_enc, size_bytes, expires_at, created_at`,
      [userId, folderId, metaEnc, storedName, size]);
    await client.query("INSERT INTO file_keys (file_id, user_id, wrapped_dek) VALUES ($1,$2,$3)",
      [r.rows[0].id, userId, wrappedDek]);
    await client.query("COMMIT");
    notifyUser(userId, "files");
    res.status(201).json({ file: fileToApi(r.rows[0]) });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    await unlinkBlob(storedName);
    console.error("[file-service] upload insert failed:", e);
    res.status(500).json({ error: "Could not save file" });
  } finally { client.release(); }
});

router.post("/shares", json, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const b = req.body ?? {};
  const fileId = b.file_id ? String(b.file_id) : null;
  const folderId = b.folder_id ? String(b.folder_id) : null;
  if ((fileId ? 1 : 0) + (folderId ? 1 : 0) !== 1)
    return res.status(400).json({ error: "Provide exactly one of file_id or folder_id" });
  const recipientId = b.recipient_id ? String(b.recipient_id) : null;
  if (!recipientId) return res.status(400).json({ error: "recipient_id is required" });
  if (recipientId === userId) return res.status(400).json({ error: "You can't share with yourself" });
  const permission = parsePermission(b.permission);
  let expiresAt: Date | null = null;
  if (b.expires_at != null) {
    const p = parseExpiry(b.expires_at);
    if ("error" in p) return res.status(400).json({ error: p.error });
    expiresAt = p.value;
  }
  const owns = fileId
    ? await pool.query("SELECT 1 FROM files WHERE id=$1 AND user_id=$2", [fileId, userId])
    : await pool.query("SELECT 1 FROM folders WHERE id=$1 AND user_id=$2", [folderId, userId]);
  if (!owns.rowCount) return res.status(404).json({ error: "Not found" });

  const metaSealed = fromB64(b.meta_sealed);
  const recipientLabel = fromB64(b.recipient_label);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const conflict = fileId
      ? "(file_id, shared_with) WHERE file_id IS NOT NULL"
      : "(folder_id, shared_with) WHERE folder_id IS NOT NULL";
    const sharerLabel = fromB64(b.sharer_label);
    const share = await client.query(
      `INSERT INTO shares (owner_id, file_id, folder_id, shared_with, meta_sealed, recipient_label, sharer_label, expires_at, permission)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT ${conflict}
       DO UPDATE SET expires_at=EXCLUDED.expires_at, permission=EXCLUDED.permission,
                     meta_sealed=EXCLUDED.meta_sealed, recipient_label=EXCLUDED.recipient_label,
                     sharer_label=EXCLUDED.sharer_label
       RETURNING id, shared_with AS recipient_id, expires_at, permission, created_at`,
      [userId, fileId, folderId, recipientId, metaSealed, recipientLabel, sharerLabel, expiresAt, permission]);

    if (fileId) {
      const wd = fromB64(b.wrapped_dek);
      if (!wd) throw Object.assign(new Error("wrapped_dek required for a file share"), { http: 400 });
      await client.query(
        `INSERT INTO file_keys (file_id, user_id, wrapped_dek, meta_sealed) VALUES ($1,$2,$3,$4)
         ON CONFLICT (file_id, user_id) DO UPDATE SET wrapped_dek=EXCLUDED.wrapped_dek, meta_sealed=EXCLUDED.meta_sealed`,
        [fileId, recipientId, wd, metaSealed]);
    } else if (Array.isArray(b.keys)) {
      for (const k of b.keys) {
        const wd = fromB64(k?.wrapped_dek);
        if (!k?.file_id || !wd) continue;
        await client.query(
          `INSERT INTO file_keys (file_id, user_id, wrapped_dek, meta_sealed) VALUES ($1,$2,$3,$4)
           ON CONFLICT (file_id, user_id) DO UPDATE SET wrapped_dek=EXCLUDED.wrapped_dek, meta_sealed=EXCLUDED.meta_sealed`,
          [String(k.file_id), recipientId, wd, fromB64(k.meta_sealed)]);
      }
    }

    if (folderId && Array.isArray(b.folder_keys)) {
      for (const fk of b.folder_keys) {
        const ns = fromB64(fk?.meta_sealed);
        if (!fk?.folder_id || !ns) continue;
        await client.query(
          `INSERT INTO shares (owner_id, file_id, folder_id, shared_with, meta_sealed, recipient_label, expires_at, permission)
           VALUES ($1,NULL,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (folder_id, shared_with) WHERE folder_id IS NOT NULL
           DO UPDATE SET meta_sealed=EXCLUDED.meta_sealed, expires_at=EXCLUDED.expires_at, permission=EXCLUDED.permission`,
          [userId, String(fk.folder_id), recipientId, ns, recipientLabel, expiresAt, permission]);
      }
    }

    await client.query(
      `INSERT INTO notifications (user_id, type, file_id, folder_id)
       VALUES ($1,'share',$2,$3)`, [recipientId, fileId, folderId]);
    await client.query("COMMIT");
    notifyUser(recipientId);

    notifyUser(recipientId, "files");
    notifyUser(userId, "files");
    res.status(201).json({ share: share.rows[0] });
  } catch (e: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (e?.http === 400) return res.status(400).json({ error: e.message });
    console.error("[file-service] share failed:", e);
    res.status(500).json({ error: "Could not create share" });
  } finally { client.release(); }
});

router.get("/shares", async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const fileId = typeof req.query.file_id === "string" ? req.query.file_id : null;
  const folderId = typeof req.query.folder_id === "string" ? req.query.folder_id : null;
  if ((fileId ? 1 : 0) + (folderId ? 1 : 0) !== 1)
    return res.status(400).json({ error: "Provide exactly one of file_id or folder_id" });
  const col = fileId ? "file_id" : "folder_id";
  try {
    const r = await pool.query(
      `SELECT id, shared_with AS recipient_id, recipient_label, expires_at, permission, created_at
         FROM shares WHERE owner_id=$1 AND ${col}=$2 ORDER BY created_at`,
      [userId, fileId ?? folderId]);
    res.json({ shares: r.rows.map((row) => ({ ...row, recipient_label: b64(row.recipient_label ?? null) })) });
  } catch (e) {
    console.error("[file-service] list shares failed:", e);
    res.status(500).json({ error: "Could not load recipients" });
  }
});

router.patch("/shares/:shareId", json, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const b = req.body ?? {};
  const hasPermission = b.permission !== undefined;
  const clearExpiry = b.clear_expiry === true;
  const hasExpiry = clearExpiry || Object.prototype.hasOwnProperty.call(b, "expires_at");
  if (!hasPermission && !hasExpiry)
    return res.status(400).json({ error: "Nothing to update" });
  if (hasPermission && !["view", "save"].includes(b.permission))
    return res.status(400).json({ error: "permission must be view or save" });
  let expiresAt: Date | null = null;
  if (hasExpiry && !clearExpiry && b.expires_at != null) {
    const p = parseExpiry(b.expires_at);
    if ("error" in p) return res.status(400).json({ error: p.error });
    expiresAt = p.value;
  }
  const permission = hasPermission ? b.permission : null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const upd = await client.query(
      `UPDATE shares
          SET permission = COALESCE($3, permission),
              expires_at = CASE WHEN $4 THEN $5 ELSE expires_at END
        WHERE id=$1 AND owner_id=$2
        RETURNING id, folder_id, shared_with, expires_at, permission`,
      [req.params.shareId, userId, permission, hasExpiry, expiresAt]);
    const row = upd.rows[0];
    if (!row) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
    if (row.folder_id) {
      await client.query(
        `WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id=$1
           UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id)
         UPDATE shares
            SET permission = COALESCE($3, permission),
                expires_at = CASE WHEN $4 THEN $5 ELSE expires_at END
          WHERE shared_with=$2 AND folder_id IN (SELECT id FROM sub)`,
        [row.folder_id, row.shared_with, permission, hasExpiry, expiresAt]);
    }
    await client.query("COMMIT");
    notifyUser(userId, "files");
    notifyUser(String(row.shared_with), "files");
    res.json({ share: { id: row.id, recipient_id: row.shared_with, expires_at: row.expires_at, permission: row.permission } });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[file-service] update share failed:", e);
    res.status(500).json({ error: "Could not update share" });
  } finally { client.release(); }
});

router.delete("/shares/:shareId", async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const del = await client.query(
      "DELETE FROM shares WHERE id=$1 AND owner_id=$2 RETURNING file_id, folder_id, shared_with", [req.params.shareId, userId]);
    const row = del.rows[0];
    if (!row) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
    if (row.file_id) {
      await client.query("DELETE FROM file_keys WHERE file_id=$1 AND user_id=$2", [row.file_id, row.shared_with]);
    } else if (row.folder_id) {
      await client.query(
        `WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id=$1
           UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id)
         DELETE FROM file_keys WHERE user_id=$2 AND file_id IN (SELECT id FROM files WHERE folder_id IN (SELECT id FROM sub))`,
        [row.folder_id, row.shared_with]);

      await client.query(
        `WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id=$1
           UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id)
         DELETE FROM shares WHERE shared_with=$2 AND folder_id IN (SELECT id FROM sub)`,
        [row.folder_id, row.shared_with]);
    }
    await client.query("COMMIT");
    notifyUser(userId, "files");
    notifyUser(String(row.shared_with), "files");
    res.json({ deleted: true });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: "Could not revoke share" });
  } finally { client.release(); }
});

router.post("/leave", json, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const b = req.body ?? {};
  const fileId = b.file_id ? String(b.file_id) : null;
  const folderId = b.folder_id ? String(b.folder_id) : null;
  if ((fileId ? 1 : 0) + (folderId ? 1 : 0) !== 1)
    return res.status(400).json({ error: "Provide exactly one of file_id or folder_id" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (fileId) {
      await client.query("DELETE FROM shares WHERE shared_with=$1 AND file_id=$2", [userId, fileId]);
      await client.query("DELETE FROM file_keys WHERE user_id=$1 AND file_id=$2", [userId, fileId]);
    } else {
      await client.query(
        `WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id=$2
           UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id)
         DELETE FROM file_keys WHERE user_id=$1 AND file_id IN (SELECT id FROM files WHERE folder_id IN (SELECT id FROM sub))`,
        [userId, folderId]);
      await client.query(
        `WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id=$2
           UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id)
         DELETE FROM shares WHERE shared_with=$1 AND folder_id IN (SELECT id FROM sub)`,
        [userId, folderId]);
    }
    await client.query("COMMIT");
    res.json({ left: true });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[file-service] leave share failed:", e);
    res.status(500).json({ error: "Could not remove from your list" });
  } finally { client.release(); }
});

router.post("/unshare", json, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const b = req.body ?? {};
  const fileId = b.file_id ? String(b.file_id) : null;
  const folderId = b.folder_id ? String(b.folder_id) : null;
  if ((fileId ? 1 : 0) + (folderId ? 1 : 0) !== 1)
    return res.status(400).json({ error: "Provide exactly one of file_id or folder_id" });
  const owns = fileId
    ? await pool.query("SELECT 1 FROM files WHERE id=$1 AND user_id=$2", [fileId, userId])
    : await pool.query("SELECT 1 FROM folders WHERE id=$1 AND user_id=$2", [folderId, userId]);
  if (!owns.rowCount) return res.status(404).json({ error: "Not found" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (fileId) {
      await client.query("DELETE FROM shares WHERE owner_id=$1 AND file_id=$2", [userId, fileId]);
      await client.query("DELETE FROM file_keys WHERE file_id=$1 AND user_id<>$2", [fileId, userId]);
    } else {
      await client.query(
        `WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id=$2
           UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id)
         DELETE FROM file_keys WHERE user_id<>$1 AND file_id IN (SELECT id FROM files WHERE folder_id IN (SELECT id FROM sub))`,
        [userId, folderId]);
      await client.query(
        `WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id=$2
           UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id)
         DELETE FROM shares WHERE owner_id=$1 AND folder_id IN (SELECT id FROM sub)`,
        [userId, folderId]);
    }
    await client.query("COMMIT");
    res.json({ unshared: true });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[file-service] unshare failed:", e);
    res.status(500).json({ error: "Could not stop sharing" });
  } finally { client.release(); }
});

router.post("/share-expiry", json, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const b = req.body ?? {};
  const fileId = b.file_id ? String(b.file_id) : null;
  const folderId = b.folder_id ? String(b.folder_id) : null;
  if ((fileId ? 1 : 0) + (folderId ? 1 : 0) !== 1)
    return res.status(400).json({ error: "Provide exactly one of file_id or folder_id" });
  let expiresAt: Date | null = null;
  if (b.expires_at != null) {
    const p = parseExpiry(b.expires_at);
    if ("error" in p) return res.status(400).json({ error: p.error });
    expiresAt = p.value;
  }
  try {
    if (fileId) {
      await pool.query("UPDATE shares SET expires_at=$3 WHERE owner_id=$1 AND file_id=$2", [userId, fileId, expiresAt]);
    } else {
      await pool.query(
        `WITH RECURSIVE sub AS (SELECT id FROM folders WHERE id=$2
           UNION ALL SELECT f.id FROM folders f JOIN sub s ON f.parent_id=s.id)
         UPDATE shares SET expires_at=$3 WHERE owner_id=$1 AND folder_id IN (SELECT id FROM sub)`,
        [userId, folderId, expiresAt]);
    }
    res.json({ updated: true });
  } catch (e) {
    console.error("[file-service] share-expiry failed:", e);
    res.status(500).json({ error: "Could not update share expiry" });
  }
});

router.get("/shared-with-me", async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const files = await pool.query(
    `SELECT f.id, f.folder_id, f.size_bytes, f.expires_at, f.created_at,
            sk.wrapped_dek, sk.meta_sealed, s.owner_id AS shared_by_id, s.sharer_label, s.permission,
            LEAST(s.expires_at, ou.purge_after) AS share_expires_at
       FROM shares s JOIN files f ON f.id = s.file_id
       JOIN users ou ON ou.id = s.owner_id
       LEFT JOIN file_keys sk ON sk.file_id = f.id AND sk.user_id = $1
      WHERE s.shared_with=$1 AND s.file_id IS NOT NULL
        AND (s.expires_at IS NULL OR s.expires_at > now()) AND (f.expires_at IS NULL OR f.expires_at > now())
      ORDER BY f.created_at DESC`, [userId]);
  const folders = await pool.query(
    `SELECT fo.id, fo.parent_id, fo.expires_at, fo.created_at, s.meta_sealed AS name_sealed,
            s.owner_id AS shared_by_id, s.sharer_label, s.permission,
            LEAST(s.expires_at, ou.purge_after) AS share_expires_at
       FROM shares s JOIN folders fo ON fo.id = s.folder_id
       JOIN users ou ON ou.id = s.owner_id
      WHERE s.shared_with=$1 AND s.folder_id IS NOT NULL
        AND (s.expires_at IS NULL OR s.expires_at > now()) AND (fo.expires_at IS NULL OR fo.expires_at > now())
        -- topmost only: hide descendant subfolder shares (parent also shared to me)
        AND NOT EXISTS (SELECT 1 FROM shares sp WHERE sp.shared_with=$1 AND sp.folder_id = fo.parent_id
                          AND (sp.expires_at IS NULL OR sp.expires_at > now()))
      ORDER BY fo.created_at DESC`, [userId]);
  res.json({
    files: files.rows.map((r) => ({
      ...fileToApi(r, r.wrapped_dek ?? null, r.meta_sealed ?? null),
      shared_by_id: r.shared_by_id, sharer_label: b64(r.sharer_label ?? null),
      permission: r.permission, share_expires_at: r.share_expires_at,
    })),
    folders: folders.rows.map((r) => ({
      id: r.id, parent_id: r.parent_id, name_sealed: b64(r.name_sealed ?? null), expires_at: r.expires_at,
      created_at: r.created_at, shared_by_id: r.shared_by_id, sharer_label: b64(r.sharer_label ?? null),
      permission: r.permission, share_expires_at: r.share_expires_at,
    })),
  });
});

router.get("/shared-by-me", async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const files = await pool.query(
    `SELECT f.id, f.folder_id, f.meta_enc, f.size_bytes, f.expires_at, f.created_at,
            COUNT(s.id)::int AS recipient_count
       FROM files f JOIN shares s ON s.file_id=f.id
      WHERE s.owner_id=$1 AND (s.expires_at IS NULL OR s.expires_at > now()) AND (f.expires_at IS NULL OR f.expires_at > now())
      GROUP BY f.id ORDER BY f.created_at DESC`, [userId]);
  const folders = await pool.query(
    `SELECT fo.id, fo.parent_id, fo.name_enc, fo.expires_at, fo.created_at, COUNT(s.id)::int AS recipient_count
       FROM folders fo JOIN shares s ON s.folder_id=fo.id
      WHERE s.owner_id=$1 AND (s.expires_at IS NULL OR s.expires_at > now()) AND (fo.expires_at IS NULL OR fo.expires_at > now())
        -- topmost only: hide descendant subfolder shares (parent also shared by me)
        AND NOT EXISTS (SELECT 1 FROM shares sp WHERE sp.owner_id=$1 AND sp.folder_id = fo.parent_id
                          AND (sp.expires_at IS NULL OR sp.expires_at > now()))
      GROUP BY fo.id ORDER BY fo.created_at DESC`, [userId]);
  res.json({
    files: files.rows.map((r) => ({ ...fileToApi(r), recipient_count: r.recipient_count })),
    folders: folders.rows.map((r) => ({ ...folderToApi(r), recipient_count: r.recipient_count })),
  });
});

router.get("/contacts", async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const r = await pool.query(
    `SELECT recipient_id, recipient_label FROM (
        SELECT DISTINCT ON (shared_with) shared_with AS recipient_id, recipient_label, created_at
          FROM shares WHERE owner_id=$1 AND recipient_label IS NOT NULL
         ORDER BY shared_with, created_at DESC
     ) t ORDER BY t.created_at DESC`, [userId]);
  res.json({ contacts: r.rows.map((row) => ({ recipient_id: row.recipient_id, recipient_label: b64(row.recipient_label) })) });
});

router.get("/expiring", async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const files = await pool.query(
    `SELECT id, folder_id, meta_enc, size_bytes, expires_at, created_at
       FROM files WHERE user_id=$1 AND expires_at IS NOT NULL AND expires_at > now() ORDER BY expires_at`, [userId]);
  const folders = await pool.query(
    `SELECT id, parent_id, name_enc, expires_at, created_at
       FROM folders WHERE user_id=$1 AND expires_at IS NOT NULL AND expires_at > now() ORDER BY expires_at`, [userId]);
  res.json({ files: files.rows.map((r) => fileToApi(r)), folders: folders.rows.map((f) => folderToApi(f)) });
});

router.get("/notifications/stream", (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write(":ok\n\n");

  let set = sseClients.get(userId);
  if (!set) { set = new Set(); sseClients.set(userId, set); }
  set.add(res);
  const heartbeat = setInterval(() => { try { res.write(":hb\n\n"); } catch {  } }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    set!.delete(res);
    if (set!.size === 0) sseClients.delete(userId);
  });
});

const BLOB_KINDS = new Set(["favorites"]);

const MAX_BLOB_BYTES = 256 * 1024;

router.get("/prefs/:kind", async (req: AuthedRequest, res: Response) => {
  const kind = String(req.params.kind);
  if (!BLOB_KINDS.has(kind)) return res.status(404).json({ error: "Unknown kind" });
  const r = await pool.query(
    "SELECT blob, revision FROM user_blobs WHERE user_id=$1 AND kind=$2", [req.userId, kind]);
  const row = r.rows[0];

  if (!row) return res.json({ blob: null, revision: 0 });
  res.json({ blob: b64(row.blob), revision: row.revision });
});

router.put("/prefs/:kind", json, async (req: AuthedRequest, res: Response) => {
  const kind = String(req.params.kind);
  if (!BLOB_KINDS.has(kind)) return res.status(404).json({ error: "Unknown kind" });
  const blob = fromB64(req.body?.blob);
  if (!blob) return res.status(400).json({ error: "blob must be base64" });
  if (blob.length > MAX_BLOB_BYTES) return res.status(413).json({ error: "Blob too large" });
  const expected = Number(req.body?.revision);
  if (!Number.isInteger(expected) || expected < 0)
    return res.status(400).json({ error: "revision must be a non-negative integer" });

  if (expected === 0) {

    const ins = await pool.query(
      `INSERT INTO user_blobs (user_id, kind, blob, revision) VALUES ($1,$2,$3,1)
       ON CONFLICT (user_id, kind) DO NOTHING RETURNING revision`,
      [req.userId, kind, blob]);
    if (!ins.rowCount) return res.status(409).json({ error: "Conflict - re-read and retry" });
    return res.json({ revision: ins.rows[0].revision });
  }

  const upd = await pool.query(
    `UPDATE user_blobs SET blob=$3, revision=revision+1, updated_at=now()
      WHERE user_id=$1 AND kind=$2 AND revision=$4 RETURNING revision`,
    [req.userId, kind, blob, expected]);
  if (!upd.rowCount) return res.status(409).json({ error: "Conflict - re-read and retry" });
  res.json({ revision: upd.rows[0].revision });
});

router.get("/notifications", async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const r = await pool.query(
    `SELECT id, type, file_id, folder_id, created_at
       FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [userId]);
  const total = await pool.query("SELECT COUNT(*)::int AS n FROM notifications WHERE user_id=$1", [userId]);
  res.json({ notifications: r.rows, unread: total.rows[0].n });
});

router.delete("/notifications/:id", async (req: AuthedRequest, res: Response) => {
  const r = await pool.query("DELETE FROM notifications WHERE id=$1 AND user_id=$2 RETURNING id", [req.params.id, req.userId]);
  if (!r.rowCount) return res.status(404).json({ error: "Not found" });
  res.json({ deleted: true });
});
router.delete("/notifications", async (req: AuthedRequest, res: Response) => {
  await pool.query("DELETE FROM notifications WHERE user_id=$1", [req.userId]);
  res.json({ deleted: true });
});

router.get("/:id", async (req: AuthedRequest, res: Response) => {
  const row = await accessibleFile(req.userId as string, req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });

  res.json({ file: {
    ...fileToApi(row, row.caller_wrapped_dek ?? null, row.caller_meta_sealed ?? null),
    permission: row.access_permission,
    sharer_label: b64(row.caller_sharer_label ?? null),
    share_expires_at: row.caller_share_expires_at ?? null,
  } });
});

router.get("/:id/content", async (req: AuthedRequest, res: Response) => {
  const row = await accessibleFile(req.userId as string, req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  const perm = row.access_permission;
  const inline = req.query.disposition === "inline";
  if (!inline && perm !== "owner" && perm !== "save")
    return res.status(403).json({ error: "You don't have permission to download this file" });

  const filePath = path.join(STORAGE_DIR, row.stored_name);
  let total: number;
  try { total = (await fs.stat(filePath)).size; } catch { return res.status(404).json({ error: "Blob missing" }); }

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Accept-Ranges", "bytes");
  const range = req.headers.range;
  if (!range) {
    res.setHeader("Content-Length", total);
    createReadStream(filePath).on("error", () => res.destroy()).pipe(res);
    return;
  }
  const m = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!m || (m[1] === "" && m[2] === "")) { res.setHeader("Content-Range", `bytes */${total}`); return res.status(416).end(); }
  let start = m[1] === "" ? total - parseInt(m[2], 10) : parseInt(m[1], 10);
  let end = m[1] === "" || m[2] === "" ? total - 1 : parseInt(m[2], 10);
  start = Math.max(0, start);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
    res.setHeader("Content-Range", `bytes */${total}`); return res.status(416).end();
  }
  end = Math.min(end, total - 1);
  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
  res.setHeader("Content-Length", end - start + 1);
  createReadStream(filePath, { start, end }).on("error", () => res.destroy()).pipe(res);
});

router.patch("/:id", json, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const id = req.params.id;
  const body = req.body ?? {};
  const sets: string[] = [];
  const vals: (Buffer | string | Date | boolean | null)[] = [];
  let i = 1;
  if ("meta_enc" in body) {
    const n = fromB64(body.meta_enc);
    if (!n) return res.status(400).json({ error: "meta_enc must be base64" });
    sets.push(`meta_enc=$${i++}`); vals.push(n);
  }
  if ("folder_id" in body) {
    const dest = body.folder_id ? String(body.folder_id) : null;
    if (dest && !(await userOwnsFolder(userId, dest))) return res.status(404).json({ error: "Folder not found" });
    sets.push(`folder_id=$${i++}`); vals.push(dest);
  }

  if ("expires_at" in body) {
    const p = parseExpiry(body.expires_at);
    if ("error" in p) return res.status(400).json({ error: p.error });
    sets.push(`expires_at=$${i++}`); vals.push(p.value);
  }
  if (!sets.length) return res.status(400).json({ error: "Nothing to update" });
  vals.push(id, userId);
  const r = await pool.query(
    `UPDATE files SET ${sets.join(", ")} WHERE id=$${i++} AND user_id=$${i}
     RETURNING id, folder_id, meta_enc, size_bytes, expires_at, created_at`, vals);
  if (!r.rows[0]) return res.status(404).json({ error: "Not found" });
  notifyUser(userId, "files");
  res.json({ file: fileToApi(r.rows[0]) });
});

router.delete("/:id", async (req: AuthedRequest, res: Response) => {
  const r = await pool.query("DELETE FROM files WHERE id=$1 AND user_id=$2 RETURNING stored_name", [req.params.id, req.userId]);
  if (!r.rows[0]) return res.status(404).json({ error: "Not found" });
  await unlinkBlob(r.rows[0].stored_name);
  notifyUser(req.userId as string, "files");
  res.json({ deleted: true });
});

router.post("/:id/save", json, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId as string;
  const row = await accessibleFile(userId, req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (!["owner", "save"].includes(row.access_permission))
    return res.status(403).json({ error: "You don't have permission to save this file" });
  const metaEnc = fromB64(req.body?.meta_enc);
  const wrappedDek = fromB64(req.body?.wrapped_dek);
  if (!metaEnc || !wrappedDek) return res.status(400).json({ error: "meta_enc and wrapped_dek are required" });
  const newStored = randomUUID();
  try { await fs.copyFile(path.join(STORAGE_DIR, row.stored_name), path.join(STORAGE_DIR, newStored)); }
  catch { return res.status(500).json({ error: "Could not save file" }); }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      `INSERT INTO files (user_id, folder_id, meta_enc, stored_name, size_bytes)
       VALUES ($1,NULL,$2,$3,$4)
       RETURNING id, folder_id, meta_enc, size_bytes, expires_at, created_at`,
      [userId, metaEnc, newStored, row.size_bytes]);
    await client.query("INSERT INTO file_keys (file_id, user_id, wrapped_dek) VALUES ($1,$2,$3)", [r.rows[0].id, userId, wrappedDek]);
    await client.query("COMMIT");
    notifyUser(userId, "files");
    res.status(201).json({ file: fileToApi(r.rows[0]) });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    await unlinkBlob(newStored);
    console.error("[file-service] save failed:", e);
    res.status(500).json({ error: "Could not save file" });
  } finally { client.release(); }
});

export default router;
