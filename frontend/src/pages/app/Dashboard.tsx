import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle, RefreshCw, Home, Plus, Sparkles, Check, Calendar, Clock,
  ChevronRight, type LucideIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { Icon, Card, PlatformTag } from '../../components/ui.tsx';
import { stats, weekChart, monthChart, platformUsage, posts } from '../../data.ts';

type Status = 'loading' | 'error' | 'ready';
type Range = '7D' | '30D';

interface DashData {
  statCards: ReturnType<typeof stats>;
  week: ReturnType<typeof weekChart>;
  month: ReturnType<typeof monthChart>;
  platforms: typeof platformUsage;
  rows: ReturnType<typeof posts>;
}

const srOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const outerStyle: CSSProperties = {
  maxWidth: 1180,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 22,
};

export default function Dashboard() {
  const { t, lang, profile, brandGradient, go } = useApp();
  const { isMobile, isTablet } = useBreakpoint();

  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<DashData | null>(null);
  const [range, setRange] = useState<Range>('7D');
  const [reloadKey, setReloadKey] = useState(0);

  // Simulated async load. The real backend serves this data through async jobs,
  // so the dashboard always passes through loading → ready/empty (or error on failure).
  useEffect(() => {
    setStatus('loading');
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      try {
        setData({
          statCards: stats(lang),
          week: weekChart(lang),
          month: monthChart(),
          platforms: platformUsage,
          rows: posts(lang),
        });
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }, 650);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [lang, reloadKey]);

  const retry = () => setReloadKey((k) => k + 1);

  if (status === 'loading') {
    return (
      <div className="view-pop" style={outerStyle} role="status" aria-busy="true">
        <span style={srOnly}>{t.dashLoading}</span>
        <DashboardSkeleton isMobile={isMobile} isTablet={isTablet} />
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className="view-pop" style={outerStyle}>
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
      </div>
    );
  }

  const isEmpty = data.rows.length === 0;
  if (isEmpty) {
    return (
      <div className="view-pop" style={outerStyle}>
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
      </div>
    );
  }

  const chart = range === '7D' ? data.week : data.month;
  const perfSubText = range === '7D' ? t.perfSub : t.perfSub30;
  const review = data.rows.filter((p) => p.kind === 'rev');
  const scheduled = data.rows.filter((p) => p.kind === 'sch');
  const primary = data.statCards[0];
  const secondary = data.statCards.slice(1);

  return (
    <div className="view-pop" style={outerStyle}>
      {/* Hero banner */}
      <div style={{ borderRadius: 22, padding: isMobile ? '24px 22px' : '30px 34px', background: `radial-gradient(700px 300px at 90% -40%,rgba(255,255,255,.45),transparent),${brandGradient}`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', boxShadow: '0 26px 50px -28px rgba(139,92,246,.55)' }}>
        <div>
          <div style={{ fontSize: 14, opacity: 0.92 }}>{t.greeting}, {profile.name} 👋</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 28, margin: '6px 0 8px' }}>{t.dashHeadline}</div>
          <div style={{ fontSize: 14, opacity: 0.9, maxWidth: 480, lineHeight: 1.5 }}>{t.dashHeadSub}</div>
        </div>
        <button onClick={() => go('create')} className="btn-grad" style={{ width: isMobile ? '100%' : 'auto', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 13, padding: '14px 22px', fontWeight: 700, fontSize: 14, color: '#6d28d9', background: '#fff', whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: '0 10px 22px -10px rgba(0,0,0,.3)' }}>
          <Icon icon={Sparkles} size={16} stroke="#6d28d9" />
          {t.createNew}
        </button>
      </div>

      {/* What needs you: review queue + what's scheduled next */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1.3fr 1fr', gap: 18, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: review.length ? 14 : 4 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.needsReviewTitle}</div>
            {review.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309', background: '#fdf0dc', borderRadius: 999, padding: '2px 9px' }}>{review.length}</span>}
          </div>
          {review.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', fontSize: 14, color: '#5b5670' }}>
              <Icon icon={Check} size={18} stroke="#16a34a" />
              {t.allCaughtUp}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {review.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <PlatformTag tag={p.tag} bg={p.bg} size={30} radius={9} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#2b2543', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                    <div style={{ fontSize: 12.5, color: '#5b5670' }}>{p.platform}</div>
                  </div>
                  <button onClick={() => go('create')} className="btn-soft" style={{ flex: 'none', border: '1px solid #ece8f6', background: '#f4f2fb', color: '#6d28d9', fontWeight: 700, fontSize: 13, borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}>{t.reviewCta}</button>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 14 }}>{t.upNextTitle}</div>
          {scheduled.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', fontSize: 14, color: '#5b5670' }}>
              <Icon icon={Calendar} size={18} stroke="#8a85a0" />
              {t.nothingScheduled}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {scheduled.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <PlatformTag tag={p.tag} bg={p.bg} size={30} radius={9} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: '#2b2543', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#5b5670', whiteSpace: 'nowrap' }}>
                    <Icon icon={Clock} size={14} stroke="#8a85a0" />
                    {p.date}
                  </span>
                </div>
              ))}
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
                <Icon icon={primary.icon} stroke={primary.color} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#5b5670' }}>{primary.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 36, color: '#211c38', lineHeight: 1 }}>{primary.value}</div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: primary.trendColor, background: primary.trendBg, padding: '3px 9px', borderRadius: 999 }}>{primary.trend}</span>
            </div>
          </div>
          <div style={{ flex: isMobile ? 'none' : '2', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)' }}>
            {secondary.map((s, i) => (
              <div key={i} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 7, borderRight: isMobile ? 'none' : (i < 2 ? '1px solid #efeaf8' : 'none'), borderBottom: isMobile && i < 2 ? '1px solid #efeaf8' : 'none' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#5b5670' }}>{s.label}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 22, color: '#211c38', lineHeight: 1 }}>{s.value}</div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: s.trendColor }}>{s.trend}</span>
                </div>
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
              <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.perfTitle}</div>
              <div style={{ fontSize: 12.5, color: '#6b6680' }}>{perfSubText}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }} role="group" aria-label={t.perfTitle}>
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
                <div title={b.h} style={{ width: '100%', borderRadius: '8px 8px 0 0', background: brandGradient, height: b.h, minHeight: 8 }} />
                <span style={{ fontSize: 11.5, color: '#6b6680' }}>{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 4 }}>{t.platTitle}</div>
          <div style={{ fontSize: 12.5, color: '#6b6680', marginBottom: 18 }}>{t.platSub}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.platforms.map((p, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, fontWeight: 600, color: '#3f3a55' }}>
                    <PlatformTag tag={p.tag} bg={p.bg} />
                    {p.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#211c38' }}>{p.pct}</span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: '#f1eef9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: p.pct, background: p.bg }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent posts table */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.recentTitle}</div>
          <button type="button" onClick={() => go('calendar')} className="link-underline" style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'center', gap: 4, border: 'none', background: 'transparent', padding: '4px 2px', fontSize: 13, fontWeight: 600, color: '#7c3aed', cursor: 'pointer' }}>
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
              {data.rows.map((p, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1eef8' }}>
                  <td style={{ padding: '14px 8px', fontSize: 14, fontWeight: 600, color: '#2b2543', maxWidth: 300 }}>{p.title}</td>
                  <td style={{ padding: '14px 8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#5b5670' }}>
                      <PlatformTag tag={p.tag} bg={p.bg} size={22} radius={7} fontSize={11} />
                      {p.platform}
                    </span>
                  </td>
                  <td style={{ padding: '14px 8px' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: p.stColor, background: p.stBg, padding: '4px 11px', borderRadius: 999 }}>{p.status}</span>
                  </td>
                  <td style={{ padding: '14px 8px', fontSize: 14, fontWeight: 600, color: '#2b2543' }}>{p.reach}</td>
                  <td style={{ padding: '14px 8px', fontSize: 13, color: '#6b6680' }}>{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
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
