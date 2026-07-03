import type { CSSProperties } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useApp } from "./context/AppContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";
import GuestRoute from "./auth/GuestRoute";
import AppShell from "./components/AppShell";
import ShareButton from "./components/ShareButton";
import { THEMES } from "./theme";

import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import Dashboard from "./pages/app/Dashboard.tsx";
import Create from "./pages/app/Create.tsx";
import Calendar from "./pages/app/Calendar.tsx";
import Analytics from "./pages/app/Analytics.tsx";
import Trends from "./pages/app/Trends.tsx";
import Brand from "./pages/app/Brand.tsx";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import AdminOverview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/Users";
import AdminPosts from "./pages/admin/Posts";
import AdminSystem from "./pages/admin/SystemStatus";
import AdminLogs from "./pages/admin/Logs";
import AdminApiVersions from "./pages/admin/ApiVersions";
import AdminRevenue from "./pages/admin/Revenue";

// Backend-driven flows kept from the original app (real URLs the server redirects to).
import GoogleCallbackPage from "./pages/GoogleCallbackPage";
import CompleteProfilePage from "./pages/CompleteProfilePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

// Authenticated app shell — sidebar + topbar wrap every signed-in page.
function AppLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}

// Khu vực Quản trị hệ thống — giao diện riêng (sidebar admin), chỉ ADMIN.
function AdminLayout() {
  return (
    <ProtectedRoute>
      <AdminRoute>
        <AppShell variant="admin">
          <Outlet />
        </AppShell>
      </AdminRoute>
    </ProtectedRoute>
  );
}

export default function App() {
  const { theme } = useApp();
  // Expose the active brand gradient so .gradtext / var(--brand) follow the theme.
  const themeVars = {
    "--brand": THEMES[theme].brand,
    "--soft": THEMES[theme].soft,
  } as CSSProperties;

  return (
    <div style={themeVars}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<GuestRoute><Auth /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Auth /></GuestRoute>} />
        <Route path="/logout" element={<Auth />} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/complete-profile" element={<CompleteProfilePage />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create" element={<Create />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/brand" element={<Brand />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Khu vực Quản trị hệ thống — tách riêng giao diện, chỉ ADMIN. */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/posts" element={<AdminPosts />} />
          <Route path="/admin/system" element={<AdminSystem />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
          <Route path="/admin/api-versions" element={<AdminApiVersions />} />
          <Route path="/admin/revenue" element={<AdminRevenue />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Nút chia sẻ nổi — hiển thị trên mọi trang */}
      <ShareButton />
    </div>
  );
}
