import { useCallback, useEffect, useState } from "react";
import {
  Dialog, Button, TextField, Stack, Alert, Box, Typography,
  CircularProgress, Menu, MenuItem, ListItemIcon, ListItemText,
  IconButton, Tooltip, Autocomplete,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs, { type Dayjs } from "dayjs";
import {
  createShare, listShares, deleteShare, updateShare, resolveRecipient, listContacts,
  unshareAll, setShareExpiry,
  type ShareItem, type SharePermission, type Contact,
} from "../../api/api";
import { relativeTime } from "../../utils/util";
import { Icon, Icons } from "../../components/icons";
import { MONO_FONT } from "../../theme";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useAuth } from "../auth/useAuth";
import { friendlyError } from "../../utils/errors";
import ConfirmDialog from "../../components/ConfirmDialog";

const PERMISSION_OPTIONS: { value: SharePermission; label: string; icon: string }[] = [
  { value: "view", label: "View only", icon: Icons.visibility },
  { value: "save", label: "View & save", icon: Icons.save },
];

interface Props {
  open: boolean;
  token: string;
  fileId?: string;
  folderId?: string;
  resourceName: string;
  onClose: () => void;
}

function initials(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return chars.toUpperCase();
}

export default function ShareDialog({
  open, token, fileId, folderId, resourceName, onClose,
}: Props) {
  const ownerEmail = useAuth((s) => s.email);
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recipient, setRecipient] = useState("");
  const [expiry, setExpiry] = useState<Dayjs | null>(null);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [permission, setPermission] = useState<SharePermission>("view");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [bulkExpiry, setBulkExpiry] = useState<Dayjs | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const debouncedRecipient = useDebouncedValue(recipient, 150);

  const q = debouncedRecipient.trim().toLowerCase();
  const options = (q ? contacts.filter((c) => c.label.toLowerCase().includes(q)) : []).slice(0, 8);

  const target = fileId ? { file_id: fileId } : { folder_id: folderId };
  const editingShare = shares.find((s) => s.id === editing) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { shares } = await listShares(token, target);
      setShares(shares);
    } catch (e) {
      setError(friendlyError(e, "Could not load recipients."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fileId, folderId]);

  useEffect(() => {
    if (open) {
      setRecipient("");
      setExpiry(null);
      setExpiryOpen(false);
      setPermission("view");
      setError("");
      setEditing(null);
      load();

      listContacts(token).then((r) => setContacts(r.contacts)).catch(() => setContacts([]));
    }
  }, [open, load, token]);

  async function handleAdd() {
    setError("");
    const trimmed = recipient.trim();
    if (!trimmed) {
      setError("Please enter an email address.");
      return;
    }
    if (expiry) {
      if (!expiry.isValid() || expiry.valueOf() <= Date.now()) {
        setError("Share expiry must be in the future.");
        return;
      }
    }
    setAdding(true);
    try {

      const recip = await resolveRecipient(token, trimmed);
      if (!recip) {
        setError("No CloudCast account matches that email address.");
        return;
      }
      await createShare(token, {
        ...target,
        recipient: { id: recip.id, public_key: recip.public_key },
        label: trimmed,
        ownerLabel: ownerEmail ?? "Someone",
        expires_at: expiry ? expiry.toISOString() : null,
        permission,
      });
      setRecipient("");
      setExpiry(null);
      setPermission("view");
      await load();
      listContacts(token).then((r) => setContacts(r.contacts)).catch(() => {});
    } catch (e) {
      setError(friendlyError(e, "Could not share."));
    } finally {
      setAdding(false);
    }
  }

  async function handleChangeExpiry(id: string, value: Dayjs | null) {
    setError("");
    if (value && (!value.isValid() || value.valueOf() <= Date.now())) {
      setError("Share expiry must be in the future.");
      return;
    }
    const iso = value ? value.toISOString() : null;
    const prev = shares;
    setShares((cur) => cur.map((s) => (s.id === id ? { ...s, expires_at: iso } : s)));
    try {
      await updateShare(token, id, { expires_at: iso });
    } catch (e) {
      setShares(prev);
      setError(friendlyError(e, "Could not update expiry."));
    }
  }

  async function handleExpiryForEveryone(value: Dayjs | null) {
    setError("");
    if (value && (!value.isValid() || value.valueOf() <= Date.now())) {
      setError("Share expiry must be in the future.");
      return;
    }
    try {
      await setShareExpiry(token, target, value ? value.toISOString() : null);
      setBulkOpen(false);
      setBulkExpiry(null);
      await load();
    } catch (e) {
      setError(friendlyError(e, "Could not update expiry."));
    }
  }

  async function handleStopSharing() {
    setError("");
    try {
      await unshareAll(token, target);
      onClose();
    } catch (e) {
      setError(friendlyError(e, "Could not stop sharing."));
    }
  }

  async function handleRevoke(id: string) {
    setError("");
    try {
      await deleteShare(token, id);
      setShares((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(friendlyError(e, "Could not revoke."));
    }
  }

  async function handleChangePermission(id: string, permission: SharePermission) {
    setError("");
    const prev = shares;
    setShares((cur) => cur.map((s) => (s.id === id ? { ...s, permission } : s)));
    try {
      await updateShare(token, id, { permission });
    } catch (e) {
      setShares(prev);
      setError(friendlyError(e, "Could not update permission."));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: "10px", overflow: "hidden" } } }}
    >

      <Stack
        direction="row"
        alignItems="center"
        spacing={1.625}
        sx={{ px: 2.75, py: 2.5, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>
            Share “{resourceName}”
          </Typography>
        </Box>
        {shares.length > 0 && (
          <>
            <IconButton
              onClick={(e) => setMenuEl(e.currentTarget)}
              aria-label="sharing options"
              sx={{ color: "text.disabled" }}
            >
              <Icon name={Icons.moreVert} size={22} />
            </IconButton>
            <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}>
              <MenuItem onClick={() => { setMenuEl(null); setBulkOpen(true); }}>
                <ListItemIcon><Icon name={Icons.schedule} /></ListItemIcon>
                <ListItemText>Set expiry for everyone</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { setMenuEl(null); setConfirmStop(true); }}>
                <ListItemIcon><Icon name={Icons.close} sx={{ color: "error.main" }} /></ListItemIcon>
                <ListItemText sx={{ color: "error.main" }}>Stop sharing</ListItemText>
              </MenuItem>
            </Menu>
          </>
        )}
        <IconButton onClick={onClose} aria-label="close" sx={{ color: "text.disabled" }}>
          <Icon name={Icons.close} size={22} />
        </IconButton>
      </Stack>

      <Box sx={{ px: 2.75, py: 2.5 }}>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.125}>
          <Autocomplete<Contact, false, false, true>
            freeSolo
            fullWidth
            options={options}
            filterOptions={(x) => x}
            inputValue={recipient}
            onInputChange={(_, value) => setRecipient(value)}
            onChange={(_, value) => {
              if (typeof value === "string") setRecipient(value);
              else if (value) setRecipient(value.label);
            }}
            getOptionLabel={(o) => (typeof o === "string" ? o : o.label)}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            noOptionsText="No matching contact - enter a full email address"
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id} sx={{ gap: 1.25 }}>
                <Box
                  sx={(t) => ({
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    bgcolor: t.colors.primaryTint,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: 11.5,
                    color: "primary.main",
                  })}
                >
                  {initials(option.label)}
                </Box>
                <Typography noWrap sx={{ fontWeight: 600, fontSize: 13, minWidth: 0 }}>
                  {option.label}
                </Typography>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Email address"
                size="small"
                type="email"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
            )}
          />
          <TextField
            select
            value={permission}
            onChange={(e) => setPermission(e.target.value as SharePermission)}
            size="small"
            sx={{ minWidth: { sm: 170 } }}
            fullWidth
          >
            {PERMISSION_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.125} alignItems={{ sm: "center" }} sx={{ mt: 1.625 }}>
          <DateTimePicker
            label="Access expires"
            value={expiry}
            onChange={(v) => setExpiry(v)}
            minDateTime={dayjs()}
            open={expiryOpen}
            onOpen={() => setExpiryOpen(true)}
            onClose={() => setExpiryOpen(false)}
            closeOnSelect={false}
            slotProps={{
              textField: {
                size: "small",
                fullWidth: true,
                onClick: () => setExpiryOpen(true),
                inputProps: { readOnly: true },
                sx: { "& input": { cursor: "pointer" } },
              },
            }}
          />
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={adding}
            sx={{ whiteSpace: "nowrap", flexShrink: 0, height: 42, px: 2.5 }}
          >
            {adding ? "Sharing…" : "Share"}
          </Button>
        </Stack>

        {error && <Alert severity="error" onClose={() => setError("")} sx={{ mt: 2 }}>{error}</Alert>}

        <Box
          sx={{
            fontFamily: MONO_FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "text.disabled", mt: 2.75, mb: 1.25,
          }}
        >
          People with access{shares.length ? ` · ${shares.length}` : ""}
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Stack spacing={0}>

            {shares.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                Not shared with anyone yet.
              </Typography>
            ) : (
              shares.map((s) => (
                <Stack
                  key={s.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  onClick={() => setEditing(s.id)}
                  sx={{
                    py: 1.125, px: 1, mx: -1, borderRadius: "8px", cursor: "pointer",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Box
                    sx={(t) => ({
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      bgcolor: t.colors.primaryTint,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: 13, color: "primary.main",
                    })}
                  >
                    {initials(s.label || "?")}
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 600, fontSize: 13.5 }}>{s.label || "Shared user"}</Typography>
                    <Box sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: 10.5, color: "text.disabled", mt: "1px" }}>
                      {(PERMISSION_OPTIONS.find((o) => o.value === s.permission)?.label ?? "View only") +
                        (s.expires_at ? ` · expires ${relativeTime(s.expires_at)}` : "")}
                    </Box>
                  </Box>
                  <Tooltip title="Stop sharing">
                    <IconButton
                      size="small"
                      aria-label={`stop sharing with ${s.label || "recipient"}`}
                      onClick={(e) => { e.stopPropagation(); handleRevoke(s.id); }}
                      sx={{ color: "text.disabled" }}
                    >
                      <Icon name={Icons.close} size={19} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))
            )}
          </Stack>
        )}
      </Box>

      <ConfirmDialog
        open={confirmStop}
        title="Stop sharing?"
        message={`Everyone will lose access to “${resourceName}”. It stays in your own files.`}
        confirmLabel="Stop sharing"
        destructive
        onConfirm={handleStopSharing}
        onClose={() => setConfirmStop(false)}
      />

      {bulkOpen && (
        <Dialog open onClose={() => setBulkOpen(false)} maxWidth="xs" fullWidth>
          <Box sx={{ px: 2.75, pt: 2.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Set expiry for everyone</Typography>
            <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: "2px" }}>
              Applies to all {shares.length} {shares.length === 1 ? "recipient" : "recipients"}.
            </Typography>
          </Box>
          <Box sx={{ px: 2.75, py: 2.5 }}>
            <DateTimePicker
              label="Access expires"
              value={bulkExpiry}
              onChange={(v) => setBulkExpiry(v)}
              minDateTime={dayjs()}
              slotProps={{
                textField: { size: "small", fullWidth: true, inputProps: { readOnly: true }, sx: { "& input": { cursor: "pointer" } } },
              }}
            />
          </Box>
          <Stack direction="row" justifyContent="space-between" sx={{ px: 2, pb: 2 }}>
            <Button onClick={() => handleExpiryForEveryone(null)}>Remove expiry</Button>
            <Box>
              <Button onClick={() => setBulkOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={() => handleExpiryForEveryone(bulkExpiry)}>Apply</Button>
            </Box>
          </Stack>
        </Dialog>
      )}

      {editingShare && (
        <Dialog open onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.75, pt: 2.5 }}>
            <Box
              sx={(t) => ({
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                bgcolor: t.colors.primaryTint,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: 13, color: "primary.main",
              })}
            >
              {initials(editingShare.label || "?")}
            </Box>
            <Typography noWrap sx={{ fontWeight: 700, fontSize: 15, minWidth: 0 }}>
              {editingShare.label || "Shared user"}
            </Typography>
          </Stack>

          <Box sx={{ px: 2.75, py: 2.5 }}>
            <TextField
              select
              size="small"
              fullWidth
              label="Permission"
              value={editingShare.permission === "owner" ? "view" : editingShare.permission}
              onChange={(e) => handleChangePermission(editingShare.id, e.target.value as SharePermission)}
            >
              {PERMISSION_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </TextField>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.75 }}>
              <DateTimePicker
                label="Access expires"
                value={editingShare.expires_at ? dayjs(editingShare.expires_at) : null}
                onChange={(v) => handleChangeExpiry(editingShare.id, v)}
                minDateTime={dayjs()}
                slotProps={{
                  textField: {
                    size: "small",
                    fullWidth: true,
                    inputProps: { readOnly: true },
                    placeholder: "Never",
                    sx: { "& input": { cursor: "pointer" } },
                  },
                }}
              />
              {editingShare.expires_at && (
                <Tooltip title="Remove expiry">
                  <IconButton
                    size="small"
                    aria-label="remove expiry"
                    onClick={() => handleChangeExpiry(editingShare.id, null)}
                    sx={{ color: "text.disabled" }}
                  >
                    <Icon name={Icons.close} size={19} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Box>

          <Stack direction="row" justifyContent="space-between" sx={{ px: 2, pb: 2 }}>
            <Button
              color="error"
              onClick={() => { handleRevoke(editingShare.id); setEditing(null); }}
            >
              Stop sharing
            </Button>
            <Button onClick={() => setEditing(null)}>Done</Button>
          </Stack>
        </Dialog>
      )}
    </Dialog>
  );
}
