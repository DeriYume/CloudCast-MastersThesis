import { useCallback, useMemo, useState } from "react";
import type { FileItem, FolderItem } from "../../api/api";

export type SelectionKind = "file" | "folder";

export interface SelectedRef {
  type: SelectionKind;
  id: string;
}

export function useSelection(files: FileItem[], folders: FolderItem[]) {
  const [fileIds, setFileIds] = useState<Set<string>>(() => new Set());
  const [folderIds, setFolderIds] = useState<Set<string>>(() => new Set());

  const isSelected = useCallback(
    (type: SelectionKind, id: string) =>
      type === "file" ? fileIds.has(id) : folderIds.has(id),
    [fileIds, folderIds]
  );

  const toggle = useCallback((type: SelectionKind, id: string) => {
    const setter = type === "file" ? setFileIds : setFolderIds;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setFileIds(new Set());
    setFolderIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setFileIds(new Set(files.map((f) => f.id)));
    setFolderIds(new Set(folders.map((f) => f.id)));
  }, [files, folders]);

  const selectOnly = useCallback((fls: FileItem[], flds: FolderItem[]) => {
    setFileIds(new Set(fls.map((f) => f.id)));
    setFolderIds(new Set(flds.map((f) => f.id)));
  }, []);

  const count = fileIds.size + folderIds.size;
  const active = count > 0;

  const visibleCount = files.length + folders.length;
  const allSelected = visibleCount > 0 && count === visibleCount;

  const selectedFiles = useMemo(
    () => files.filter((f) => fileIds.has(f.id)),
    [files, fileIds]
  );
  const selectedFolders = useMemo(
    () => folders.filter((f) => folderIds.has(f.id)),
    [folders, folderIds]
  );

  const selected = useMemo<SelectedRef[]>(
    () => [
      ...selectedFiles.map((f) => ({ type: "file" as const, id: f.id })),
      ...selectedFolders.map((f) => ({ type: "folder" as const, id: f.id })),
    ],
    [selectedFiles, selectedFolders]
  );

  return {
    isSelected,
    toggle,
    clear,
    selectAll,
    selectOnly,
    count,
    active,
    allSelected,
    selected,
    selectedFiles,
    selectedFolders,
  };
}
