import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Alert,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs, { type Dayjs } from "dayjs";
import { relativeTime } from "../../utils/util";
import { friendlyError } from "../../utils/errors";

interface Props {
  open: boolean;
  title?: string;
  resourceName: string;
  currentExpiry: string | null;
  onSubmit: (expiresAt: string | null) => Promise<void> | void;
  onClose: () => void;
}

export default function ExpiryDialog({
  open,
  title = "Manage expiry",
  resourceName,
  currentExpiry,
  onSubmit,
  onClose,
}: Props) {
  const [value, setValue] = useState<Dayjs | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(currentExpiry ? dayjs(currentExpiry) : null);
      setError("");
      setBusy(false);
      setPickerOpen(false);
    }
  }, [open, currentExpiry]);

  async function handleSave(next: Dayjs | null) {
    setError("");
    if (next) {
      if (!next.isValid()) {
        setError("Please pick a valid date and time.");
        return;
      }
      if (next.valueOf() <= Date.now()) {
        setError("Expiry must be in the future.");
        return;
      }
    }
    setBusy(true);
    try {
      await onSubmit(next ? next.toISOString() : null);
      onClose();
    } catch (e) {
      setError(friendlyError(e, "Could not update expiry."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Set when "{resourceName}" should automatically expire and become inaccessible.
          </Typography>
          {currentExpiry && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Currently expires {relativeTime(currentExpiry)}.
            </Alert>
          )}
          <DateTimePicker
            label="Expires at"
            value={value}
            onChange={(v) => setValue(v)}
            minDateTime={dayjs()}
            open={pickerOpen}
            onOpen={() => setPickerOpen(true)}
            onClose={() => setPickerOpen(false)}
            closeOnSelect={false}
            slotProps={{
              textField: {
                fullWidth: true,
                onClick: () => setPickerOpen(true),
                inputProps: { readOnly: true },
                sx: { "& input": { cursor: "pointer" } },
              },
            }}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
        <Button
          color="inherit"
          disabled={busy || (!value && !currentExpiry)}
          onClick={() => { setValue(null); setError(""); }}
        >
          Clear expiry
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} color="inherit" disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={busy || (!value && !currentExpiry)}
            onClick={() => handleSave(value)}
          >
            {!value && currentExpiry ? "Clear expiry" : "Save"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
