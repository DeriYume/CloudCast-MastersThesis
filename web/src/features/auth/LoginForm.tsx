import { Box, Button, Typography, Alert, Stack, Link, Divider, Collapse } from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import AuthInput from "./AuthInput";
import PasswordRules from "./PasswordRules";
import { MONO_FONT } from "../../theme";

interface Props {
  mode: "login" | "register";
  email: string;
  password: string;
  confirm: string;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setConfirm: (v: string) => void;
  emailInvalid: boolean;
  showRules: boolean;
  confirmMismatch: boolean;
  busy: boolean;
  canSubmit: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onQrMode: () => void;
  onSwitchMode: () => void;
}

export default function LoginForm({
  mode, email, password, confirm, setEmail, setPassword, setConfirm,
  emailInvalid, showRules, confirmMismatch, busy, canSubmit, error, onSubmit, onQrMode, onSwitchMode,
}: Props) {
  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={onSubmit}>
        <Stack spacing={1}>
          <AuthInput
            kind="email"
            label="Email"
            value={email}
            onChange={setEmail}
            required
            autoFocus
            error={emailInvalid}
            helperText={emailInvalid ? "Enter a valid email address" : " "}
          />
          <AuthInput
            key={mode}
            kind="password"
            label="Password"
            value={password}
            onChange={setPassword}
            required
          />

          <PasswordRules show={showRules} password={password} />

          <Collapse in={mode === "register"} unmountOnExit>
            <AuthInput
              kind="password"
              label="Confirm password"
              value={confirm}
              onChange={setConfirm}
              required={mode === "register"}
              error={confirmMismatch}
              helperText={confirmMismatch ? "Passwords don't match" : " "}
            />
          </Collapse>

          <Button type="submit" variant="contained" size="large" disabled={busy || !canSubmit}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </Stack>
      </form>

      {mode === "login" && (
        <>
          <Divider sx={{ my: 2.5, "&::before, &::after": { borderColor: "divider" } }}>
            <Box component="span" sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: 12, color: "text.disabled" }}>
              OR
            </Box>
          </Divider>
          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<Icon name={Icons.qrCode2} sx={{ color: "primary.main" }} />}
            onClick={onQrMode}
          >
            Sign in with another device
          </Button>
        </>
      )}

      <Typography variant="body2" align="center" sx={{ mt: 3 }} color="text.secondary">
        {mode === "login" ? "No account yet? " : "Already have an account? "}
        <Link
          component="button"
          type="button"
          underline="hover"
          sx={{ fontWeight: 600 }}
          onClick={onSwitchMode}
        >
          {mode === "login" ? "Create one" : "Sign in"}
        </Link>
      </Typography>
    </>
  );
}
