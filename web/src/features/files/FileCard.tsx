import { useState } from "react";
import { SELECTION_TINT, SELECTION_BORDER, FAVORITE } from "../../theme/colors.generated";
import {
  Card, CardActionArea, CardContent,
  Typography, IconButton, Menu,
  MenuItem, ListItemIcon, ListItemText, Box, Stack,
} from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import type { FileItem } from "../../api/api";
import { useLongPress } from "../../hooks/useLongPress";
import { MONO_FONT } from "../../theme";
import {
  formatBytes, formatDate, fileKind, relativeTime, expiresSoon, KIND_SYMBOL,
} from "../../utils/util";

import { FILE_DRAG_KEY } from "../dnd/dragKeys";

export const MULTI_DRAG_KEY = "application/x-cloudcast-multi";

export let isFileDragging = false;

interface Props {
  file: FileItem;
  sharedBy?: string;
  location?: string;
  readOnly?: boolean;

  accessEndsAt?: string | null;

  recipientCount?: number;

  onSave?: () => void;
  selectable?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onOpen: () => void;
  onToggleFavorite?: () => void;
  onMove?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onRename?: () => void;
  onShare?: () => void;
  onManageExpiry?: () => void;

  onStopSharing?: () => void;

  onRemove?: () => void;
}

const metaSx = { fontFamily: MONO_FONT, fontWeight: 500, fontSize: 11.5, color: "text.disabled" } as const;

function MetaChip({
  icon, label, title, variant = "tint", color, bg, borderColor,
}: {
  icon: string;
  label: string;
  title?: string;
  variant?: "tint" | "outline" | "warning";
  color?: string;
  bg?: string;
  borderColor?: string;
}) {
  return (
    <Box
      component="span"
      title={title}
      sx={(t) => {
        const tint = t.colors.primaryTint;
        const warnBg = t.palette.mode === "light" ? t.colors.accents.warningBgLight : t.colors.accents.warningBgDark;
        const styles =
          variant === "outline"
            ? { bg: "transparent", color: t.palette.text.secondary, border: `1px solid ${t.palette.divider}` }
            : variant === "warning"
            ? { bg: warnBg, color: t.palette.warning.main, border: "none" }
            : { bg: tint, color: t.palette.primary.main, border: "none" };
        return {
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          maxWidth: "100%",
          padding: "3px 9px",
          borderRadius: "7px",
          fontFamily: '"Hanken Grotesk", sans-serif',
          fontWeight: 500,
          fontSize: 11,
          background: bg ?? styles.bg,
          color: color ?? styles.color,
          border: borderColor ? `1px solid ${borderColor}` : styles.border,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        };
      }}
    >
      <Icon name={icon} size={13} />
      {label}
    </Box>
  );
}

export default function FileCard({
  file,
  sharedBy,
  location,
  readOnly = false,
  accessEndsAt,
  recipientCount,
  onSave,
  selectable = false,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onOpen,
  onToggleFavorite,
  onMove,
  onDownload,
  onDelete,
  onRename,
  onShare,
  onManageExpiry,
  onStopSharing,
  onRemove,
}: Props) {
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [dragging, setDragging] = useState(false);
  const kind = KIND_SYMBOL[fileKind(file.mime_type, file.original_name)];

  const hasMenu = Boolean(onRename || onMove || onShare || onManageExpiry || onSave || onDownload || onDelete || onStopSharing || onRemove);
  const hasChips =
    !!location || !!sharedBy || recipientCount !== undefined || !!accessEndsAt || !!file.expires_at;

  const longPress = useLongPress(() => onToggleSelect?.());
  function handleClick() {
    if (longPress.fired.current) { longPress.fired.current = false; return; }
    if (selectionMode) onToggleSelect?.();
    else onOpen();
  }

  return (
    <Card
      variant="outlined"
      draggable={!readOnly}
      onDragStart={
        readOnly
          ? undefined
          : (e) => {
              longPress.cancel();
              e.dataTransfer.setData(FILE_DRAG_KEY, file.id);
              if (selected) e.dataTransfer.setData(MULTI_DRAG_KEY, "1");
              e.dataTransfer.effectAllowed = "move";
              isFileDragging = true;
              setDragging(true);
            }
      }
      onDragEnd={
        readOnly
          ? undefined
          : () => {
              isFileDragging = false;
              setDragging(false);
            }
      }
      onPointerDown={selectable ? longPress.handlers.onPointerDown : undefined}
      onPointerMove={selectable ? longPress.handlers.onPointerMove : undefined}
      onPointerUp={selectable ? longPress.handlers.onPointerUp : undefined}
      onMouseLeave={() => longPress.cancel()}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        opacity: dragging ? 0.45 : 1,
        cursor: readOnly ? "default" : selectionMode ? "pointer" : "grab",
        transition: "opacity 0.15s, border-color 0.12s, outline-color 0.12s",
        borderColor: selected ? "primary.main" : "divider",
        borderWidth: 1,

        outline: selected ? `2px solid ${SELECTION_BORDER}` : "none",
        outlineOffset: "-1px",
        bgcolor: selected ? SELECTION_TINT : "background.paper",
        "&:active": { cursor: readOnly ? "default" : selectionMode ? "pointer" : "grabbing" },
      }}
    >
      <CardActionArea onClick={handleClick} sx={{ borderRadius: "inherit", flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start" }}>
        <CardContent sx={{ p: "15px !important" }}>
          <Box
            sx={(t) => ({
              width: 44,
              height: 44,
              borderRadius: "8px",
              bgcolor: t.colors.primaryTint,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <Icon name={kind.icon} size={24} color={kind.color} />
          </Box>
          <Typography
            noWrap
            title={file.original_name}
            sx={{ fontWeight: 600, fontSize: 14.5, color: "text.primary", mt: 1.5, pr: 5 }}
          >
            {file.original_name}
          </Typography>
          <Typography sx={{ ...metaSx, mt: 0.4 }}>
            {formatBytes(file.size_bytes)} · {formatDate(file.created_at)}
          </Typography>
          {hasChips && (
            <Stack direction="row" sx={{ mt: 1, flexWrap: "wrap", gap: 0.75 }}>
              {location && (
                <MetaChip icon={Icons.folder} label={location} title={`In ${location}`} variant="outline" />
              )}
              {accessEndsAt && (
                <MetaChip
                  icon={Icons.schedule}
                  label={`Access ends ${relativeTime(accessEndsAt)}`}
                  variant={expiresSoon(accessEndsAt) ? "warning" : "outline"}
                />
              )}
              {file.expires_at && (
                <MetaChip
                  icon={Icons.schedule}
                  label={`Expires ${relativeTime(file.expires_at)}`}
                  variant={expiresSoon(file.expires_at) ? "warning" : "outline"}
                />
              )}
              {sharedBy && (
                <MetaChip icon={Icons.person} label={sharedBy} title={`Shared by ${sharedBy}`} variant="tint" />
              )}
              {recipientCount !== undefined && (
                <MetaChip
                  icon={Icons.group}
                  label={`${recipientCount} ${recipientCount === 1 ? "person" : "people"}`}
                  title={`Shared with ${recipientCount} ${recipientCount === 1 ? "person" : "people"}`}
                  variant="tint"
                />
              )}
            </Stack>
          )}
        </CardContent>
      </CardActionArea>

      {onToggleFavorite && (
        <IconButton
          size="small"
          aria-label={file.is_favorite ? "Remove from favourites" : "Add to favourites"}
          onClick={onToggleFavorite}
          sx={{ position: "absolute", top: 8, right: 38 }}
        >
          {file.is_favorite ? (
            <Icon name={Icons.star} fill sx={{ color: FAVORITE }} />
          ) : (
            <Icon name={Icons.star} sx={{ color: "text.disabled" }} />
          )}
        </IconButton>
      )}

      {hasMenu && (
        <IconButton
          size="small"
          aria-label="more actions"
          onClick={(e) => setMenuEl(e.currentTarget)}
          sx={{ position: "absolute", top: 8, right: 8, color: "text.disabled" }}
        >
          <Icon name={Icons.moreVert} />
        </IconButton>
      )}

      <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}>
        {onRename && (
          <MenuItem onClick={() => { setMenuEl(null); onRename(); }}>
            <ListItemIcon><Icon name={Icons.rename} /></ListItemIcon>
            <ListItemText>Rename</ListItemText>
          </MenuItem>
        )}
        {onMove && (
          <MenuItem onClick={() => { setMenuEl(null); onMove(); }}>
            <ListItemIcon><Icon name={Icons.driveFileMove} /></ListItemIcon>
            <ListItemText>Move to…</ListItemText>
          </MenuItem>
        )}
        {onShare && (
          <MenuItem onClick={() => { setMenuEl(null); onShare(); }}>
            <ListItemIcon><Icon name={Icons.share} /></ListItemIcon>
            <ListItemText>Share…</ListItemText>
          </MenuItem>
        )}
        {onManageExpiry && (
          <MenuItem onClick={() => { setMenuEl(null); onManageExpiry(); }}>
            <ListItemIcon><Icon name={Icons.schedule} /></ListItemIcon>
            <ListItemText>{file.expires_at ? "Manage expiry" : "Set expiry"}</ListItemText>
          </MenuItem>
        )}
        {onSave && (
          <MenuItem onClick={() => { setMenuEl(null); onSave(); }}>
            <ListItemIcon><Icon name={Icons.cloudDownload} /></ListItemIcon>
            <ListItemText>Save to my cloud</ListItemText>
          </MenuItem>
        )}
        {onDownload && (
          <MenuItem onClick={() => { setMenuEl(null); onDownload(); }}>
            <ListItemIcon><Icon name={Icons.download} /></ListItemIcon>
            <ListItemText>Download</ListItemText>
          </MenuItem>
        )}
        {onStopSharing && (
          <MenuItem onClick={() => { setMenuEl(null); onStopSharing(); }}>

            <ListItemIcon><Icon name={Icons.close} /></ListItemIcon>
            <ListItemText>Stop sharing</ListItemText>
          </MenuItem>
        )}
        {onRemove && (
          <MenuItem onClick={() => { setMenuEl(null); onRemove(); }}>
            <ListItemIcon><Icon name={Icons.close} /></ListItemIcon>
            <ListItemText>Remove from my list</ListItemText>
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem onClick={() => { setMenuEl(null); onDelete(); }}>
            <ListItemIcon><Icon name={Icons.delete} sx={{ color: "error.main" }} /></ListItemIcon>
            <ListItemText sx={{ color: "error.main" }}>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
}
