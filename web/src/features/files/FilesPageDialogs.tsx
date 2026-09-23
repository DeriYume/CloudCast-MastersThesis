import type { Dispatch, SetStateAction } from "react";
import { Snackbar } from "@mui/material";
import ConfirmDialog from "../../components/ConfirmDialog";
import MoveToFolderDialog from "./MoveToFolderDialog";
import FolderNameDialog from "../folders/FolderNameDialog";
import ExpiryDialog from "../sharing/ExpiryDialog";
import ShareDialog from "../sharing/ShareDialog";
import AutoFileDialog, { type AutoFileChoice } from "../uploads/AutoFileDialog";
import ConflictDialog from "../uploads/ConflictDialog";
import UploadProgress from "../uploads/UploadProgress";
import { descendantIds } from "../../utils/util";
import type { FolderItem, ConflictInfo, ConflictChoice, OnConflict } from "../../api/api";
import type { FilesView as View } from "./useFilesData";
import type { useFilesData } from "./useFilesData";
import type { useSelection } from "./useSelection";
import type { useUploads } from "../uploads/useUploads";
import type { useFilesPageDialogs } from "./useFilesPageDialogs";

type FilesData = ReturnType<typeof useFilesData>;
type SelectionApi = ReturnType<typeof useSelection>;
type Uploads = ReturnType<typeof useUploads>;
type Dialogs = ReturnType<typeof useFilesPageDialogs>;

interface ConflictState { info: ConflictInfo; bulk: boolean; resolve: (c: ConflictChoice) => void; }
interface AutoFileState { folderName: string; countLabel: string; resolve: (c: AutoFileChoice) => void; }

interface Props {
  dialogs: Dialogs;
  folders: FolderItem[];
  token: string;
  view: View;
  folderId?: string;
  selection: SelectionApi;
  resolveSingle: (op: (oc?: OnConflict) => Promise<unknown>) => Promise<unknown>;
  moveFile: FilesData["moveFile"];
  doMoveFolder: FilesData["doMoveFolder"];
  doCreateFolder: FilesData["doCreateFolder"];
  doRenameFolder: FilesData["doRenameFolder"];
  renameFile: FilesData["renameFile"];
  removeFile: FilesData["removeFile"];
  doDeleteFolder: FilesData["doDeleteFolder"];
  setFileExpiry: FilesData["setFileExpiry"];
  setFolderExpiry: FilesData["setFolderExpiry"];
  confirmBulkDelete: () => void;
  confirmBulkMove: (dest: string | null) => void;
  conflict: ConflictState | null;
  setConflict: Dispatch<SetStateAction<ConflictState | null>>;
  autoFile: AutoFileState | null;
  setAutoFile: Dispatch<SetStateAction<AutoFileState | null>>;
  uploadEntries: Uploads["uploadEntries"];
  toast: string;
  setToast: Dispatch<SetStateAction<string>>;
}

export default function FilesPageDialogs({
  dialogs, folders, token, view, folderId, selection,
  resolveSingle, moveFile, doMoveFolder, doCreateFolder, doRenameFolder, renameFile, removeFile, doDeleteFolder,
  setFileExpiry, setFolderExpiry, confirmBulkDelete, confirmBulkMove,
  conflict, setConflict, autoFile, setAutoFile, uploadEntries, toast, setToast,
}: Props) {
  const {
    moveTarget, setMoveTarget,
    folderMoveTarget, setFolderMoveTarget,
    newFolderOpen, setNewFolderOpen,
    newFolderParent,
    renameFolderTarget, setRenameFolderTarget,
    renameFileTarget, setRenameFileTarget,
    deleteFileTarget, setDeleteFileTarget,
    deleteFolderTarget, setDeleteFolderTarget,
    bulkDeleteOpen, setBulkDeleteOpen,
    shareFileTarget, setShareFileTarget,
    shareFolderTarget, setShareFolderTarget,
    expiryFileTarget, setExpiryFileTarget,
    expiryFolderTarget, setExpiryFolderTarget,
    bulkMoveOpen, setBulkMoveOpen,
  } = dialogs;

  return (
    <>
      <MoveToFolderDialog
        open={Boolean(moveTarget)}
        folders={folders}
        currentFolderId={moveTarget?.folder_id ?? null}
        title="Move file to"
        onMove={(dest) => moveTarget && resolveSingle((oc) => moveFile(moveTarget.id, dest, oc))}
        onClose={() => setMoveTarget(null)}
      />
      <MoveToFolderDialog
        open={Boolean(folderMoveTarget)}
        folders={folders}
        currentFolderId={folderMoveTarget?.parent_id ?? null}
        title="Move folder to"
        disabledIds={
          folderMoveTarget
            ? [folderMoveTarget.id, ...descendantIds(folders, folderMoveTarget.id)]
            : []
        }
        onMove={(dest) => folderMoveTarget && resolveSingle((oc) => doMoveFolder(folderMoveTarget.id, dest, oc))}
        onClose={() => setFolderMoveTarget(null)}
      />
      <FolderNameDialog
        open={newFolderOpen}
        title={newFolderParent ? "New subfolder" : "New folder"}
        confirmLabel="Create"
        onSubmit={(name) => resolveSingle((oc) => doCreateFolder(name, newFolderParent, oc))}
        onClose={() => setNewFolderOpen(false)}
      />
      <FolderNameDialog
        open={Boolean(renameFolderTarget)}
        title="Rename folder"
        initialName={renameFolderTarget?.name}
        onSubmit={(name) => renameFolderTarget && resolveSingle((oc) => doRenameFolder(renameFolderTarget.id, name, oc))}
        onClose={() => setRenameFolderTarget(null)}
      />
      <FolderNameDialog
        open={Boolean(renameFileTarget)}
        title="Rename file"
        fieldLabel="File name"
        initialName={renameFileTarget?.original_name}
        onSubmit={(name) => renameFileTarget && resolveSingle((oc) => renameFile(renameFileTarget.id, name, oc))}
        onClose={() => setRenameFileTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(deleteFileTarget)}
        title="Delete file?"
        message={`"${deleteFileTarget?.original_name}" will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteFileTarget && removeFile(deleteFileTarget.id)}
        onClose={() => setDeleteFileTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(deleteFolderTarget)}
        title="Delete folder?"
        message={`"${deleteFolderTarget?.name}" and everything inside it - sub-folders and files - will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete folder"
        destructive
        onConfirm={() => deleteFolderTarget && doDeleteFolder(deleteFolderTarget.id)}
        onClose={() => setDeleteFolderTarget(null)}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selected items?"
        message={`${selection.count} item${selection.count === 1 ? "" : "s"}${
          selection.selectedFolders.length > 0
            ? " (folders include everything inside them)"
            : ""
        } will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmBulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />

      <ShareDialog
        open={Boolean(shareFileTarget)}
        token={token}
        fileId={shareFileTarget?.id}
        resourceName={shareFileTarget?.original_name ?? ""}
        onClose={() => setShareFileTarget(null)}
      />
      <ShareDialog
        open={Boolean(shareFolderTarget)}
        token={token}
        folderId={shareFolderTarget?.id}
        resourceName={shareFolderTarget?.name ?? ""}
        onClose={() => setShareFolderTarget(null)}
      />
      <ExpiryDialog
        open={Boolean(expiryFileTarget)}
        resourceName={expiryFileTarget?.original_name ?? ""}
        currentExpiry={expiryFileTarget?.expires_at ?? null}
        onSubmit={(iso) => expiryFileTarget ? setFileExpiry(expiryFileTarget.id, iso) : undefined}
        onClose={() => setExpiryFileTarget(null)}
      />
      <ExpiryDialog
        open={Boolean(expiryFolderTarget)}
        resourceName={expiryFolderTarget?.name ?? ""}
        currentExpiry={expiryFolderTarget?.expires_at ?? null}
        onSubmit={(iso) => expiryFolderTarget ? setFolderExpiry(expiryFolderTarget.id, iso) : undefined}
        onClose={() => setExpiryFolderTarget(null)}
      />

      <MoveToFolderDialog
        open={bulkMoveOpen}
        folders={folders}
        currentFolderId={view === "folder" && folderId ? folderId : null}
        title={`Move ${selection.count} item${selection.count === 1 ? "" : "s"} to`}
        disabledIds={selection.selectedFolders.flatMap((f) => [f.id, ...descendantIds(folders, f.id)])}
        onMove={(dest) => confirmBulkMove(dest)}
        onClose={() => setBulkMoveOpen(false)}
      />

      <ConflictDialog
        conflict={conflict?.info ?? null}
        allowApplyAll={conflict?.bulk ?? false}
        onResolve={(choice) => { conflict?.resolve(choice); setConflict(null); }}
      />

      <AutoFileDialog
        folderName={autoFile?.folderName ?? null}
        countLabel={autoFile?.countLabel ?? ""}
        onResolve={(choice) => { autoFile?.resolve(choice); setAutoFile(null); }}
      />

      <UploadProgress entries={uploadEntries} />

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast("")}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
