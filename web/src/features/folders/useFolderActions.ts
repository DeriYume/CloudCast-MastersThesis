import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createFolder, renameFolder, deleteFolder, type FolderItem } from "../../api/api";
import { useFolders } from "./useFolders";
import { descendantIds } from "../../utils/util";

interface UseFolderActionsOptions {
  token: string | null;
  activeFolderId: string | undefined;
  onCreated?: (parentId: string | null) => void;
}

export function useFolderActions({ token, activeFolderId, onCreated }: UseFolderActionsOptions) {
  const folders = useFolders((s) => s.folders);
  const refreshFolders = useFolders((s) => s.refresh);
  const navigate = useNavigate();

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);

  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuFolder, setMenuFolder] = useState<FolderItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<FolderItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FolderItem | null>(null);

  function openNewFolder(parent: string | null) {
    setNewFolderParent(parent);
    setNewFolderOpen(true);
  }

  function openFolderMenu(e: React.MouseEvent<HTMLElement>, folder: FolderItem) {
    e.stopPropagation();
    setMenuFolder(folder);
    setMenuEl(e.currentTarget);
  }
  function closeFolderMenu() {
    setMenuEl(null);
    setMenuFolder(null);
  }

  async function handleCreateFolder(name: string) {
    if (!token) return;
    const { folder } = await createFolder(token, name, newFolderParent);
    await refreshFolders(token);
    onCreated?.(newFolderParent);
    navigate(`/folders/${folder.id}`);
  }

  async function handleRenameFolder(id: string, name: string) {
    if (!token) return;
    await renameFolder(token, id, name);
    await refreshFolders(token);
  }

  async function handleDeleteFolder(id: string) {
    if (!token) return;
    const leaving =
      activeFolderId !== undefined &&
      (activeFolderId === id || descendantIds(folders, id).includes(activeFolderId));
    await deleteFolder(token, id);
    await refreshFolders(token);
    if (leaving) navigate("/");
  }

  return {
    newFolderOpen,
    newFolderParent,
    openNewFolder,
    closeNewFolder: () => setNewFolderOpen(false),
    handleCreateFolder,
    menuEl,
    menuFolder,
    openFolderMenu,
    closeFolderMenu,
    renameTarget,
    setRenameTarget,
    handleRenameFolder,
    deleteTarget,
    setDeleteTarget,
    handleDeleteFolder,
  };
}
