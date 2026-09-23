import JSZip from "jszip";
import * as session from "../features/crypto/session";
import * as filecrypto from "../features/crypto/filecrypto";
import { ready as cryptoReady } from "../features/crypto/sodium";
import { indexFromNames, nameExists, dedupeName, idOf, type NameIndex } from "../utils/naming";
import { UserError } from "../utils/errors";
import { BASE, authHeaders, handle, req, type ApiError } from "./http";
import { hydrateFile } from "./crypto-glue";
import { resolveName, type OnConflict } from "./conflicts";
import { listFolderFiles, listSubfolders } from "./folders";
import type { FileItem } from "./types";

async function fetchDecrypted(
  token: string,
  id: string,
  inline = false
): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string; name: string }> {
  await cryptoReady();
  const { file } = await getFile(token, id);
  if (!file.wrapped_dek) throw new UserError("Missing decryption key for this file");
  const dek = session.openWrappedDek(file.wrapped_dek);
  const res = await fetch(
    `${BASE}/files/${id}/content${inline ? "?disposition=inline" : ""}`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const bytes = await filecrypto.decryptFile(new Uint8Array(await res.arrayBuffer()), dek);
  return { bytes, mime: file.mime_type, name: file.original_name };
}


export interface ListFilesOpts {
  folder?: string;

  all?: boolean;
}

export async function listFiles(token: string, opts: ListFilesOpts = {}): Promise<{ files: FileItem[] }> {
  const params = new URLSearchParams();
  if (opts.all) params.set("all", "true");
  if (opts.folder) params.set("folder", opts.folder);
  const qs = params.toString();
  const r = await req<{ files?: FileItem[] }>("GET", `/files${qs ? `?${qs}` : ""}`, token);
  return { files: (r.files ?? []).map(hydrateFile) };
}

export async function getFile(token: string, id: string): Promise<{ file: FileItem }> {
  const r = await req<{ file: FileItem & { sharer_label?: string | null } }>("GET", `/files/${id}`, token);

  return { file: { ...hydrateFile(r.file), shared_by: session.openNameSealedToMe(r.file.sharer_label) } };
}

export async function fileNameIndex(token: string, folderId: string | null): Promise<NameIndex> {
  const { files } = folderId ? await listFolderFiles(token, folderId) : await listFiles(token, {});
  return indexFromNames(files.map((f) => ({ id: f.id, name: f.original_name })));
}

export async function uploadFile(
  token: string,
  file: File,
  folderId?: string,
  onConflict?: OnConflict
): Promise<{ file: FileItem }> {
  await cryptoReady();

  let name = file.name;
  const index = await fileNameIndex(token, folderId ?? null);
  if (nameExists(index, name)) {
    if (!onConflict) {
      const err = new Error(`"${name}" already exists here`) as ApiError;
      err.code = "NAME_CONFLICT";
      err.conflict = { type: "file", name, existing_id: idOf(index, name)! };
      throw err;
    }
    if (onConflict === "replace") await deleteFile(token, idOf(index, name)!);
    else if (onConflict === "rename") name = dedupeName(index, name);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dek = session.newDek();
  const ciphertext = await filecrypto.encryptFile(bytes, dek);
  const form = new FormData();
  form.append("file", new Blob([ciphertext], { type: "application/octet-stream" }), "blob");
  form.append("meta_enc", session.sealMeta(name, file.type || session.DEFAULT_MIME));
  form.append("wrapped_dek", session.wrapDekForSelf(dek));
  form.append("size_bytes", String(bytes.length));
  if (folderId) form.append("folder_id", folderId);
  const r = await handle(
    await fetch(`${BASE}/files`, { method: "POST", headers: authHeaders(token), body: form })
  );

  return { file: { ...r.file, original_name: name } };
}

export async function patchFile(
  token: string,
  id: string,
  patch: {
    folder_id?: string | null;
    original_name?: string;
    expires_at?: string | null;
    on_conflict?: OnConflict;
  }
): Promise<{ file: FileItem }> {
  const body: Record<string, unknown> = {};
  if ("folder_id" in patch) body.folder_id = patch.folder_id;
  if ("expires_at" in patch) body.expires_at = patch.expires_at;

  const renaming = patch.original_name !== undefined;
  const moving = "folder_id" in patch;
  if (renaming || moving) {
    await cryptoReady();
    const { file: current } = await getFile(token, id);
    const destFolder = moving ? (patch.folder_id ?? null) : (current.folder_id ?? null);
    const desired = patch.original_name ?? current.original_name;
    const finalName = await resolveName(
      await fileNameIndex(token, destFolder),
      desired.trim(), patch.on_conflict, false, id,
      (existing) => deleteFile(token, existing)
    );

    if (renaming || finalName !== current.original_name) {
      body.meta_enc = session.sealMeta(finalName, current.mime_type);
    }
  }
  const r = await req<{ file: FileItem }>("PATCH", `/files/${id}`, token, body);
  return { file: hydrateFile(r.file) };
}

export async function deleteFile(token: string, id: string) {
  return req("DELETE", `/files/${id}`, token);
}

export async function getFileBlobUrl(token: string, id: string): Promise<string> {
  const { bytes, mime } = await fetchDecrypted(token, id, true);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

export async function downloadFile(token: string, id: string, name: string) {
  const { bytes, mime, name: realName } = await fetchDecrypted(token, id);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name || realName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getFileText(
  token: string,
  id: string,
  maxBytes = 256 * 1024
): Promise<{ text: string; truncated: boolean }> {
  const { bytes } = await fetchDecrypted(token, id, true);
  const slice = bytes.subarray(0, maxBytes);
  return { text: new TextDecoder("utf-8").decode(slice), truncated: bytes.length > maxBytes };
}

export interface ZipEntry {
  path: string;
  size: number;
  compressedSize: number;
  isDir: boolean;
}

export async function getZipEntries(
  token: string,
  id: string
): Promise<{ entries: ZipEntry[]; truncated: boolean }> {
  const { bytes } = await fetchDecrypted(token, id);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new UserError("Could not read archive (not a valid zip)");
  }
  const entries: ZipEntry[] = [];
  zip.forEach((relativePath, entry) => {

    const data = (entry as unknown as { _data?: { uncompressedSize?: number; compressedSize?: number } })._data;
    entries.push({
      path: relativePath,
      size: data?.uncompressedSize ?? 0,
      compressedSize: data?.compressedSize ?? 0,
      isDir: entry.dir,
    });
  });
  return { entries, truncated: false };
}

function zipSafe(name: string): string {
  return (name || "unnamed").replace(/[/\\]/g, "_").replace(/^\.+/, "_");
}

async function addFolderToZip(zip: JSZip, token: string, folderId: string, prefix: string) {
  const [{ files }, { folders }] = await Promise.all([
    listFolderFiles(token, folderId),
    listSubfolders(token, folderId),
  ]);
  for (const f of files) {
    const { bytes } = await fetchDecrypted(token, f.id);
    zip.file(prefix + zipSafe(f.original_name), bytes);
  }
  for (const sub of folders) {
    await addFolderToZip(zip, token, sub.id, prefix + zipSafe(sub.name) + "/");
  }
}

export async function downloadArchive(
  token: string,
  files: { id: string; name: string }[],
  folders: { id: string; name: string }[],
  zipName = "cloudcast.zip"
) {
  await cryptoReady();
  const zip = new JSZip();
  for (const f of files) {
    const { bytes } = await fetchDecrypted(token, f.id);
    zip.file(zipSafe(f.name), bytes);
  }
  for (const fo of folders) {
    await addFolderToZip(zip, token, fo.id, zipSafe(fo.name) + "/");
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function listAllFiles(token: string): Promise<FileItem[]> {
  await cryptoReady();
  const r = await req<{ files?: FileItem[] }>("GET", "/files?all=true", token);
  return (r.files ?? []).map(hydrateFile);
}

