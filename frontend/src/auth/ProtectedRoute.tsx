import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Loader } from "../components/ui";

interface Props {
  children: ReactNode;
  // Khi true (mặc định): hồ sơ chưa hoàn tất sẽ bị đẩy sang /complete-profile.
  requireCompleteProfile?: boolean;
}

export default function ProtectedRoute({
  children,
  requireCompleteProfile = true,
}: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader fullScreen />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (requireCompleteProfile && !user.profileCompleted) {
    return <Navigate to="/complete-profile" replace />;
  }
  return <>{children}</>;
}
