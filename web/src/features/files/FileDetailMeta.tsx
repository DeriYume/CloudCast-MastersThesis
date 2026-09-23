import type { NavigateFunction } from "react-router-dom";
import { Box, Stack, Typography } from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import { formatBytes, formatDate, expiresSoon, relativeTime, type FileKind } from "../../utils/util";
import type { FileItem } from "../../api/api";
import { MONO_FONT } from "../../theme";

interface Props {
  file: FileItem;
  tile: { icon: string; color: string };
  kind: FileKind;
  isOwner: boolean;
  folderName?: string | null;
  navigate: NavigateFunction;
}

export default function FileDetailMeta({ file, tile, kind, isOwner, folderName, navigate }: Props) {
  const accessEnds = !isOwner ? file.share_expires_at ?? null : null;
  const expiry =
    file.expires_at && accessEnds
      ? (new Date(accessEnds) < new Date(file.expires_at) ? accessEnds : file.expires_at)
      : file.expires_at ?? accessEnds;
  const expiryLabel = expiry && expiry === accessEnds ? "Access expires" : "Expires";

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "9px",
        p: 2.25,
      }}
    >
      <Stack direction="row" spacing={1.625} alignItems="center">
        <Box
          sx={(t) => ({
            width: 48, height: 48, borderRadius: "8px", flexShrink: 0,
            bgcolor: t.colors.primaryTint,
            display: "flex", alignItems: "center", justifyContent: "center",
          })}
        >
          <Icon name={tile.icon} size={26} color={tile.color} fill={kind === "image"} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>
            {file.original_name}
          </Typography>
          <Box sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: 11.5, color: "text.disabled", mt: "2px" }}>
            {file.mime_type}
          </Box>
        </Box>
      </Stack>

      <Box sx={{ height: "1px", bgcolor: "divider", my: 2 }} />

      <MetaRow label="Size" value={formatBytes(file.size_bytes)} mono />
      <MetaRow label="Created" value={formatDate(file.created_at)} mono />
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.625 }}>
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Location</Typography>
        {isOwner && folderName ? (
          <Box
            component="span"
            onClick={() => navigate(`/folders/${file.folder_id}`)}
            sx={{ fontWeight: 500, fontSize: 13, color: "primary.main", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
          >
            {folderName}
          </Box>
        ) : (
          <Typography sx={{ fontSize: 13 }}>{isOwner ? "All files" : "Shared with me"}</Typography>
        )}
      </Stack>
      {!isOwner && file.shared_by && (
        <MetaRow label="Shared by" value={file.shared_by} />
      )}
      {expiry && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.625 }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{expiryLabel}</Typography>
          <Box
            component="span"
            sx={(t) => ({
              display: "inline-flex", alignItems: "center", gap: "5px",
              px: "9px", py: "3px", borderRadius: "8px",
              bgcolor: expiresSoon(expiry)
                ? (t.palette.mode === "light" ? t.colors.accents.warningBgLight : t.colors.accents.warningBgDark)
                : t.colors.primaryTint,
              color: expiresSoon(expiry) ? t.palette.warning.main : t.palette.primary.main,
              fontFamily: MONO_FONT, fontWeight: 500, fontSize: 12,
            })}
          >
            {expiresSoon(expiry) && <Icon name={Icons.schedule} size={13} />}
            {relativeTime(expiry)}
          </Box>
        </Stack>
      )}
    </Box>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.625 }}>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontFamily: mono ? MONO_FONT : undefined, fontWeight: 500, fontSize: 13, textAlign: "right", wordBreak: "break-all" }}>
        {value}
      </Typography>
    </Stack>
  );
}
