import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle, RefreshCw, Home, Plus, Sparkles, Check, Calendar, Clock,
  ChevronRight, Eye, Heart, Send, CalendarClock, type LucideIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useUiStore } from '../../store/useUiStore.ts';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { Icon, Card, PlatformTag } from '../../components/ui.tsx';
import PageContainer from '../../components/PageContainer.tsx';
import OnboardingModal, { isOnboardingDismissed } from '../../components/OnboardingModal.tsx';
import { PLATFORM_BG, PLATFORMS } from '../../theme.ts';
import { TONE_COLORS } from '../../statusTokens.ts';
import { PLATFORM_TO_TAG, getConnectionStats } from '../../api/connections.ts';
import { listBrandProfiles } from '../../api/brandProfile.ts';
import { listAllContentStrategies } from '../../api/contentStrategy.ts';
import { listContentItems, type ContentItemResponse } from '../../api/contentGeneration.ts';
import { listSchedules, type PostSchedule } from '../../api/schedules.ts';
import { listAnalyzedPosts, type AnalyzedPost } from '../../api/analytics.ts';

// UI-02 — Dashboard nối dữ liệu thật: hàng đợi duyệt (NEED_REVIEW), lịch sắp đăng,
// số liệu bài đã đăng (analytics) + FR-86: thanh tiến độ thiết lập (brand → kết nối →
// chiến lược → nội dung đầu tiên).

type Status = 'loading' | 'error' | 'ready';
type Range = '7D' | '30D';

interface SetupProgress {
  brand: boolean;
  connection: boolean;
  strategy: boolean;
  content: boolean;
}

interface DashData {
  setup: SetupProgress;
  review: ContentItemResponse[];
  scheduled: PostSchedule[];
  posts: AnalyzedPost[];
  postedTotal: number;
}

const srOnly: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n));
const latestViews = (p: AnalyzedPost) => p.analytics.length ? p.analytics[p.analytics.length - 1].views ?? 0 : 0;
const latestLikes = (p: AnalyzedPost) => p.analytics.length ? p.analytics[p.analytics.length - 1].likes ?? 0 : 0;

export default function Dashboard() {
  const { t, lang, profile, brandGradient, go } = useApp();
  const { isMobile, isTablet } = useBreakpoint();

  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<DashData | null>(null);
  const [range, setRange] = useState<Range>('7D');
  const [reloadKey, setReloadKey] = useState(0);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    (async () => {
      try {
        // Nguồn nào lỗi lẻ (vd chưa có bài phân tích) không được phá cả dashboard.
        const [brands, connStats, strategies, anyItem, review, schedules, analyzed] = await Promise.all([
          listBrandProfiles({ size: 1 }).catch(() => null),
          getConnectionStats().catch(() => null),
          listAllContentStrategies().catch(() => []),
          listContentItems({ size: 1 }).catch(() => null),
          listContentItems({ status: 'NEED_REVIEW', size: 5 }).catch(() => null),
          listSchedules({ status: 'SCHEDULED' }).catch(() => []),
          listAnalyzedPosts({ size: 50 }).catch(() => null),
        ]);
        if (!alive) return;
        const setup: SetupProgress = {
          brand: (brands?.totalElements ?? 0) > 0,
          connection: (connStats?.active ?? 0) > 0,
          strategy: strategies.length > 0,
          content: (anyItem?.totalElements ?? 0) > 0,
        };
        setData({
          setup,
          review: review?.content ?? [],
          scheduled: schedules,
          posts: analyzed?.content ?? [],
          postedTotal: analyzed?.totalElements ?? 0,
        });
        setStatus('ready');
        // FR-85: chào mừng lần đầu — chỉ khi CHƯA làm bước thiết lập nào và chưa từng đóng.
        if (!setup.brand && !setup.connection && !setup.strategy && !setup.content && !isOnboardingDismissed()) {
          setOnboardingOpen(true);
        }
      } catch {
        if (alive) setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const retry = () => setReloadKey((k) => k + 1);

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
          tone="error"
          icon={AlertTriangle}
          title={t.dashErrTitle}
          message={t.dashErrMsg}
          action={
            <button onClick={retry} className="btn-grad" style={primaryBtn(brandGradient)}>
              <Icon icon={RefreshCw} size={18} stroke="#fff" />
              {t.retry}
            </button>
          }
        />
      </PageContainer>
    );
  }

  const isEmpty = data.posts.length === 0 && data.scheduled.length === 0 && data.review.length === 0;

  if (isEmpty) {
    return (
      <PageContainer>
        {onboardingOpen && <OnboardingModal onClose={() => setOnboardingOpen(false)} />}
        <SetupProgressCard setup={data.setup} />
        <StatePanel
          tone="empty"
          icon={Home}
          title={t.dashEmptyTitle}
          message={t.dashEmptyMsg}
          action={
            <button onClick={() => go('create')} className="btn-grad" style={primaryBtn(brandGradient)}>
              <Icon icon={Plus} size={18} stroke="#fff" />
              {t.dashEmptyCta}
            </button>
          }
        />
      </PageContainer>
    );
  }

  const totals = data.posts.reduce(
    (acc, p) => ({ views: acc.views + latestViews(p), likes: acc.likes + latestLikes(p) }),
    { views: 0, likes: 0 },
  );
  const statCards = [
    { icon: Eye, label: t.anaViews, value: fmtNum(totals.views), bg: '#e0f7fb', color: '#0e7490' },
    { icon: Heart, label: t.anaLikes, value: fmtNum(totals.likes), bg: '#fdecf1', color: '#e23d6e' },
    { icon: Send, label: t.dbPosted, value: String(data.postedTotal), bg: '#e8f8ee', color: '#16a34a' },
    { icon: CalendarClock, label: t.dbScheduled, value: String(data.scheduled.length), bg: '#f1e9ff', color: '#7c3aed' },
  ];
  const primary = statCards[0];
  const secondary = statCards.slice(1);
  const chart = buildChart(data.posts, range, lang);
  const perfSubText = range === '7D' ? t.perfSub : t.perfSub30;
  const platformShare = buildPlatformShare(data.posts);
  const postedTone = TONE_COLORS.success;

  return (
    <PageContainer>
      {onboardingOpen && <OnboardingModal onClose={() => setOnboardingOpen(false)} />}
      <SetupProgressCard setup={data.setup} />

      {/* Hero banner */}
      <div style={{ borderRadius: 22, padding: isMobile ? '24px 22px' : '30px 34px', background: `radial-gradient(700px 300px at 90% -40%,rgba(255,255,255,.45),transparent),${brandGradient}`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', boxShadow: '0 26px 50px -28px rgba(139,92,246,.55)' }}>
        <div>
          <div style={{ fontSize: 14, opacity: 0.92 }}>{t.greeting}, {profile.name} 👋</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 28, margin: '6px 0 8px' }}>{t.dashHeadline}</div>
          <div style={{ fontSize: 14, opacity: 0.9, maxWidth: 480, lineHeight: 1.5 }}>
            {t.dbHeroSub
              .replace('{review}', String(data.review.length))
              .replace('{scheduled}', String(data.scheduled.length))}
          </div>
        </div>
        <button onClick={() => go('create')} className="btn-grad" style={{ width: isMobile ? '100%' : 'auto', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 13, padding: '14px 22px', fontWeight: 700, fontSize: 14, color: '#6d28d9', background: '#fff', whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: '0 10px 22px -10px rgba(0,0,0,.3)' }}>
          <Icon icon={Sparkles} size={16} stroke="#6d28d9" />
          {t.createNew}
        </button>
      </div>

      {/* What needs you: review queue + what's scheduled next */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1.3fr 1fr', gap: 18, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: data.review.length ? 14 : 4 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.needsReviewTitle}</div>
            {data.review.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309', background: '#fdf0dc', borderRadius: 999, padding: '2px 9px' }}>{data.review.length}</span>}
          </div>
          {data.review.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', fontSize: 14, color: '#5b5670' }}>
              <Icon icon={Check} size={18} stroke="#16a34a" />
              {t.allCaughtUp}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.review.map((item) => {
                const tag = item.versions[0] ? (PLATFORM_TO_TAG[item.versions[0].platformName] ?? 'FB') : 'FB';
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={30} radius={9} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#2b2543', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.caption || item.brandName || t.schNoCaption}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#5b5670' }}>{item.brandName ?? ''}</div>
                    </div>
                    <button onClick={() => go('create')} className="btn-soft" style={{ flex: 'none', border: '1px solid #ece8f6', background: '#f4f2fb', color: '#6d28d9', fontWeight: 700, fontSize: 13, borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}>{t.reviewCta}</button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 14 }}>{t.upNextTitle}</div>
          {data.scheduled.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', fontSize: 14, color: '#5b5670' }}>
              <Icon icon={Calendar} size={18} stroke="#8a85a0" />
              {t.nothingScheduled}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.scheduled.slice(0, 4).map((s) => {
                const tag = PLATFORM_TO_TAG[s.platformName] ?? 'FB';
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={30} radius={9} />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: '#2b2543', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.contentVersion?.formattedCaption || t.schNoCaption}
                    </div>
                    <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#5b5670', whiteSpace: 'nowrap' }}>
                      <Icon icon={Clock} size={14} stroke="#8a85a0" />
                      {s.scheduledTime.slice(11, 16)} · {s.scheduledTime.slice(8, 10)}/{s.scheduledTime.slice(5, 7)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Metrics: one prominent figure + three compact supporting stats */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ flex: isMobile ? 'none' : '1.15', padding: 22, display: 'flex', flexDirection: 'column', gap: 10, borderRight: isMobile ? 'none' : '1px solid #efeaf8', borderBottom: isMobile ? '1px solid #efeaf8' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: primary.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <primary.icon size={19} color={primary.color} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#5b5670' }}>{primary.label}</span>
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 36, color: '#211c38', lineHeight: 1 }}>{primary.value}</div>
          </div>
          <div style={{ flex: isMobile ? 'none' : '2', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)' }}>
            {secondary.map((s, i) => (
              <div key={i} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 7, borderRight: isMobile ? 'none' : (i < 2 ? '1px solid #efeaf8' : 'none'), borderBottom: isMobile && i < 2 ? '1px solid #efeaf8' : 'none' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#5b5670' }}>{s.label}</span>
                <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 22, color: '#211c38', lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Performance + platforms */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.dbPerfTitle}</div>
              <div style={{ fontSize: 12.5, color: '#6b6680' }}>{perfSubText}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }} role="group" aria-label={t.dbPerfTitle}>
              {(['7D', '30D'] as Range[]).map((r) => {
                const on = range === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    aria-pressed={on}
                    style={{ fontSize: 12, fontWeight: 600, color: on ? '#7c3aed' : '#6b6680', background: on ? '#f3edff' : '#f6f4fb', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', transition: 'background .15s, color .15s' }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: range === '7D' ? 14 : 8, height: 200, paddingTop: 10 }}>
            {chart.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                <div title={String(b.count)} style={{ width: '100%', borderRadius: '8px 8px 0 0', background: brandGradient, height: b.h, minHeight: 8, opacity: b.count === 0 ? 0.25 : 1 }} />
                <span style={{ fontSize: 11.5, color: '#6b6680' }}>{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 4 }}>{t.platTitle}</div>
          <div style={{ fontSize: 12.5, color: '#6b6680', marginBottom: 18 }}>{t.dbPlatSub}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {platformShare.map((p, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, fontWeight: 600, color: '#3f3a55' }}>
                    <PlatformTag tag={p.tag} bg={p.bg} />
                    {p.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#211c38' }}>{p.pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: '#f1eef9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${p.pct}%`, background: p.bg }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent published posts */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.recentTitle}</div>
          <button type="button" onClick={() => go('analytics')} className="link-underline" style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'center', gap: 4, border: 'none', background: 'transparent', padding: '4px 2px', fontSize: 13, fontWeight: 600, color: '#7c3aed', cursor: 'pointer' }}>
            {t.viewAll}
            <Icon icon={ChevronRight} size={14} stroke="#7c3aed" />
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                {[t.colPost, t.colPlatform, t.colStatus, t.colReach, t.colDate].map((h, i) => (
                  <th key={i} scope="col" style={{ fontSize: 12, fontWeight: 600, color: '#6b6680', padding: '12px 8px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.posts.slice(0, 5).map((p) => {
                const tag = PLATFORM_TO_TAG[p.platformName] ?? 'FB';
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #f1eef8' }}>
                    <td style={{ padding: '14px 8px', fontSize: 14, fontWeight: 600, color: '#2b2543', maxWidth: 300 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.formattedCaption || t.schNoCaption}</span>
                    </td>
                    <td style={{ padding: '14px 8px' }}>
                      <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={22} radius={7} fontSize={11} />
                    </td>
                    <td style={{ padding: '14px 8px' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: postedTone.color, background: postedTone.bg, padding: '4px 11px', borderRadius: 999 }}>{t.schStPOSTED}</span>
                    </td>
                    <td style={{ padding: '14px 8px', fontSize: 14, fontWeight: 600, color: '#2b2543' }}>{fmtNum(latestViews(p))}</td>
                    <td style={{ padding: '14px 8px', fontSize: 13, color: '#6b6680' }}>{p.publishedAt.slice(8, 10)}/{p.publishedAt.slice(5, 7)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}

/** FR-86: thanh tiến độ thiết lập — ẩn khi đã xong cả 4 bước. */
function SetupProgressCard({ setup }: { setup: SetupProgress }) {
  const { t, brandGradient, go } = useApp();
  const setBrandInitialTab = useUiStore((s) => s.setBrandInitialTab);

  const steps: { key: keyof SetupProgress; label: string; onClick: () => void }[] = [
    { key: 'brand', label: t.dbsBrand, onClick: () => go('brand') },
    { key: 'connection', label: t.dbsConnect, onClick: () => go('settings') },
    { key: 'strategy', label: t.dbsStrategy, onClick: () => { setBrandInitialTab('strategy'); go('brand'); } },
    { key: 'content', label: t.dbsContent, onClick: () => go('create') },
  ];
  const done = steps.filter((s) => setup[s.key]).length;
  if (done === steps.length) return null;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#211c38' }}>{t.dbsTitle}</div>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#7c3aed' }}>{done}/{steps.length}</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: '#f1eef9', overflow: 'hidden', margin: '12px 0 16px' }}>
        <div style={{ height: '100%', borderRadius: 99, width: `${(done / steps.length) * 100}%`, background: brandGradient, transition: 'width .3s' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {steps.map((s) => {
          const ok = setup[s.key];
          return (
            <button
              key={s.key}
              onClick={s.onClick}
              disabled={ok}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                border: `1px solid ${ok ? '#c9ecd6' : '#ece8f6'}`, borderRadius: 11, padding: '9px 14px',
                fontSize: 12.5, fontWeight: 700, cursor: ok ? 'default' : 'pointer',
                background: ok ? '#eafbf1' : '#fff', color: ok ? '#16a34a' : '#4b4660',
              }}
            >
              <span style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: ok ? '#16a34a' : '#ece8f6', color: '#fff' }}>
                {ok ? <Check size={12} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a39bbf' }} />}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

interface ChartBar { label: string; count: number; h: string }

// 7D: mỗi ngày một cột; 30D: 10 cột × 3 ngày. Giá trị = số bài đăng thành công trong khoảng đó.
function buildChart(posts: AnalyzedPost[], range: Range, lang: string): ChartBar[] {
  const today = new Date();
  const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const counts = new Map<string, number>();
  for (const p of posts) {
    const key = p.publishedAt.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const bars: ChartBar[] = [];
  if (range === '7D') {
    const weekday = lang === 'en'
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      bars.push({ label: weekday[d.getDay()], count: counts.get(dayKey(d)) ?? 0, h: '0%' });
    }
  } else {
    for (let b = 9; b >= 0; b--) {
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - b * 3);
      let count = 0;
      for (let i = 0; i < 3; i++) {
        const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
        count += counts.get(dayKey(d)) ?? 0;
      }
      bars.push({ label: String(end.getDate()), count, h: '0%' });
    }
  }

  const max = Math.max(1, ...bars.map((b) => b.count));
  return bars.map((b) => ({ ...b, h: `${Math.round((b.count / max) * 100)}%` }));
}

// Phân bổ bài đã đăng theo nền tảng (BR scope: FB/IG/TH).
function buildPlatformShare(posts: AnalyzedPost[]) {
  const total = Math.max(1, posts.length);
  return PLATFORMS.map((pl) => {
    const count = posts.filter((p) => (PLATFORM_TO_TAG[p.platformName] ?? '') === pl.tag).length;
    return { tag: pl.tag, bg: pl.bg, name: pl.name, pct: Math.round((count / total) * 100) };
  });
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
  color: '#fff',
  background: brandGradient,
  cursor: 'pointer',
  boxShadow: '0 16px 30px -12px rgba(139,92,246,.6)',
});

/** Centered error / empty panel — readable AA text on a single card. */
function StatePanel({
  tone,
  icon,
  title,
  message,
  action,
  role,
}: {
  tone: 'error' | 'empty';
  icon: LucideIcon;
  title: string;
  message: string;
  action: ReactNode;
  role?: 'alert';
}) {
  const accent = tone === 'error' ? '#e23d6e' : '#7c3aed';
  const tintBg = tone === 'error' ? '#fdeef2' : '#f4ecff';
  return (
    <Card style={{ padding: '48px 28px' }}>
      <div role={role} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, maxWidth: 420, margin: '0 auto' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: tintBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={icon} size={26} stroke={accent} />
        </div>
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 19, color: '#211c38' }}>{title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: '#5b5670' }}>{message}</div>
        <div style={{ marginTop: 6 }}>{action}</div>
      </div>
    </Card>
  );
}

/** Loading skeleton mirroring the dashboard layout. */
function DashboardSkeleton({ isMobile, isTablet }: { isMobile: boolean; isTablet: boolean }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="sk" style={{ height: isMobile ? 150 : 132, borderRadius: 22 }} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1.3fr 1fr', gap: 18 }}>
        {[0, 1].map((c) => (
          <div key={c} style={{ ...skCard, height: 150 }}>
            <div className="sk" style={{ width: 140, height: 16 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
              {[0, 1].map((r) => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="sk" style={{ width: 30, height: 30, borderRadius: 9 }} />
                  <div className="sk" style={{ flex: 1, height: 14 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ ...skCard, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 22, height: isMobile ? 'auto' : 96, alignItems: isMobile ? 'stretch' : 'center' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ flex: 1, paddingBottom: isMobile && i < 3 ? 16 : 0, borderBottom: isMobile && i < 3 ? '1px solid #efeaf8' : 'none' }}>
            <div className="sk" style={{ width: '70%', height: 12 }} />
            <div className="sk" style={{ width: '45%', height: 22, marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1.6fr 1fr', gap: 18 }}>
        <div style={{ ...skCard, height: 280 }}>
          <div className="sk" style={{ width: 180, height: 16 }} />
          <div className="sk" style={{ width: 120, height: 12, marginTop: 8 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 170, marginTop: 18 }}>
            {[60, 80, 50, 92, 70, 96, 78].map((h, i) => (
              <div key={i} className="sk" style={{ flex: 1, height: `${h}%`, borderRadius: '8px 8px 0 0' }} />
            ))}
          </div>
        </div>
        <div style={{ ...skCard, height: 280 }}>
          <div className="sk" style={{ width: 120, height: 16 }} />
          <div className="sk" style={{ width: 90, height: 12, marginTop: 8 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 22 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="sk" style={{ width: '50%', height: 12, marginBottom: 9 }} />
                <div className="sk" style={{ width: '100%', height: 8, borderRadius: 99 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ ...skCard, height: 230 }}>
        <div className="sk" style={{ width: 140, height: 16 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 22 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="sk" key={i} style={{ width: '100%', height: 16 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const skCard: CSSProperties = {
  background: '#fff',
  border: '1px solid #efeaf8',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 18px 38px -34px rgba(80,40,140,.5)',
};
