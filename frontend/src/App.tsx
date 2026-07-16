import { lazy, Suspense, useEffect } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useApp } from "./context/AppContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";
import GuestRoute from "./auth/GuestRoute";
import AppShell from "./components/AppShell";
import ShareButton from "./components/ShareButton";

// Code-splitting theo route (hiệu năng tải trang): mỗi trang một chunk, tải khi vào route —
// landing không kéo theo app/admin và ngược lại. Chỉ shell/route-guard ở chunk chính.
const LandingPage = lazy(() => import("./pages/LandingPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/app/Dashboard.tsx"));
const Create = lazy(() => import("./pages/app/Create.tsx"));
const CreateWizard = lazy(() => import("./pages/app/CreateWizard.tsx"));
const Calendar = lazy(() => import("./pages/app/Calendar.tsx"));
const FailedPosts = lazy(() => import("./pages/app/FailedPosts.tsx"));
const Analytics = lazy(() => import("./pages/app/Analytics.tsx"));
const Trends = lazy(() => import("./pages/app/Trends.tsx"));
const Brand = lazy(() => import("./pages/app/Brand.tsx"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminOverview = lazy(() => import("./pages/admin/Overview"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminPosts = lazy(() => import("./pages/admin/Posts"));
const AdminSystem = lazy(() => import("./pages/admin/SystemStatus"));
const AdminLogs = lazy(() => import("./pages/admin/Logs"));
const AdminApiVersions = lazy(() => import("./pages/admin/ApiVersions"));
const AdminRevenue = lazy(() => import("./pages/admin/Revenue"));
const AdminPlans = lazy(() => import("./pages/admin/Plans"));
const AdminAiProviders = lazy(() => import("./pages/admin/AiProviders"));
const AdminAiModels = lazy(() => import("./pages/admin/AiModels"));
const AdminAiUsage = lazy(() => import("./pages/admin/AiUsage"));

// Backend-driven flows kept from the original app (real URLs the server redirects to).
const GoogleCallbackPage = lazy(() => import("./pages/GoogleCallbackPage"));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));

// Fallback khi chunk trang đang tải — dùng .loader sẵn có (index.css), căn giữa viewport.
function PageLoader() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span className="loader" aria-label="Loading" />
    </div>
  );
}

// Tải trước chunk các trang cùng khu vực khi trình duyệt rảnh — click sidebar
// không phải chờ tải chunk (đường dẫn lặp lại với lazy() ở trên; lệch nhau chỉ
// làm mất prefetch của trang đó, trang vẫn lazy-load bình thường).
function usePrefetchOnIdle(imports: ReadonlyArray<() => Promise<unknown>>) {
  useEffect(() => {
    const idle: (cb: () => void) => void =
      "requestIdleCallback" in window
        ? (cb) => window.requestIdleCallback(cb)
        : (cb) => window.setTimeout(cb, 1500);
    idle(() => imports.forEach((f) => f().catch(() => undefined)));
  }, [imports]);
}

const APP_PAGE_IMPORTS = [
  () => import("./pages/app/Dashboard.tsx"),
  () => import("./pages/app/Create.tsx"),
  () => import("./pages/app/CreateWizard.tsx"),
  () => import("./pages/app/Calendar.tsx"),
  () => import("./pages/app/FailedPosts.tsx"),
  () => import("./pages/app/Analytics.tsx"),
  () => import("./pages/app/Trends.tsx"),
  () => import("./pages/app/Brand.tsx"),
  () => import("./pages/Profile"),
  () => import("./pages/Settings"),
] as const;

const ADMIN_PAGE_IMPORTS = [
  () => import("./pages/admin/Overview"),
  () => import("./pages/admin/Users"),
  () => import("./pages/admin/Posts"),
  () => import("./pages/admin/SystemStatus"),
  () => import("./pages/admin/Logs"),
  () => import("./pages/admin/ApiVersions"),
  () => import("./pages/admin/Revenue"),
  () => import("./pages/admin/Plans"),
  () => import("./pages/admin/AiProviders"),
  () => import("./pages/admin/AiModels"),
  () => import("./pages/admin/AiUsage"),
] as const;

// Authenticated app shell — sidebar + topbar wrap every signed-in page.
// Suspense nằm TRONG shell: khi chunk trang đang tải, chỉ vùng nội dung hiện
// loader; sidebar/topbar giữ nguyên (không unmount rồi remount cả khung —
// nguyên nhân logo/avatar nháy lại và cảm giác giật khi bấm sidebar).
function AppLayout() {
  usePrefetchOnIdle(APP_PAGE_IMPORTS);
  return (
    <ProtectedRoute>
      <AppShell>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </ProtectedRoute>
  );
}

// Khu vực Quản trị hệ thống — giao diện riêng (sidebar admin), chỉ ADMIN.
function AdminLayout() {
  usePrefetchOnIdle(ADMIN_PAGE_IMPORTS);
  return (
    <ProtectedRoute>
      <AdminRoute>
        <AppShell variant="admin">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </AppShell>
      </AdminRoute>
    </ProtectedRoute>
  );
}

export default function App() {
  const { theme } = useApp();
  // Đồng bộ khai báo: gắn data-theme lên <html> để :root[data-theme] cascade toàn site
  // (kể cả overlay/portal). Đổi theme override cả dải brand (--brand-*) lẫn ambient
  // (--theme-surface-*) ở styles/tokens.css → nút/badge/accent/nền đổi tông theo.
  // FOUC lúc tải đã được chặn bằng inline script ở index.html; setTheme cũng áp ngay.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/login" element={<GuestRoute><Auth /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Auth /></GuestRoute>} />
        <Route path="/logout" element={<Auth />} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/complete-profile" element={<CompleteProfilePage />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create" element={<Create />} />
          <Route path="/create/new" element={<CreateWizard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/failed-posts" element={<FailedPosts />} />
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
          <Route path="/admin/plans" element={<AdminPlans />} />
          <Route path="/admin/ai/providers" element={<AdminAiProviders />} />
          <Route path="/admin/ai/models" element={<AdminAiModels />} />
          <Route path="/admin/ai/usage" element={<AdminAiUsage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>

      {/* Nút chia sẻ nổi — hiển thị trên mọi trang */}
      <ShareButton />
    </div>
  );
}
