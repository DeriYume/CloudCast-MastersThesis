import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Typography, Alert, CircularProgress } from "@mui/material";
import { MONO_FONT } from "../theme";
import { useAuth } from "../features/auth/useAuth";
import { useFolders } from "../features/folders/useFolders";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { FILTERS, type FilterKey, type SearchMode } from "../features/search/searchTypes";
import SearchControls from "../features/search/SearchControls";
import SearchResults from "../features/search/SearchResults";
import SearchEmptyCard from "../features/search/SearchEmptyCard";
import SearchDialogs from "../features/search/SearchDialogs";
import { friendlyError } from "../utils/errors";
import { toggleFavorite as toggleFavoriteId } from "../features/files/favorites";
import {
  searchFiles, semanticSearch, reindexSemantic, patchFile, deleteFile, runWithConflict,
  type ApiError, type FileItem, type FolderItem,
  type OnConflict, type ConflictChoice, type ConflictInfo, type AskConflict,
} from "../api/api";

function isStatus(e: unknown, status: number): boolean {
  return e instanceof Error && (e as ApiError).status === status;
}

export default function SearchPage() {
  const token = useAuth((s) => s.token)!;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const q = params.get("q") ?? "";
  const modeParam = params.get("mode");
  const mode: SearchMode = modeParam === "smart" ? "smart" : "name";
  const typeParam = params.get("type");
  const filter: FilterKey =
    FILTERS.some((f) => f.key === typeParam) ? (typeParam as FilterKey) : "all";

  const debouncedQ = useDebouncedValue(q.trim(), 300);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [smartUnavailable, setSmartUnavailable] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [toast, setToast] = useState("");

  const allFolders = useFolders((s) => s.folders);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const [conflict, setConflict] = useState<{
    info: ConflictInfo;
    resolve: (c: ConflictChoice) => void;
  } | null>(null);
  const askSingle = useCallback<AskConflict>(
    (info) => new Promise<ConflictChoice>((resolve) => setConflict({ info, resolve })),
    []
  );
  const resolveSingle = useCallback(
    (op: (oc?: OnConflict) => Promise<unknown>) =>
      runWithConflict(op, askSingle)
        .then(reload)
        .catch((e) => setError(friendlyError(e, "Something went wrong"))),
    [askSingle, reload]
  );

  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [shareTarget, setShareTarget] = useState<FileItem | null>(null);
  const [expiryTarget, setExpiryTarget] = useState<FileItem | null>(null);

  const toggleFavorite = useCallback(
    (f: FileItem) =>
      toggleFavoriteId(token, f.id, !f.is_favorite)
        .then(() => reload())
        .catch((e) => setError(friendlyError(e, "Couldn't update favourite"))),
    [token, reload]
  );
  const doDelete = useCallback(
    (id: string) =>
      deleteFile(token, id)
        .then(reload)
        .catch((e) => setError(friendlyError(e, "Couldn't delete file"))),
    [token, reload]
  );
  const setExpiry = useCallback(
    (id: string, iso: string | null) =>
      patchFile(token, id, { expires_at: iso })
        .then(reload)
        .catch((e) => setError(friendlyError(e, "Couldn't set expiry"))),
    [token, reload]
  );

  useEffect(() => {
    if (!debouncedQ) {
      setFiles([]);
      setFolders([]);
      setError("");
      setSmartUnavailable(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    const request =
      mode === "smart"
        ? semanticSearch(token, debouncedQ, allFolders)
        : searchFiles(token, debouncedQ, filter === "all" ? undefined : filter, allFolders);

    request
      .then((res) => {
        if (cancelled) return;
        setSmartUnavailable(false);
        setFiles(res.files);
        setFolders(res.folders);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        if (mode === "smart" && isStatus(e, 503)) {
          setSmartUnavailable(true);
          setError("");
        } else {
          setSmartUnavailable(false);
          setError(friendlyError(e, "Search failed"));
        }
        setFiles([]);
        setFolders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, debouncedQ, filter, mode, reloadKey, allFolders]);

  function setMode(next: SearchMode) {
    const params2 = new URLSearchParams(params);
    if (next === "name") params2.delete("mode");
    else params2.set("mode", "smart");

    if (next === "smart") params2.delete("type");
    setParams(params2, { replace: true });
  }

  function setFilter(key: FilterKey) {
    const next = new URLSearchParams(params);
    if (key === "all") next.delete("type");
    else next.set("type", key);
    setParams(next, { replace: true });
  }

  async function handleReindex() {
    setReindexing(true);
    try {
      const res = await reindexSemantic(token);
      setSmartUnavailable(false);
      setToast(
        res.queued > 0
          ? `Indexing started (${res.queued} item${res.queued === 1 ? "" : "s"} queued)`
          : "Index is already up to date"
      );
    } catch (e: unknown) {
      if (isStatus(e, 503)) {
        setSmartUnavailable(true);
        setToast("Smart search isn't enabled on this server");
      } else {
        setToast(friendlyError(e, "Could not start indexing"));
      }
    } finally {
      setReindexing(false);
    }
  }

  const smart = mode === "smart";
  const total = files.length + folders.length;
  const showFolders = folders.length > 0;
  const trimmed = q.trim();
  const hasQuery = trimmed.length > 0;
  const settled = !loading && debouncedQ === trimmed;

  const countLabel = useMemo(() => {
    if (!hasQuery) return "";
    const parts: string[] = [];
    parts.push(`${files.length} file${files.length === 1 ? "" : "s"}`);
    if (!smart && filter === "all")
      parts.push(`${folders.length} folder${folders.length === 1 ? "" : "s"}`);
    return parts.join(" · ");
  }, [hasQuery, files.length, folders.length, filter, smart]);

  return (
    <Box sx={{ minHeight: "70vh" }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          {hasQuery ? `Results for "${trimmed}"` : "Search"}
        </Typography>
        {hasQuery && (
          <Box sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: 12, color: "text.disabled", mt: 0.5 }}>
            {countLabel}
          </Box>
        )}
      </Box>

      <SearchControls
        mode={mode}
        smart={smart}
        filter={filter}
        smartUnavailable={smartUnavailable}
        reindexing={reindexing}
        setMode={setMode}
        setFilter={setFilter}
        handleReindex={handleReindex}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {!hasQuery ? (
        <SearchEmptyCard>
          {smart
            ? "Describe what you're looking for to find files by meaning."
            : "Type in the search bar to find your files and folders by name."}
        </SearchEmptyCard>
      ) : smart && smartUnavailable ? null : loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : settled && total === 0 ? (
        <SearchEmptyCard>No matches for "{trimmed}".</SearchEmptyCard>
      ) : (
        <SearchResults
          showFolders={showFolders}
          folders={folders}
          files={files}
          navigate={navigate}
          token={token}
          toggleFavorite={toggleFavorite}
          setRenameTarget={setRenameTarget}
          setMoveTarget={setMoveTarget}
          setShareTarget={setShareTarget}
          setExpiryTarget={setExpiryTarget}
          setDeleteTarget={setDeleteTarget}
        />
      )}

      <SearchDialogs
        token={token}
        allFolders={allFolders}
        renameTarget={renameTarget}
        setRenameTarget={setRenameTarget}
        moveTarget={moveTarget}
        setMoveTarget={setMoveTarget}
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        shareTarget={shareTarget}
        setShareTarget={setShareTarget}
        expiryTarget={expiryTarget}
        setExpiryTarget={setExpiryTarget}
        resolveSingle={resolveSingle}
        doDelete={doDelete}
        setExpiry={setExpiry}
        conflict={conflict}
        setConflict={setConflict}
        toast={toast}
        setToast={setToast}
      />
    </Box>
  );
}
