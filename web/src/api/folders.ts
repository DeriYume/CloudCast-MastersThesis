import { ready as cryptoReady } from "../features/crypto/sodium";
import * as session from "../features/crypto/session";
import { indexFromNames, type NameIndex } from "../utils/naming";
import { req } from "./http";
import { hydrateFile, hydrateFolder } from "./crypto-glue";
import { resolveName, type OnConflict } from "./conflicts";
import type { FileItem, FolderItem } from "./types";

export async function listFolders(token: string): Promise<{ folders: FolderItem[] }> {
  const r = await req<{ folders?: FolderItem[] }>("GET", "/files/folders", token);
  return { folders: (r.folders ?? []).map(hydrateFolder) };
}

export async function folderNameIndex(token: string, parentId: string | null): Promise<NameIndex> {
  const { folders } = await listFolders(token);
  return indexFromNames(
    folders.filter((f) => (f.parent_id ?? null) === parentId).map((f) => ({ id: f.id, name: f.name }))
  );
}

export async function createFolder(
  token: string,
  name: string,
  parentId?: string | null,
  onConflict?: OnConflict
): Promise<{ folder: FolderItem }> {
  await cryptoReady();
  const finalName = await resolveName(
    await folderNameIndex(token, parentId ?? null),
    name.trim(), onConflict, true, undefined,
    (id) => deleteFolder(token, id)
  );
  const r = await req<{ folder: FolderItem }>("POST", "/files/folders", token, {
    name_enc: session.sealName(finalName),
    parent_id: parentId ?? null,
  });
  return { folder: { ...hydrateFolder(r.folder), name } };
}

export async function moveFolder(
  token: string,
  id: string,
  parentId: string | null,
  onConflict?: OnConflict
): Promise<{ folder: FolderItem }> {
  await cryptoReady();

  const { folders } = await listFolders(token);
  const current = folders.find((f) => f.id === id);
  const body: Record<string, unknown> = { parent_id: parentId };
  if (current) {
    const finalName = await resolveName(
      await folderNameIndex(token, parentId),
      current.name, onConflict, true, id,
      (existing) => deleteFolder(token, existing)
    );
    if (finalName !== current.name) body.name_enc = session.sealName(finalName);
  }
  const r = await req<{ folder: FolderItem }>("PATCH", `/files/folders/${id}`, token, body);
  return { folder: hydrateFolder(r.folder) };
}

export async function getFolder(token: string, id: string): Promise<{ folder: FolderItem }> {
  const r = await req<{ folder: FolderItem }>("GET", `/files/folders/${id}`, token);
  return { folder: hydrateFolder(r.folder) };
}

export async function listFolderFiles(token: string, id: string): Promise<{ files: FileItem[] }> {
  const r = await req<{ files?: FileItem[] }>("GET", `/files/folders/${id}/files`, token);
  return { files: (r.files ?? []).map(hydrateFile) };
}

export async function listSubfolders(token: string, id: string): Promise<{ folders: FolderItem[] }> {
  const r = await req<{ folders?: FolderItem[] }>("GET", `/files/folders/${id}/subfolders`, token);
  return { folders: (r.folders ?? []).map(hydrateFolder) };
}

export async function renameFolder(
  token: string,
  id: string,
  name: string,
  onConflict?: OnConflict
): Promise<{ folder: FolderItem }> {
  await cryptoReady();
  const { folders } = await listFolders(token);
  const current = folders.find((f) => f.id === id);
  const finalName = await resolveName(
    await folderNameIndex(token, current?.parent_id ?? null),
    name.trim(), onConflict, true, id,
    (existing) => deleteFolder(token, existing)
  );
  const r = await req<{ folder: FolderItem }>("PATCH", `/files/folders/${id}`, token, {
    name_enc: session.sealName(finalName),
  });
  return { folder: { ...hydrateFolder(r.folder), name: finalName } };
}

export async function deleteFolder(token: string, id: string) {
  return req("DELETE", `/files/folders/${id}`, token);
}

export async function patchFolder(
  token: string,
  id: string,
  patch: { parent_id?: string | null; name?: string; expires_at?: string | null; on_conflict?: OnConflict }
): Promise<{ folder: FolderItem }> {
  const body: Record<string, unknown> = {};
  if ("parent_id" in patch) body.parent_id = patch.parent_id;
  if ("expires_at" in patch) body.expires_at = patch.expires_at;
  if (patch.name !== undefined) body.name_enc = session.sealName(patch.name);
  const r = await req<{ folder: FolderItem }>("PATCH", `/files/folders/${id}`, token, body);
  return { folder: hydrateFolder(r.folder) };
}

