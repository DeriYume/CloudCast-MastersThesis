import { useMemo, useState } from "react";
import type { FileItem, FolderItem } from "../../api/api";
import { extensionOf } from "../../utils/util";

export type SortKey = "name" | "date" | "size" | "type";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "date", label: "Date added" },
  { key: "size", label: "Size" },
  { key: "type", label: "Type" },
];

export function useFileSort(files: FileItem[]) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  function handleSortSelect(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key === "name" || key === "type");
    }
  }

  const sortedFiles = useMemo(() => {
    const byName = (a: FileItem, b: FileItem) =>
      a.original_name.toLowerCase().localeCompare(b.original_name.toLowerCase());
    const copy = [...files].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = byName(a, b); break;
        case "date": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case "size": cmp = Number(a.size_bytes) - Number(b.size_bytes); break;
        case "type": cmp = extensionOf(a.original_name).localeCompare(extensionOf(b.original_name)); break;
      }
      return cmp !== 0 ? cmp : byName(a, b);
    });
    return sortAsc ? copy : copy.reverse();
  }, [files, sortKey, sortAsc]);

  return { sortKey, sortAsc, sortedFiles, handleSortSelect, SORT_OPTIONS };
}

export function sortFolders(
  folders: FolderItem[],
  sortKey: SortKey,
  sortAsc: boolean,
): FolderItem[] {
  const byName = (a: FolderItem, b: FolderItem) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  if (sortKey === "size" || sortKey === "type") {
    return [...folders].sort(byName);
  }
  const copy = [...folders].sort((a, b) => {
    const cmp =
      sortKey === "date"
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : byName(a, b);
    return cmp !== 0 ? cmp : byName(a, b);
  });
  return sortAsc ? copy : copy.reverse();
}
