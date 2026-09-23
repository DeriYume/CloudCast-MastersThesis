import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";
import { useCryptoSession } from "../crypto/session";

export default function ProtectedRoute() {
  const token = useAuth((s) => s.token);
  const unlocked = useCryptoSession((s) => s.unlocked);

  return token && unlocked ? <Outlet /> : <Navigate to="/login" replace />;
}
