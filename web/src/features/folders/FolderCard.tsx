import { useRef, useState } from "react";
import { SELECTION_TINT, SELECTION_BORDER, PRIMARY } from "../../theme/colors.generated";
import {
  Card, CardActionArea,
  CardContent, Typography,
  IconButton, Menu,
  MenuItem, ListItemIcon,
  ListItemText, Stack, Box,
} from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import type { FolderItem } from "../../api/api";
import { FILE_DRAG_KEY, FOLDER_DRAG_KEY } from "../dnd/dragKeys";
import { MULTI_DRAG_KEY } from "../files/FileCard";
import { useLongPress } from "../../hooks/useLongPress";
import { MONO_FONT } from "../../theme";
import { relativeTime, expiresSoon } from "../../utils/util";

interface Props {
  folder: FolderItem & { fileCount?: number };
  isDragTarget?: boolean;
  sharedBy?: string;

  recipientCount?: number;

  accessEndsAt?: string | null;
  selectable?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onOpen: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onNewSubfolder?: () => void;
  onMoveFolder?: () => void;
  onShare?: () => void;
  onManageExpiry?: () => void;

  onStopSharing?: () => void;

  onRemove?: () => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  onMoveFile?: (fileId: string) => void;
  onMoveFolderInto?: (folderId: string) => void;
  onMoveSelectionInto?: (folderId: string) => void;
  draggable?: boolean;
  onDrop?: (e: React.DragEvent) => void;
}

const metaSx = { fontFamily: MONO_FONT, fontWeight: 500, fontSize: 11, color: "text.disabled" } as const;

function MetaChip({
  icon, label, title, variant = "tint",
}: {
  icon: string;
  label: string;
  title?: string;
  variant?: "tint" | "outline" | "warning";
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
          padding: "2px 8px",
          borderRadius: "7px",
          fontFamily: '"Hanken Grotesk", sans-serif',
          fontWeight: 500,
          fontSize: 10.5,
          background: styles.bg,
          color: styles.color,
          border: styles.border,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        };
      }}
    >
      <Icon name={icon} size={12} />
      {label}
    </Box>
  );
}

export default function FolderCard({
  folder, isDragTarget = false, sharedBy, recipientCount, accessEndsAt,
  selectable = false, selectionMode = false, selected = false, onToggleSelect,
  onOpen, onRename, onDelete,
  onNewSubfolder, onMoveFolder,
  onShare, onManageExpiry, onStopSharing, onRemove,
  onDragEnter, onDragLeave,
  onMoveFile, onMoveFolderInto, onMoveSelectionInto, draggable = false, onDrop,
}: Props) {
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);

  const hasMenu = Boolean(onNewSubfolder || onMoveFolder || onShare || onManageExpiry || onRename || onDelete || onStopSharing || onRemove);
  const count = folder.fileCount;
  const isEmpty = count === 0;
  const subtitle =
    count === undefined ? "" : count === 0 ? "Empty" : `${count} item${count === 1 ? "" : "s"}`;
  const hasChips = sharedBy || recipientCount !== undefined || accessEndsAt || folder.expires_at;

  const suppressNextClickRef = useRef(false);

  const dragDepth = useRef(0);

  const longPress = useLongPress(() => onToggleSelect?.());

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (dragDepth.current === 1) onDragEnter?.();
  }

  function handleDragLeave(e: React.DragEvent) {
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      onDragLeave?.();
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    suppressNextClickRef.current = true;
    const fileId = e.dataTransfer.getData(FILE_DRAG_KEY);
    const draggedFolderId = e.dataTransfer.getData(FOLDER_DRAG_KEY);
    const multi = e.dataTransfer.getData(MULTI_DRAG_KEY);
    if (multi && onMoveSelectionInto) {

      onMoveSelectionInto(folder.id);
    } else if (fileId) {
      onMoveFile?.(fileId);
    } else if (draggedFolderId) {

      if (draggedFolderId !== folder.id) onMoveFolderInto?.(draggedFolderId);
    } else {
      onDrop?.(e);
    }
  }

  function handleClick() {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (longPress.fired.current) { longPress.fired.current = false; return; }
    if (selectionMode) onToggleSelect?.();
    else onOpen();
  }

  return (
    <Card
      variant="outlined"
      data-folder-id={folder.id}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              longPress.cancel();
              e.dataTransfer.setData(FOLDER_DRAG_KEY, folder.id);
              if (selected) e.dataTransfer.setData(MULTI_DRAG_KEY, "1");
              e.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      onPointerDown={selectable ? longPress.handlers.onPointerDown : undefined}
      onPointerMove={selectable ? longPress.handlers.onPointerMove : undefined}
      onPointerUp={selectable ? longPress.handlers.onPointerUp : undefined}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseLeave={() => longPress.cancel()}
      sx={{
        position: "relative",
        alignSelf: "start",
        cursor: selectionMode ? "pointer" : draggable ? "grab" : undefined,
        bgcolor: isDragTarget || selected ? SELECTION_TINT : "background.paper",
        borderColor: isDragTarget || selected ? "primary.main" : "divider",
        borderWidth: 1,

        outline: isDragTarget ? `2px dashed ${SELECTION_BORDER}` : selected ? `2px solid ${SELECTION_BORDER}` : "none",
        outlineOffset: "-1px",
        transition: "border-color 0.12s, background-color 0.12s, outline-color 0.12s",
      }}
    >
      <CardActionArea onClick={handleClick} sx={{ borderRadius: "inherit" }}>
        <CardContent sx={{ p: "14px !important", pr: "40px !important" }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={(t) => ({
                width: 42,
                height: 42,
                borderRadius: "7px",
                flexShrink: 0,
                bgcolor: isEmpty
                  ? t.palette.action.hover
                  : t.palette.mode === "light"
                  ? t.colors.primaryTint
                  : t.colors.primaryTint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <Icon
                name={Icons.folder}
                size={23}
                fill={!isEmpty}
                color={isEmpty ? undefined : PRIMARY}
                sx={isEmpty ? { color: "text.disabled" } : undefined}
              />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                noWrap
                title={folder.name}
                sx={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: isDragTarget ? "primary.main" : "text.primary",
                }}
              >
                {folder.name}
              </Typography>
              {subtitle && <Typography sx={{ ...metaSx, mt: 0.25 }}>{subtitle}</Typography>}
              {hasChips && (
                <Stack direction="row" sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.75 }}>
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
                  {accessEndsAt && (
                    <MetaChip
                      icon={Icons.schedule}
                      label={`Access ends ${relativeTime(accessEndsAt)}`}
                      variant={expiresSoon(accessEndsAt) ? "warning" : "outline"}
                    />
                  )}
                  {folder.expires_at && (
                    <MetaChip
                      icon={Icons.schedule}
                      label={`Expires ${relativeTime(folder.expires_at)}`}
                      variant={expiresSoon(folder.expires_at) ? "warning" : "outline"}
                    />
                  )}
                </Stack>
              )}
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>

      {hasMenu && (
        <IconButton
          size="small"
          aria-label="more actions"
          onClick={(e) => { e.stopPropagation(); setMenuEl(e.currentTarget); }}
          sx={{ position: "absolute", top: "50%", right: 6, transform: "translateY(-50%)", color: "text.disabled" }}
        >
          <Icon name={Icons.moreVert} />
        </IconButton>
      )}

      <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}>
        {onNewSubfolder && (
          <MenuItem onClick={() => { setMenuEl(null); onNewSubfolder(); }}>
            <ListItemIcon><Icon name={Icons.createNewFolder} /></ListItemIcon>
            <ListItemText>New subfolder</ListItemText>
          </MenuItem>
        )}
        {onMoveFolder && (
          <MenuItem onClick={() => { setMenuEl(null); onMoveFolder(); }}>
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
            <ListItemText>{folder.expires_at ? "Manage expiry" : "Set expiry"}</ListItemText>
          </MenuItem>
        )}
        {onRename && (
          <MenuItem onClick={() => { setMenuEl(null); onRename(); }}>
            <ListItemIcon><Icon name={Icons.rename} /></ListItemIcon>
            <ListItemText>Rename</ListItemText>
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
