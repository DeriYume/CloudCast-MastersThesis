import { ready as cryptoReady } from "../features/crypto/sodium";
import * as session from "../features/crypto/session";
import { fileKind } from "../utils/util";
import { BASE, authHeaders, handle, req, type ApiError } from "./http";
import { UserError } from "../utils/errors";
import { getFile, listAllFiles } from "./files";

export interface AnalyzeResult {
  summary: string;
  model: string;
  cached: boolean;
  created_at?: string;
}

let serverPkCache: string | null = null;
async function serverPublicKey(token: string): Promise<string> {
  if (serverPkCache) return serverPkCache;
  const r = await req<{ public_key: string }>("GET", "/files/ai/server-key", token);
  serverPkCache = r.public_key as string;
  return serverPkCache;
}
async function mintGrant(token: string, id: string): Promise<string> {
  await cryptoReady();
  const { file } = await getFile(token, id);
  if (!file.wrapped_dek) throw new UserError("Missing decryption key for this file");
  const dek = session.openWrappedDek(file.wrapped_dek);
  return session.wrapDekForPub(dek, await serverPublicKey(token));
}

export async function analyzeFile(
  token: string,
  id: string,
  _refresh = false
): Promise<AnalyzeResult> {
  const wrapped_dek_for_server = await mintGrant(token, id);
  const r = await req<{ summary_sealed: string }>("POST", `/files/${id}/analyze`, token, {
    wrapped_dek_for_server,
  });

  return { summary: session.openNameSealedToMe(r.summary_sealed), model: "local", cached: false };
}

export interface ClassifyResult {

  category: string;

  folder: string | null;
}

export async function classifyFile(
  token: string,
  id: string,
  timeoutMs = 20_000
): Promise<ClassifyResult> {
  const wrapped_dek_for_server = await mintGrant(token, id);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let r;
  try {
    r = await handle(
      await fetch(`${BASE}/files/${id}/classify`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ wrapped_dek_for_server }),
        signal: ctrl.signal,
      })
    );
  } finally {
    clearTimeout(timer);
  }
  const category = session.openNameSealedToMe(r.category_sealed);
  return { category, folder: category === "Other" ? null : category };
}


export function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
export async function fetchEmbeddings(token: string): Promise<{ file_id: string; vec: Float32Array }[]> {
  await cryptoReady();
  const r = await req<{ embeddings?: { file_id: string; embedding_enc: string }[] }>(
    "GET", "/files/ai/embeddings", token
  );
  return (r.embeddings ?? []).map((e: { file_id: string; embedding_enc: string }) => {
    const bytes = session.openSealedBytesToMe(e.embedding_enc);

    return { file_id: e.file_id, vec: new Float32Array(bytes.slice().buffer) };
  });
}

export async function embedFile(token: string, id: string): Promise<void> {
  const wrapped_dek_for_server = await mintGrant(token, id);
  await req("POST", `/files/${id}/embed`, token, { wrapped_dek_for_server });
}

export async function extractKeywords(token: string, id: string): Promise<boolean> {
  const wrapped_dek_for_server = await mintGrant(token, id);
  const r = await req<{ ok?: boolean; skipped?: boolean }>(
    "POST", `/files/${id}/keywords`, token, { wrapped_dek_for_server }
  );

  return Boolean(r.ok) && !r.skipped;
}

export async function fetchKeywords(token: string): Promise<Map<string, string[]>> {
  await cryptoReady();
  const r = await req<{ keywords?: { file_id: string; keywords_enc: string }[] }>(
    "GET", "/files/ai/keywords", token
  );
  const out = new Map<string, string[]>();
  for (const k of (r.keywords ?? []) as { file_id: string; keywords_enc: string }[]) {
    try {
      const json = new TextDecoder().decode(session.openSealedBytesToMe(k.keywords_enc));
      const words = JSON.parse(json);
      if (Array.isArray(words)) out.set(k.file_id, words as string[]);
    } catch {  }
  }
  return out;
}

export interface FilingSuggestion { embedding: Float32Array; suggestedName: string; }

export async function suggestFiling(token: string, id: string): Promise<FilingSuggestion> {
  const wrapped_dek_for_server = await mintGrant(token, id);
  const r = await req<{ embedding_enc: string; suggested_name_enc: string }>(
    "POST", `/files/${id}/filing`, token, { wrapped_dek_for_server }
  );
  const bytes = session.openSealedBytesToMe(r.embedding_enc);
  return {
    embedding: new Float32Array(bytes.slice().buffer),
    suggestedName: session.openNameSealedToMe(r.suggested_name_enc),
  };
}

export async function getFolderCentroids(token: string): Promise<Map<string, Float32Array>> {
  const [all, embeddings] = await Promise.all([listAllFiles(token), fetchEmbeddings(token)]);
  const folderOf = new Map(all.map((f) => [f.id, f.folder_id]));
  const acc = new Map<string, { sum: Float32Array; n: number }>();
  for (const e of embeddings) {
    const folderId = folderOf.get(e.file_id);
    if (!folderId) continue;
    const a = acc.get(folderId);
    if (!a) acc.set(folderId, { sum: e.vec.slice(), n: 1 });
    else { for (let i = 0; i < a.sum.length; i++) a.sum[i] += e.vec[i]; a.n++; }
  }
  const out = new Map<string, Float32Array>();
  for (const [fid, { sum, n }] of acc) {
    const c = new Float32Array(sum.length);
    for (let i = 0; i < sum.length; i++) c[i] = sum[i] / n;
    out.set(fid, c);
  }
  return out;
}

export function bestFolderMatch(
  embedding: Float32Array,
  centroids: Map<string, Float32Array>,
  threshold = 0.6
): { folderId: string; score: number } | null {
  let best: { folderId: string; score: number } | null = null;
  for (const [folderId, c] of centroids) {
    const score = cosineSim(embedding, c);
    if (score > (best?.score ?? -1)) best = { folderId, score };
  }
  return best && best.score >= threshold ? best : null;
}

export async function reindexSemantic(token: string): Promise<{ queued: number }> {
  const all = await listAllFiles(token);
  const targets = all.filter((f) => {
    const k = fileKind(f.mime_type, f.original_name);

    return k === "text" || k === "code" || k === "image" || k === "doc" || k === "pdf";
  });
  let done = 0, cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const f = targets[cursor++];
      try { await embedFile(token, f.id); done++; }
      catch (e) {
        if ((e as ApiError).status === 503) throw e;

      }

      try { await extractKeywords(token, f.id); } catch {  }
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  return { queued: done };
}

export interface AiPreferences {
  auto_file_mode: "off" | "type" | "smart";
  analysis: boolean;
  semantic_search: boolean;
}

export interface AiConfig { ai: boolean; semantic: boolean; preferences: AiPreferences }
export async function getAiConfig(token: string): Promise<AiConfig> {
  return req("GET", "/files/ai/config", token);
}
export async function updateAiPreferences(
  token: string,
  prefs: AiPreferences
): Promise<{ ok: boolean }> {
  return req("PUT", "/files/ai/preferences", token, prefs);
}

export type AiStatus = Pick<AiConfig, "ai" | "semantic">;
