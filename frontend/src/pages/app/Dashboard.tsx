import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import {
  AlertTriangle, Clock, FileText, RefreshCw, Send, Sparkles, XCircle, type LucideIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useAuth } from '../../auth/AuthContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { useToast } from '../../components/toast/ToastProvider.tsx';
import { Icon, Card } from '../../components/ui.tsx';
import PageContainer from '../../components/PageContainer.tsx';
import OnboardingModal, { isOnboardingDismissed } from '../../components/OnboardingModal.tsx';
import SetupChecklist from '../../components/dashboard/SetupChecklist.tsx';
import StatCard from '../../components/dashboard/StatCard.tsx';
import PlatformPanel from '../../components/dashboard/PlatformPanel.tsx';
import PerformanceChart from '../../components/dashboard/PerformanceChart.tsx';
import TopTopics from '../../components/dashboard/TopTopics.tsx';
import ContentTypeDonut from '../../components/dashboard/ContentTypeDonut.tsx';
import ActivityTimeline from '../../components/dashboard/ActivityTimeline.tsx';
import DashboardSkeleton from '../../components/dashboard/DashboardSkeleton.tsx';
import { getDashboardPerformance, getDashboardSummary, type DashboardPerformance, type DashboardSummary } from '../../api/dashboard.ts';
import { DEFAULT_PERF_FILTER, type PerfFilter } from '../../components/dashboard/PerformanceFilter.tsx';
import { rangeOfPreset } from '../../components/analytics/dateRange.ts';
import { listNotifications, type AppNotification } from '../../api/notifications.ts';
import { C } from '../../styles/colors';

// UI-02 — Bảng điều khiển bố cục mới. TOÀN BỘ số liệu đến từ MỘT endpoint tổng hợp
// (GET /dashboard/summary) thay cho 7 request rời rạc trước đây; riêng timeline hoạt động
// tái dùng GET /notifications vốn đã là nhật ký sự kiện (FR-75..FR-79).
//
// Thứ tự khối: banner chào mừng (giữ nguyên) → tiến độ thiết lập (FR-86, tự ẩn khi 4/4) →
// 4 thẻ số liệu → nền tảng đã kết nối → biểu đồ hiệu suất → top chủ đề + loại nội dung →
// hoạt động gần đây. Mọi khối CHỈ hiển thị số liệu thật; chưa có
// số thì hiện empty state của chính khối (không còn dữ liệu mẫu) nên số liệu = 0 không làm vỡ layout.

type Status = 'loading' | 'error' | 'ready';

/** Số mục hiển thị trên preview timeline hoạt động (mới nhất); còn lại xem trong modal "Xem tất cả". */
const ACTIVITY_SIZE = 5;

const srOnly: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

export default function Dashboard() {
  const { t, profile, brandGradient, go } = useApp();
  const { user } = useAuth();
  const displayName = user?.fullName || profile.name || 'User';
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const toast = useToast();

  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [activity, setActivity] = useState<AppNotification[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  // Làm mới (realtime / "Thử lại") KHÔNG dựng lại skeleton — giữ nội dung cũ để trang không nháy.
  const loadedRef = useRef(false);
  // Realtime: bài đổi trạng thái / thông báo mới → làm mới số liệu + "Hoạt động gần đây" (không hiện skeleton lại).
  useRealtimeRefresh(['post.updated', 'notification.created', 'ready'], () => setReloadKey((k) => k + 1), 1500);

  // Biểu đồ "Hiệu quả nội dung" + donut "Loại nội dung" theo cùng bộ lọc: mặc định 7 ngày dùng luôn số trong
  // /dashboard/summary; 30 ngày / tùy chỉnh gọi /dashboard/performance riêng, chỉ khi bấm "Lọc" — đổi khoảng
  // không tải lại cả trang.
  const [perfFilter, setPerfFilter] = useState<PerfFilter>(DEFAULT_PERF_FILTER);
  const [perf, setPerf] = useState<DashboardPerformance | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  // Bộ lọc đang hiển thị trên biểu đồ (chỉ cập nhật khi tải thành công) — lọc hỏng thì trả nút về đúng khoảng này.
  const appliedPerfRef = useRef<PerfFilter>(DEFAULT_PERF_FILTER);

  useEffect(() => {
    let alive = true;
    if (!loadedRef.current) setStatus('loading');
    (async () => {
      try {
        // Timeline là phần phụ: lỗi riêng của nó không được phá cả bảng điều khiển.
        const [summary, notifications] = await Promise.all([
          getDashboardSummary(),
          listNotifications({ size: ACTIVITY_SIZE }).catch(() => null),
        ]);
        if (!alive) return;
        setData(summary);
        if (notifications) {
          setActivity(notifications.content);
          setActivityTotal(notifications.totalElements);
        }
        setStatus('ready');
        // FR-85: chào mừng lần đầu — chỉ khi CHƯA làm bước thiết lập nào và chưa từng đóng.
        if (!loadedRef.current && summary.onboarding.completed === 0 && !isOnboardingDismissed()) {
          setOnboardingOpen(true);
        }
        loadedRef.current = true;
      } catch {
        if (!alive) return;
        // Đã có dữ liệu trên màn hình: lần làm mới hỏng KHÔNG được xóa cả trang — giữ nội dung, báo bằng toast.
        if (loadedRef.current) toast.error(t.dashErrMsg, { title: t.dashErrTitle });
        else setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [reloadKey, toast, t]);

  useEffect(() => {
    if (perfFilter.preset === 'd7') {
      appliedPerfRef.current = perfFilter;
      setPerf(null);
      return;
    }
    let alive = true;
    setPerfLoading(true);
    getDashboardPerformance(perfFilter.from, perfFilter.to)
      .then((res) => {
        if (!alive) return;
        appliedPerfRef.current = perfFilter;
        setPerf(res);
      })
      .catch(() => {
        if (!alive) return;
        toast.error(t.dashErrMsg, { title: t.dashErrTitle });
        setPerfFilter(appliedPerfRef.current);
      })
      .finally(() => { if (alive) setPerfLoading(false); });
    return () => { alive = false; };
    // reloadKey: realtime làm mới cả biểu đồ đang lọc, không chỉ các thẻ.
  }, [perfFilter, reloadKey, toast, t]);

  if (status === 'loading') {
    return (
      <PageContainer role="status" aria-busy="true">
        <span style={srOnly}>{t.dashLoading}</span>
        <DashboardSkeleton isMobile={isMobile} isTablet={isTablet} />
      </PageContainer>
    );
  }

  if (status === 'error' || !data) {
    return (
      <PageContainer>
        <StatePanel
          role="alert"
          icon={AlertTriangle}
          title={t.dashErrTitle}
          message={t.dashErrMsg}
          action={
            <button onClick={() => setReloadKey((k) => k + 1)} className="btn-grad" style={primaryBtn(brandGradient)}>
              <Icon icon={RefreshCw} size={18} stroke={C.onBrand} />
              {t.retry}
            </button>
          }
        />
      </PageContainer>
    );
  }

  // 4 thẻ: 4 cột (desktop) → 2 cột (tablet) → 1 cột (mobile).
  const statCols = isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  // Cặp "Top chủ đề | Loại nội dung": 2-up từ tablet trở lên, 1 cột ở mobile.
  // (minmax(0,..) để biểu đồ recharts co theo cột, không đẩy tràn ngang.)
  const pairCols = isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)';
  // Khoảng thật của donut: bộ lọc 30 ngày / tùy chỉnh lấy từ backend (đã kẹp theo gói), mặc định = 7 ngày của summary.
  const typesRange = perf ? { from: perf.from, to: perf.to } : rangeOfPreset(data.rangeDays);
  const contentTypes = perf ? perf.contentTypes : data.contentTypes;

  return (
    <PageContainer>
      {onboardingOpen && <OnboardingModal onClose={() => setOnboardingOpen(false)} />}

      {/* Banner chào mừng — giữ nguyên như trước, chỉ đổi nguồn số liệu sang API tổng hợp. */}
      <div style={{
        borderRadius: 22, padding: isMobile ? '24px 22px' : '30px 34px',
        background: `radial-gradient(700px 300px at 90% -40%,rgba(255,255,255,.45),transparent),${brandGradient}`,
        color: C.onBrand, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 24, flexWrap: 'wrap', boxShadow: '0 26px 50px -28px rgba(139,92,246,.55)',
      }}>
        <div>
          <div style={{ fontSize: 14, opacity: 0.92 }}>{t.greeting}, {displayName} 👋</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 28, margin: '6px 0 8px' }}>
            {t.dashHeadline}
          </div>
          <div style={{ fontSize: 14, opacity: 0.9, maxWidth: 480, lineHeight: 1.5 }}>
            {t.dbHeroSub
              .replace('{review}', String(data.awaitingReview))
              .replace('{scheduled}', String(data.scheduled))}
          </div>
        </div>
        <button onClick={() => go('create')} className="btn-grad" style={{
          width: isMobile ? '100%' : 'auto', justifyContent: 'center', display: 'inline-flex',
          alignItems: 'center', gap: 8, border: 'none', borderRadius: 13, padding: '14px 22px',
          // Nút sáng CỐ ĐỊNH trên banner gradient ở cả hai chế độ (thiết kế dark mode giữ nguyên).
          fontWeight: 700, fontSize: 14, color: '#6d28d9', background: '#fff', whiteSpace: 'nowrap',
          cursor: 'pointer', boxShadow: '0 10px 22px -10px rgba(0,0,0,.3)',
        }}>
          <Icon icon={Sparkles} size={16} stroke="#6d28d9" />
          {t.createNew}
        </button>
      </div>

      <SetupChecklist id="dashboard-setup" onboarding={data.onboarding} />

      <div id="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: statCols, gap: 16 }}>
        <StatCard icon={FileText} tone="violet" label={t.dbStatTotal} stat={data.stats.total} comparisonLabel={t.dbVs7d} onClick={() => go('create')} />
        <StatCard icon={Send} tone="emerald" label={t.dbPosted} stat={data.stats.posted} comparisonLabel={t.dbVs7d} onClick={() => go('calendar')} />
        <StatCard icon={Clock} tone="amber" label={t.dbStatPending} stat={data.stats.pending} comparisonLabel={t.dbVs7d} onClick={() => go('calendar')} />
        <StatCard icon={XCircle} tone="rose" label={t.dbStatRejected} stat={data.stats.rejected} comparisonLabel={t.dbVs7d} onClick={() => go('failedPosts')} />
      </div>

      {isDesktop ? (
        // ≥lg: 2 cột — trái (2/3) hiệu suất + [top chủ đề | loại nội dung]; phải (1/3) nền tảng + hoạt động.
        // alignItems:start để mỗi cột cao tự nhiên; minmax(0,..) chặn tràn ngang do biểu đồ.
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <PerformanceChart id="dashboard-performance" points={perf ? perf.points : data.performance} filter={perfFilter}
            onFilterChange={setPerfFilter} loading={perfLoading} />
            {/* alignItems:stretch để 2 card con cao bằng nhau. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18, alignItems: 'stretch' }}>
              <TopTopics id="dashboard-topics" rows={data.topTopics} />
              <ContentTypeDonut id="dashboard-types" rows={contentTypes} from={typesRange.from} to={typesRange.to} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <PlatformPanel id="dashboard-platforms" rows={data.platforms} />
            <ActivityTimeline id="dashboard-activity" items={activity} total={activityTotal} />
          </div>
        </div>
      ) : (
        // <lg: xếp dọc theo thứ tự dễ đọc — hiệu suất → nền tảng → (top chủ đề | loại nội dung) → hoạt động.
        <>
          <PerformanceChart id="dashboard-performance" points={perf ? perf.points : data.performance} filter={perfFilter}
            onFilterChange={setPerfFilter} loading={perfLoading} />
          <PlatformPanel id="dashboard-platforms" rows={data.platforms} />
          <div style={{ display: 'grid', gridTemplateColumns: pairCols, gap: 18, alignItems: 'stretch' }}>
            <TopTopics id="dashboard-topics" rows={data.topTopics} />
            <ContentTypeDonut id="dashboard-types" rows={contentTypes} from={typesRange.from} to={typesRange.to} />
          </div>
          <ActivityTimeline id="dashboard-activity" items={activity} total={activityTotal} />
        </>
      )}
    </PageContainer>
  );
}

const primaryBtn = (brandGradient: string): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  border: 'none',
  borderRadius: 13,
  padding: '13px 22px',
  fontWeight: 700,
  fontSize: 14,
  color: C.onBrand,
  background: brandGradient,
  cursor: 'pointer',
  boxShadow: '0 16px 30px -12px rgba(139,92,246,.6)',
});

/** Panel lỗi căn giữa — chỉ dùng khi API tổng hợp thất bại (mỗi khối tự lo empty state riêng). */
function StatePanel({
  icon,
  title,
  message,
  action,
  role,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action: ReactNode;
  role?: 'alert';
}) {
  return (
    <Card style={{ padding: '48px 28px' }}>
      <div role={role} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        gap: 14, maxWidth: 420, margin: '0 auto',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: C.roseTint,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon icon={icon} size={26} stroke={C.rose} />
        </div>
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 19, color: C.textStrong }}>
          {title}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: C.ink550 }}>{message}</div>
        <div style={{ marginTop: 6 }}>{action}</div>
      </div>
    </Card>
  );
}
