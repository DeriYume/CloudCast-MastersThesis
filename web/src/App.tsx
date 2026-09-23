import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import LoginPage from "./pages/LoginPage";
import FilesPage from "./pages/FilesPage";
import FileDetailPage from "./pages/FileDetailPage";
import SearchPage from "./pages/SearchPage";
import Layout from "./components/Layout";
import Logo from "./components/Logo";
import ProtectedRoute from "./features/auth/ProtectedRoute";
import { useAuth } from "./features/auth/useAuth";
import { useDragGuard } from "./features/dnd/useDragGuard";
import { ready as cryptoReady } from "./features/crypto/sodium";
import { setUnauthorizedHandler } from "./api/api";

function BootSplash() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
      <Logo />
      <CircularProgress size={26} />
    </Box>
  );
}

export default function App() {
  useDragGuard();
  const navigate = useNavigate();

  const [cryptoReadyOk, setCryptoReadyOk] = useState(false);
  useEffect(() => {
    let mounted = true;
    cryptoReady().then(() => { if (mounted) setCryptoReadyOk(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!useAuth.getState().token) return;
      useAuth.getState().clear();
      navigate("/login", { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  if (!cryptoReadyOk) return <BootSplash />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<FilesPage view="root" />} />
          <Route path="/favorites" element={<FilesPage view="favorites" />} />
          <Route path="/shared" element={<FilesPage view="shared-hub" />} />
          <Route path="/shared/by-me" element={<FilesPage view="shared-by-me" />} />
          <Route path="/shared/with-me" element={<FilesPage view="shared-with-me" />} />

          <Route path="/shared/recent" element={<Navigate to="/shared" replace />} />
          <Route path="/expiring" element={<FilesPage view="expiring" />} />
          <Route path="/folders/:folderId" element={<FilesPage view="folder" />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/files/:id" element={<FileDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
