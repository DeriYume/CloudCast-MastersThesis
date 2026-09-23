import { useState } from "react";
import { ON_PRIMARY_BORDER } from "../../theme/colors.generated";
import {
  Paper, Stack, Typography, Button, IconButton, Tooltip, Menu, MenuItem, ListItemText,
} from "@mui/material";
import { Icon, Icons } from "../../components/icons";

interface Props {
  count: number;
  allSelected: boolean;

  folderSelected: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onMove: () => void;
  onDelete: () => void;
  onDownloadZip: () => void;
  onDownloadIndividual: () => void;
}

export default function SelectionToolbar({
  count, allSelected, folderSelected,
  onSelectAll, onClear, onMove, onDelete, onDownloadZip, onDownloadIndividual,
}: Props) {
  const [dlAnchor, setDlAnchor] = useState<null | HTMLElement>(null);
  const closeDl = () => setDlAnchor(null);

  return (
    <Paper
      elevation={2}
      sx={{
        position: "sticky",
        top: 8,
        zIndex: 5,
        mb: 2,
        px: 2,
        py: 1,
        borderRadius: 2,
        bgcolor: "primary.main",
        color: "primary.contrastText",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Tooltip title="Clear selection">
          <IconButton size="small" onClick={onClear} sx={{ color: "inherit" }} aria-label="clear selection">
            <Icon name={Icons.close} />
          </IconButton>
        </Tooltip>
        <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>
          {count} selected
        </Typography>
        <Button
          size="small"
          startIcon={allSelected ? <Icon name={Icons.removeDone} /> : <Icon name={Icons.selectAll} />}
          onClick={allSelected ? onClear : onSelectAll}
          sx={{ color: "inherit", borderColor: ON_PRIMARY_BORDER }}
          variant="outlined"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
        <Button
          size="small"
          startIcon={<Icon name={Icons.download} />}
          onClick={(e) => setDlAnchor(e.currentTarget)}
          sx={{ color: "inherit", borderColor: ON_PRIMARY_BORDER }}
          variant="outlined"
        >
          Download
        </Button>
        <Menu anchorEl={dlAnchor} open={Boolean(dlAnchor)} onClose={closeDl}>
          <MenuItem onClick={() => { closeDl(); onDownloadZip(); }}>
            <ListItemText primary="Download as .zip" />
          </MenuItem>
          <MenuItem
            disabled={folderSelected}
            onClick={() => { closeDl(); onDownloadIndividual(); }}
          >
            <ListItemText
              primary="Download individually"
              secondary={folderSelected ? "Folders download as .zip" : undefined}
            />
          </MenuItem>
        </Menu>
        <Button
          size="small"
          startIcon={<Icon name={Icons.driveFileMove} />}
          onClick={onMove}
          sx={{ color: "inherit", borderColor: ON_PRIMARY_BORDER }}
          variant="outlined"
        >
          Move
        </Button>
        <Button
          size="small"
          startIcon={<Icon name={Icons.delete} />}
          onClick={onDelete}
          variant="contained"
          color="error"
        >
          Delete
        </Button>
      </Stack>
    </Paper>
  );
}
