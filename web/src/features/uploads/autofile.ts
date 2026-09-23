import { fileKind } from "../../utils/util";
import { KIND_FOLDERS, FOLDER_CONCEPTS } from "../../shared/formats.generated";
import type { FolderItem } from "../../api/api";
import { childFolders } from "../../utils/util";


export function targetFolderName(file: File): string | null {
  return KIND_FOLDERS[fileKind(file.type, file.name)] ?? null;
}

export function findTopLevelFolder(
  folders: FolderItem[],
  name: string
): FolderItem | undefined {
  const lower = name.toLowerCase();
  return childFolders(folders, null).find((f) => f.name.toLowerCase() === lower);
}


const WORD_GROUPS: Map<string, number[]> = (() => {
  const m = new Map<string, number[]>();
  FOLDER_CONCEPTS.forEach((group, gi) => {
    for (const w of group) {
      const arr = m.get(w) ?? [];
      arr.push(gi);
      m.set(w, arr);
    }
  });
  return m;
})();

function singular(w: string): string {
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular);
}

function conceptsOf(word: string): string[] {
  const keys = [`w:${word}`];
  for (const gi of WORD_GROUPS.get(word) ?? []) keys.push(`g:${gi}`);
  return keys;
}

function conceptSet(words: string[]): Set<string> {
  const s = new Set<string>();
  for (const w of words) for (const k of conceptsOf(w)) s.add(k);
  return s;
}

function folderDepth(byId: Map<string, FolderItem>, f: FolderItem): number {
  let depth = 0;
  let cur: FolderItem | undefined = f;
  const seen = new Set<string>();
  while (cur?.parent_id && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parent_id);
    depth++;
  }
  return depth;
}

export function findMatchingFolder(
  folders: FolderItem[],
  category: string
): FolderItem | undefined {
  const qWords = wordsOf(category);
  if (qWords.length === 0) return undefined;
  const qConcepts = conceptSet(qWords);
  const qKey = [...qWords].sort().join(" ");

  const byId = new Map(folders.map((f) => [f.id, f]));
  let best: FolderItem | undefined;
  let bestScore = 0;
  let bestDepth = Infinity;

  for (const f of folders) {
    const fWords = wordsOf(f.name);
    if (fWords.length === 0) continue;

    const fConcepts = conceptSet(fWords);
    let sharedConcepts = 0;
    for (const k of qConcepts) if (fConcepts.has(k)) sharedConcepts++;
    if (sharedConcepts === 0) continue;

    const wordExact = fWords.filter((w) => qWords.includes(w)).length;
    const unmatched = fWords.filter((w) => !conceptsOf(w).some((k) => qConcepts.has(k))).length;

    const exactFull = fWords.length === qWords.length && [...fWords].sort().join(" ") === qKey;
    const score = sharedConcepts * 10 + wordExact * 5 + (exactFull ? 50 : 0) - unmatched * 3;
    if (score <= 0) continue;

    const depth = folderDepth(byId, f);
    const better =
      score > bestScore ||
      (score === bestScore &&
        (depth < bestDepth ||
          (depth === bestDepth && best !== undefined && f.name.toLowerCase() < best.name.toLowerCase())));
    if (better) {
      best = f;
      bestScore = score;
      bestDepth = depth;
    }
  }
  return best;
}

export interface AutoFileGroup {

  target: string | null;
  files: File[];
}

export function groupByTarget(files: File[]): AutoFileGroup[] {
  const order: (string | null)[] = [];
  const map = new Map<string | null, File[]>();
  for (const f of files) {
    const target = targetFolderName(f);
    if (!map.has(target)) {
      map.set(target, []);
      order.push(target);
    }
    map.get(target)!.push(f);
  }
  return order.map((target) => ({ target, files: map.get(target)! }));
}

export function groupTargetsByName(
  decided: { file: File; target: string | null }[]
): AutoFileGroup[] {
  const order: (string | null)[] = [];
  const map = new Map<string | null, File[]>();
  for (const { file, target } of decided) {
    if (!map.has(target)) {
      map.set(target, []);
      order.push(target);
    }
    map.get(target)!.push(file);
  }
  return order.map((target) => ({ target, files: map.get(target)! }));
}

export function groupCountLabel(group: AutoFileGroup): string {
  const n = group.files.length;
  if (group.files.length === 1) {
    const kind = fileKind(group.files[0].type, group.files[0].name);
    if (kind !== "other") return `1 ${kind}`;
  }
  return `${n} file${n === 1 ? "" : "s"}`;
}
