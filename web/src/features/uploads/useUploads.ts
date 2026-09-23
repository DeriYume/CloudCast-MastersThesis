import type { FilesView } from "../files/useFilesData";
import { useEffect, useRef, useState } from "react";
import {
  uploadFile, createFolder, patchFile, deleteFile, embedFile, extractKeywords, runWithConflict, fileNameIndex,
  suggestFiling, getFolderCentroids, bestFolderMatch,
  isNameConflict,
  type AskConflict, type ConflictChoice, type FolderItem, type ApiError,
} from "../../api/api";
import { nameExists, dedupeName, idOf, type NameIndex } from "../../utils/naming";
import type { UploadEntry } from "./UploadProgress";
import { useAiPrefs } from "../../hooks/useAiPrefs";
import { useFolders } from "../folders/useFolders";
import {
  groupByTarget, findTopLevelFolder, findMatchingFolder,
  groupCountLabel, targetFolderName,
} from "./autofile";
import { fileKind } from "../../utils/util";
import type { FilingRow, FilingDecision } from "./FilingReviewDialog";
import { friendlyError } from "../../utils/errors";

export type AskFiling = (rows: FilingRow[]) => Promise<Map<number, FilingDecision> | null>;

export type AskAutoFile = (folderName: string, countLabel: string) =>
  Promise<"create" | "here" | "cancel">;

interface UseUploadsOptions {
  token: string;
  view: FilesView;
  folderId?: string;
  onError: (msg: string) => void;
  onDone: () => Promise<void>;
  askConflict: AskConflict;

  askAutoFile: AskAutoFile;

  askFiling: AskFiling;
}

export function useUploads({
  token, view, folderId, onError, onDone, askConflict, askAutoFile, askFiling,
}: UseUploadsOptions) {
  const [uploadEntries, setUploadEntries] = useState<UploadEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (
      uploadEntries.length > 0 &&
      uploadEntries.every(
        (e) => e.status === "done" || e.status === "error" || e.status === "skipped"
      )
    ) {
      const t = setTimeout(() => setUploadEntries([]), 2000);
      return () => clearTimeout(t);
    }
  }, [uploadEntries]);

  async function ensureFolder(name: string): Promise<FolderItem | null> {

    const already = findTopLevelFolder(useFolders.getState().folders, name);
    if (already) return already;
    try {
      const { folder } = await createFolder(token, name, null);
      const refreshed = useFolders.getState().folders;
      if (!refreshed.some((f) => f.id === folder.id)) {
        useFolders.setState({ folders: [...refreshed, folder as FolderItem] });
      }
      return folder as FolderItem;
    } catch (err) {
      if (isNameConflict(err)) {

        await useFolders.getState().refresh(token);
        const existing = findTopLevelFolder(useFolders.getState().folders, name);
        if (existing) return existing;
      }
      throw err;
    }
  }

  async function resolveAutoFileTargets(
    fileList: File[]
  ): Promise<Map<number, string | undefined> | null> {
    const result = new Map<number, string | undefined>();

    let folders = useFolders.getState().folders;
    const index = new Map<File, number>();
    fileList.forEach((f, i) => index.set(f, i));

    for (const group of groupByTarget(fileList)) {

      if (group.target === null) {
        for (const f of group.files) result.set(index.get(f)!, undefined);
        continue;
      }

      const existing = findMatchingFolder(folders, group.target);
      if (existing) {
        for (const f of group.files) result.set(index.get(f)!, existing.id);
        continue;
      }

      const choice = await askAutoFile(group.target, groupCountLabel(group));
      if (choice === "cancel") return null;
      if (choice === "here") {
        for (const f of group.files) result.set(index.get(f)!, undefined);
        continue;
      }

      try {
        const folder = await ensureFolder(group.target);
        if (folder) {

          folders = [...folders, folder];
          for (const f of group.files) result.set(index.get(f)!, folder.id);
        } else {
          for (const f of group.files) result.set(index.get(f)!, undefined);
        }
      } catch (err) {
        const msg = friendlyError(err, "Could not create folder");
        onError(msg);

        for (const f of group.files) result.set(index.get(f)!, undefined);
      }
    }
    return result;
  }

  function maybeEmbed(fileId: string | undefined, file: File): void {
    if (!fileId || !useAiPrefs.getState().semanticSearch) return;
    const kind = fileKind(file.type, file.name);
    if (kind !== "text" && kind !== "code" && kind !== "image") return;
    void embedFile(token, fileId).catch(() => {  });

    void extractKeywords(token, fileId).catch(() => {  });
  }

  async function uploadBatch(
    fileList: File[],
    perFileDest: Map<number, string | undefined> | null,
    explicitDest: string | undefined
  ) {
    const entries: UploadEntry[] = fileList.map((f) => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      status: "pending",
    }));
    setUploadEntries(entries);

    const memory = { current: null as ConflictChoice | null };

    for (let i = 0; i < fileList.length; i++) {
      const dest = perFileDest ? perFileDest.get(i) : explicitDest;

      const destName =
        perFileDest && dest
          ? useFolders.getState().folders.find((f) => f.id === dest)?.name
          : undefined;
      setUploadEntries((prev) =>
        prev.map((e, idx) => (idx === i ? { ...e, status: "uploading" } : e))
      );
      try {
        const result = await runWithConflict(
          (oc) => uploadFile(token, fileList[i], dest, oc),
          askConflict,
          memory
        );
        if (result !== "skipped") maybeEmbed((result as { file?: { id?: string } }).file?.id, fileList[i]);
        setUploadEntries((prev) =>
          prev.map((e, idx) =>
            idx === i
              ? result === "skipped"
                ? { ...e, status: "skipped" }
                : { ...e, status: "done", dest: destName }
              : e
          )
        );
      } catch (err) {
        const msg = friendlyError(err, "Upload failed");
        setUploadEntries((prev) =>
          prev.map((e, idx) => (idx === i ? { ...e, status: "error", error: msg } : e))
        );
        onError(msg);
      }
    }
  }

  async function uploadSmart(fileList: File[]) {
    const entries: UploadEntry[] = fileList.map((f) => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      status: "pending",
    }));
    setUploadEntries(entries);

    const memory = { current: null as ConflictChoice | null };

    const uploadedIds: (string | undefined)[] = new Array(fileList.length).fill(undefined);

    for (let i = 0; i < fileList.length; i++) {
      setUploadEntries((prev) =>
        prev.map((e, idx) => (idx === i ? { ...e, status: "uploading" } : e))
      );
      let uploadedId: string | undefined;
      try {
        const result = await runWithConflict(
          async (oc) => {
            const r = await uploadFile(token, fileList[i], undefined, oc);
            uploadedId = r.file?.id;
            return r;
          },
          askConflict,
          memory
        );
        if (result === "skipped") {
          setUploadEntries((prev) =>
            prev.map((e, idx) => (idx === i ? { ...e, status: "skipped" } : e))
          );
        } else {
          uploadedIds[i] = uploadedId;

          setUploadEntries((prev) =>
            prev.map((e, idx) => (idx === i ? { ...e, status: "filing" } : e))
          );
        }
      } catch (err) {
        const msg = friendlyError(err, "Upload failed");
        setUploadEntries((prev) =>
          prev.map((e, idx) => (idx === i ? { ...e, status: "error", error: msg } : e))
        );
        onError(msg);
      }
    }

    const FILING_CONCURRENCY = 3;
    let centroids: Map<string, Float32Array>;
    try { centroids = await getFolderCentroids(token); } catch { centroids = new Map(); }

    const rowByIndex: (FilingRow | undefined)[] = new Array(fileList.length).fill(undefined);
    const jobs = fileList
      .map((file, index) => ({ file, index, id: uploadedIds[index] }))
      .filter((j): j is { file: File; index: number; id: string } => Boolean(j.id));

    const nameToDecision = (name: string): FilingDecision => {
      if (!name) return { kind: "root" };
      const existing = findTopLevelFolder(useFolders.getState().folders, name);
      return existing ? { kind: "existing", folderId: existing.id } : { kind: "new", name };
    };

    let aiDown = false;
    let cursor = 0;
    async function filingWorker() {
      while (cursor < jobs.length) {
        const j = jobs[cursor++];

        let suggestedName = targetFolderName(j.file) ?? "";
        let decision: FilingDecision = nameToDecision(suggestedName);
        if (!aiDown) {
          try {
            const { embedding, suggestedName: sn } = await suggestFiling(token, j.id);
            if (sn) suggestedName = sn;

            if (useAiPrefs.getState().semanticSearch) {
              void extractKeywords(token, j.id).catch(() => {  });
            }
            const match = bestFolderMatch(embedding, centroids);
            decision = match
              ? { kind: "existing", folderId: match.folderId }
              : nameToDecision(suggestedName || "Documents");
          } catch (e) {
            const status = (e as ApiError).status;
            if (status === undefined || status === 503 || status === 429) aiDown = true;

          }
        }
        rowByIndex[j.index] = {
          index: j.index,
          fileName: j.file.name,
          mime: j.file.type,
          suggestedName: suggestedName || "Documents",
          decision,
        };
      }
    }
    await Promise.all(Array.from({ length: Math.min(FILING_CONCURRENCY, jobs.length) }, filingWorker));
    const rows = rowByIndex.filter((r): r is FilingRow => Boolean(r));

    const decisions = rows.length > 0 ? await askFiling(rows) : null;

    if (decisions) {
      const newFolderIds = new Map<string, string>();
      const folderIdx = new Map<string, NameIndex>();
      const moveMemory = { current: null as ConflictChoice | null };

      const moveInto = async (fid: string, fileId: string, fileName: string): Promise<boolean> => {
        let idx = folderIdx.get(fid);
        if (!idx) { idx = await fileNameIndex(token, fid); folderIdx.set(fid, idx); }
        if (!nameExists(idx, fileName)) {
          await patchFile(token, fileId, { folder_id: fid });
          idx.set(fileName.toLowerCase(), fileId);
          return true;
        }

        let choice = moveMemory.current;
        if (!choice) choice = await askConflict({ type: "file", name: fileName, existing_id: idOf(idx, fileName)! });
        if (choice.all) moveMemory.current = choice;
        if (choice.action === "skip") {
          await deleteFile(token, fileId);
          return false;
        }
        if (choice.action === "replace") {
          await deleteFile(token, idOf(idx, fileName)!);
          await patchFile(token, fileId, { folder_id: fid });
          idx.set(fileName.toLowerCase(), fileId);
          return true;
        }
        const renamed = dedupeName(idx, fileName);
        await patchFile(token, fileId, { folder_id: fid, original_name: renamed });
        idx.set(renamed.toLowerCase(), fileId);
        return true;
      };
      for (const row of rows) {
        const id = uploadedIds[row.index];
        const d = decisions.get(row.index) ?? { kind: "root" };

        let landedIn: string | undefined;
        try {
          if (id && d.kind === "existing") {
            if (await moveInto(d.folderId, id, row.fileName)) {
              landedIn = useFolders.getState().folders.find((f) => f.id === d.folderId)?.name;
            }
          } else if (id && d.kind === "new") {
            const name = d.name.trim() || "Documents";
            let fid = newFolderIds.get(name.toLowerCase());
            if (!fid) {
              const folder = await ensureFolder(name);
              if (folder) { fid = folder.id; newFolderIds.set(name.toLowerCase(), fid); }
            }
            if (fid && (await moveInto(fid, id, row.fileName))) landedIn = name;
          }

        } catch (err) {
          onError(friendlyError(err, "Could not file upload"));
        }
        markFiled(row.index, landedIn);
      }
    }

    setUploadEntries((prev) =>
      prev.map((e) => (e.status === "filing" ? { ...e, status: "done" } : e))
    );
  }

  function markFiled(index: number, destName?: string) {
    setUploadEntries((prev) =>
      prev.map((e, idx) =>
        idx === index && e.status === "filing" ? { ...e, status: "done", dest: destName } : e
      )
    );
  }

  async function uploadMany(fileList: File[], targetFolderId?: string) {
    if (fileList.length === 0) return;

    const explicitDest = targetFolderId ?? (view === "folder" ? folderId : undefined);
    const mode = useAiPrefs.getState().autoFileMode;

    const atRoot = explicitDest === undefined;

    if (atRoot && mode === "smart") {
      await uploadSmart(fileList);
      await onDone();
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    let perFileDest: Map<number, string | undefined> | null = null;
    if (atRoot && mode === "type") {
      perFileDest = await resolveAutoFileTargets(fileList);
      if (perFileDest === null) {

        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }

    await uploadBatch(fileList, perFileDest, explicitDest);

    await onDone();
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    await uploadMany(Array.from(e.target.files ?? []));
  }

  const isUploading = uploadEntries.some(
    (e) => e.status === "uploading" || e.status === "pending" || e.status === "filing"
  );

  return { uploadEntries, uploadMany, onUpload, isUploading, inputRef };
}
