import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle, Clock, FileText, RefreshCw, Send, Sparkles, XCircle, type LucideIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
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
import { buildMockPerformance, buildMockTopics } from '../../components/dashboard/dashboardMock.ts';
import { getDashboardSummary, type DashboardRange, type DashboardSummary } from '../../api/dashboard.ts';
import { listNotifications, type AppNotification } from '../../api/notifications.ts';
import { C } from '../../styles/colors';

// UI-02 — Bảng điều khiển bố cục mới. TOÀN BỘ số liệu đến từ MỘT endpoint tổng hợp
// (GET /dashboard/summary) thay cho 7 request rời rạc trước đây; riêng timeline hoạt động
// tái dùng GET /notifications vốn đã là nhật ký sự kiện (FR-75..FR-79).
//
// Thứ tự khối: banner chào mừng (giữ nguyên) → tiến độ thiết lập (FR-86, tự ẩn khi 4/4) →
// 4 thẻ số liệu → nền tảng đã kết nối → biểu đồ hiệu suất → top chủ đề + loại nội dung →
// hoạt động gần đây. Mỗi khối tự lo empty state của mình nên số liệu = 0 không làm vỡ layout.

type Status = 'loading' | 'error' | 'ready';

/** Số mục hiển thị trên preview timeline hoạt động (mới nhất); còn lại xem trong modal "Xem tất cả". */
const ACTIVITY_SIZE = 5;

const srOnly: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

export default function Dashboard() {
  const { t, profile, brandGradient, go } = useApp();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const toast = useToast();

  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [activity, setActivity] = useState<AppNotification[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [range, setRange] = useState<DashboardRange>(7);
  const [reloadKey, setReloadKey] = useState(0);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  // Đổi khoảng thời gian KHÔNG dựng lại skeleton — giữ nội dung cũ để trang không nháy.
  const loadedRef = useRef(false);
  // Khoảng thời gian ĐANG hiển thị (chỉ cập nhật khi tải thành công) — dùng để trả bộ lọc về
  // đúng dữ liệu trên biểu đồ nếu lần đổi khoảng bị lỗi.
  const appliedRangeRef = useRef<DashboardRange>(7);

  useEffect(() => {
    let alive = true;
    if (!loadedRef.current) setStatus('loading');
    // Timeline hoạt động KHÔNG phụ thuộc khoảng thời gian → chỉ nạp ở lần tải đầu (và khi
    // bấm "Thử lại" từ trạng thái lỗi), tránh gọi lại /notifications mỗi lần đổi 7↔30 ngày.
    const fetchActivity = !loadedRef.current;
    (async () => {
      try {
        // Timeline là phần phụ: lỗi riêng của nó không được phá cả bảng điều khiển.
        const [summary, notifications] = await Promise.all([
          getDashboardSummary(range),
          fetchActivity ? listNotifications({ size: ACTIVITY_SIZE }).catch(() => null) : Promise.resolve(null),
        ]);
        if (!alive) return;
        setData(summary);
        if (fetchActivity) {
          setActivity(notifications?.content ?? []);
          setActivityTotal(notifications?.totalElements ?? 0);
        }
        setStatus('ready');
        // FR-85: chào mừng lần đầu — chỉ khi CHƯA làm bước thiết lập nào và chưa từng đóng.
        if (!loadedRef.current && summary.onboarding.completed === 0 && !isOnboardingDismissed()) {
          setOnboardingOpen(true);
        }
        loadedRef.current = true;
        appliedRangeRef.current = summary.rangeDays === 30 ? 30 : 7;
      } catch {
        if (!alive) return;
        if (loadedRef.current) {
          // Đã có dữ liệu trên màn hình: đổi khoảng thời gian hỏng KHÔNG được xóa cả trang.
          // Giữ nguyên nội dung, báo bằng toast và trả nút lọc về đúng khoảng đang hiển thị.
          toast.error(t.dashErrMsg, { title: t.dashErrTitle });
          setRange(appliedRangeRef.current);
        } else {
          setStatus('error');
        }
      }
    })();
    return () => { alive = false; };
  }, [range, reloadKey, toast, t]);

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

  // Fallback DỮ LIỆU MẪU khi tài khoản chưa có số liệu thật (xem dashboardMock.ts): chỉ để xem
  // trước giao diện, luôn kèm nhãn "Dữ liệu mẫu" (prop demo). Có dữ liệu thật thì dùng dữ liệu thật.
  const perfHasData = data.performance.some((p) => p.reach > 0 || p.engagement > 0);
  const perfPoints = perfHasData ? data.performance : buildMockPerformance(range);
  const topicsDemo = data.topTopics.length === 0;
  const topicRows = topicsDemo
    ? buildMockTopics([t.dbDemoTopic1, t.dbDemoTopic2, t.dbDemoTopic3, t.dbDemoTopic4, t.dbDemoTopic5])
    : data.topTopics;

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
          <div style={{ fontSize: 14, opacity: 0.92 }}>{t.greeting}, {profile.name} 👋</div>
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

      <SetupChecklist onboarding={data.onboarding} />

      <div style={{ display: 'grid', gridTemplateColumns: statCols, gap: 16 }}>
        <StatCard icon={FileText} tone="violet" label={t.dbStatTotal} stat={data.stats.total} comparisonLabel={t.dbVs7d} />
        <StatCard icon={Send} tone="emerald" label={t.dbPosted} stat={data.stats.posted} comparisonLabel={t.dbVs7d} />
        <StatCard icon={Clock} tone="amber" label={t.dbStatPending} stat={data.stats.pending} comparisonLabel={t.dbVs7d} />
        <StatCard icon={XCircle} tone="rose" label={t.dbStatRejected} stat={data.stats.rejected} comparisonLabel={t.dbVs7d} />
      </div>

      {isDesktop ? (
        // ≥lg: 2 cột — trái (2/3) hiệu suất + [top chủ đề | loại nội dung]; phải (1/3) nền tảng + hoạt động.
        // alignItems:start để mỗi cột cao tự nhiên; minmax(0,..) chặn tràn ngang do biểu đồ.
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <PerformanceChart points={perfPoints} range={range} onRangeChange={setRange} demo={!perfHasData} />
            {/* alignItems:stretch để 2 card con cao bằng nhau. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18, alignItems: 'stretch' }}>
              <TopTopics rows={topicRows} demo={topicsDemo} />
              <ContentTypeDonut rows={data.contentTypes} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <PlatformPanel rows={data.platforms} />
            <ActivityTimeline items={activity} total={activityTotal} />
          </div>
        </div>
      ) : (
        // <lg: xếp dọc theo thứ tự dễ đọc — hiệu suất → nền tảng → (top chủ đề | loại nội dung) → hoạt động.
        <>
          <PerformanceChart points={perfPoints} range={range} onRangeChange={setRange} demo={!perfHasData} />
          <PlatformPanel rows={data.platforms} />
          <div style={{ display: 'grid', gridTemplateColumns: pairCols, gap: 18, alignItems: 'stretch' }}>
            <TopTopics rows={topicRows} demo={topicsDemo} />
            <ContentTypeDonut rows={data.contentTypes} />
          </div>
          <ActivityTimeline items={activity} total={activityTotal} />
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
