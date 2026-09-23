import { useState } from "react";
import type { FolderItem, FileItem } from "../../api/api";
import type FileCard from "./FileCard";

type FileTarget = Parameters<typeof FileCard>[0]["file"];

export function useFilesPageDialogs() {
  const [renameFileTarget, setRenameFileTarget] = useState<FileTarget | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileTarget | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<FileTarget | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<FolderItem | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<FolderItem | null>(null);
  const [folderMoveTarget, setFolderMoveTarget] = useState<FolderItem | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [shareFileTarget, setShareFileTarget] = useState<FileItem | null>(null);
  const [shareFolderTarget, setShareFolderTarget] = useState<FolderItem | null>(null);
  const [expiryFileTarget, setExpiryFileTarget] = useState<FileItem | null>(null);
  const [expiryFolderTarget, setExpiryFolderTarget] = useState<FolderItem | null>(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  return {
    renameFileTarget, setRenameFileTarget,
    moveTarget, setMoveTarget,
    deleteFileTarget, setDeleteFileTarget,
    renameFolderTarget, setRenameFolderTarget,
    deleteFolderTarget, setDeleteFolderTarget,
    folderMoveTarget, setFolderMoveTarget,
    newFolderOpen, setNewFolderOpen,
    newFolderParent, setNewFolderParent,
    shareFileTarget, setShareFileTarget,
    shareFolderTarget, setShareFolderTarget,
    expiryFileTarget, setExpiryFileTarget,
    expiryFolderTarget, setExpiryFolderTarget,
    bulkMoveOpen, setBulkMoveOpen,
    bulkDeleteOpen, setBulkDeleteOpen,
  };
}
