import { ready as cryptoReady } from "../features/crypto/sodium";
import * as session from "../features/crypto/session";
import { req } from "./http";
import { UserError } from "../utils/errors";
import { hydrateFile, hydrateFolder } from "./crypto-glue";
import { getFile } from "./files";
import { listFolders, listFolderFiles, getFolder } from "./folders";
import type {
  FileItem, Permission, SharePermission, ShareItem,
  SharedFileItem, SharedFolderItem, SharedByMeFileItem, SharedByMeFolderItem,
} from "./types";

async function collectFolderShare(
  token: string,
  folderId: string,
  recipientPk: string
): Promise<{
  fileKeys: { file_id: string; wrapped_dek: string; meta_sealed: string }[];
  folderNames: { folder_id: string; meta_sealed: string }[];
}> {
  const { folders } = await listFolders(token);
  const byId = new Map(folders.map((f) => [f.id, f]));
  const childrenOf = new Map<string | null, string[]>();
  for (const f of folders) {
    const arr = childrenOf.get(f.parent_id) ?? [];
    arr.push(f.id);
    childrenOf.set(f.parent_id, arr);
  }
  const subtree: string[] = [];
  const stack = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    subtree.push(id);
    for (const child of childrenOf.get(id) ?? []) stack.push(child);
  }
  const fileKeys: { file_id: string; wrapped_dek: string; meta_sealed: string }[] = [];

  const folderNames: { folder_id: string; meta_sealed: string }[] = [];
  for (const fid of subtree) {
    if (fid !== folderId) {
      const fo = byId.get(fid);
      if (fo) folderNames.push({ folder_id: fid, meta_sealed: session.sealNameForPub(fo.name, recipientPk) });
    }
    const { files } = await listFolderFiles(token, fid);
    for (const meta of files) {
      const { file } = await getFile(token, meta.id);
      if (!file.wrapped_dek) continue;
      const dek = session.openWrappedDek(file.wrapped_dek);
      fileKeys.push({
        file_id: file.id,
        wrapped_dek: session.wrapDekForPub(dek, recipientPk),

        meta_sealed: session.sealMetaForPub(file.original_name, file.mime_type, recipientPk),
      });
    }
  }
  return { fileKeys, folderNames };
}

export async function createShare(
  token: string,
  input: {
    file_id?: string;
    folder_id?: string;
    recipient: { id: string; public_key: string };
    label: string;
    ownerLabel: string;
    expires_at?: string | null;
    permission?: SharePermission;
  }
): Promise<{ share: ShareItem }> {
  await cryptoReady();
  const { recipient, label } = input;
  const recipient_label = session.sealName(label);
  const body: Record<string, unknown> = {
    recipient_id: recipient.id,
    recipient_label,
    sharer_label: session.sealNameForPub(input.ownerLabel, recipient.public_key),
    expires_at: input.expires_at ?? null,
    permission: input.permission ?? "view",
  };

  if (input.file_id) {
    const { file } = await getFile(token, input.file_id);
    if (!file.wrapped_dek) throw new UserError("Missing decryption key for this file");
    const dek = session.openWrappedDek(file.wrapped_dek);
    body.file_id = input.file_id;
    body.wrapped_dek = session.wrapDekForPub(dek, recipient.public_key);
    body.meta_sealed = session.sealMetaForPub(file.original_name, file.mime_type, recipient.public_key);
  } else if (input.folder_id) {
    const { folder } = await getFolder(token, input.folder_id);
    body.folder_id = input.folder_id;

    body.meta_sealed = session.sealNameForPub(folder.name, recipient.public_key);
    const { fileKeys, folderNames } = await collectFolderShare(token, input.folder_id, recipient.public_key);
    body.keys = fileKeys;
    body.folder_keys = folderNames;
  } else {
    throw new UserError("Provide a file or folder to share");
  }

  const r = await req<{
    share: { id: string; expires_at: string | null; permission: Permission; created_at: string };
  }>("POST", "/files/shares", token, body);

  return {
    share: {
      id: r.share.id,
      recipient_id: recipient.id,
      label,
      expires_at: r.share.expires_at,
      permission: r.share.permission,
      created_at: r.share.created_at,
    },
  };
}

export async function listShares(
  token: string,
  target: { file_id?: string; folder_id?: string }
): Promise<{ shares: ShareItem[] }> {
  const params = new URLSearchParams();
  if (target.file_id) params.set("file_id", target.file_id);
  if (target.folder_id) params.set("folder_id", target.folder_id);
  const r = await req("GET", `/files/shares?${params.toString()}`, token);
  const shares: ShareItem[] = (r.shares ?? []).map((s: {
    id: string; recipient_id: string; recipient_label: string | null;
    expires_at: string | null; permission: Permission; created_at: string;
  }) => ({
    id: s.id,
    recipient_id: s.recipient_id,
    label: session.openName(s.recipient_label),
    expires_at: s.expires_at,
    permission: s.permission,
    created_at: s.created_at,
  }));
  return { shares };
}

export async function updateShare(
  token: string,
  shareId: string,
  patch: { permission?: SharePermission; expires_at?: string | null }
): Promise<{ permission: Permission; expires_at: string | null }> {
  const body: Record<string, unknown> = {};
  if (patch.permission !== undefined) body.permission = patch.permission;
  if (patch.expires_at !== undefined) {
    if (patch.expires_at === null) body.clear_expiry = true;
    else body.expires_at = patch.expires_at;
  }
  const r = await req<{ share: { permission: Permission; expires_at: string | null } }>(
    "PATCH", `/files/shares/${shareId}`, token, body
  );
  return { permission: r.share.permission, expires_at: r.share.expires_at };
}

export async function leaveShare(
  token: string,
  target: { file_id?: string; folder_id?: string }
): Promise<{ left: boolean }> {
  return req("POST", "/files/leave", token, target);
}

export async function unshareAll(
  token: string,
  target: { file_id?: string; folder_id?: string }
): Promise<{ unshared: boolean }> {
  return req("POST", "/files/unshare", token, target);
}

export async function setShareExpiry(
  token: string,
  target: { file_id?: string; folder_id?: string },
  expiresAt: string | null
): Promise<{ updated: boolean }> {
  return req("POST", "/files/share-expiry", token, { ...target, expires_at: expiresAt });
}

export async function deleteShare(token: string, shareId: string): Promise<{ deleted: boolean }> {
  return req("DELETE", `/files/shares/${shareId}`, token);
}

export interface UserSuggestion {
  id: string;
  public_key: string;
  label: string;
}

export async function searchUsers(
  token: string,
  q: string
): Promise<{ users: UserSuggestion[] }> {
  const query = q.trim();
  if (!query) return { users: [] };
  const r = await req<{ results?: { id: string; public_key: string }[] }>(
    "GET", `/auth/users/search?q=${encodeURIComponent(query)}`, token
  );
  const users: UserSuggestion[] = (r.results ?? []).map((u: { id: string; public_key: string }) => ({
    id: u.id,
    public_key: u.public_key,
    label: query,
  }));
  return { users };
}

export async function resolveRecipient(token: string, q: string): Promise<UserSuggestion | null> {
  const { users } = await searchUsers(token, q);
  return users[0] ?? null;
}

export interface Contact {
  id: string;
  label: string;
}

export async function listContacts(token: string): Promise<{ contacts: Contact[] }> {
  await cryptoReady();
  const r = await req<{ contacts?: { recipient_id: string; recipient_label: string | null }[] }>(
    "GET", "/files/contacts", token
  );
  const contacts: Contact[] = (r.contacts ?? [])
    .map((c: { recipient_id: string; recipient_label: string | null }) => ({
      id: c.recipient_id,
      label: session.openName(c.recipient_label),
    }))
    .filter((c: Contact) => c.label && c.label !== "(unreadable)");
  return { contacts };
}

export async function listSharedWithMe(
  token: string
): Promise<{ files: SharedFileItem[]; folders: SharedFolderItem[] }> {
  const r = await req("GET", "/files/shared-with-me", token);

  type Shared = { sharer_label?: string | null; meta_enc?: string | null; meta_sealed?: string | null;
                  name_enc?: string | null; name_sealed?: string | null };
  return {
    files: (r.files ?? []).map((f: Shared) =>
      ({ ...hydrateFile(f), shared_by: session.openNameSealedToMe(f.sharer_label) })),
    folders: (r.folders ?? []).map((f: Shared) =>
      ({ ...hydrateFolder(f), shared_by: session.openNameSealedToMe(f.sharer_label) })),
  };
}

export async function listSharedByMe(
  token: string
): Promise<{ files: SharedByMeFileItem[]; folders: SharedByMeFolderItem[] }> {
  const r = await req("GET", "/files/shared-by-me", token);

  return {
    files: (r.files ?? []).map(hydrateFile),
    folders: (r.folders ?? []).map(hydrateFolder),
  };
}

export async function saveSharedFile(token: string, id: string): Promise<{ file: FileItem }> {
  await cryptoReady();
  const { file } = await getFile(token, id);
  if (!file.wrapped_dek) throw new UserError("Missing decryption key for this file");
  const dek = session.openWrappedDek(file.wrapped_dek);
  const r = await req<{ file: FileItem }>("POST", `/files/${id}/save`, token, {
    meta_enc: session.sealMeta(file.original_name, file.mime_type),
    wrapped_dek: session.wrapDekForSelf(dek),
  });
  return { file: hydrateFile(r.file) };
}

