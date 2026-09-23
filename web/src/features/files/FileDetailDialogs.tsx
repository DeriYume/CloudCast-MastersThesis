import type { Dispatch, SetStateAction } from "react";
import { Snackbar } from "@mui/material";
import ConfirmDialog from "../../components/ConfirmDialog";
import MoveToFolderDialog from "./MoveToFolderDialog";
import ShareDialog from "../sharing/ShareDialog";
import ExpiryDialog from "../sharing/ExpiryDialog";
import type { FileItem, FolderItem } from "../../api/api";
import type { useFileDetail } from "./useFileDetail";

type FileDetail = ReturnType<typeof useFileDetail>;

interface Props {
  file: FileItem | null;
  folders: FolderItem[];
  token: string;
  moveOpen: boolean;
  setMoveOpen: Dispatch<SetStateAction<boolean>>;
  deleteOpen: boolean;
  setDeleteOpen: Dispatch<SetStateAction<boolean>>;
  shareOpen: boolean;
  setShareOpen: Dispatch<SetStateAction<boolean>>;
  expiryOpen: boolean;
  setExpiryOpen: Dispatch<SetStateAction<boolean>>;
  onMove: FileDetail["onMove"];
  onDelete: FileDetail["onDelete"];
  onSetExpiry: FileDetail["onSetExpiry"];
  notice: string;
  setNotice: FileDetail["setNotice"];
}

export default function FileDetailDialogs({
  file, folders, token, moveOpen, setMoveOpen, deleteOpen, setDeleteOpen, shareOpen, setShareOpen,
  expiryOpen, setExpiryOpen, onMove, onDelete, onSetExpiry, notice, setNotice,
}: Props) {
  return (
    <>
      {file && (
        <>
          <MoveToFolderDialog
            open={moveOpen}
            folders={folders}
            currentFolderId={file.folder_id}
            onMove={onMove}
            onClose={() => setMoveOpen(false)}
          />
          <ConfirmDialog
            open={deleteOpen}
            title="Delete file?"
            message={`"${file.original_name}" will be permanently deleted. This can't be undone.`}
            confirmLabel="Delete"
            destructive
            onConfirm={onDelete}
            onClose={() => setDeleteOpen(false)}
          />
          <ShareDialog
            open={shareOpen}
            token={token}
            fileId={file.id}
            resourceName={file.original_name}
            onClose={() => setShareOpen(false)}
          />
          <ExpiryDialog
            open={expiryOpen}
            resourceName={file.original_name}
            currentExpiry={file.expires_at}
            onSubmit={onSetExpiry}
            onClose={() => setExpiryOpen(false)}
          />
        </>
      )}

      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={() => setNotice("")}
        message={notice}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
