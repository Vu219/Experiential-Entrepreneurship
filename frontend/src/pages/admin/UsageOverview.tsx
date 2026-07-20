import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Coins, DollarSign, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Loader } from '../../components/ui';
import StatusBadge from '../../components/admin/StatusBadge';
import SectionCard from '../../components/admin/SectionCard';
import StatCard from '../../components/admin/StatCard';
import Avatar from '../../components/admin/Avatar';
import Pagination from '../../components/admin/Pagination';
import Heatmap from '../../components/admin/Heatmap';
import UsageEventsTable from '../../components/admin/usage/UsageEventsTable';
import AlertsPanel from '../../components/admin/usage/AlertsPanel';
import { DataTable } from '../../components/admin/AdminListPage';
import { useToast } from '../../components/toast/ToastProvider';
import { userPlanMeta, type UserPlan } from '../../api/admin';
import { aiTaskLabel, type AiTaskCode } from '../../api/adminAi';
import {
  getUsageByPlan,
  getUsageByUser,
  reconcileUsage,
  getBillingRates,
  createBillingRate,
  getUsageOverview,
  getUsageHeatmap,
  type AdminUserUsageRow,
  type BillingRate,
  type HeatmapPoint,
  type PlanUsage,
  type UsageOverview as UsageOverviewData,
  type UsageThresholdFilter,
} from '../../api/adminUsage';
import PageContainer from '../../components/PageContainer';

// Trang admin "Token & hạn mức" (nhóm Kinh doanh): tab Theo gói (chỉ đọc/gộp — hạn mức
// sửa ở Quản lý gói) + tab Theo người dùng (lọc sắp chạm/đã vượt, chi tiết, cấp thêm/reset
// có audit qua usage_adjustments). Nguồn số liệu: event log ai_usage.

const tdStyle: CSSProperties = { padding: '12px 16px', fontSize: 13.5, color: '#2b2543' };
const tdMuted: CSSProperties = { ...tdStyle, color: '#8a85a0', fontSize: 13 };

const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${+(n / 1_000).toFixed(1)}K`
      : n.toLocaleString('vi-VN');

const fmtUsd = (n: number | null) => (n == null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 4 })}`);
const fmtDateTime = (iso: string) => iso.slice(0, 16).replace('T', ' ');

/** Scope chọn được khi thêm version hệ số (khớp enum AiTaskCode phía BE). */
const RATE_TASKS: AiTaskCode[] = [
  'CONTENT_GENERATION', 'PLATFORM_FORMATTING', 'TREND_RESEARCH',
  'GOLDEN_HOURS', 'STRATEGY_OPTIMIZATION', 'CONTENT_REGENERATION',
];
const initialsOf = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(-2).join('').toUpperCase();

/** % mức dùng so hạn mức (null = không giới hạn) + tone màu ngưỡng 80/100. */
const pctOf = (used: number, limit: number | null) =>
  limit === null ? null : Math.min(limit > 0 ? (used / limit) * 100 : 100, 100);
const pctTone = (pct: number | null) => (pct === null ? 'success' : pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'success');

function UsageBar({ used, limit, gradient }: { used: number; limit: number | null; gradient: string }) {
  const pct = pctOf(used, limit);
  const fill = pct !== null && pct >= 100 ? '#ef4444' : pct !== null && pct >= 80 ? '#f59e0b' : gradient;
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5b5670', marginBottom: 4 }}>
        {fmtTokens(used)} / {limit === null ? '∞' : fmtTokens(limit)}
      </div>
      {limit !== null && (
        <div style={{ height: 6, borderRadius: 999, background: '#ece6f8', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: fill }} />
        </div>
      )}
    </div>
  );
}


export default function UsageOverview() {
  const { t, lang, go, brandGradient } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  // Entry point "Chi tiết" giữ nguyên vị trí — giờ mở TRANG chi tiết thay modal (pha 4).
  const openDetail = (userId: string) => navigate(`/admin/usage/users/${userId}`);
  const [tab, setTab] = useState<'overview' | 'plans' | 'users' | 'events' | 'rates'>('overview');

  // ----- Tab Tổng quan (đọc từ rollup usage_hourly) -----
  const [ov, setOv] = useState<UsageOverviewData | null>(null);
  const [heat, setHeat] = useState<HeatmapPoint[]>([]);
  const [ovLoad, setOvLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [metric, setMetric] = useState<'tokens' | 'requests' | 'cost' | 'latency'>('tokens');
  const fetchOverview = () => {
    setOvLoad('loading');
    Promise.all([getUsageOverview(), getUsageHeatmap({ days: 7 })])
      .then(([o, h]) => { setOv(o); setHeat(h); setOvLoad('ok'); })
      .catch(() => setOvLoad('error'));
  };
  useEffect(() => { if (tab === 'overview') fetchOverview(); }, [tab]);

  const metricValue = (p: HeatmapPoint): number | null =>
    metric === 'tokens' ? p.totalTokens
      : metric === 'requests' ? p.requests
        : metric === 'cost' ? p.costUsd
          : p.latencyAvgMs;

  // Đơn vị legend/tooltip heatmap đổi theo metric đang chọn (mục 5a).
  const fmtMetric = (v: number): string =>
    metric === 'tokens' ? `${fmtTokens(v)} token`
      : metric === 'requests' ? `${v.toLocaleString('vi-VN')} request`
        : metric === 'cost' ? fmtUsd(v)
          : `${Math.round(v)} ms`;

  // ----- Tab Theo gói (bảng GIÁM SÁT TIÊU THỤ, chỉ đọc — mục 5b) -----
  const [plans, setPlans] = useState<PlanUsage[]>([]);
  const [planLoad, setPlanLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const fetchPlans = () => {
    setPlanLoad('loading');
    getUsageByPlan()
      .then((p) => { setPlans(p); setPlanLoad('ok'); })
      .catch(() => setPlanLoad('error'));
  };
  useEffect(() => { if (tab === 'plans') fetchPlans(); }, [tab]);

  // Toàn bộ user (tối đa 5 trang × 100) — nguồn CLIENT-SIDE cho cột "User cần chú ý"
  // + drill-down user theo gói, vì BE chưa có endpoint lọc by-user theo planCode
  // (ghi chú cần API ở cuối file). Tải lười khi mở tab, dùng lại cho mọi gói.
  const [allUsers, setAllUsers] = useState<AdminUserUsageRow[] | null>(null);
  const [drillPlan, setDrillPlan] = useState<string | null>(null);
  useEffect(() => {
    if (tab !== 'plans' || allUsers !== null) return;
    (async () => {
      const acc: AdminUserUsageRow[] = [];
      try {
        for (let p = 0; p < 5; p++) {
          const pg = await getUsageByUser({ page: p, size: 100 });
          acc.push(...pg.content);
          if (p >= pg.totalPages - 1) break;
        }
      } catch { /* thiếu dữ liệu chú ý — bảng chính vẫn hiển thị */ }
      setAllUsers(acc);
    })();
  }, [tab, allUsers]);

  /** Đếm user 80–<100% và ≥100% của một gói (null = đang tải). */
  const attentionOf = (planCode: string): { warn: number; over: number } | null => {
    if (allUsers === null) return null;
    let warn = 0, over = 0;
    for (const u of allUsers) {
      if (u.planCode !== planCode || u.limit === null) continue;
      const pct = u.limit > 0 ? (u.used / u.limit) * 100 : 100;
      if (pct >= 100) over++;
      else if (pct >= 80) warn++;
    }
    return { warn, over };
  };

  // ----- Tab Theo người dùng -----
  const [rows, setRows] = useState<AdminUserUsageRow[]>([]);
  const [userLoad, setUserLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [filter, setFilter] = useState<UsageThresholdFilter>('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => { setQDebounced(q); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const fetchUsers = () => {
    setUserLoad('loading');
    getUsageByUser({ filter, q: qDebounced, page })
      .then((p) => { setRows(p.content); setPageCount(p.totalPages); setUserLoad('ok'); })
      .catch(() => setUserLoad('error'));
  };
  useEffect(() => { if (tab === 'users') fetchUsers(); }, [tab, filter, qDebounced, page]);

  const doReconcile = async () => {
    try {
      const n = await reconcileUsage();
      toast.success(t.auReconcileOk.replace('{n}', String(n)));
    } catch {
      toast.error(t.auActionErr);
    }
  };

  // ----- Tab Hệ số quy đổi (billing_rates) -----
  const [rates, setRates] = useState<BillingRate[]>([]);
  const [rateLoad, setRateLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [rTask, setRTask] = useState<AiTaskCode | ''>('');
  const [rModel, setRModel] = useState('');
  const [rMult, setRMult] = useState('');
  const [rMin, setRMin] = useState('');
  const [rBusy, setRBusy] = useState(false);
  const fetchRates = () => {
    setRateLoad('loading');
    getBillingRates()
      .then((r) => { setRates(r); setRateLoad('ok'); })
      .catch(() => setRateLoad('error'));
  };
  useEffect(() => { if (tab === 'rates') fetchRates(); }, [tab]);

  const doAddRate = async () => {
    const multiplier = Number(rMult);
    if (!Number.isFinite(multiplier) || multiplier <= 0) return;
    setRBusy(true);
    try {
      await createBillingRate({
        taskCode: rTask || null,
        modelCode: rModel,
        multiplier,
        minCharge: rMin ? Math.floor(Number(rMin)) : undefined,
      });
      toast.success(t.auRateAddOk);
      setRModel(''); setRMult(''); setRMin('');
      fetchRates();
    } catch {
      toast.error(t.auActionErr);
    } finally {
      setRBusy(false);
    }
  };

  const tabBtn = (key: 'overview' | 'plans' | 'users' | 'events' | 'rates', label: string) => {
    const active = tab === key;
    return (
      <button key={key} onClick={() => setTab(key)} style={{ border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6', background: active ? brandGradient : '#fff', color: active ? '#fff' : '#5b5670', borderRadius: 9, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
    );
  };

  const filterChip = (key: UsageThresholdFilter, label: string) => {
    const active = filter === key;
    return (
      <button key={key || 'all'} onClick={() => { setFilter(key); setPage(0); }} style={{ border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6', background: active ? brandGradient : '#fff', color: active ? '#fff' : '#5b5670', borderRadius: 999, padding: '6px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
    );
  };

  // Loader gói trong vùng cao cố định 240px, căn giữa — không phình theo container
  // thành khối lớn vô định hình khi đợi dữ liệu.
  const loadingCard = (
    <Card style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader label={t.listLoading} />
    </Card>
  );
  const errorCard = (retry: () => void) => (
    <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670', marginBottom: 14 }}>{t.listError}</div>
      <button onClick={retry} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
    </Card>
  );

  return (
    <PageContainer>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{tabBtn('overview', t.auTabOverview)}{tabBtn('plans', t.auTabByPlan)}{tabBtn('users', t.auTabByUser)}{tabBtn('events', t.auTabEvents)}{tabBtn('rates', t.auTabRates)}</div>

      {tab === 'overview' && (
        ovLoad === 'loading' ? loadingCard : ovLoad === 'error' ? errorCard(fetchOverview) : ov && (
          <>
            {/* Tổng kỳ này so kỳ trước + chi phí + request + tỉ lệ lỗi */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <StatCard icon={Coins} iconBg="linear-gradient(135deg,#f1e9ff,#fae9ff)" iconColor="#8b5cf6"
                value={fmtTokens(ov.totalTokens)} label={`${t.auOvTokens} · ${ov.periodStart.slice(0, 7)}`}
                pill={ov.tokenDeltaPct === null ? null : `${ov.tokenDeltaPct >= 0 ? '+' : ''}${ov.tokenDeltaPct}% ${t.auOvVsPrev}`}
                pillTone={ov.tokenDeltaPct !== null && ov.tokenDeltaPct > 0 ? 'warning' : 'success'} />
              <StatCard icon={DollarSign} iconBg="linear-gradient(135deg,#e7fff4,#e9f7ff)" iconColor="#10b981"
                value={fmtUsd(ov.costUsd)} label={t.auOvCost} valueFontSize={24} />
              <StatCard icon={Activity} iconBg="linear-gradient(135deg,#e9f0ff,#f1e9ff)" iconColor="#6366f1"
                value={ov.requests.toLocaleString('vi-VN')} label={t.auOvRequests} />
              <StatCard icon={AlertTriangle} iconBg="linear-gradient(135deg,#fff1e9,#ffe9f1)" iconColor="#f59e0b"
                value={ov.requests > 0 ? `${((ov.errors / ov.requests) * 100).toFixed(1)}%` : '—'}
                label={`${t.auOvErrorRate} (${ov.errors.toLocaleString('vi-VN')})`}
                pillTone={ov.errors > 0 ? 'warning' : 'success'} />
            </div>
            {ov.creditUnits > 0 && (
              <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: -8 }}>
                {t.auOvCreditPart.replace('{n}', fmtTokens(ov.creditUnits))}
              </div>
            )}

            {/* Cảnh báo bất thường (pha 5A — alert-only) + đo FP + ngưỡng rule */}
            <AlertsPanel />

            {/* Heatmap 7×24 — metric chọn phía client */}
            <SectionCard
              title={t.auOvHeatmap}
              action={
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([['tokens', t.auOvMetricTokens], ['requests', t.auOvMetricRequests], ['cost', t.auOvMetricCost], ['latency', t.auOvMetricLatency]] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setMetric(key)}
                      style={{ border: '1px solid', borderColor: metric === key ? 'transparent' : '#ece8f6', background: metric === key ? brandGradient : '#fff', color: metric === key ? '#fff' : '#5b5670', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              {heat.length === 0 ? (
                <div style={{ fontSize: 13, color: '#a59fbb', padding: '10px 0' }}>{t.auOvNoData}</div>
              ) : (
                <Heatmap cells={heat.map((p) => ({ bucket: p.bucket, value: metricValue(p) }))} days={7}
                  fmt={fmtMetric} legend={{ low: t.hmLow, high: t.hmHigh }} />
              )}
            </SectionCard>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
              {/* Top tính năng theo token */}
              <SectionCard title={t.auOvTopFeatures}>
                {ov.topFeatures.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#a59fbb' }}>{t.auOvNoData}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {ov.topFeatures.map((f) => {
                      const maxTok = Math.max(...ov.topFeatures.map((x) => x.totalTokens), 1);
                      return (
                        <div key={f.taskCode}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5, fontSize: 13 }}>
                            <span style={{ fontWeight: 600, color: '#3f3a55' }}>{aiTaskLabel(lang, f.taskCode)}</span>
                            <span style={{ fontWeight: 700, color: '#5b5670' }}>{fmtTokens(f.totalTokens)}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 999, background: '#ece6f8', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(f.totalTokens / maxTok) * 100}%`, borderRadius: 999, background: brandGradient }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              {/* Top model & provider theo token + cost */}
              <SectionCard flush title={t.auOvTopModels}>
                <DataTable head={['Model', 'Token', t.aiUsageCost ?? 'Cost']} minWidth={320}>
                  {ov.topModels.map((m) => (
                    <tr key={`${m.providerCode}:${m.modelCode}`} style={{ borderTop: '1px solid #f1eef8' }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        {m.modelCode}
                        <div style={{ fontSize: 11.5, color: '#a59fbb' }}>{m.providerCode}</div>
                      </td>
                      <td style={tdStyle}>{fmtTokens(m.totalTokens)}</td>
                      <td style={tdMuted}>{fmtUsd(m.costUsd)}</td>
                    </tr>
                  ))}
                </DataTable>
              </SectionCard>
            </div>

            {/* Top 10 user tiêu thụ */}
            <SectionCard flush title={t.auOvTopUsers}>
              <DataTable head={[t.auColUser, 'Token', t.aiUsageCost ?? 'Cost', '']} minWidth={560}>
                {ov.topUsers.map((u) => (
                  <tr key={u.userId} style={{ borderTop: '1px solid #f1eef8' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar url={u.avatarUrl ?? undefined} initials={initialsOf(u.fullName || u.email)} gradient={brandGradient} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{u.fullName || u.email}</div>
                          <div style={{ fontSize: 12, color: '#a59fbb' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtTokens(u.totalTokens)}</td>
                    <td style={tdMuted}>{fmtUsd(u.costUsd)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => openDetail(u.userId)} style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.auDetail}</button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </SectionCard>
          </>
        )
      )}

      {tab === 'plans' && (
        planLoad === 'loading' ? loadingCard : planLoad === 'error' ? errorCard(fetchPlans) : (() => {
          // Bảng giám sát TIÊU THỤ theo gói (mục 5b) — chỉ đọc; cấu hình gói ở trang
          // Quản lý gói (chỉ giữ link nhỏ). Cột "So tổng trần" cũ (gây hiểu nhầm 100%
          // đỏ ở gói Free) được thay bằng % so tổng hạn mức CẤP PHÁT + cột hành động
          // "User cần chú ý". Progress chỉ đỏ khi THẬT SỰ vượt 100%.
          const totals = plans.reduce(
            (a, p) => {
              const cap = p.monthlyTokenLimit === null ? null : p.monthlyTokenLimit * p.userCount;
              return {
                users: a.users + p.userCount,
                tokens: a.tokens + p.totalTokens,
                cost: a.cost + (p.estimatedCost ?? 0),
                cap: a.cap === null || cap === null ? null : a.cap + cap,
              };
            },
            { users: 0, tokens: 0, cost: 0, cap: 0 as number | null },
          );
          const barColor = (pct: number) => (pct > 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : brandGradient);
          const usedCell = (tokens: number, cap: number | null) => {
            const pct = cap === null || cap === 0 ? null : (tokens / cap) * 100;
            return (
              <div style={{ minWidth: 150 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5b5670', marginBottom: 4 }}>
                  {fmtTokens(tokens)}{pct !== null && <span style={{ color: '#a59fbb', fontWeight: 600 }}> · {Math.round(pct)}%</span>}
                </div>
                {pct !== null && (
                  <div style={{ height: 6, borderRadius: 999, background: '#ece6f8', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: 999, background: barColor(pct) }} />
                  </div>
                )}
              </div>
            );
          };
          const attentionCell = (att: { warn: number; over: number } | null) =>
            att === null ? <span style={{ color: '#a59fbb' }}>…</span>
              : att.warn === 0 && att.over === 0 ? <span style={{ color: '#a59fbb' }}>—</span>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, whiteSpace: 'nowrap' }}>
                    {att.warn > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#b45309' }}>{t.auPlanWarnShort.replace('{n}', String(att.warn))}</span>}
                    {att.over > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#dc2626' }}>{t.auPlanOverShort.replace('{n}', String(att.over))}</span>}
                  </div>
                );
          const periodChip = (label: string, active: boolean) => (
            <button key={label} disabled={!active} title={active ? undefined : t.auPeriodNeedApi}
              style={{ border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6', background: active ? brandGradient : '#fff', color: active ? '#fff' : '#a59fbb', borderRadius: 999, padding: '6px 13px', fontSize: 12.5, fontWeight: 700, cursor: active ? 'pointer' : 'not-allowed' }}>
              {label}
            </button>
          );
          const totalAttention = allUsers === null ? null : plans.reduce(
            (a, p) => {
              const att = attentionOf(p.planCode)!;
              return { warn: a.warn + att.warn, over: a.over + att.over };
            },
            { warn: 0, over: 0 },
          );
          return (
            <>
              {/* Bộ chọn kỳ — hiện chỉ "Kỳ này" (BE gộp theo kỳ hiện tại); kỳ khác cần API. */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {periodChip(t.auPeriodThis, true)}
                {periodChip(t.auPeriodPrev, false)}
                {periodChip(t.auPeriod30, false)}
              </div>
              <SectionCard
                flush
                title={t.auTabByPlan}
                action={
                  <button onClick={() => go('adminPlans')} style={{ border: 'none', background: 'none', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer', padding: 0 }}>{t.auEditPlanLimits}</button>
                }
              >
                <DataTable head={[t.auColPlan, t.auPlanUsers, t.auPlanLimitPerUser, t.auPlanAllocated, t.auPlanUsed, t.auPlanCost, t.auPlanAttention]} minWidth={920}>
                  {plans.map((p) => {
                    const cap = p.monthlyTokenLimit === null ? null : p.monthlyTokenLimit * p.userCount;
                    const open = drillPlan === p.planCode;
                    const drillRows = open && allUsers !== null
                      ? allUsers
                          .filter((u) => u.planCode === p.planCode)
                          .sort((a, b) => (pctOf(b.used, b.limit) ?? -1) - (pctOf(a.used, a.limit) ?? -1))
                      : null;
                    return (
                      <Fragment key={p.planId}>
                        <tr
                          onClick={() => setDrillPlan(open ? null : p.planCode)}
                          style={{ borderTop: '1px solid #f1eef8', opacity: p.isActive ? 1 : 0.6, cursor: 'pointer', background: open ? '#faf8ff' : undefined }}
                        >
                          <td style={{ ...tdStyle, fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <StatusBadge {...userPlanMeta((p.planCode || 'FREE') as UserPlan)} />
                              <span>{lang === 'en' ? p.planNameEn : p.planNameVi}</span>
                            </div>
                          </td>
                          <td style={tdStyle}>{p.userCount}</td>
                          <td style={tdMuted}>{p.monthlyTokenLimit === null ? t.usageUnlimited : fmtTokens(p.monthlyTokenLimit)}</td>
                          <td style={tdMuted}>{cap === null ? '∞' : fmtTokens(cap)}</td>
                          <td style={tdStyle}>{usedCell(p.totalTokens, cap)}</td>
                          <td style={tdStyle}>
                            {fmtUsd(p.estimatedCost)}
                            {p.estimatedCost != null && p.userCount > 0 && (
                              <div style={{ fontSize: 11.5, color: '#a59fbb' }}>{t.auPlanAvgUser}: {fmtUsd(p.estimatedCost / p.userCount)}</div>
                            )}
                          </td>
                          <td style={tdStyle}>{attentionCell(attentionOf(p.planCode))}</td>
                        </tr>
                        {open && (
                          <tr style={{ background: '#faf8ff' }}>
                            <td colSpan={7} style={{ padding: '4px 16px 14px' }}>
                              {drillRows === null ? (
                                <div style={{ fontSize: 12.5, color: '#a59fbb', padding: '8px 0' }}>{t.listLoading}</div>
                              ) : drillRows.length === 0 ? (
                                <div style={{ fontSize: 12.5, color: '#a59fbb', padding: '8px 0' }}>{t.auDrillEmpty}</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {drillRows.map((u) => {
                                    const pct = pctOf(u.used, u.limit);
                                    return (
                                      <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', borderRadius: 10, background: '#fff', border: '1px solid #f1eef8' }}>
                                        <Avatar url={u.avatarUrl ?? undefined} initials={initialsOf(u.fullName || u.email)} size={28} gradient={brandGradient} />
                                        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2b2543', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.fullName || u.email}</div>
                                          <div style={{ fontSize: 11, color: '#a59fbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                                        </div>
                                        <div style={{ flex: '2 1 200px' }}><UsageBar used={u.used} limit={u.limit} gradient={brandGradient} /></div>
                                        <StatusBadge tone={pctTone(pct)} label={pct === null ? '∞' : `${Math.round(pct)}%`} />
                                        <button onClick={(e) => { e.stopPropagation(); openDetail(u.userId); }} style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '5px 11px', fontSize: 12, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.auDetail}</button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {/* Hàng tổng cộng */}
                  <tr style={{ borderTop: '2px solid #ece8f6', background: '#faf9fe' }}>
                    <td style={{ ...tdStyle, fontWeight: 800 }}>{t.auPlanTotal}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{totals.users}</td>
                    <td style={tdMuted}>—</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{totals.cap === null ? '∞' : fmtTokens(totals.cap)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{usedCell(totals.tokens, totals.cap)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtUsd(totals.cost)}</td>
                    <td style={tdStyle}>{attentionCell(totalAttention)}</td>
                  </tr>
                </DataTable>
              </SectionCard>
            </>
          );
        })()
      )}

      {tab === 'users' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {filterChip('', t.auFilterAll)}
              {filterChip('warning', t.auFilterWarn)}
              {filterChip('exceeded', t.auFilterOver)}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input placeholder={t.auSearchPh} value={q} onChange={(e) => setQ(e.target.value)} style={{ border: '1px solid #ece8f6', borderRadius: 10, padding: '8px 12px', fontSize: 13, width: 220 }} />
              <button onClick={doReconcile} title={t.auReconcile} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>
                <RefreshCw size={14} /> {t.auReconcile}
              </button>
            </div>
          </div>

          {userLoad === 'loading' ? loadingCard : userLoad === 'error' ? errorCard(fetchUsers) : rows.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '44px 16px', color: '#8a85a0', fontSize: 13.5 }}>{t.auEmpty}</Card>
          ) : (
            <SectionCard flush title={t.auTabByUser}>
              <DataTable head={[t.auColUser, t.auColPlan, t.auColUsage, '%', '']} minWidth={760}>
                {rows.map((r) => {
                  const pct = pctOf(r.used, r.limit);
                  return (
                    <tr key={r.userId} style={{ borderTop: '1px solid #f1eef8' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar url={r.avatarUrl ?? undefined} initials={initialsOf(r.fullName || r.email)} gradient={brandGradient} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{r.fullName || r.email}</div>
                            <div style={{ fontSize: 12, color: '#a59fbb' }}>{r.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}><StatusBadge {...userPlanMeta((r.planCode || 'FREE') as UserPlan)} /></td>
                      <td style={tdStyle}><UsageBar used={r.used} limit={r.limit} gradient={brandGradient} /></td>
                      <td style={tdStyle}>
                        <StatusBadge tone={pctTone(pct)} label={pct === null ? '∞' : `${Math.round(pct)}%`} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <button onClick={() => openDetail(r.userId)} style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.auDetail}</button>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
              <div style={{ padding: '0 16px 16px' }}>
                <Pagination page={page + 1} pageCount={pageCount} onChange={(p) => setPage(p - 1)} />
              </div>
            </SectionCard>
          )}
        </>
      )}

      {tab === 'events' && <UsageEventsTable syncUrl />}

      {tab === 'rates' && (
        rateLoad === 'loading' ? loadingCard : rateLoad === 'error' ? errorCard(fetchRates) : (
          <SectionCard flush title={t.auTabRates}>
            <div style={{ padding: '10px 16px 0', fontSize: 12, color: '#8a85a0' }}>{t.auRateNote}</div>

            {/* Thêm version mới — append-only, BE tự đóng version đang mở cùng scope */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '12px 16px' }}>
              <select value={rTask} onChange={(e) => setRTask(e.target.value as AiTaskCode | '')}
                style={{ border: '1px solid #ece8f6', borderRadius: 10, padding: '8px 10px', fontSize: 13, color: '#2b2543', background: '#fff' }}>
                <option value="">{t.auRateAllTasks}</option>
                {RATE_TASKS.map((task) => <option key={task} value={task}>{aiTaskLabel(lang, task)}</option>)}
              </select>
              <input placeholder={t.auRateModelPh} value={rModel} onChange={(e) => setRModel(e.target.value)}
                style={{ border: '1px solid #ece8f6', borderRadius: 10, padding: '8px 10px', fontSize: 13, width: 200 }} />
              <input type="number" min={0.000001} step="any" placeholder={t.auRateMultiplierPh} value={rMult} onChange={(e) => setRMult(e.target.value)}
                style={{ border: '1px solid #ece8f6', borderRadius: 10, padding: '8px 10px', fontSize: 13, width: 130 }} />
              <input type="number" min={0} placeholder={t.auRateMinChargePh} value={rMin} onChange={(e) => setRMin(e.target.value)}
                style={{ border: '1px solid #ece8f6', borderRadius: 10, padding: '8px 10px', fontSize: 13, width: 170 }} />
              <button onClick={doAddRate} disabled={rBusy || !(Number(rMult) > 0)}
                style={{ border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: rBusy ? 'wait' : 'pointer', opacity: rBusy || !(Number(rMult) > 0) ? 0.55 : 1 }}>
                {t.auRateAdd}
              </button>
            </div>

            {rates.length === 0 ? (
              <div style={{ padding: '10px 16px 20px', fontSize: 13, color: '#a59fbb' }}>{t.auRateEmpty}</div>
            ) : (
              <DataTable
                head={[t.auRateColTask, t.auRateColModel, t.auRateColMultiplier, t.auRateColMinCharge, t.auRateColFrom, t.auRateColTo, t.auRateColBy, '']}
                minWidth={860}
              >
                {rates.map((r) => {
                  const scheduled = r.effectiveTo === null && r.effectiveFrom > new Date().toISOString();
                  const tone = r.effectiveTo !== null ? 'neutral' : scheduled ? 'warning' : 'success';
                  const label = r.effectiveTo !== null ? t.auRateReplaced : scheduled ? t.auRateScheduled : t.auRateActive;
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid #f1eef8', opacity: r.effectiveTo !== null ? 0.6 : 1 }}>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{r.taskCode ? aiTaskLabel(lang, r.taskCode) : t.auRateAllTasks}</td>
                      <td style={tdMuted}>{r.modelCode ?? t.auRateAllModels}</td>
                      <td style={tdStyle}>×{r.multiplier}</td>
                      <td style={tdMuted}>{r.minCharge == null ? '—' : fmtTokens(r.minCharge)}</td>
                      <td style={tdMuted}>{fmtDateTime(r.effectiveFrom)}</td>
                      <td style={tdMuted}>{r.effectiveTo === null ? '—' : fmtDateTime(r.effectiveTo)}</td>
                      <td style={tdMuted}>{r.createdByEmail ?? '—'}</td>
                      <td style={tdStyle}><StatusBadge tone={tone} label={label} /></td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </SectionCard>
        )
      )}

    </PageContainer>
  );
}
