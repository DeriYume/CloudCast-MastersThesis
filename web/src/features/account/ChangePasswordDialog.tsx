import { useState } from "react";
import { useDialogForm } from "../../hooks/useDialogForm";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Alert, List, ListItem, ListItemIcon, ListItemText,
} from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import { changePassword } from "../../api/api";
import { useAuth } from "../auth/useAuth";
import { PASSWORD_RULES, passwordIsValid } from "../../utils/util";
import PasswordField from "./PasswordField";
import { friendlyError } from "../../utils/errors";

interface Props {
  open: boolean;
  token: string;
  onClose: () => void;
}

export default function ChangePasswordDialog({ open, token, onClose }: Props) {

  const email = useAuth((s) => s.email);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const { error, setError, busy, setBusy } = useDialogForm(open, () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  });

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 && passwordIsValid(next) && next === confirm && !busy;

  async function handleSubmit() {
    setError("");
    if (!canSubmit) return;
    setBusy(true);
    try {
      await changePassword(token, email ?? "", current, next);
      onClose();

    } catch (e) {
      setError(friendlyError(e, "Could not change password."));
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
      <DialogTitle>Change password</DialogTitle>
      <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <PasswordField
              label="Current password"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
            />
            <PasswordField
              label="New password"
              value={next}
              onChange={setNext}
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              error={mismatch}
              helperText={mismatch ? "Passwords don't match." : " "}
            />
            <List dense disablePadding>
              {PASSWORD_RULES.map((r) => {
                const ok = r.test(next);
                return (
                  <ListItem key={r.label} disableGutters sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 30 }}>
                      {ok ? (
                        <Icon name={Icons.checkCircle} sx={{ color: "success.main" }} />
                      ) : (
                        <Icon name={Icons.radioUnchecked} sx={{ color: "text.disabled" }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={r.label}
                      primaryTypographyProps={{
                        variant: "body2",
                        color: ok ? "text.primary" : "text.secondary",
                      }}
                    />
                  </ListItem>
                );
              })}
            </List>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={!canSubmit}>
          Update password
        </Button>
      </DialogActions>
    </Dialog>
  );
}
