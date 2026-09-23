import { useState } from "react";
import { useDialogForm } from "../../hooks/useDialogForm";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Alert,
} from "@mui/material";
import { deleteAccount, ACCOUNT_GRACE_DAYS_FALLBACK } from "../../api/api";
import { verifyPassword, canVerifyPassword } from "../crypto/session";
import PasswordField from "./PasswordField";
import { friendlyError } from "../../utils/errors";

interface Props {
  open: boolean;
  token: string;
  graceDays?: number;
  onDeleted: () => void;
  onClose: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function DeleteAccountDialog({ open, token, graceDays, onDeleted, onClose }: Props) {
  const days = graceDays ?? ACCOUNT_GRACE_DAYS_FALLBACK;
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{ purge_after: string; grace_days: number; notified: boolean } | null>(null);

  const { error, setError, busy, setBusy } = useDialogForm(open, () => {
    setPassword("");
    setResult(null);
  });

  async function schedule() {
    setBusy(true);
    setError("");
    try {
      if (!canVerifyPassword()) {
        setError(
          "This device was signed in with a QR code, so we can't verify your password here. " +
          "Sign in with your email and password to do this."
        );
        setBusy(false);
        return;
      }
      if (!verifyPassword(password)) {
        setError("That password isn't right.");
        setBusy(false);
        return;
      }
      const r = await deleteAccount(token);
      setResult({ purge_after: r.purge_after, grace_days: r.grace_days, notified: r.notified });
    } catch (e) {
      setError(friendlyError(e, "Couldn't schedule the deletion."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete account</DialogTitle>
      <DialogContent dividers>
        {result ? (
          <Stack spacing={2} sx={{ py: 1 }}>
            <Alert severity="success">
              Your account is scheduled for deletion on <strong>{formatDate(result.purge_after)}</strong>
              , {result.grace_days} days from now. Your data is kept until then so you can change your mind.
              {result.notified
                ? " People you shared files with have been notified to save their copies before then."
                : ""}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              You've been signed out everywhere. Sign back in before that date to cancel the deletion.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              This schedules your account and <strong>everything you own</strong> - files, folders, and
              shares - for permanent deletion. Nothing is erased straight away: the deletion runs after
              a <strong>{days}-day</strong> grace period, during which your data is
              retained and you can cancel by signing back in. Anyone you've shared files with is
              notified so they can save a copy first.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Confirm your password to continue.
            </Typography>
            <PasswordField
              label="Your password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {result ? (
          <Button variant="contained" color="error" onClick={onDeleted}>Sign out</Button>
        ) : (
          <>
            <Button onClick={onClose} color="inherit" disabled={busy}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={schedule}
              disabled={busy || !password}
            >
              {busy ? "Scheduling…" : "Delete account"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
