import type { Dispatch, SetStateAction } from "react";
import { Snackbar } from "@mui/material";
import ConfirmDialog from "../../components/ConfirmDialog";
import MoveToFolderDialog from "../files/MoveToFolderDialog";
import FolderNameDialog from "../folders/FolderNameDialog";
import ExpiryDialog from "../sharing/ExpiryDialog";
import ShareDialog from "../sharing/ShareDialog";
import ConflictDialog from "../uploads/ConflictDialog";
import { patchFile, type FileItem, type FolderItem, type ConflictInfo, type ConflictChoice, type OnConflict } from "../../api/api";

interface ConflictState { info: ConflictInfo; resolve: (c: ConflictChoice) => void; }

interface Props {
  token: string;
  allFolders: FolderItem[];
  renameTarget: FileItem | null;
  setRenameTarget: Dispatch<SetStateAction<FileItem | null>>;
  moveTarget: FileItem | null;
  setMoveTarget: Dispatch<SetStateAction<FileItem | null>>;
  deleteTarget: FileItem | null;
  setDeleteTarget: Dispatch<SetStateAction<FileItem | null>>;
  shareTarget: FileItem | null;
  setShareTarget: Dispatch<SetStateAction<FileItem | null>>;
  expiryTarget: FileItem | null;
  setExpiryTarget: Dispatch<SetStateAction<FileItem | null>>;
  resolveSingle: (op: (oc?: OnConflict) => Promise<unknown>) => Promise<unknown>;
  doDelete: (id: string) => void;
  setExpiry: (id: string, iso: string | null) => void;
  conflict: ConflictState | null;
  setConflict: Dispatch<SetStateAction<ConflictState | null>>;
  toast: string;
  setToast: Dispatch<SetStateAction<string>>;
}

export default function SearchDialogs({
  token, allFolders,
  renameTarget, setRenameTarget, moveTarget, setMoveTarget, deleteTarget, setDeleteTarget,
  shareTarget, setShareTarget, expiryTarget, setExpiryTarget,
  resolveSingle, doDelete, setExpiry, conflict, setConflict, toast, setToast,
}: Props) {
  return (
    <>
      <FolderNameDialog
        open={Boolean(renameTarget)}
        title="Rename file"
        fieldLabel="File name"
        initialName={renameTarget?.original_name}
        onSubmit={(name) =>
          renameTarget &&
          resolveSingle((oc) => patchFile(token, renameTarget.id, { original_name: name, on_conflict: oc }))
        }
        onClose={() => setRenameTarget(null)}
      />
      <MoveToFolderDialog
        open={Boolean(moveTarget)}
        folders={allFolders}
        currentFolderId={moveTarget?.folder_id ?? null}
        title="Move file to"
        disabledIds={[]}
        onMove={(dest) =>
          moveTarget &&
          resolveSingle((oc) => patchFile(token, moveTarget.id, { folder_id: dest, on_conflict: oc }))
        }
        onClose={() => setMoveTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete file?"
        message={`"${deleteTarget?.original_name}" will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteTarget && doDelete(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
      <ShareDialog
        open={Boolean(shareTarget)}
        token={token}
        fileId={shareTarget?.id}
        resourceName={shareTarget?.original_name ?? ""}
        onClose={() => setShareTarget(null)}
      />
      <ExpiryDialog
        open={Boolean(expiryTarget)}
        resourceName={expiryTarget?.original_name ?? ""}
        currentExpiry={expiryTarget?.expires_at ?? null}
        onSubmit={(iso) => (expiryTarget ? setExpiry(expiryTarget.id, iso) : undefined)}
        onClose={() => setExpiryTarget(null)}
      />
      <ConflictDialog
        conflict={conflict?.info ?? null}
        allowApplyAll={false}
        onResolve={(choice) => { conflict?.resolve(choice); setConflict(null); }}
      />

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
