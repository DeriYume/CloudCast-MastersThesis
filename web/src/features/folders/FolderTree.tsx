import { useState } from "react";
import {
  Box, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Stack,
  Typography, IconButton, Tooltip,
} from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import type { FolderItem } from "../../api/api";
import { childFolders } from "../../utils/util";
import { MONO_FONT } from "../../theme";

interface Props {
  width: number | string;
  folders: FolderItem[];
  activeFolderId: string | undefined;
  isRootSelected: boolean;
  isFavoritesSelected: boolean;
  isSharedSelected: boolean;
  isExpiringSelected: boolean;
  onNavigate: (path: string) => void;
  onNewFolder: (parentId: string | null) => void;
  onOpenFolderMenu: (e: React.MouseEvent<HTMLElement>, folder: FolderItem) => void;
}

const SECTION_LABEL_SX = {
  fontFamily: MONO_FONT,
  fontWeight: 600,
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "text.disabled",
} as const;

function NavItem({
  icon, label, selected, onClick, trailing,
}: {
  icon: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{ height: 44, px: 1.75, mb: 0.25 }}
    >
      <ListItemIcon sx={{ minWidth: 32 }}>
        <Icon
          name={icon}
          size={21}
          fill={selected}
          sx={{ color: selected ? "primary.main" : "text.secondary" }}
        />
      </ListItemIcon>
      <ListItemText
        primary={label}
        primaryTypographyProps={{
          sx: {
            fontWeight: selected ? 600 : 500,
            fontSize: 14,
            color: selected ? "primary.main" : "text.primary",
          },
        }}
      />
      {trailing}
    </ListItemButton>
  );
}

export default function FolderTree({
  width,
  folders,
  activeFolderId,
  isRootSelected,
  isFavoritesSelected,
  isSharedSelected,
  isExpiringSelected,
  onNavigate,
  onNewFolder,
  onOpenFolderMenu,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleExpand(id: string) {
    setExpanded((m) => ({ ...m, [id]: !m[id] }));
  }

  function renderFolderNodes(parentId: string | null, depth: number): React.ReactNode {
    const nodes = childFolders(folders, parentId).slice().sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    return nodes.map((f) => {
      const hasKids = childFolders(folders, f.id).length > 0;
      const isOpen = !!expanded[f.id];
      const isActive = activeFolderId === f.id;
      return (
        <Box key={f.id}>
          <ListItem
            disablePadding
            secondaryAction={
              <IconButton
                size="small"
                edge="end"
                aria-label={`actions for ${f.name}`}
                onClick={(e) => onOpenFolderMenu(e, f)}
                sx={{ color: "text.disabled" }}
              >
                <Icon name={Icons.moreVert} />
              </IconButton>
            }
          >
            <ListItemButton
              selected={isActive}
              onClick={() => onNavigate(`/folders/${f.id}`)}
              sx={{ height: 38, pr: 5, pl: 1 + depth * 1.5 }}
            >
              <Box
                role="button"
                aria-label={hasKids ? (isOpen ? "Collapse" : "Expand") : undefined}
                onClick={(e) => {
                  if (!hasKids) return;
                  e.stopPropagation();
                  toggleExpand(f.id);
                }}
                sx={{
                  width: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mr: 0.25,
                  cursor: hasKids ? "pointer" : "default",
                  color: "text.secondary",
                }}
              >
                {hasKids &&
                  (isOpen ? (
                    <Icon name={Icons.expandMore} />
                  ) : (
                    <Icon name={Icons.chevronRight} />
                  ))}
              </Box>
              <ListItemIcon sx={{ minWidth: 30 }}>
                <Icon
                  name={Icons.folder}
                  size={19}
                  sx={{ color: isActive ? "primary.main" : "secondary.main" }}
                />
              </ListItemIcon>
              <ListItemText
                primary={f.name}
                primaryTypographyProps={{
                  noWrap: true,
                  sx: { fontSize: 13.5, fontWeight: 500, color: isActive ? "primary.main" : "text.primary" },
                }}
              />
            </ListItemButton>
          </ListItem>
          {hasKids && isOpen && renderFolderNodes(f.id, depth + 1)}
        </Box>
      );
    });
  }

  return (
    <Box sx={{ width, display: "flex", flexDirection: "column", height: "100%" }} role="navigation">
      <List sx={{ px: 1.25, pt: 2, pb: 0 }}>
        <NavItem icon={Icons.cloud} label="All files" selected={isRootSelected} onClick={() => onNavigate("/")} />
        <NavItem icon={Icons.star} label="Favourites" selected={isFavoritesSelected} onClick={() => onNavigate("/favorites")} />
        <NavItem icon={Icons.group} label="Shared" selected={isSharedSelected} onClick={() => onNavigate("/shared")} />
        <NavItem icon={Icons.schedule} label="Expiring soon" selected={isExpiringSelected} onClick={() => onNavigate("/expiring")} />
      </List>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, mt: 1.5, mb: 0.5 }}>
        <Typography sx={SECTION_LABEL_SX}>Folders</Typography>
        <Tooltip title="New folder">
          <IconButton size="small" onClick={() => onNewFolder(null)} aria-label="new folder" sx={{ color: "primary.main" }}>
            <Icon name={Icons.createNewFolder} />
          </IconButton>
        </Tooltip>
      </Stack>

      <List sx={{ px: 1.25, pt: 0, flex: 1, overflowY: "auto" }}>
        {folders.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
            No folders yet.
          </Typography>
        ) : (
          renderFolderNodes(null, 0)
        )}
      </List>
    </Box>
  );
}
