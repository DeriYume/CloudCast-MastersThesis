import { fileKind, queryKinds } from "../utils/util";
import { req } from "./http";
import { listAllFiles } from "./files";
import { cosineSim, fetchEmbeddings, fetchKeywords } from "./ai";
import type { FileItem, FolderItem } from "./types";

export type SearchFileType = "image" | "video" | "audio" | "pdf" | "text";


function matchesType(f: FileItem, type: SearchFileType): boolean {
  const kind = fileKind(f.mime_type, f.original_name);
  if (type === "text") return kind === "text" || kind === "code" || kind === "doc";
  return kind === type;
}

export async function searchFiles(
  token: string,
  q: string,
  type?: SearchFileType,
  folders: FolderItem[] = []
): Promise<{ files: FileItem[]; folders: FolderItem[] }> {
  const needle = q.trim().toLowerCase();
  if (!needle) return { files: [], folders: [] };
  const all = await listAllFiles(token);
  const files = all
    .filter((f) => f.original_name.toLowerCase().includes(needle))
    .filter((f) => !type || matchesType(f, type));
  const folderHits = type ? [] : folders.filter((fo) => (fo.name ?? "").toLowerCase().includes(needle));
  return { files, folders: folderHits };
}


const SEMANTIC_FLOOR = 0.6;
const SEMANTIC_GAP = 0.05;

function semanticCutoff(values: number[]): number {
  if (!values.length) return SEMANTIC_FLOOR;
  return Math.max(SEMANTIC_FLOOR, Math.max(...values) - SEMANTIC_GAP);
}

export async function semanticSearch(
  token: string,
  q: string,
  folders: FolderItem[] = []
): Promise<{ files: FileItem[]; folders: FolderItem[] }> {
  const query = q.trim();
  if (!query) return { files: [], folders: [] };
  const needle = query.toLowerCase();
  const wantedKinds = queryKinds(needle);

  const all = await listAllFiles(token);

  let qv: Float32Array | null = null;
  const vecById = new Map<string, Float32Array>();
  try {
    const [qres, embeddings] = await Promise.all([
      req<{ vector: number[] }>("POST", "/files/ai/embed-query", token, { q: query }),
      fetchEmbeddings(token),
    ]);
    qv = new Float32Array(qres.vector as number[]);
    for (const e of embeddings) vecById.set(e.file_id, e.vec);
  } catch {  }

  const keywordsById = await fetchKeywords(token).catch(() => new Map<string, string[]>());
  const terms = needle.split(/[^\p{L}\p{N}._-]+/u).filter((t) => t.length >= 3);

  const sims = new Map<string, number>();
  if (qv) {
    for (const f of all) {
      const vec = vecById.get(f.id);
      if (vec) sims.set(f.id, cosineSim(qv, vec));
    }
  }
  const semanticFloor = semanticCutoff([...sims.values()]);

  const scored = all
    .map((f) => {
      let score = 0;
      if (f.original_name.toLowerCase().includes(needle)) score += 100;
      if (wantedKinds.size && wantedKinds.has(fileKind(f.mime_type, f.original_name))) score += 60;
      if ((f.folder_name ?? "").toLowerCase().includes(needle)) score += 70;

      const words = keywordsById.get(f.id);
      if (words?.length && terms.length) {
        let hits = 0;
        for (const t of terms) {
          if (words.includes(t)) hits += 1;
          else if (words.some((w) => w.startsWith(t))) hits += 0.5;
        }
        if (hits > 0) score += (hits / terms.length) * 80;
      }
      const c = sims.get(f.id);
      if (c !== undefined && c >= semanticFloor) score += c * 40;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map((x) => x.f);

  const folderHits = folders.filter((fo) => (fo.name ?? "").toLowerCase().includes(needle));
  return { files: scored, folders: folderHits };
}

