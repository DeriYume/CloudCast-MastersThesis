import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Alert, Box,
} from "@mui/material";
import { useAuth } from "../auth/useAuth";
import { regenerateRecovery } from "../../api/api";
import { newRecoveryVault, verifyPassword, canVerifyPassword } from "../crypto/session";
import PasswordField from "./PasswordField";
import { ready as cryptoReady } from "../crypto/sodium";
import { Icon, Icons } from "../../components/icons";
import { friendlyError } from "../../utils/errors";

interface Props {
  open: boolean;
  token: string;
  onClose: () => void;
}

async function downloadCode(code: string, email: string | null) {
  const content =
`CloudCast recovery code
=======================
Keep this file somewhere safe. If you forget your password, this code is the ONLY
way to recover your account and data - CloudCast cannot reset it for you.

Account: ${email ?? ""}
Saved:   ${new Date().toISOString()}

Recovery code:
${code}
`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cloudcast-recovery-code.txt";
  a.click();
  URL.revokeObjectURL(url);
}

export default function RegenerateRecoveryDialog({ open, token, onClose }: Props) {
  const email = useAuth((s) => s.email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setBusy(false); setError(""); setCode(null); }
  }, [open]);

  async function regenerate() {
    setBusy(true);
    setError("");
    try {
      await cryptoReady();

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
      const vault = newRecoveryVault();
      await regenerateRecovery(token, vault.recovery_encrypted_private_key);
      setCode(vault.recoveryCode);
    } catch (e) {
      setError(friendlyError(e, "Couldn't regenerate the recovery code."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Regenerate recovery code</DialogTitle>
      <DialogContent dividers>
        {code ? (
          <Stack spacing={2} sx={{ py: 1 }}>
            <Alert severity="success">
              Your new recovery code is ready. Save it now - it won't be shown again, and your old
              code no longer works.
            </Alert>
            <Box
              component="code"
              sx={{
                fontFamily: "monospace", fontSize: 14, userSelect: "all", wordBreak: "break-all",
                p: 1.5, borderRadius: "8px", bgcolor: "action.hover", textAlign: "center",
              }}
            >
              {code}
            </Box>
            <Button variant="outlined" startIcon={<Icon name={Icons.download} size={18} />} onClick={() => downloadCode(code, email)}>
              Download code
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              This creates a new recovery code and <strong>invalidates your current one</strong>. Use it
              if you've lost your code or want to rotate it. Your password and files are unaffected -
              CloudCast never sees the code.
            </Typography>
            <PasswordField
              label="Confirm your password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {code ? (
          <Button variant="contained" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button onClick={onClose} color="inherit" disabled={busy}>Cancel</Button>
            <Button variant="contained" onClick={regenerate} disabled={busy || !password}>
              {busy ? "Regenerating…" : "Regenerate"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
