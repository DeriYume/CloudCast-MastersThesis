import { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from "@mui/material";

interface Props {
  open: boolean;
  title: string;
  initialName?: string;
  confirmLabel?: string;
  dismissLabel?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
  fieldLabel?: string;
}

export default function FolderNameDialog({
  open,
  title,
  initialName = "",
  confirmLabel = "Save",
  dismissLabel = "Cancel",
  onSubmit,
  onClose,
  fieldLabel = "Folder name"
}: Props) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const trimmed = name.trim();

  function submit() {
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={fieldLabel}
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            {dismissLabel}
          </Button>
          <Button type="submit" variant="contained" disabled={!trimmed}>
            {confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
