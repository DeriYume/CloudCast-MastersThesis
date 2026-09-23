import { useState, useEffect } from "react";
import { WARNING, PRIMARY, GRADIENT_END, WHITE, OVERLAY_WARNING_HOVER } from "../../theme/colors.generated";
import { Dialog, Box, Typography, Stack, IconButton, Switch } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { type UserProfile, restoreAccount } from "../../api/api";
import { displayNameFromEmail } from "../../utils/util";
import { useAuth } from "../auth/useAuth";
import { useAiPrefs } from "../../hooks/useAiPrefs";
import { Icon, Icons } from "../../components/icons";
import { MONO_FONT } from "../../theme";
import ChangePasswordDialog from "./ChangePasswordDialog";
import ChangeEmailDialog from "./ChangeEmailDialog";
import RegenerateRecoveryDialog from "./RegenerateRecoveryDialog";
import DeleteAccountDialog from "./DeleteAccountDialog";
import ConfirmDialog from "../../components/ConfirmDialog";
import QrIssueDialog from "../auth/QrIssueDialog";
import AutoFileModeDialog, { AUTO_FILE_LABEL } from "./AutoFileModeDialog";

interface Props {
  open: boolean;
  email: string | null;
  user: UserProfile | null;
  onLogout: () => void;
  onClose: () => void;
}

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return "due now";
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return mins === 1 ? "1 minute left" : `${mins} minutes left`;
  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 48) return hours === 1 ? "1 hour left" : `${hours} hours left`;
  return `${Math.ceil(ms / 86_400_000)} days left`;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

const rowSx = (disabled?: boolean, hover = true) => (t: Theme) => ({
  width: "100%", textAlign: "left" as const,
  display: "flex", alignItems: "center", gap: 1.375,
  px: 1.625, py: 1.375, mb: 1, borderRadius: "7px",
  border: "1px solid", borderColor: "divider", bgcolor: "background.paper",
  opacity: disabled ? 0.5 : 1,
  cursor: disabled ? "default" : "pointer",
  "&:hover": disabled || !hover ? {} : { borderColor: t.palette.primary.main },
});

function SettingRow({ icon, label, hint, value, onClick, disabled }: {
  icon: string; label: string; hint?: string;

  value?: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <Box
      component="button"
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.blur(); onClick(); }}
      disabled={disabled}
      sx={rowSx(disabled)}
    >
      <Icon name={icon} size={19} sx={{ color: "primary.main" }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500, fontSize: 13.5, color: "text.primary" }}>{label}</Typography>
        {hint && <Typography noWrap sx={{ fontSize: 11.5, color: "text.disabled" }}>{hint}</Typography>}
      </Box>
      {value && (
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", flexShrink: 0 }}>{value}</Typography>
      )}
      <Icon name={Icons.chevronRight} size={18} sx={{ color: "text.disabled" }} />
    </Box>
  );
}

function ToggleRow({ icon, label, hint, checked, onChange, disabled }: {
  icon: string; label: string; hint?: string;
  checked: boolean; onChange: (next: boolean) => void; disabled?: boolean;
}) {
  return (
    <Box component="label" sx={rowSx(disabled, false)}>
      <Icon name={icon} size={19} sx={{ color: "primary.main" }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500, fontSize: 13.5, color: "text.primary" }}>{label}</Typography>
        {hint && <Typography sx={{ fontSize: 11.5, color: "text.disabled" }}>{hint}</Typography>}
      </Box>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        sx={{ flexShrink: 0 }}
      />
    </Box>
  );
}

export default function ProfileDialog({ open, email, user, onLogout, onClose }: Props) {
  const token = useAuth((s) => s.token);
  const pendingDeletion = useAuth((s) => s.pendingDeletion);
  const setPendingDeletion = useAuth((s) => s.setPendingDeletion);
  const autoFileMode = useAiPrefs((s) => s.autoFileMode);
  const analysis = useAiPrefs((s) => s.analysis);
  const semanticSearch = useAiPrefs((s) => s.semanticSearch);
  const aiStatus = useAiPrefs((s) => s.aiStatus);
  const loadAiPrefs = useAiPrefs((s) => s.load);
  const updateAiPrefs = useAiPrefs((s) => s.update);
  const [pwOpen, setPwOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [autoFileOpen, setAutoFileOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  async function cancelDeletion() {
    if (!token) return;
    setCancelBusy(true);
    try {
      await restoreAccount(token);
      setPendingDeletion(null);
    } catch {

    } finally {
      setCancelBusy(false);
      setCancelConfirmOpen(false);
    }
  }

  useEffect(() => {
    if (open && token) loadAiPrefs(token);
  }, [open, token, loadAiPrefs]);

  function changePref(patch: Parameters<typeof updateAiPrefs>[1]) {
    if (token) void updateAiPrefs(token, patch);
  }
  const aiOff = !aiStatus.ai;
  const semanticOff = !aiStatus.semantic;

  const resolvedEmail = user?.email ?? email;
  const name = user?.display_name || displayNameFromEmail(resolvedEmail);
  const initial = name.charAt(0).toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).getFullYear()
    : null;

  const sectionLabel = {
    fontFamily: MONO_FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.14em",
    textTransform: "uppercase" as const, color: "text.disabled", mb: 1.375,
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: "10px", overflow: "auto" } } }}
      >

        <Stack
          direction="row"
          alignItems="center"
          spacing={1.875}
          sx={{ p: 3, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Box
            sx={{
              width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
              background: `linear-gradient(135deg,${PRIMARY},${GRADIENT_END})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: 21, color: WHITE,
            }}
          >
            {initial}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em" }}>
              {name}
            </Typography>
            <Typography noWrap sx={{ fontSize: 13, color: "text.secondary", mt: "2px" }}>
              {resolvedEmail}{memberSince ? ` · member since ${memberSince}` : ""}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="close" sx={{ color: "text.disabled" }}>
            <Icon name={Icons.close} size={22} />
          </IconButton>
        </Stack>

        <Box sx={{ p: 3 }}>
          <Box sx={sectionLabel}>Account</Box>
          <SettingRow
            icon={Icons.mail}
            label="Change email"
            onClick={() => setEmailOpen(true)}
            disabled={!token}
          />
          <SettingRow
            icon={Icons.lock}
            label="Change password"
            onClick={() => setPwOpen(true)}
            disabled={!token}
          />
          <SettingRow
            icon={Icons.verifiedUser}
            label="Regenerate recovery code"
            hint="Replaces your current recovery code"
            onClick={() => setRecoveryOpen(true)}
            disabled={!token}
          />
          <SettingRow
            icon={Icons.devices}

            label="Sign in another device"
            hint="Show a code that signs in a phone or computer"
            onClick={() => setQrOpen(true)}
            disabled={!token}
          />
        </Box>

        <Box sx={{ px: 3, pb: 1 }}>
          <Box sx={sectionLabel}>Preferences</Box>
          <SettingRow
            icon={Icons.createNewFolder}
            label="Auto-file new uploads"
            hint="Sort root-level uploads into folders automatically"
            value={AUTO_FILE_LABEL[autoFileMode]}
            onClick={() => setAutoFileOpen(true)}
            disabled={!token}
          />
          <ToggleRow
            icon={Icons.autoAwesome}
            label="File analysis"

            hint={
              aiOff
                ? "Unavailable - this server has AI switched off."
                : "Show an on-demand summary card on the file screen."
            }
            checked={analysis && !aiOff}
            disabled={!token || aiOff}
            onChange={(next) => changePref({ analysis: next })}
          />
          <ToggleRow
            icon={Icons.search}
            label="Search by meaning"
            hint={
              semanticOff
                ? "Unavailable - this server has semantic search switched off."
                : "Index files so you can search by meaning. Turning this off deletes the stored index."
            }
            checked={semanticSearch && !semanticOff}
            disabled={!token || semanticOff}
            onChange={(next) => changePref({ semantic_search: next })}
          />
        </Box>

        <Box sx={{ px: 3, pt: 2, pb: 1 }}>
          <Box sx={sectionLabel}>Danger zone</Box>
          <Box
            component="button"
            onClick={() => (pendingDeletion ? setCancelConfirmOpen(true) : setDeleteOpen(true))}
            disabled={!token || cancelBusy}
            sx={(t) => ({
              width: "100%", textAlign: "left",
              cursor: !token || cancelBusy ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 1.375,
              px: 1.625, py: 1.375, borderRadius: "7px",
              border: `1px solid ${t.palette.mode === "light" ? t.colors.accents.dangerBorderLight : t.colors.accents.dangerBorderDark}`,
              bgcolor: "background.paper",
              opacity: !token || cancelBusy ? 0.5 : 1,
              "&:hover": !token || cancelBusy ? {} : { bgcolor: OVERLAY_WARNING_HOVER },
            })}
          >
            <Icon name={pendingDeletion ? Icons.history : Icons.delete} size={19} color={WARNING} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 500, fontSize: 13.5, color: WARNING }}>
                {pendingDeletion ? (cancelBusy ? "Cancelling…" : "Cancel deletion") : "Delete account"}
              </Typography>
              <Typography noWrap sx={{ fontSize: 11.5, color: "text.disabled" }}>
                {pendingDeletion
                  ? `Scheduled for ${formatWhen(pendingDeletion)} · ${timeLeft(pendingDeletion)}`
                  : "Permanently remove your account and everything you own"}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={(t) => ({
            px: 3, py: 2, borderTop: "1px solid", borderColor: "divider",
            bgcolor: t.colors.inputBg,
          })}
        >
          <Box
            component="button"
            onClick={() => { onClose(); onLogout(); }}
            sx={(t) => ({
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 1,
              height: 42, px: 2.25, borderRadius: "7px",
              border: `1px solid ${t.palette.mode === "light" ? t.colors.accents.dangerBorderLight : t.colors.accents.dangerBorderDark}`,
              bgcolor: "transparent",
              "&:hover": { bgcolor: OVERLAY_WARNING_HOVER },
            })}
          >
            <Icon name={Icons.logout} size={18} color={WARNING} />
            <Box sx={{ fontFamily: '"Hanken Grotesk", sans-serif', fontWeight: 600, fontSize: 13, color: WARNING }}>Log out</Box>
          </Box>
        </Stack>
      </Dialog>

      {token && (
        <>
          <ChangePasswordDialog open={pwOpen} token={token} onClose={() => setPwOpen(false)} />
          <ChangeEmailDialog
            open={emailOpen}
            token={token}
            currentEmail={resolvedEmail}
            onClose={() => setEmailOpen(false)}
          />
          <RegenerateRecoveryDialog open={recoveryOpen} token={token} onClose={() => setRecoveryOpen(false)} />
          <DeleteAccountDialog
            open={deleteOpen}
            token={token}
            graceDays={user?.graceDays}
            onClose={() => setDeleteOpen(false)}
            onDeleted={() => { setDeleteOpen(false); onClose(); onLogout(); }}
          />
          <ConfirmDialog
            open={cancelConfirmOpen}
            title="Cancel the deletion?"
            message={
              pendingDeletion
                ? `Your account is scheduled for deletion on ${formatWhen(pendingDeletion)}. Cancelling keeps the account and everything in it, and the deletion will not run.`
                : "Cancelling keeps the account and everything in it, and the deletion will not run."
            }
            confirmLabel="Cancel deletion"
            dismissLabel="Keep it scheduled"
            onConfirm={cancelDeletion}
            onClose={() => setCancelConfirmOpen(false)}
          />
          <QrIssueDialog open={qrOpen} token={token} onClose={() => setQrOpen(false)} />
          <AutoFileModeDialog
            open={autoFileOpen}
            value={autoFileMode}
            aiAvailable={!aiOff}
            onSelect={(mode) => changePref({ auto_file_mode: mode })}
            onClose={() => setAutoFileOpen(false)}
          />
        </>
      )}
    </>
  );
}
