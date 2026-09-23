import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { getFile, deleteFile, downloadFile, patchFile, saveSharedFile, type FileItem } from "../../api/api";
import { toggleFavorite as toggleFavoriteId } from "./favorites";
import { useVaultRevision } from "./useVaultRevision";
import { reconcileItem } from "../../utils/reconcile";
import { friendlyError } from "../../utils/errors";

interface UseFileDetailReturn {
  file: FileItem | null;
  loading: boolean;
  error: string;

  notice: string;
  setNotice: (s: string) => void;
  onDownload: () => Promise<void>;
  onToggleFavorite: () => Promise<void>;
  onMove: (dest: string | null) => Promise<void>;
  onDelete: () => Promise<void>;
  onSetExpiry: (expiresAt: string | null) => Promise<void>;
  onSave: () => Promise<void>;
}

export function useFileDetail(id: string): UseFileDetailReturn {
  const token = useAuth((s) => s.token)!;
  const navigate = useNavigate();

  const [file, setFile] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadedId = useRef<string | null>(null);

  const revision = useVaultRevision((s) => s.revision);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(loadedId.current !== id);
      try {
        const { file: fresh } = await getFile(token, id);
        if (cancelled) return;

        setFile((prev) => reconcileItem(prev, fresh));
        loadedId.current = id;
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, "Failed to load"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, token, revision]);

  async function onDownload() {
    if (!file) return;
    try {
      await downloadFile(token, file.id, file.original_name);
    } catch (e) {
      setError(friendlyError(e, "Download failed"));
    }
  }

  async function onToggleFavorite() {
    if (!file) return;
    const next = !file.is_favorite;
    try {
      await toggleFavoriteId(token, file.id, next);
      setFile({ ...file, is_favorite: next });
    } catch (e) {
      setError(friendlyError(e, "Update failed"));
    }
  }

  async function onMove(dest: string | null) {
    if (!file) return;
    try {
      const { file: updated } = await patchFile(token, file.id, {
        folder_id: dest,
      });
      setFile(updated);
    } catch (e) {
      setError(friendlyError(e, "Move failed"));
    }
  }

  async function onDelete() {
    if (!file) return;
    try {
      await deleteFile(token, file.id);
      navigate(-1);
    } catch (e) {
      setError(friendlyError(e, "Delete failed"));
    }
  }

  async function onSetExpiry(expiresAt: string | null) {
    if (!file) return;
    try {
      const { file: updated } = await patchFile(token, file.id, { expires_at: expiresAt });
      setFile(updated);
    } catch (e) {
      setError(friendlyError(e, "Could not update expiry"));
      throw e;
    }
  }

  async function onSave() {
    if (!file) return;
    setError("");
    try {
      await saveSharedFile(token, file.id);
      setNotice(`Saved "${file.original_name}" to your cloud.`);
    } catch (e) {
      setError(friendlyError(e, "Could not save this file."));
    }
  }

  return {
    file, loading, error, notice, setNotice,
    onDownload, onToggleFavorite, onMove, onDelete, onSetExpiry, onSave,
  };
}
