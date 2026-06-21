import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Loader } from "../components/ui";

// Chỉ cho khách (chưa đăng nhập) vào. Đã đăng nhập thì chặn các trang login/
// register/forgot-password, đẩy về dashboard (hoặc complete-profile nếu hồ sơ
// chưa hoàn tất) — đối xứng với ProtectedRoute.
export default function GuestRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader fullScreen />;
  }
  if (user) {
    return <Navigate to={user.profileCompleted ? "/dashboard" : "/complete-profile"} replace />;
  }
  return <>{children}</>;
}
