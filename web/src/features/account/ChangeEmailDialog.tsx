import { useState } from "react";
import { useDialogForm } from "../../hooks/useDialogForm";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Alert,
} from "@mui/material";
import { changeEmail, getMe } from "../../api/api";
import { emailIsValid } from "../../utils/util";
import { useAuth } from "../auth/useAuth";
import PasswordField from "./PasswordField";
import { friendlyError } from "../../utils/errors";

interface Props {
  open: boolean;
  token: string;
  currentEmail: string | null;
  onClose: () => void;
}

export default function ChangeEmailDialog({ open, token, currentEmail, onClose }: Props) {
  const setUser = useAuth((s) => s.setUser);
  const [password, setPassword] = useState("");
  const [oldEmail, setOldEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const { error, setError, busy, setBusy } = useDialogForm(open, () => {
    setPassword("");
    setOldEmail("");
    setNewEmail("");
  });

  const trimmed = newEmail.trim();
  const sameEmail = currentEmail != null && trimmed.toLowerCase() === currentEmail.toLowerCase();

  const oldEmailMatches =
    currentEmail != null && oldEmail.trim().toLowerCase() === currentEmail.toLowerCase();
  const canSubmit =
    password.length > 0 && oldEmailMatches && emailIsValid(trimmed) && !sameEmail && !busy;

  async function handleSubmit() {
    setError("");
    if (!canSubmit) return;
    setBusy(true);
    try {
      await changeEmail(token, password, trimmed);

      try {
        const { user } = await getMe(token);
        setUser(user);
      } catch {

      }
      onClose();

    } catch (e) {
      setError(friendlyError(e, "Could not change email."));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        component: "form",
        onSubmit: (e: React.FormEvent) => {
          e.preventDefault();
          handleSubmit();
        },
      }}
    >
      <DialogTitle>Change email</DialogTitle>
      <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              type="email"
              label="Current email"
              value={oldEmail}
              onChange={(e) => setOldEmail(e.target.value)}
              error={!busy && oldEmail.trim().length > 0 && !oldEmailMatches}
              helperText={
                busy || oldEmail.trim().length === 0
                  ? " "
                  : !oldEmailMatches
                  ? "That's not the address on this account."
                  : " "
              }
              autoComplete="off"
              fullWidth
            />
            <TextField
              type="email"
              label="New email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              error={!busy && trimmed.length > 0 && (!emailIsValid(trimmed) || sameEmail)}
              helperText={
                busy || trimmed.length === 0
                  ? " "
                  : sameEmail
                  ? "That's already your email."
                  : !emailIsValid(trimmed)
                  ? "Enter a valid email address."
                  : " "
              }
              autoComplete="email"
              fullWidth
            />
            <PasswordField
              label="Current password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={!canSubmit}>
          Update email
        </Button>
      </DialogActions>
    </Dialog>
  );
}
