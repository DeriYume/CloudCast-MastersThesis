import type { FolderItem } from "../api/api";
import { PRIMARY } from "../theme/colors.generated";
import { Icons } from "../components/icons";

import {
  IMAGE_EXTS, VIDEO_EXTS, AUDIO_EXTS, ARCHIVE_EXTS, DOC_EXTS, CODE_EXTS, TEXT_EXTS, SEARCH_WORDS,
} from "../shared/formats.generated";

export function formatBytes(bytes: number | string): string {
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function relativeTime(iso: string): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diff = target - now;
  const past = diff < 0;
  const abs = Math.abs(diff);
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  let value: number;
  let unit: string;
  if (abs < hour) {
    value = Math.max(1, Math.round(abs / min));
    unit = "minute";
  } else if (abs < day) {
    value = Math.round(abs / hour);
    unit = "hour";
  } else {
    value = Math.round(abs / day);
    unit = "day";
  }
  const label = `${value} ${unit}${value === 1 ? "" : "s"}`;
  return past ? `${label} ago` : `in ${label}`;
}

export function expiresSoon(iso: string): boolean {
  const diff = new Date(iso).getTime() - Date.now();
  return diff < 24 * 60 * 60 * 1000;
}

export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export const PASSWORD_RULES: { test: (p: string) => boolean; label: string }[] = [
  { test: (p) => p.length >= 8, label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p), label: "An uppercase letter" },
  { test: (p) => /[a-z]/.test(p), label: "A lowercase letter" },
  { test: (p) => /\d/.test(p), label: "A digit" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "A special character" },
];

export function passwordIsValid(password: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(password));
}

export function emailIsValid(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export type FileKind = "image" | "video" | "audio" | "pdf" | "doc" | "archive" | "code" | "text" | "other";

export function childFolders(folders: FolderItem[], parentId: string | null): FolderItem[] {
  return folders.filter((f) => (f.parent_id ?? null) === parentId);
}

export function folderChain(folders: FolderItem[], id: string): FolderItem[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: FolderItem[] = [];
  const seen = new Set<string>();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    chain.unshift(cur);
    seen.add(cur.id);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return chain;
}

export function descendantIds(folders: FolderItem[], id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const f of folders) {
      if ((f.parent_id ?? null) === cur) {
        out.push(f.id);
        stack.push(f.id);
      }
    }
  }
  return out;
}

export interface FlatFolder {
  folder: FolderItem;
  depth: number;
}

export function flattenTree(folders: FolderItem[]): FlatFolder[] {
  const byName = (a: FolderItem, b: FolderItem) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  const out: FlatFolder[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const f of childFolders(folders, parentId).sort(byName)) {
      out.push({ folder: f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function fileKind(mime: string, name: string): FileKind {
  const m = mime.toLowerCase();
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (CODE_EXTS.includes(ext)) return "code";

  if (m.startsWith("image/") || IMAGE_EXTS.includes(ext)) return "image";
  if (m.startsWith("video/") || VIDEO_EXTS.includes(ext)) return "video";
  if (m.startsWith("audio/") || AUDIO_EXTS.includes(ext)) return "audio";

  if (ARCHIVE_EXTS.includes(ext) || /zip|compressed|tar|gzip|x-7z|x-rar/.test(m)) return "archive";
  if (m === "application/pdf" || ext === "pdf") return "pdf";

  if (DOC_EXTS.includes(ext)) return "doc";

  if (m.startsWith("text/") || TEXT_EXTS.includes(ext)) return "text";
  return "other";
}

export function displayNameFromEmail(email: string | null | undefined): string {
  if (!email) return "User";
  return email.split("@")[0] || email;
}

export function fileGlyph(mime: string, name: string): { icon: string; color: string } {
  return KIND_SYMBOL[fileKind(mime, name)];
}

export function queryKinds(q: string): Set<FileKind> {
  const out = new Set<FileKind>();
  for (const tok of q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
    for (const k of SEARCH_WORDS[tok] ?? []) out.add(k as FileKind);
  }
  return out;
}

export const KIND_SYMBOL: Record<FileKind, { icon: string; color: string }> = {
  image: { icon: Icons.image, color: PRIMARY },
  video: { icon: Icons.movie, color: PRIMARY },
  audio: { icon: Icons.musicNote, color: PRIMARY },
  pdf: { icon: Icons.pictureAsPdf, color: PRIMARY },
  doc: { icon: Icons.file, color: PRIMARY },
  archive: { icon: Icons.folderZip, color: PRIMARY },
  code: { icon: Icons.code, color: PRIMARY },
  text: { icon: Icons.description, color: PRIMARY },
  other: { icon: Icons.file, color: PRIMARY },
};
