import { useState } from "react";
import { HATCH, GLASS, SHADOW_INK, STRONG, SUCCESS } from "../../theme/colors.generated";
import { Box, Link } from "@mui/material";
import { useFileDragActive } from "../dnd/useFileDragActive";
import type { FileItem } from "../../api/api";
import { fileKind, KIND_SYMBOL } from "../../utils/util";
import { Icon, Icons } from "../../components/icons";
import { MONO_FONT } from "../../theme";
import FullscreenImage from "./FullscreenImage";
import VideoPreview from "./VideoPreview";
import ZipContents from "./ZipContents";
import TextPreview from "./TextPreview";

interface Props {
  file: FileItem;

  previewUrl: string | null;
}

const HATCH_LIGHT = `repeating-linear-gradient(135deg,${HATCH.light1} 0 14px,${HATCH.light2} 14px 28px)`;
const HATCH_DARK = `repeating-linear-gradient(135deg,${HATCH.dark1} 0 14px,${HATCH.dark2} 14px 28px)`;

function PlaceholderTile({ file, caption }: { file: FileItem; caption: string }) {
  const kind = fileKind(file.mime_type, file.original_name);
  const tile = KIND_SYMBOL[kind];
  return (
    <Box
      sx={(t) => ({
        minHeight: 420,
        background: t.palette.mode === "light" ? HATCH_LIGHT : HATCH_DARK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Box sx={{ textAlign: "center" }}>
        <Box
          sx={{
            width: 70, height: 70, mx: "auto", borderRadius: "9px",
            bgcolor: "background.paper",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name={tile.icon} size={36} color={tile.color} fill={kind === "image"} />
        </Box>
        <Box
          sx={(t) => ({
            fontFamily: MONO_FONT, fontWeight: 500, fontSize: 12,
            color: t.palette.mode === "light" ? t.colors.accents.aiMetaLight : t.colors.accents.aiMetaDark,
            mt: 1.75,
          })}
        >
          {caption}
        </Box>
      </Box>
    </Box>
  );
}

export default function PreviewPane({ file, previewUrl }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const kind = fileKind(file.mime_type, file.original_name);

  const fileDragActive = useFileDragActive();

  if (kind === "archive") {
    return <ZipContents fileId={file.id} />;
  }

  if (kind === "text" || kind === "code") {
    return <TextPreview fileId={file.id} />;
  }

  if (!previewUrl) {
    return <PlaceholderTile file={file} caption="LOADING PREVIEW…" />;
  }

  if (kind === "image") {
    return (
      <>
        <Box
          sx={(t) => ({
            position: "relative",
            minHeight: 420,
            background: t.palette.mode === "light" ? HATCH_LIGHT : HATCH_DARK,
            display: "flex", alignItems: "center", justifyContent: "center",
          })}
        >
          <Box
            component="img"
            src={previewUrl}
            alt={file.original_name}
            onClick={() => setFullscreen(true)}
            sx={{ maxWidth: "100%", maxHeight: 540, objectFit: "contain", cursor: "zoom-in", display: "block" }}
          />
          <Box
            onClick={() => setFullscreen(true)}
            sx={{
              position: "absolute", bottom: 14, right: 14, width: 38, height: 38, borderRadius: "7px",
              bgcolor: GLASS, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 2px 8px rgba(${SHADOW_INK.light},.12)`, cursor: "zoom-in",
            }}
          >
            <Icon name={Icons.fullscreen} size={20} color={STRONG} />
          </Box>
        </Box>
        <FullscreenImage
          src={previewUrl}
          alt={file.original_name}
          open={fullscreen}
          onClose={() => setFullscreen(false)}
        />
      </>
    );
  }

  if (kind === "video") {
    return (
      <Box sx={(t) => ({ background: t.palette.mode === "light" ? HATCH_LIGHT : HATCH_DARK, p: 2 })}>
        <VideoPreview src={previewUrl} />
      </Box>
    );
  }

  if (kind === "audio") {
    return (
      <Box sx={(t) => ({
        minHeight: 240, p: 3,
        background: t.palette.mode === "light" ? HATCH_LIGHT : HATCH_DARK,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2.5,
      })}>
        <Box sx={{ width: 70, height: 70, borderRadius: "9px", bgcolor: "background.paper", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={Icons.musicNote} size={36} color={SUCCESS} fill />
        </Box>
        <audio src={previewUrl} controls style={{ width: "100%", maxWidth: 420, display: "block" }} />
      </Box>
    );
  }

  if (kind === "pdf") {
    return (
      <Box>
        <Box
          component="iframe"
          src={previewUrl}
          title={file.original_name}
          sx={{
            width: "100%", height: "70vh", border: 0, display: "block", bgcolor: "background.default",
            pointerEvents: fileDragActive ? "none" : "auto",
          }}
        />
        <Box sx={{ px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Link href={previewUrl} target="_blank" rel="noopener" variant="caption">
            Open in a new tab
          </Link>
        </Box>
      </Box>
    );
  }

  return <PlaceholderTile file={file} caption="NO PREVIEW" />;
}
