import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Box, Alert, CircularProgress,
} from "@mui/material";
import QRCode from "qrcode";
import { qrOffer, qrPending, qrApprove } from "../../api/api";
import { ready as cryptoReady } from "../crypto/sodium";
import { sealSkTo } from "../crypto/session";
import { formatCode } from "./signInCode";
import { Icon, Icons } from "../../components/icons";
import { friendlyError } from "../../utils/errors";

interface Props {
  open: boolean;
  token: string;
  onClose: () => void;
}

const POLL_MS = 3000;

type Phase =
  | { kind: "loading" }
  | { kind: "showing"; code: string; qr: string; expiresAt: number }
  | { kind: "confirm"; code: string; transferPk: string }
  | { kind: "approving" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function QrIssueDialog({ open, token, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [remaining, setRemaining] = useState<number | null>(null);
  const aliveRef = useRef(true);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    pollTimer.current = null;
    tickTimer.current = null;
  }, []);

  const begin = useCallback(async () => {
    clearTimers();
    const my = ++sessionRef.current;
    setPhase({ kind: "loading" });
    setRemaining(null);
    try {
      await cryptoReady();
      const { code, expiresAt } = await qrOffer(token);
      if (!aliveRef.current || sessionRef.current !== my) return;
      const qr = await QRCode.toDataURL(code, { margin: 1, width: 200 });
      const expiresMs = new Date(expiresAt).getTime();
      setPhase({ kind: "showing", code, qr, expiresAt: expiresMs });

      const tick = () => setRemaining(Math.max(0, Math.round((expiresMs - Date.now()) / 1000)));
      tick();
      tickTimer.current = setInterval(tick, 1000);

      const poll = async () => {
        if (!aliveRef.current || sessionRef.current !== my) return;
        try {
          const res = await qrPending(token, code);
          if (!aliveRef.current || sessionRef.current !== my) return;
          if (res.status === "registered" && res.transfer_pk) {
            clearTimers();
            setPhase({ kind: "confirm", code, transferPk: res.transfer_pk });
            return;
          }
          if (res.status === "waiting") { pollTimer.current = setTimeout(poll, POLL_MS); return; }

          begin();
        } catch { pollTimer.current = setTimeout(poll, POLL_MS); }
      };
      pollTimer.current = setTimeout(poll, POLL_MS);
    } catch (err) {
      if (!aliveRef.current || sessionRef.current !== my) return;
      setPhase({ kind: "error", message: friendlyError(err, "Couldn't create a sign-in code.") });
    }
  }, [token, clearTimers]);

  useEffect(() => {
    if (!open) return;
    aliveRef.current = true;
    begin();
    return () => { aliveRef.current = false; sessionRef.current++; clearTimers(); };
  }, [open, begin, clearTimers]);

  async function confirmApprove(code: string, transferPk: string) {
    setPhase({ kind: "approving" });
    try {
      await cryptoReady();
      await qrApprove(token, code, sealSkTo(transferPk));
      setPhase({ kind: "done" });
    } catch (err) {
      setPhase({ kind: "error", message: friendlyError(err, "Couldn't approve that device.") });
    }
  }

  function handleClose() { clearTimers(); onClose(); }

  return (
    <Dialog open={open} onClose={phase.kind === "approving" ? undefined : handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Sign in another device</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
          {phase.kind === "loading" && <Box sx={{ py: 4 }}><CircularProgress /></Box>}

          {phase.kind === "showing" && (
            <>
              <Typography variant="body2" color="text.secondary" align="center">
                On the new device, choose <strong>Use QR sign-in</strong> and enter this code (or scan it).
              </Typography>
              <Box sx={{ p: 2, bgcolor: "common.white", borderRadius: 2, border: "1px solid", borderColor: "divider", lineHeight: 0 }}>
                <img src={phase.qr} alt="Sign-in QR code" width={200} height={200} />
              </Box>

              <Typography component="code" sx={{ letterSpacing: 3, fontFamily: "monospace", fontSize: 20, userSelect: "all" }}>
                {formatCode(phase.code)}
              </Typography>
              {remaining !== null && (
                <Typography variant="caption" color="text.secondary">
                  {remaining > 0 ? `Refreshes in ${remaining}s` : "Refreshing…"}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" align="center">
                Only enter this on a device that's yours - approving grants it access to your account.
              </Typography>
            </>
          )}

          {phase.kind === "confirm" && (
            <>
              <Icon name={Icons.devices} />
              <Typography sx={{ fontWeight: 700, fontSize: 17 }}>A device is asking to sign in</Typography>
              <Typography variant="body2" color="text.secondary" align="center">
                Approve only if you just entered code <strong>{formatCode(phase.code)}</strong> on your own device.
                You stay signed in here; the other device gets its own session.
              </Typography>
              <Stack direction="row" spacing={1.25} sx={{ width: "100%" }}>
                <Button fullWidth color="inherit" onClick={begin}>Deny</Button>
                <Button fullWidth variant="contained" onClick={() => confirmApprove(phase.code, phase.transferPk)}>Approve</Button>
              </Stack>
            </>
          )}

          {phase.kind === "approving" && <Box sx={{ py: 4 }}><CircularProgress /></Box>}

          {phase.kind === "done" && (
            <Alert severity="success" sx={{ width: "100%" }}>
              Approved. The other device is signing in now - no password needed there.
            </Alert>
          )}

          {phase.kind === "error" && (
            <Stack spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
              <Alert severity="error" sx={{ width: "100%" }}>{phase.message}</Alert>
              <Button variant="contained" onClick={begin}>Try again</Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={phase.kind === "approving"}>
          {phase.kind === "done" ? "Done" : "Close"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
