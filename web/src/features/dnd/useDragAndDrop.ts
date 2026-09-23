import type { FilesView } from "../files/useFilesData";
import { useEffect, useRef, useState } from "react";
import { FILE_DRAG_KEY, FOLDER_DRAG_KEY } from "./dragKeys";

type DragTarget = "page" | string | null;

interface UseDragAndDropOptions {
  token: string;
  view: FilesView;
  folderId?: string;
  onUploadMany: (files: File[], targetFolderId?: string) => Promise<void>;
  onMoveFile: (fileId: string, destFolderId: string) => void;
  onMoveFolder: (folderId: string, destFolderId: string) => void;
}

export interface FolderHandlers {
  onDragEnter: (fid: string) => void;
  onDragLeave: (fid: string) => void;
  onMoveFile: (fileId: string, destFolderId: string) => void;
  onMoveFolder: (folderId: string, destFolderId: string) => void;
  onDrop: (e: React.DragEvent, fid: string) => void;
}

export interface ShieldProps {
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}

export function useDragAndDrop({
  onUploadMany,
  onMoveFile,
  onMoveFolder,
}: UseDragAndDropOptions): {
  dragTarget: DragTarget;
  folderHandlers: FolderHandlers;
  shieldActive: boolean;
  shieldProps: ShieldProps;
} {
  const [folderTarget, setFolderTargetState] = useState<string | null>(null);

  const folderTargetRef = useRef<string | null>(null);
  function setFolderTarget(
    next: string | null | ((prev: string | null) => string | null)
  ) {
    const value = typeof next === "function" ? next(folderTargetRef.current) : next;
    folderTargetRef.current = value;
    setFolderTargetState(value);
  }
  const [uploadActive, setUploadActive] = useState(false);

  const uploadRef = useRef(onUploadMany);
  uploadRef.current = onUploadMany;

  useEffect(() => {
    function reset() {
      setFolderTarget(null);
      setUploadActive(false);
    }

    function onDocDragLeave(e: DragEvent) { if (e.relatedTarget === null) reset(); }
    function onVisibility() { if (document.hidden) reset(); }

    function onWindowDrop(e: DragEvent) {
      const files = e.dataTransfer?.files;

      const target = folderTargetRef.current ?? undefined;
      reset();
      if (files && files.length > 0) uploadRef.current(Array.from(files), target);
    }

    function onWindowDragOver(e: DragEvent) {
      const types = e.dataTransfer?.types;
      if (!types) return;
      const t = Array.from(types);
      const internal = t.includes(FILE_DRAG_KEY) || t.includes(FOLDER_DRAG_KEY);
      if (!internal && t.includes("Files")) setUploadActive(true);
    }

    window.addEventListener("dragenter", onWindowDragOver, { capture: true });
    window.addEventListener("dragover", onWindowDragOver, { capture: true });
    window.addEventListener("drop", onWindowDrop);
    window.addEventListener("dragend", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("dragleave", onDocDragLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("dragenter", onWindowDragOver, { capture: true });
      window.removeEventListener("dragover", onWindowDragOver, { capture: true });
      window.removeEventListener("drop", onWindowDrop);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("dragleave", onDocDragLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const dragTarget: DragTarget = folderTarget ?? (uploadActive ? "page" : null);

  const folderHandlers: FolderHandlers = {
    onDragEnter(fid) {
      setFolderTarget(fid);
    },
    onDragLeave(fid) {
      setFolderTarget((prev) => (prev === fid ? null : prev));
    },
    onMoveFile,
    onMoveFolder,
    onDrop(e, _fid) {
      e.preventDefault();
      e.stopPropagation();
      setFolderTarget(null);
      setUploadActive(false);
    },
  };

  function folderIdAt(x: number, y: number): string | null {
    for (const el of document.elementsFromPoint(x, y)) {
      const hit = (el as HTMLElement).closest?.("[data-folder-id]");
      if (hit) return (hit as HTMLElement).getAttribute("data-folder-id");
    }
    return null;
  }

  function folderIdNear(x: number, y: number): string | null {
    for (const [dx, dy] of [[0, 0], [0, -6], [0, 6], [-6, 0], [6, 0]]) {
      const fid = folderIdAt(x + dx, y + dy);
      if (fid) return fid;
    }
    return null;
  }

  const shieldProps: ShieldProps = {
    onDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      setFolderTarget(folderIdNear(e.clientX, e.clientY));
    },
    onDrop(e) {
      e.preventDefault();
      e.stopPropagation();

      const fid = folderIdNear(e.clientX, e.clientY) ?? folderTargetRef.current;
      setFolderTarget(null);
      setUploadActive(false);
      if (e.dataTransfer.files.length > 0) {
        onUploadMany(Array.from(e.dataTransfer.files), fid ?? undefined);
      }
    },

    onClick() {
      setFolderTarget(null);
      setUploadActive(false);
    },
  };

  return { dragTarget, folderHandlers, shieldActive: uploadActive, shieldProps };
}
