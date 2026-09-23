import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Stack, Alert, CircularProgress } from "@mui/material";
import { useFolders } from "../features/folders/useFolders";
import { fileKind, KIND_SYMBOL } from "../utils/util";
import { useAuth } from "../features/auth/useAuth";
import { useFileDetail } from "../features/files/useFileDetail";
import { useFileBlobUrl } from "../features/files/useFileBlobUrl";
import PreviewPane from "../features/preview/PreviewPane";
import AiAnalysisCard from "../features/preview/AiAnalysisCard";
import FileDetailHeader from "../features/files/FileDetailHeader";
import FileDetailActions from "../features/files/FileDetailActions";
import FileDetailMeta from "../features/files/FileDetailMeta";
import FileDetailDialogs from "../features/files/FileDetailDialogs";

export default function FileDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useAuth((s) => s.token)!;
  const folders = useFolders((s) => s.folders);

  const { file, loading, error, notice, setNotice, onDownload, onToggleFavorite, onMove, onDelete, onSetExpiry, onSave } =
    useFileDetail(id!);
  const previewUrl = useFileBlobUrl(file);

  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [expiryOpen, setExpiryOpen] = useState(false);

  const folderName = file?.folder_id
    ? folders.find((f) => f.id === file.folder_id)?.name
    : null;

  const permission = file?.permission ?? "owner";
  const isOwner = permission === "owner";

  const canDownload = isOwner || permission === "save";
  const canSave = !isOwner && permission === "save";

  const kind = file ? fileKind(file.mime_type, file.original_name) : "other";
  const tile = KIND_SYMBOL[kind];

  return (
    <Box>
      <FileDetailHeader fileName={file?.original_name} onBack={() => navigate(-1)} />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : file ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 392px" },
            gap: 2.75,
            alignItems: "start",
          }}
        >

          <Box
            sx={(t) => ({
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "9px",
              bgcolor: "background.paper",
              overflow: "hidden",
              boxShadow: t.colors.cardShadow,
            })}
          >
            <PreviewPane file={file} previewUrl={previewUrl} />
          </Box>

          <Stack spacing={1.75} sx={{ minWidth: 0 }}>

            <FileDetailActions
              canDownload={canDownload}
              canSave={canSave}
              isOwner={isOwner}
              isFavorite={!!file.is_favorite}
              hasExpiry={!!file.expires_at}
              onDownload={onDownload}
              onSave={onSave}
              onToggleFavorite={onToggleFavorite}
              onShareClick={() => setShareOpen(true)}
              onMoveClick={() => setMoveOpen(true)}
              onManageExpiry={() => setExpiryOpen(true)}
              onDeleteClick={() => setDeleteOpen(true)}
            />

            <FileDetailMeta
              file={file}
              tile={tile}
              kind={kind}
              isOwner={isOwner}
              folderName={folderName}
              navigate={navigate}
            />

            <AiAnalysisCard file={file} />

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </Box>
      ) : (
        <Alert severity="error">{error || "File not found"}</Alert>
      )}

      <FileDetailDialogs
        file={file}
        folders={folders}
        token={token}
        moveOpen={moveOpen}
        setMoveOpen={setMoveOpen}
        deleteOpen={deleteOpen}
        setDeleteOpen={setDeleteOpen}
        shareOpen={shareOpen}
        setShareOpen={setShareOpen}
        expiryOpen={expiryOpen}
        setExpiryOpen={setExpiryOpen}
        onMove={onMove}
        onDelete={onDelete}
        onSetExpiry={onSetExpiry}
        notice={notice}
        setNotice={setNotice}
      />
    </Box>
  );
}
