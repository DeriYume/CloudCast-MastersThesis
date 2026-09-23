import { WHITE } from "../../theme/colors.generated";
import {
  Dialog, Box, Stack, Typography, IconButton,
} from "@mui/material";
import { useState } from "react";
import type { FolderItem } from "../../api/api";
import { flattenTree } from "../../utils/util";
import { Icon, Icons } from "../../components/icons";
import { MONO_FONT } from "../../theme";

interface Props {
  open: boolean;
  folders: FolderItem[];
  currentFolderId: string | null;
  disabledIds?: string[];
  title?: string;
  onMove: (folderId: string | null) => void;
  onClose: () => void;
}

export default function MoveToFolderDialog({
  open, folders, currentFolderId,
  disabledIds = [],
  title = "Move to folder",
  onMove, onClose,
}: Props) {
  const [selected, setSelected] = useState<string | null>(currentFolderId);
  const rows = flattenTree(folders);
  const disabled = new Set(disabledIds);

  function handleEnter() { setSelected(currentFolderId); }

  function onClick() {
    onMove(selected);
    onClose();
  }

  function FolderRow({
    id, label, depth, isDisabled,
  }: { id: string | null; label: string; depth: number; isDisabled?: boolean }) {
    const isSelected = selected === id;
    const isCurrent = currentFolderId === id;
    return (
      <Box
        component="button"
        disabled={isDisabled}
        onClick={() => !isDisabled && setSelected(id)}
        sx={(t) => ({
          width: "100%", textAlign: "left", cursor: isDisabled ? "default" : "pointer",

          color: "text.primary",
          display: "flex", alignItems: "center", gap: 1.5,
          px: 1.5, py: 1.375, borderRadius: "8px", border: "1px solid",
          borderColor: isSelected ? (t.colors.selectedBorder) : "transparent",
          bgcolor: isSelected ? (t.colors.primaryTint) : "transparent",
          opacity: isDisabled ? 0.45 : 1,
          pl: `${12 + depth * 18}px`,
          "&:hover": isDisabled || isSelected ? {} : { bgcolor: t.colors.moveHoverBg },
        })}
      >
        <Box
          sx={(t) => ({
            width: 38, height: 38, flexShrink: 0, borderRadius: "7px",
            bgcolor: isSelected ? t.palette.background.paper : (t.colors.primaryTint),
            display: "flex", alignItems: "center", justifyContent: "center",
          })}
        >
          <Icon name={id === null ? Icons.cloud : Icons.folder} size={21} fill={id !== null} sx={{ color: "primary.main" }} />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 600, fontSize: 14 }}>{label}</Typography>
          {isCurrent && (
            <Box sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: 10.5, color: "text.disabled", mt: "1px" }}>
              current location
            </Box>
          )}
        </Box>
        {isSelected ? (
          <Icon name={Icons.radioChecked} size={20} fill sx={{ color: "primary.main" }} />
        ) : (
          <Icon name={Icons.radioUnchecked} size={20} sx={{ color: "text.disabled" }} />
        )}
      </Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      TransitionProps={{ onEnter: handleEnter }}
      slotProps={{ paper: { sx: { borderRadius: "10px", overflow: "hidden" } } }}
    >

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2.75, py: 2.5, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Typography noWrap sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em" }}>
          {title}
        </Typography>
        <IconButton onClick={onClose} aria-label="close" sx={{ color: "text.disabled" }}>
          <Icon name={Icons.close} size={22} />
        </IconButton>
      </Stack>

      <Box sx={{ px: 2, py: 1.75, maxHeight: 360, overflowY: "auto" }}>
        <FolderRow id={null} label="All files (root)" depth={0} />
        {rows.map(({ folder, depth }) => (
          <FolderRow
            key={folder.id}
            id={folder.id}
            label={folder.name}
            depth={depth + 1}
            isDisabled={disabled.has(folder.id)}
          />
        ))}
      </Box>

      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={1.25}
        sx={(t) => ({
          px: 2.75, py: 1.75, borderTop: "1px solid", borderColor: "divider",
          bgcolor: t.colors.inputBg,
        })}
      >
        <Box
          component="button"
          onClick={onClose}
          sx={{
            cursor: "pointer", height: 42, px: 2.25, borderRadius: "9px",
            border: "1px solid", borderColor: "divider", bgcolor: "transparent",
            fontFamily: '"Hanken Grotesk", sans-serif', fontWeight: 600, fontSize: 13, color: "text.secondary",
          }}
        >
          Cancel
        </Box>
        <Box
          component="button"
          disabled={selected === currentFolderId}
          onClick={onClick}
          sx={(t) => ({
            cursor: selected === currentFolderId ? "default" : "pointer",
            height: 42, px: 2.5, borderRadius: "9px", border: "none",
            bgcolor: selected === currentFolderId ? t.palette.action.disabledBackground : t.palette.primary.main,
            color: selected === currentFolderId ? t.palette.text.disabled : WHITE,
            fontFamily: '"Hanken Grotesk", sans-serif', fontWeight: 600, fontSize: 13,
            "&:hover": selected === currentFolderId ? {} : { bgcolor: t.palette.primary.dark },
          })}
        >
          Move here
        </Box>
      </Stack>
    </Dialog>
  );
}
