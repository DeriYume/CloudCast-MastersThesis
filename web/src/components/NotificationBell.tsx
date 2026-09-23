import { useCallback, useEffect, useState } from "react";
import { PRIMARY, WARNING } from "../theme/colors.generated";
import {
  IconButton, Badge, Menu, Box, Stack, Typography, CircularProgress, Tooltip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  listNotifications, deleteNotification, clearNotifications, openNotificationStream,
  type NotificationItem,
} from "../api/api";
import { bumpVaultRevision } from "../features/files/useVaultRevision";
import { useAiPrefs } from "../hooks/useAiPrefs";
import { relativeTime } from "../utils/util";
import { Icon, Icons } from "./icons";
import { MONO_FONT } from "../theme";

const POLL_MS = 5 * 60_000;

const CATCHUP_MIN_GAP_MS = 30_000;

function tileFor(type: string): { icon: string; color: string; warn?: boolean; fill?: boolean } {
  switch (type) {
    case "share":
      return { icon: Icons.group, color: PRIMARY };
    case "login":
    case "approve":
      return { icon: Icons.verifiedUser, color: PRIMARY };
    case "expiry":
    case "expiring":
      return { icon: Icons.schedule, color: WARNING, warn: true };
    case "ai":
    case "autofile":
      return { icon: Icons.autoAwesome, color: PRIMARY, fill: true };
    case "owner_leaving":
      return { icon: Icons.schedule, color: WARNING, warn: true };
    default:
      return { icon: Icons.notifications, color: PRIMARY };
  }
}

function messageFor(n: NotificationItem): string {
  switch (n.type) {
    case "share":
      return n.folder_id ? "A folder was shared with you." : "A file was shared with you.";
    case "owner_leaving":
      return n.folder_id
        ? "An owner is deleting their account - save the shared folder to keep it."
        : "An owner is deleting their account - save the shared file to keep it.";
    case "expiry":
    case "expiring":
      return "An item is expiring soon.";
    default:
      return "You have a new notification.";
  }
}

export default function NotificationBell({ token }: { token: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const open = Boolean(anchorEl);

  const load = useCallback(async () => {
    try {
      const data = await listNotifications(token);
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {

    }
  }, [token]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let safetyNet: ReturnType<typeof setInterval> | null = null;

    let lastCatchUp = Date.now();
    const catchUp = () => {
      if (Date.now() - lastCatchUp < CATCHUP_MIN_GAP_MS) return;
      lastCatchUp = Date.now();
      bumpVaultRevision();
    };

    let everOpened = false;

    const connect = () => {
      unsub = openNotificationStream(
        token,
        (event) => {

          if (event === "files") bumpVaultRevision();
          else if (event === "prefs") useAiPrefs.getState().load(token);
          else load();
        },

        () => {
          unsub = null;
          const wasOpen = everOpened;
          everOpened = false;
          reconnect = setTimeout(() => {
            reconnect = null;
            connect();
            load();

            if (wasOpen) catchUp();
          }, 4000);
        },
        () => { everOpened = true; }
      );
    };
    const start = () => {
      if (unsub || reconnect) return;
      load();

      catchUp();
      connect();
      safetyNet = setInterval(load, POLL_MS);
    };
    const stop = () => {
      if (unsub) { unsub(); unsub = null; }
      if (reconnect) { clearTimeout(reconnect); reconnect = null; }
      if (safetyNet) { clearInterval(safetyNet); safetyNet = null; }
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [load, token]);

  async function handleOpen(e: React.MouseEvent<HTMLElement>) {
    setAnchorEl(e.currentTarget);
    setLoading(true);
    await load();
    setLoading(false);
  }

  function destinationFor(n: NotificationItem): string | null {
    if (n.file_id) return `/files/${n.file_id}`;
    if (n.folder_id) return `/folders/${n.folder_id}`;
    return "/shared/with-me";
  }

  async function handleClick(n: NotificationItem) {
    setAnchorEl(null);
    dismiss(n);
    const dest = destinationFor(n);
    if (dest) navigate(dest);
  }

  function dismiss(n: NotificationItem) {
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    setUnread((u) => Math.max(0, u - 1));

    deleteNotification(token, n.id).catch(() => {  });
  }

  async function handleRemove(e: React.MouseEvent, n: NotificationItem) {
    e.stopPropagation();
    dismiss(n);
  }

  async function handleClearAll() {
    setItems([]);
    setUnread(0);
    try {
      await clearNotifications(token);
    } catch {

    }
  }

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton color="inherit" onClick={handleOpen} aria-label="notifications" sx={{ ml: 0.5 }}>
          <Badge badgeContent={unread} color="error" max={99}>
            <Icon name={Icons.notifications} size={22} fill={unread > 0} sx={{ color: unread > 0 ? "primary.main" : "text.secondary" }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { width: 392, maxWidth: "92vw", borderRadius: "10px", overflow: "hidden", mt: 0.5 } },
          list: { sx: { p: 0 } },
        }}
      >

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2.25, py: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Typography sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>
            Notifications
          </Typography>

          <Stack direction="row" spacing={1.5}>
            <Box
              component="button"
              onClick={handleClearAll}
              disabled={items.length === 0}
              sx={{
                border: "none", background: "transparent", cursor: items.length === 0 ? "default" : "pointer", p: 0,
                fontFamily: '"Hanken Grotesk", sans-serif', fontWeight: 600, fontSize: 12,
                color: items.length === 0 ? "text.disabled" : "primary.main",
              }}
            >
              Clear all
            </Box>
          </Stack>
        </Stack>

        {loading && items.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={22} />
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4, px: 2 }}>
            <Icon name={Icons.notificationsOff} size={32} sx={{ color: "text.disabled" }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              You're all caught up.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 0.75, maxHeight: 420, overflowY: "auto" }}>
            {items.map((n) => {
              const tile = tileFor(n.type);
              return (
                <Stack
                  key={n.id}
                  direction="row"
                  spacing={1.5}
                  onClick={() => handleClick(n)}

                  sx={(t) => ({
                    p: 1.5, borderRadius: "8px", cursor: "pointer",
                    bgcolor: t.colors.unreadRowBg,
                    "&:hover": { bgcolor: t.colors.rowHoverBg },
                    "& .notif-remove": { opacity: 0 },
                    "&:hover .notif-remove": { opacity: 1 },
                  })}
                >
                  <Box
                    sx={(t) => ({
                      width: 38, height: 38, flexShrink: 0, borderRadius: "7px",
                      bgcolor: tile.warn
                        ? (t.palette.mode === "light" ? t.colors.accents.warningBgLight : t.colors.accents.warningBgDark)
                        : t.colors.primaryTint,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    })}
                  >
                    <Icon name={tile.icon} size={20} fill={tile.fill} color={tile.color} />
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, lineHeight: 1.4, color: "text.primary", fontWeight: 500 }}>
                      {messageFor(n)}
                    </Typography>
                    <Box sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: 10.5, color: "text.disabled", mt: "3px" }}>
                      {relativeTime(n.created_at)}
                    </Box>
                  </Box>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main", mt: 0.5, flexShrink: 0 }} />
                  <Tooltip title="Dismiss">
                    <IconButton
                      className="notif-remove"
                      size="small"
                      aria-label="dismiss notification"
                      onClick={(e) => handleRemove(e, n)}
                      sx={{ color: "text.disabled", p: 0.25, alignSelf: "flex-start" }}
                    >
                      <Icon name={Icons.close} size={16} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              );
            })}
          </Box>
        )}
      </Menu>
    </>
  );
}
