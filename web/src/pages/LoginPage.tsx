import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Box, Paper, Typography, Button, Alert, Stack, Link, TextField } from "@mui/material";
import Logo from "../components/Logo";
import QrSignIn from "../features/auth/QrSignIn";
import LoginHeader from "../features/auth/LoginHeader";
import LoginForm from "../features/auth/LoginForm";
import AuthInput from "../features/auth/AuthInput";
import { useAuth } from "../features/auth/useAuth";
import { useCryptoSession } from "../features/crypto/session";
import { registerHybrid, loginHybrid, recoverHybrid } from "../features/auth/authCrypto";
import { passwordIsValid, emailIsValid } from "../utils/util";
import { friendlyError } from "../utils/errors";

async function downloadRecoveryCode(code: string, email: string): Promise<void> {
  const content =
`CloudCast recovery code
=======================
Keep this file somewhere safe. If you forget your password, this code is the ONLY
way to recover your account and data - CloudCast cannot reset it for you.

Account: ${email}
Saved:   ${new Date().toISOString()}

Recovery code:
${code}
`;
  const blob = new Blob([content], { type: "text/plain" });
  const filename = "cloudcast-recovery-code.txt";
  const w = window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<any> };
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Text file", accept: { "text/plain": [".txt"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const token = useAuth((s) => s.token);
  const unlocked = useCryptoSession((s) => s.unlocked);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [qrMode, setQrMode] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const [recCode, setRecCode] = useState("");
  const [recPass, setRecPass] = useState("");
  const [recConfirm, setRecConfirm] = useState("");

  if (token && unlocked) return <Navigate to="/" replace />;

  const showRules = mode === "register" && password.length > 0;
  const emailInvalid = email.length > 0 && !emailIsValid(email);
  const confirmMismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    emailIsValid(email) &&
    (mode === "login" ||
      (passwordIsValid(password) && confirm.length > 0 && confirm === password));
  const canRecover =
    emailIsValid(email) && recCode.trim().length > 0 && passwordIsValid(recPass) && recConfirm === recPass;

  async function doLogin(pw: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const { token, pendingDeletion } = await loginHybrid(normalizedEmail, pw);
    setAuth(token, normalizedEmail, pendingDeletion);
    navigate("/");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        const { recoveryCode } = await registerHybrid(email.trim().toLowerCase(), password);
        setRecoveryCode(recoveryCode);
      } else {
        await doLogin(password);
      }
    } catch (err) {
      setError(friendlyError(err, mode === "register" ? "Could not create that account." : "Authentication failed."));
    } finally {
      setBusy(false);
    }
  }

  async function continueAfterRecovery() {
    setError("");
    setBusy(true);
    try {
      await doLogin(password);
    } catch (err) {
      setError(friendlyError(err, "Authentication failed."));
    } finally {
      setBusy(false);
    }
  }

  async function doRecover() {
    setError("");
    setBusy(true);
    try {
      await recoverHybrid(email.trim().toLowerCase(), recCode, recPass);
      await doLogin(recPass);
    } catch (err) {
      setError(friendlyError(err, "Password reset failed"));
    } finally {
      setBusy(false);
    }
  }

  function backToSignIn() {
    setRecovering(false);
    setError("");
    setRecCode(""); setRecPass(""); setRecConfirm("");
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
      <Paper
        elevation={0}
        sx={{ p: { xs: 3, sm: 5 }, width: "100%", maxWidth: 420, border: "1px solid", borderColor: "divider", borderRadius: "12px" }}
      >
        <Logo size={36} wordmark={19} />

        {recoveryCode ? (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Typography variant="h6">Save your recovery code</Typography>
            <Alert severity="info">
              Save this recovery code - it's how you get back in if you forget your password.
              For your privacy the server can't reset your password for you, so keep the file
              somewhere safe (your password manager, or Documents).
            </Alert>
            <Box sx={{ fontFamily: "monospace", fontSize: 14, p: 2, bgcolor: "action.hover", borderRadius: 1, wordBreak: "break-all" }}>
              {recoveryCode}
            </Box>
            <Button variant="outlined" onClick={() => downloadRecoveryCode(recoveryCode, email.trim().toLowerCase())}>
              Download recovery code (.txt)
            </Button>
            {error && <Alert severity="error">{error}</Alert>}
            <Button variant="contained" size="large" disabled={busy} onClick={continueAfterRecovery}>
              {busy ? "Please wait…" : "I've saved it - continue"}
            </Button>
          </Stack>
        ) : recovering ? (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Typography variant="h6">Reset your password</Typography>
            <Alert severity="info">
              Enter your email, the recovery code you saved, and a new password. Only your
              recovery code can unlock your keys - the server can't reset them for you.
            </Alert>
            <AuthInput kind="email" label="Email" value={email} onChange={setEmail} required autoFocus
              error={emailInvalid} helperText={emailInvalid ? "Enter a valid email address" : " "} />
            <TextField
              label="Recovery code" value={recCode} onChange={(e) => setRecCode(e.target.value)}
              fullWidth multiline minRows={2} sx={{ "& textarea": { fontFamily: "monospace" } }}
            />
            <AuthInput kind="password" label="New password" value={recPass} onChange={setRecPass} required />
            <AuthInput kind="password" label="Confirm new password" value={recConfirm} onChange={setRecConfirm} required
              error={recConfirm.length > 0 && recConfirm !== recPass}
              helperText={recConfirm.length > 0 && recConfirm !== recPass ? "Passwords don't match" : " "} />
            {error && <Alert severity="error">{error}</Alert>}
            <Button variant="contained" size="large" disabled={busy || !canRecover} onClick={doRecover}>
              {busy ? "Please wait…" : "Reset password"}
            </Button>
            <Link component="button" type="button" underline="hover" sx={{ fontWeight: 600 }} onClick={backToSignIn}>
              Back to sign in
            </Link>
          </Stack>
        ) : (
          <>
            <LoginHeader qrMode={qrMode} mode={mode} />
            {qrMode ? (
              <QrSignIn onBack={() => setQrMode(false)} />
            ) : (
              <>
                <LoginForm
                  mode={mode}
                  email={email}
                  password={password}
                  confirm={confirm}
                  setEmail={setEmail}
                  setPassword={setPassword}
                  setConfirm={setConfirm}
                  emailInvalid={emailInvalid}
                  showRules={showRules}
                  confirmMismatch={confirmMismatch}
                  busy={busy}
                  canSubmit={canSubmit}
                  error={error}
                  onSubmit={submit}
                  onQrMode={() => { setQrMode(true); setError(""); }}
                  onSwitchMode={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setConfirm(""); }}
                />
                {mode === "login" && (
                  <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                    <Link component="button" type="button" underline="hover" sx={{ fontWeight: 600 }}
                      onClick={() => { setRecovering(true); setError(""); }}>
                      Forgot password?
                    </Link>
                  </Typography>
                )}
              </>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
}
