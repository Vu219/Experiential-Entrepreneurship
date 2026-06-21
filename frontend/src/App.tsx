import type { CSSProperties } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useApp } from "./context/AppContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import GuestRoute from "./auth/GuestRoute";
import AppShell from "./components/AppShell";
import ShareButton from "./components/ShareButton";
import { THEMES } from "./theme";

import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Create from "./pages/Create";
import Calendar from "./pages/Calendar";
import Analytics from "./pages/Analytics";
import Trends from "./pages/Trends";
import Brand from "./pages/Brand";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";

// Backend-driven flows kept from the original app (real URLs the server redirects to).
import GoogleCallbackPage from "./pages/GoogleCallbackPage";
import CompleteProfilePage from "./pages/CompleteProfilePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import BrandProfilePage from "./pages/BrandProfilePage";

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
          <Route path="/admin" element={<Admin />} />
        </Route>

        {/* Full brand-profile management (multi-profile CRUD). */}
        <Route
          path="/brand-profiles"
          element={
            <ProtectedRoute>
              <BrandProfilePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Nút chia sẻ nổi — hiển thị trên mọi trang */}
      <ShareButton />
    </div>
  );
}
