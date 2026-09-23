import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Stack, Typography, Alert, CircularProgress, Link, TextField } from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import { useAuth } from "./useAuth";
import { qrRegister, qrPoll, getMe } from "../../api/api";
import * as cc from "../crypto/sodium";
import { setSession } from "../crypto/session";
import { CODE_LENGTH, formatCodeAsTyped, isCompleteCode, normalizeCode } from "./signInCode";
import { friendlyError } from "../../utils/errors";

const POLL_MS = 3000;

interface Props {

  onBack: () => void;
}

type Phase =
  | { kind: "enter" }
  | { kind: "waiting" }
  | { kind: "error"; message: string };

export default function QrSignIn({ onBack }: Props) {
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const setUser = useAuth((s) => s.setUser);

  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "enter" });
  const aliveRef = useRef(true);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transferRef = useRef<cc.Keypair | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, []);

  async function poll(c: string) {
    if (!aliveRef.current) return;
    try {
      const res = await qrPoll(c);
      if (!aliveRef.current) return;
      if (res.status === "approved" && res.sealed_token && res.sealed_sk && res.public_key && res.mk_sealed) {
        const t = transferRef.current!;
        const token = cc.fromUtf8(cc.sealOpen(cc.fromB64(res.sealed_token), t.publicKey, t.privateKey));
        const userSk = cc.sealOpen(cc.fromB64(res.sealed_sk), t.publicKey, t.privateKey);
        setSession(userSk, cc.fromB64(res.public_key), cc.fromB64(res.mk_sealed));
        setAuth(token, "");
        try { const { user } = await getMe(token); if (aliveRef.current) setUser(user); } catch {  }
        navigate("/");
        return;
      }
      if (res.status === "pending") { pollTimer.current = setTimeout(() => poll(c), POLL_MS); return; }

      setPhase({
        kind: "error",
        message: res.status === "expired"
          ? "The code expired - grab the current one from your signed-in device."
          : "That code is no longer valid.",
      });
    } catch {
      pollTimer.current = setTimeout(() => poll(c), POLL_MS);
    }
  }

  async function submit() {
    const c = normalizeCode(code);
    if (!c) { setPhase({ kind: "error", message: "Enter the code shown on your signed-in device." }); return; }
    try {
      await cc.ready();
      const transfer = cc.generateKeypair();
      transferRef.current = transfer;
      await qrRegister(c, cc.toB64(transfer.publicKey));
      setPhase({ kind: "waiting" });
      poll(c);
    } catch (err) {
      setPhase({ kind: "error", message: friendlyError(err, "Couldn't use that code.") });
    }
  }

  return (
    <Stack spacing={2} alignItems="center">
      <Typography variant="body2" color="text.secondary" align="center">
        On a device where you're already signed in, open <strong>Sign in another device</strong> and enter
        the code it shows. Your keys transfer securely - no password needed here.
      </Typography>

      {phase.kind === "waiting" ? (
        <Stack spacing={1.5} alignItems="center" sx={{ py: 3 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">Waiting for approval on your other device…</Typography>
        </Stack>
      ) : (
        <>
          <TextField
            label="Sign-in code"
            placeholder="XK4M-9PTW"
            value={code}

            onChange={(e) => { setCode(formatCodeAsTyped(e.target.value)); if (phase.kind === "error") setPhase({ kind: "enter" }); }}
            autoFocus
            fullWidth
            slotProps={{
              htmlInput: {
                style: { letterSpacing: 3, fontFamily: "monospace", textTransform: "uppercase" },

                autoCapitalize: "characters",
                autoCorrect: "off",
                spellCheck: false,

                autoComplete: "one-time-code",
                inputMode: "text",
                maxLength: CODE_LENGTH + 1,
              },
            }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
          {phase.kind === "error" && <Alert severity="error" sx={{ width: "100%" }}>{phase.message}</Alert>}

          <Button
            variant="contained"
            fullWidth
            disabled={!isCompleteCode(normalizeCode(code))}
            onClick={submit}
          >
            Sign in
          </Button>
        </>
      )}

      <Link
        component="button"
        type="button"
        underline="hover"
        onClick={onBack}
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
      >
        <Icon name={Icons.arrowBack} />
        Back to email & password
      </Link>
    </Stack>
  );
}
