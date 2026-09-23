import { useCallback, useEffect, useRef, useState } from "react";
import { useVaultRevision, markLocalRefresh, isEchoOfLocalRefresh } from "./useVaultRevision";
import { useNavigate } from "react-router-dom";
import {
  listFiles, deleteFile, patchFile, createFolder,
  renameFolder, moveFolder, deleteFolder, patchFolder,
  listSharedWithMe, listSharedByMe, listExpiring, listFolderFiles, listSubfolders, getFolder,
  runWithConflict, isNameConflict,
  type FileItem, type FolderItem, type OnConflict, type AskConflict, type ConflictChoice,
  type Permission
} from "../../api/api";
import { useFolders } from "../folders/useFolders";
import { loadFavorites, toggleFavorite as toggleFavoriteId } from "./favorites";
import { descendantIds } from "../../utils/util";
import { reconcile, reconcileItem, reconcileRecord } from "../../utils/reconcile";
import { friendlyError } from "../../utils/errors";

const EMPTY: Record<string, never> = {};

const NO_FOLDERS: never[] = [];

export type FilesView =
  | "root"
  | "favorites"
  | "folder"
  | "shared-hub"
  | "shared-by-me"
  | "shared-with-me"
  | "shared-recent"
  | "expiring";
type View = FilesView;

export interface ExtraFolder extends FolderItem {
  shared_by?: string;
  share_expires_at?: string | null;
  recipient_count?: number;
}

export type ShareDirection = "incoming" | "outgoing";

interface UseFilesDataOptions {
  token: string;
  view: View;
  folderId?: string;
}

export function useFilesData({ token, view, folderId }: UseFilesDataOptions) {
  const navigate = useNavigate();
  const folders = useFolders((s) => s.folders);
  const refreshFolders = useFolders((s) => s.refresh);
  const ownsFolder = useFolders((s) => s.folders.some((f) => f.id === folderId));

  const [files, setFiles] = useState<FileItem[]>([]);
  const [virtualFolders, setVirtualFolders] = useState<ExtraFolder[]>([]);
  const [sharedByMap, setSharedByMap] = useState<Record<string, string>>({});
  const [permissionMap, setPermissionMap] = useState<Record<string, Permission>>({});
  const [shareExpiryMap, setShareExpiryMap] = useState<Record<string, string | null>>({});
  const [recipientCountMap, setRecipientCountMap] = useState<Record<string, number>>({});
  const [directionMap, setDirectionMap] = useState<Record<string, ShareDirection>>({});
  const [externalFolder, setExternalFolder] = useState<FolderItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadedKey = useRef<string | null>(null);

  const runRefresh = useCallback(async (local: boolean) => {
    setError("");

    const key = `${view}:${folderId ?? ""}`;
    setLoading(loadedKey.current !== key);

    if (view !== "shared-hub" && view !== "shared-recent") setDirectionMap((prev) => reconcileRecord(prev, EMPTY));
    try {

      await loadFavorites(token).catch(() => {  });
      if (view === "shared-hub" || view === "shared-recent") {

        const [incoming, outgoing] = await Promise.all([
          listSharedWithMe(token),
          listSharedByMe(token),
        ]);
        const by: Record<string, string> = {};
        const perm: Record<string, Permission> = {};
        const exp: Record<string, string | null> = {};
        const count: Record<string, number> = {};
        const dir: Record<string, ShareDirection> = {};

        for (const fi of [...incoming.files, ...incoming.folders]) {
          by[fi.id] = fi.shared_by;
          if (fi.permission) perm[fi.id] = fi.permission;
          exp[fi.id] = fi.share_expires_at ?? null;
          dir[fi.id] = "incoming";
        }
        for (const fo of [...outgoing.files, ...outgoing.folders]) {
          count[fo.id] = fo.recipient_count;
          dir[fo.id] = "outgoing";
        }

        const byRecency = <T extends { created_at: string }>(a: T, b: T) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        const merged = [...incoming.files, ...outgoing.files].sort(byRecency);
        const mergedFolders = [...incoming.folders, ...outgoing.folders].sort(byRecency);
        setSharedByMap((prev) => reconcileRecord(prev, by));
        setPermissionMap((prev) => reconcileRecord(prev, perm));
        setShareExpiryMap((prev) => reconcileRecord(prev, exp));
        setRecipientCountMap((prev) => reconcileRecord(prev, count));
        setDirectionMap((prev) => reconcileRecord(prev, dir));
        setFiles((prev) => reconcile(prev, merged));
        setVirtualFolders((prev) => reconcile(prev, mergedFolders));
        setExternalFolder(null);
      } else if (view === "shared-with-me") {
        const data = await listSharedWithMe(token);
        const by: Record<string, string> = {};
        const perm: Record<string, Permission> = {};
        const exp: Record<string, string | null> = {};
        for (const f of data.files) {
          by[f.id] = f.shared_by;
          if (f.permission) perm[f.id] = f.permission;
          exp[f.id] = f.share_expires_at ?? null;
        }
        for (const f of data.folders) {
          by[f.id] = f.shared_by;
          if (f.permission) perm[f.id] = f.permission;
          exp[f.id] = f.share_expires_at ?? null;
        }
        setSharedByMap((prev) => reconcileRecord(prev, by));
        setPermissionMap((prev) => reconcileRecord(prev, perm));
        setShareExpiryMap((prev) => reconcileRecord(prev, exp));
        setRecipientCountMap((prev) => reconcileRecord(prev, EMPTY));
        setFiles((prev) => reconcile(prev, data.files));
        setVirtualFolders((prev) => reconcile(prev, data.folders));
        setExternalFolder(null);
      } else if (view === "shared-by-me") {
        const data = await listSharedByMe(token);
        const count: Record<string, number> = {};
        for (const f of data.files) count[f.id] = f.recipient_count;
        for (const f of data.folders) count[f.id] = f.recipient_count;
        setSharedByMap((prev) => reconcileRecord(prev, EMPTY));
        setPermissionMap((prev) => reconcileRecord(prev, EMPTY));
        setShareExpiryMap((prev) => reconcileRecord(prev, EMPTY));
        setRecipientCountMap((prev) => reconcileRecord(prev, count));
        setFiles((prev) => reconcile(prev, data.files));
        setVirtualFolders((prev) => reconcile(prev, data.folders));
        setExternalFolder(null);
      } else if (view === "expiring") {
        const data = await listExpiring(token);
        setSharedByMap((prev) => reconcileRecord(prev, EMPTY));
        setPermissionMap((prev) => reconcileRecord(prev, EMPTY));
        setShareExpiryMap((prev) => reconcileRecord(prev, EMPTY));
        setRecipientCountMap((prev) => reconcileRecord(prev, EMPTY));
        setFiles((prev) => reconcile(prev, data.files));
        setVirtualFolders((prev) => reconcile(prev, data.folders));
      } else if (view === "folder" && folderId && !ownsFolder) {

        const [{ files }, { folder }, { folders: subs }] = await Promise.all([
          listFolderFiles(token, folderId),
          getFolder(token, folderId),
          listSubfolders(token, folderId),
        ]);
        setSharedByMap((prev) => reconcileRecord(prev, EMPTY));
        setPermissionMap((prev) => reconcileRecord(prev, EMPTY));
        setShareExpiryMap((prev) => reconcileRecord(prev, EMPTY));
        setRecipientCountMap((prev) => reconcileRecord(prev, EMPTY));
        setVirtualFolders((prev) => reconcile(prev, subs));
        setExternalFolder((prev) => reconcileItem(prev, folder));
        setFiles((prev) => reconcile(prev, files));
      } else {

        const opts =
          view === "favorites"
            ? { all: true }
            : view === "folder"
            ? { folder: folderId }
            : {};
        const data = await listFiles(token, opts);
        if (view === "favorites") data.files = data.files.filter((f) => f.is_favorite);
        setSharedByMap((prev) => reconcileRecord(prev, EMPTY));
        setPermissionMap((prev) => reconcileRecord(prev, EMPTY));
        setShareExpiryMap((prev) => reconcileRecord(prev, EMPTY));
        setRecipientCountMap((prev) => reconcileRecord(prev, EMPTY));
        setVirtualFolders((prev) => reconcile(prev, NO_FOLDERS));
        setExternalFolder(null);
        setFiles((prev) => reconcile(prev, data.files));
      }

      loadedKey.current = key;
    } catch (e) {
      setError(friendlyError(e, "Failed to load files"));
    } finally {
      setLoading(false);
      if (local) markLocalRefresh();
    }
  }, [token, view, folderId, ownsFolder]);

  const refresh = useCallback(() => runRefresh(true), [runRefresh]);

  useEffect(() => { refresh(); }, [refresh]);

  const revision = useVaultRevision((s) => s.revision);
  useEffect(() => {

    if (revision === 0) return;

    const t = setTimeout(() => {

      if (isEchoOfLocalRefresh()) return;

      if (token) refreshFolders(token);
      void runRefresh(false);
    }, 400);
    return () => clearTimeout(t);
  }, [revision, runRefresh, refreshFolders, token]);

  async function guard(action: () => Promise<unknown>) {
    setError("");
    try { await action(); } catch (e) {

      if (isNameConflict(e)) throw e;
      setError(friendlyError(e, "Something went wrong"));
    }
  }

  const toggleFavorite = (f: FileItem) =>
    guard(async () => {
      await toggleFavoriteId(token, f.id, !f.is_favorite);
      await refresh();
    });

  const moveFile = (id: string, dest: string | null, onConflict?: OnConflict) =>
    guard(async () => {
      await patchFile(token, id, { folder_id: dest, on_conflict: onConflict });
      await refresh();
    });

  const bulkMove = async (
    items: { type: "file" | "folder"; id: string }[],
    dest: string | null,
    ask: AskConflict
  ): Promise<{ failed: number; skipped: number }> => {
    setError("");
    let failed = 0;
    let skipped = 0;
    let foldersTouched = false;
    const memory = { current: null as ConflictChoice | null };
    for (const item of items) {
      try {
        const result = await runWithConflict(
          (oc) =>
            item.type === "file"
              ? patchFile(token, item.id, { folder_id: dest, on_conflict: oc })
              : moveFolder(token, item.id, dest, oc),
          ask,
          memory
        );
        if (result === "skipped") skipped += 1;
        if (item.type === "folder") foldersTouched = true;
      } catch {
        failed += 1;
      }
    }
    if (foldersTouched) await refreshFolders(token);
    await refresh();
    if (failed > 0) {
      setError(`${failed} item${failed === 1 ? "" : "s"} could not be moved.`);
    }
    return { failed, skipped };
  };

  const removeFile = (id: string) =>
    guard(async () => {
      await deleteFile(token, id);
      await refresh();
    });

  const bulkDelete = async (
    items: { type: "file" | "folder"; id: string }[]
  ): Promise<{ failed: number }> => {
    setError("");
    let failed = 0;
    let foldersTouched = false;
    for (const item of items) {
      try {
        if (item.type === "file") {
          await deleteFile(token, item.id);
        } else {
          await deleteFolder(token, item.id);
          foldersTouched = true;
        }
      } catch {
        failed += 1;
      }
    }
    if (foldersTouched) await refreshFolders(token);
    await refresh();
    if (failed > 0) {
      setError(
        `${failed} item${failed === 1 ? "" : "s"} could not be deleted. The rest were removed.`
      );
    }
    return { failed };
  };

  const doCreateFolder = (name: string, parentId: string | null, onConflict?: OnConflict) =>
    guard(async () => {
      await createFolder(token, name, parentId, onConflict);
      await refreshFolders(token);
    });

  const doRenameFolder = (id: string, name: string, onConflict?: OnConflict) =>
    guard(async () => {
      await renameFolder(token, id, name, onConflict);
      await refreshFolders(token);
    });

  const doMoveFolder = (id: string, dest: string | null, onConflict?: OnConflict) =>
    guard(async () => {
      await moveFolder(token, id, dest, onConflict);
      await refreshFolders(token);
    });

  const doDeleteFolder = (id: string) =>
    guard(async () => {
      const goHome =
        view === "folder" &&
        folderId !== undefined &&
        (folderId === id || descendantIds(folders, id).includes(folderId));
      await deleteFolder(token, id);
      await refreshFolders(token);
      if (goHome) navigate("/");
      else await refresh();
    });

  const renameFile = (id: string, name: string, onConflict?: OnConflict) =>
    guard(async () => {
      await patchFile(token, id, { original_name: name, on_conflict: onConflict });
      await refresh();
  });

  const setFileExpiry = (id: string, expiresAt: string | null) =>
    guard(async () => {
      await patchFile(token, id, { expires_at: expiresAt });
      await refresh();
    });

  const setFolderExpiry = (id: string, expiresAt: string | null) =>
    guard(async () => {
      await patchFolder(token, id, { expires_at: expiresAt });
      await refreshFolders(token);
      await refresh();
    });

  return {
    files,
    virtualFolders,
    sharedByMap,
    permissionMap,
    shareExpiryMap,
    recipientCountMap,
    directionMap,
    externalFolder,
    loading,
    error,
    setError,
    refresh,
    guard,
    toggleFavorite,
    moveFile,
    removeFile,
    bulkDelete,
    bulkMove,
    doCreateFolder,
    doRenameFolder,
    doMoveFolder,
    doDeleteFolder,
    renameFile,
    setFileExpiry,
    setFolderExpiry,
  };
}
