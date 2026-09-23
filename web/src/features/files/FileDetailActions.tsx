import { useState, type ReactNode, type MouseEvent } from "react";
import { WHITE, FAVORITE, WARNING } from "../../theme/colors.generated";
import { Box, Stack, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import { Icon, Icons } from "../../components/icons";

interface Props {
  canDownload: boolean;
  canSave: boolean;
  isOwner: boolean;
  isFavorite: boolean;
  hasExpiry: boolean;
  onDownload: () => void;
  onSave: () => void;
  onToggleFavorite: () => void;
  onShareClick: () => void;
  onMoveClick: () => void;
  onManageExpiry: () => void;
  onDeleteClick: () => void;
}

export default function FileDetailActions({
  canDownload, canSave, isOwner, isFavorite, hasExpiry,
  onDownload, onSave, onToggleFavorite, onShareClick, onMoveClick, onManageExpiry, onDeleteClick,
}: Props) {
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  return (
    <Stack direction="row" spacing={1.125} alignItems="stretch">
      {canDownload && (
        <Box
          component="button"
          onClick={onDownload}
          sx={{
            flex: 1, height: 46, borderRadius: "7px", border: "none", cursor: "pointer",
            bgcolor: "primary.main", color: WHITE,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
            "&:hover": { bgcolor: "primary.dark" },
          }}
        >
          <Icon name={Icons.download} size={19} color={WHITE} />
          <Box sx={{ fontFamily: '"Hanken Grotesk", sans-serif', fontWeight: 600, fontSize: 14 }}>Download</Box>
        </Box>
      )}
      {canSave && (
        <Box
          component="button"
          onClick={onSave}
          sx={{
            flex: 1, height: 46, borderRadius: "7px", border: "none", cursor: "pointer",
            bgcolor: "primary.main", color: WHITE,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
            "&:hover": { bgcolor: "primary.dark" },
          }}
        >
          <Icon name={Icons.save} size={19} color={WHITE} />
          <Box sx={{ fontFamily: '"Hanken Grotesk", sans-serif', fontWeight: 600, fontSize: 14 }}>Save</Box>
        </Box>
      )}
      {isOwner && <RailIconButton icon={Icons.share} tip="Share" onClick={onShareClick} />}
      {isOwner && (
        <RailIconButton
          icon={Icons.star}
          tip={isFavorite ? "Remove from favourites" : "Add to favourites"}
          onClick={onToggleFavorite}
          iconNode={
            isFavorite ? (
              <Icon name={Icons.star} fill size={22} sx={{ color: FAVORITE }} />
            ) : (
              <Icon name={Icons.star} size={22} sx={{ color: "primary.main" }} />
            )
          }
        />
      )}
      {isOwner && <RailIconButton icon={Icons.driveFileMove} tip="Move to…" onClick={onMoveClick} />}
      {isOwner && (
        <>

          <RailIconButton
            icon={Icons.delete}
            tip="Expiry or delete"
            iconColor={WARNING}
            onClick={(e) => setMenuEl(e.currentTarget)}
          />
          <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}>
            <MenuItem onClick={() => { setMenuEl(null); onManageExpiry(); }}>
              <ListItemIcon><Icon name={Icons.schedule} /></ListItemIcon>
              <ListItemText>{hasExpiry ? "Manage expiry" : "Set expiry"}</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { setMenuEl(null); onDeleteClick(); }}>
              <ListItemIcon><Icon name={Icons.delete} sx={{ color: "error.main" }} /></ListItemIcon>
              <ListItemText sx={{ color: "error.main" }}>Delete</ListItemText>
            </MenuItem>
          </Menu>
        </>
      )}
    </Stack>
  );
}

function RailIconButton({
  icon, tip, onClick, iconColor, fill, iconNode,
}: {
  icon: string;
  tip: string;
  onClick: (e: MouseEvent<HTMLElement>) => void;
  iconColor?: string;
  fill?: boolean;

  iconNode?: ReactNode;
}) {
  return (
    <Tooltip title={tip}>
      <Box
        component="button"
        aria-label={tip}
        onClick={onClick}
        sx={(t) => ({
          width: 46, height: 46, flexShrink: 0, borderRadius: "7px", cursor: "pointer",
          border: "1px solid", borderColor: "divider", bgcolor: "background.paper",
          display: "flex", alignItems: "center", justifyContent: "center",
          "&:hover": { borderColor: t.palette.primary.main },
        })}
      >
        {iconNode ?? (
          <Icon name={icon} size={20} fill={fill} color={iconColor} sx={iconColor ? undefined : { color: "primary.main" }} />
        )}
      </Box>
    </Tooltip>
  );
}
