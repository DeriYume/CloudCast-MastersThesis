import { useEffect, useState } from "react";
import { getFileBlobUrl, type FileItem } from "../../api/api";
import { useAuth } from "../auth/useAuth";

export function useFileBlobUrl(file: FileItem | null): string | null {
  const token = useAuth((s) => s.token)!;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileId = file?.id ?? null;

  const mime = file?.mime_type ?? "";
  const canPreview =
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    mime === "application/pdf";

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;

    if (fileId && canPreview) {
      setPreviewUrl(null);
      getFileBlobUrl(token, fileId)
        .then((u) => {
          if (cancelled) {
            URL.revokeObjectURL(u);
            return;
          }
          url = u;
          setPreviewUrl(u);
        })
        .catch(() => undefined);
    } else {
      setPreviewUrl(null);
    }

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId, canPreview, token]);

  return previewUrl;
}
