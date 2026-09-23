import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
} from "@mui/material";
import { Icon, Icons } from "../../components/icons";

export type AutoFileChoice = "create" | "here" | "cancel";

interface Props {

  folderName: string | null;

  countLabel: string;
  onResolve: (choice: AutoFileChoice) => void;
}

export default function AutoFileDialog({ folderName, countLabel, onResolve }: Props) {
  return (
    <Dialog
      open={Boolean(folderName)}
      onClose={() => onResolve("cancel")}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Icon name={Icons.createNewFolder} sx={{ color: "primary.main" }} /> Auto-file uploads
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Create folder{" "}
          <Typography component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
            “{folderName}”
          </Typography>{" "}
          and file {countLabel} there?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 1 }}>
        <Button onClick={() => onResolve("cancel")} color="inherit">Cancel</Button>
        <Button onClick={() => onResolve("here")} variant="outlined">
          Upload here instead
        </Button>
        <Button onClick={() => onResolve("create")} variant="contained">
          Create &amp; file
        </Button>
      </DialogActions>
    </Dialog>
  );
}
