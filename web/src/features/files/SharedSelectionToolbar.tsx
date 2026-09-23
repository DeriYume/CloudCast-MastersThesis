import { ON_PRIMARY_BORDER } from "../../theme/colors.generated";
import { Paper, Stack, Typography, Button, IconButton, Tooltip } from "@mui/material";
import { Icon, Icons } from "../../components/icons";

interface Props {
  view: "shared-by-me" | "shared-with-me";
  count: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onClear: () => void;

  onDownload?: () => void;
  canDownload?: boolean;
  onSave?: () => void;
  canSave?: boolean;
  onRemove?: () => void;

  onManageExpiry?: () => void;
  onStopSharing?: () => void;
}

const barBtn = { color: "inherit", borderColor: ON_PRIMARY_BORDER } as const;

export default function SharedSelectionToolbar({
  view, count, allSelected, onSelectAll, onClear,
  onDownload, canDownload, onSave, canSave, onRemove, onManageExpiry, onStopSharing,
}: Props) {
  const incoming = view === "shared-with-me";
  return (
    <Paper
      elevation={2}
      sx={{
        position: "sticky", top: 8, zIndex: 5, mb: 2, px: 2, py: 1, borderRadius: 2,
        bgcolor: "primary.main", color: "primary.contrastText",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1 }}>
        <Tooltip title="Clear selection">
          <IconButton size="small" onClick={onClear} sx={{ color: "inherit" }} aria-label="clear selection">
            <Icon name={Icons.close} />
          </IconButton>
        </Tooltip>
        <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>{count} selected</Typography>

        <Button
          size="small" variant="outlined" sx={barBtn}
          startIcon={<Icon name={allSelected ? Icons.removeDone : Icons.selectAll} />}
          onClick={allSelected ? onClear : onSelectAll}
        >
          {allSelected ? "Deselect all" : "Select all"}
        </Button>

        {incoming ? (
          <>
            {onSave && (
              <Tooltip title={canSave ? "" : "All selected files must allow saving"}>
                <span>
                  <Button size="small" variant="outlined" sx={barBtn} disabled={!canSave}
                    startIcon={<Icon name={Icons.save} />} onClick={onSave}>Save</Button>
                </span>
              </Tooltip>
            )}
            {onDownload && (
              <Tooltip title={canDownload ? "" : "Every selected item must allow download"}>
                <span>
                  <Button size="small" variant="outlined" sx={barBtn} disabled={!canDownload}
                    startIcon={<Icon name={Icons.download} />} onClick={onDownload}>Download</Button>
                </span>
              </Tooltip>
            )}
            {onRemove && (
              <Button size="small" variant="contained" color="error"
                startIcon={<Icon name={Icons.close} />} onClick={onRemove}>Remove</Button>
            )}
          </>
        ) : (
          <>
            {onManageExpiry && (
              <Button size="small" variant="outlined" sx={barBtn}
                startIcon={<Icon name={Icons.schedule} />} onClick={onManageExpiry}>Set expiry</Button>
            )}
            {onStopSharing && (
              <Button size="small" variant="contained" color="error"
                startIcon={<Icon name={Icons.close} />} onClick={onStopSharing}>Stop sharing</Button>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}
