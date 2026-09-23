import { useEffect, useState } from "react";
import { PRIMARY, GRADIENT_END, WHITE } from "../theme/colors.generated";
import {
  AppBar, Toolbar, Box,
  Drawer, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Avatar, Tooltip, useMediaQuery,
} from "@mui/material";
import { Icon, Icons } from "./icons";
import { Outlet, useNavigate, useLocation, useParams } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { useAuth } from "../features/auth/useAuth";
import { usePrefs } from "../hooks/usePrefs";
import { useAiPrefs } from "../hooks/useAiPrefs";
import { useFolders } from "../features/folders/useFolders";
import { useFolderActions } from "../features/folders/useFolderActions";
import { logout as apiLogout, getMe } from "../api/api";
import { displayNameFromEmail } from "../utils/util";
import FolderNameDialog from "../features/folders/FolderNameDialog";
import ConfirmDialog from "./ConfirmDialog";
import FolderTree from "../features/folders/FolderTree";
import ProfileDialog from "../features/account/ProfileDialog";
import SearchBar from "./SearchBar";
import NotificationBell from "./NotificationBell";
import Logo from "./Logo";

const DRAWER_WIDTH = 250;

function initialsFor(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Layout() {
  const token = useAuth((s) => s.token);
  const email = useAuth((s) => s.email);
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const setUser = useAuth((s) => s.setUser);
  const setPendingDeletion = useAuth((s) => s.setPendingDeletion);
  const folders = useFolders((s) => s.folders);
  const refreshFolders = useFolders((s) => s.refresh);
  const resetFolders = useFolders((s) => s.reset);
  const loadAiPrefs = useAiPrefs((s) => s.load);
  const resetAiPrefs = useAiPrefs((s) => s.reset);

  const themeMode = usePrefs((s) => s.themeMode);
  const toggleThemeMode = usePrefs((s) => s.toggleThemeMode);

  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeFolderId = location.pathname.startsWith("/folders/") ? params.folderId : undefined;

  const displayName = user?.display_name || displayNameFromEmail(email);
  const initials = initialsFor(displayName);

  const folderActions = useFolderActions({
    token,
    activeFolderId,
    onCreated: () => undefined,
  });

  useEffect(() => {
    if (!token) return;
    refreshFolders(token).catch(() => undefined);
    loadAiPrefs(token);
    getMe(token)
      .then(({ user }) => {
        setUser(user);
        setPendingDeletion(user.pendingDeletion ?? null);
      })
      .catch((e: Error & { status?: number }) => {
        if (e.status === 401) doLogout();
      });
  }, [token]);

  async function doLogout() {
    if (token) {
      try {
        await apiLogout(token);
      } catch {

      }
    }
    clear();
    resetFolders();
    resetAiPrefs();
    navigate("/login");
  }

  function navigateAndCloseDrawer(path: string) {
    navigate(path);
    setMobileOpen(false);
  }

  const sidebar = (
    <FolderTree
      width="AUTO"
      folders={folders}
      activeFolderId={activeFolderId}
      isRootSelected={location.pathname === "/"}
      isFavoritesSelected={location.pathname === "/favorites"}
      isSharedSelected={location.pathname.startsWith("/shared")}
      isExpiringSelected={location.pathname === "/expiring"}
      onNavigate={navigateAndCloseDrawer}
      onNewFolder={folderActions.openNewFolder}
      onOpenFolderMenu={folderActions.openFolderMenu}
    />
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        elevation={0}
        color="default"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {!isDesktop && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 0.5 }} aria-label="open navigation">
              <Icon name={Icons.menu} />
            </IconButton>
          )}
          <Box sx={{ cursor: "pointer" }} onClick={() => navigate("/")}>
            <Logo size={34} wordmark={isDesktop ? 18 : false} />
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <SearchBar />
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title={themeMode === "light" ? "Switch to dark mode" : "Switch to light mode"}>
            <IconButton color="inherit" onClick={toggleThemeMode} aria-label="toggle colour theme">
              {themeMode === "light" ? <Icon name={Icons.darkMode} /> : <Icon name={Icons.lightMode} />}
            </IconButton>
          </Tooltip>
          {token && <NotificationBell token={token} />}
          <Tooltip title="Profile">
            <IconButton
              aria-label="open profile"
              onClick={(e) => {
                (e.currentTarget as HTMLElement).blur();
                setProfileOpen(true);
              }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  background: `linear-gradient(135deg,${PRIMARY},${GRADIENT_END})`,
                  color: WHITE,
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {initials}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              borderColor: "divider",
              bgcolor: "background.paper",
            },
          }}
        >
          <Toolbar />
          <Box sx={{ height: "calc(100vh - 64px)" }}>{sidebar}</Box>
        </Drawer>
      ) : (
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ "& .MuiDrawer-paper": { width: 250 } }} >
          <Toolbar />
          <Box sx={{ height: "calc(100vh - 64px)" }}>{sidebar}</Box>
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          ml: { md: `${DRAWER_WIDTH}px` },
          pt: { xs: 9, sm: 10 },
          px: { xs: 2, sm: 3, md: 4 },
          pb: 5,
        }}
      >
        <Box sx={{ maxWidth: 1100, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>

      <FolderNameDialog
        open={folderActions.newFolderOpen}
        title={folderActions.newFolderParent ? "New subfolder" : "New folder"}
        confirmLabel="Create"
        onSubmit={folderActions.handleCreateFolder}
        onClose={folderActions.closeNewFolder}
      />

      <Menu anchorEl={folderActions.menuEl} open={Boolean(folderActions.menuEl)} onClose={folderActions.closeFolderMenu}>
        <MenuItem
          onClick={() => {
            if (folderActions.menuFolder) folderActions.openNewFolder(folderActions.menuFolder.id);
            folderActions.closeFolderMenu();
          }}
        >
          <ListItemIcon>
            <Icon name={Icons.createNewFolder} />
          </ListItemIcon>
          <ListItemText>New subfolder</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            folderActions.setRenameTarget(folderActions.menuFolder);
            folderActions.closeFolderMenu();
          }}
        >
          <ListItemIcon>
            <Icon name={Icons.rename} />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            folderActions.setDeleteTarget(folderActions.menuFolder);
            folderActions.closeFolderMenu();
          }}
        >
          <ListItemIcon>
            <Icon name={Icons.delete} sx={{ color: "error.main" }} />
          </ListItemIcon>
          <ListItemText sx={{ color: "error.main" }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <ProfileDialog
        open={profileOpen}
        email={email}
        user={user}
        onLogout={doLogout}
        onClose={() => setProfileOpen(false)}
      />

      <FolderNameDialog
        open={Boolean(folderActions.renameTarget)}
        title="Rename folder"
        initialName={folderActions.renameTarget?.name}
        onSubmit={(name) => folderActions.renameTarget && folderActions.handleRenameFolder(folderActions.renameTarget.id, name)}
        onClose={() => folderActions.setRenameTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(folderActions.deleteTarget)}
        title="Delete folder?"
        message={`"${folderActions.deleteTarget?.name}" and everything inside it - sub-folders and files - will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete folder"
        destructive
        onConfirm={() => folderActions.deleteTarget && folderActions.handleDeleteFolder(folderActions.deleteTarget.id)}
        onClose={() => folderActions.setDeleteTarget(null)}
      />
    </Box>
  );
}
