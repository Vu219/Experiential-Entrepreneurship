import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useUiStore } from '../../store/useUiStore';
import { Card, Loader } from '../../components/ui';
import StatusBadge from '../../components/admin/StatusBadge';
import SectionCard from '../../components/admin/SectionCard';
import Avatar from '../../components/admin/Avatar';
import Heatmap from '../../components/admin/Heatmap';
import UsageEventsTable from '../../components/admin/usage/UsageEventsTable';
import { useToast } from '../../components/toast/ToastProvider';
import { userPlanMeta, type UserPlan } from '../../api/admin';
import { aiTaskLabel } from '../../api/adminAi';
import {
  getUserUsageDetail,
  getUserAdjustmentsAllTime,
  getUserSessions,
  getUsageHeatmap,
  getAlerts,
  grantTokens,
  resetUsage,
  type AdminUserUsageDetail,
  type HeatmapPoint,
  type UsageAdjustment,
  type UsageAlert,
  type UserSessions,
} from '../../api/adminUsage';
import { alertRuleLabel } from '../../components/admin/usage/AlertsPanel';
import PageContainer from '../../components/PageContainer';


// Trang chi tiết usage MỘT user (/admin/usage/users/:id) — nâng cấp từ modal "Chi tiết usage"
// cũ (entry point giữ nguyên: nút Chi tiết ở tab Theo người dùng / Tổng quan). Tab: Nhật ký
// (bảng dùng chung, pre-filter user) · Heatmap (bất thường 3h sáng) · Theo tính năng · Audit
// toàn thời gian · Phiên & thiết bị (BE audit mỗi lần xem vì trả IP).

const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${+(n / 1_000).toFixed(1)}K` : n.toLocaleString('vi-VN');
const fmtDateTime = (iso: string) => iso.slice(0, 16).replace('T', ' ');
const initialsOf = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(-2).join('').toUpperCase();
const pctOf = (used: number, limit: number | null) =>
  limit === null ? null : Math.min(limit > 0 ? (used / limit) * 100 : 100, 100);

type DetailTab = 'timeline' | 'heatmap' | 'features' | 'audit' | 'sessions';

/** Khối skeleton nhỏ dùng lại (class .skeleton có sẵn ở index.css). */
function Sk({ w, h = 12, r = 8 }: { w: number | string; h?: number; r?: number }) {
  return <span className="skeleton" style={{ display: 'block', width: w, height: h, borderRadius: r }} />;
}

/** Skeleton mô phỏng đúng bố cục trang đích (header user + thanh mức dùng + hàng tab
    + card nội dung) — thay cho spinner to chiếm cả trang khi điều hướng vào chi tiết. */
function DetailSkeleton() {
  return (
    <PageContainer role="status" aria-busy="true">
      <Sk w={120} h={14} />
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 280px' }}>
            <span className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%', flex: 'none' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, maxWidth: 260 }}>
              <Sk w="70%" h={14} />
              <Sk w="50%" h={10} />
            </div>
          </div>
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Sk w="100%" h={10} />
            <Sk w="100%" h={8} r={999} />
          </div>
          <div style={{ flex: '1 1 280px' }}><Sk w="100%" h={92} r={14} /></div>
        </div>
      </Card>
      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: 5 }, (_, i) => <Sk key={i} w={96} h={32} r={9} />)}
      </div>
      <Card>
        <Sk w={180} h={14} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {Array.from({ length: 6 }, (_, i) => <Sk key={i} w="100%" h={22} />)}
        </div>
      </Card>
    </PageContainer>
  );
}

export default function UserUsageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang, brandGradient } = useApp();
  const toast = useToast();

  const [detail, setDetail] = useState<AdminUserUsageDetail | null>(null);
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [tab, setTab] = useState<DetailTab>('timeline');

  // Grant/reset (chuyển nguyên từ modal cũ — hành vi không đổi).
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  // Dữ liệu theo tab (tải lười khi mở tab).
  const [heat, setHeat] = useState<HeatmapPoint[] | null>(null);
  const [audit, setAudit] = useState<UsageAdjustment[] | null>(null);
  const [sessions, setSessions] = useState<UserSessions | null>(null);
  const [openAlerts, setOpenAlerts] = useState<UsageAlert[]>([]);

  const fetchDetail = () => {
    if (!id) return;
    getUserUsageDetail(id)
      .then((d) => { setDetail(d); setLoad('ok'); })
      .catch(() => setLoad('error'));
    getAlerts({ status: 'OPEN', userId: id }).then(setOpenAlerts).catch(() => setOpenAlerts([]));
  };
  useEffect(fetchDetail, [id]);

  // Heading Topbar = tên user đang xem + email · gói (thay vì heading mặc định sai
  // "Bảng điều khiển") — clear khi rời trang để không rò sang trang khác.
  const setPageHeading = useUiStore((s) => s.setPageHeading);
  useEffect(() => {
    if (detail) {
      const plan = userPlanMeta((detail.usage.planCode ?? 'FREE') as UserPlan);
      setPageHeading({ title: detail.fullName || detail.email, sub: `${detail.email} · ${plan.label}` });
    }
    return () => setPageHeading(null);
  }, [detail, setPageHeading]);

  useEffect(() => {
    if (!id) return;
    if (tab === 'heatmap' && heat === null) getUsageHeatmap({ days: 7, userId: id }).then(setHeat).catch(() => setHeat([]));
    if (tab === 'audit' && audit === null) getUserAdjustmentsAllTime(id).then(setAudit).catch(() => setAudit([]));
    if (tab === 'sessions' && sessions === null) getUserSessions(id).then(setSessions).catch(() => setSessions({ activeSessionCount: 0, recentClients: [] }));
  }, [tab, id]);

  const doGrant = async () => {
    const tokens = Number(amount);
    if (!id || !Number.isFinite(tokens) || tokens <= 0) return;
    setBusy(true);
    try {
      await grantTokens(id, Math.floor(tokens), reason);
      toast.success(t.auGrantOk);
      setAmount(''); setReason(''); setAudit(null);
      fetchDetail();
    } catch { toast.error(t.auActionErr); } finally { setBusy(false); }
  };

  const doReset = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await resetUsage(id, reason);
      toast.success(t.auResetOk);
      setReason(''); setResetArmed(false); setAudit(null);
      fetchDetail();
    } catch { toast.error(t.auActionErr); } finally { setBusy(false); }
  };

  const inputStyle: CSSProperties = { border: '1px solid #ece8f6', borderRadius: 10, padding: '8px 12px', fontSize: 13.5, color: '#2b2543' };
  const btnStyle = (bg: string): CSSProperties => ({ border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700, fontSize: 13, color: '#fff', background: bg, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 });
  const tabBtn = (key: DetailTab, label: string) => {
    const active = tab === key;
    return (
      <button key={key} onClick={() => setTab(key)} style={{ border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6', background: active ? brandGradient : '#fff', color: active ? '#fff' : '#5b5670', borderRadius: 9, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
    );
  };

  if (load === 'loading') return <DetailSkeleton />;
  if (load === 'error' || !detail) {
    return (
      <PageContainer>
        <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670', marginBottom: 14 }}>{t.listError}</div>
          <button onClick={fetchDetail} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
        </Card>
      </PageContainer>
    );
  }

  const usage = detail.usage;
  const pct = pctOf(usage.used, usage.limit);
  const barFill = pct !== null && pct >= 100 ? '#ef4444' : pct !== null && pct >= 80 ? '#f59e0b' : brandGradient;
  const maxFeature = Math.max(...usage.byFeature.map((f) => f.totalTokens), 1);

  return (
    <PageContainer>
      <button onClick={() => navigate('/admin/usage')} style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', border: 'none', background: 'none', fontSize: 13, fontWeight: 700, color: '#7d6aa3', cursor: 'pointer', padding: 0 }}>
        <ArrowLeft size={15} /> {t.audBack}
      </button>

      {/* Banner cảnh báo bất thường đang mở của user (pha 5A — xử lý ở tab Tổng quan) */}
      {openAlerts.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
            {t.alrUserBanner.replace('{n}', String(openAlerts.length))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {openAlerts.map((a) => (
              <div key={a.id} style={{ fontSize: 12.5, color: '#92400e' }}>
                <b>{alertRuleLabel(t, a.ruleCode)}</b> — {a.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header: user + gói + thanh usage + credit/shortfall + grant/reset */}
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 280px', minWidth: 0 }}>
            <Avatar url={detail.avatarUrl ?? undefined} initials={initialsOf(detail.fullName || detail.email)} size={44} gradient={brandGradient} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5, color: '#2b2543' }}>{detail.fullName || detail.email}</div>
              <div style={{ fontSize: 12.5, color: '#8a85a0' }}>{detail.email}</div>
              <div style={{ fontSize: 12, color: '#a59fbb', marginTop: 2 }}>
                {usage.billingPeriod} · {t.tuReset} {fmtDateTime(usage.periodEnd).slice(0, 10)}
              </div>
            </div>
            <StatusBadge {...userPlanMeta((usage.planCode ?? 'FREE') as UserPlan)} />
          </div>

          <div style={{ flex: '1 1 300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, color: '#5b5670', marginBottom: 5 }}>
              <span>{t.auColUsage}</span>
              <span>{fmtTokens(usage.used)} / {usage.limit === null ? '∞' : fmtTokens(usage.limit)}</span>
            </div>
            {usage.limit !== null && (
              <div style={{ height: 7, borderRadius: 999, background: '#ece6f8', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: barFill }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8, fontSize: 12.5 }}>
              {(usage.creditUsed ?? 0) > 0 && (
                <span style={{ color: '#8a85a0' }}>{t.auCreditUsed}: <b style={{ color: '#3f3a55' }}>{fmtTokens(usage.creditUsed ?? 0)}</b></span>
              )}
              {(usage.creditLeft ?? 0) > 0 && (
                <span style={{ color: '#8a85a0' }}>{t.auCreditLeft}: <b style={{ color: '#059669' }}>{fmtTokens(usage.creditLeft ?? 0)}</b></span>
              )}
              {(detail.creditShortfall ?? 0) > 0 && (
                <span style={{ color: '#b45309', fontWeight: 600 }}>{t.auShortfall}: <b style={{ color: '#dc2626' }}>{fmtTokens(detail.creditShortfall ?? 0)}</b></span>
              )}
            </div>
          </div>

          {/* Cấp thêm / reset — mỗi thao tác một dòng audit usage_adjustments (như modal cũ) */}
          <div style={{ flex: '1 1 280px', background: '#f8f6fd', border: '1px solid #eee9f6', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min={1} placeholder={t.auGrantAmount} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...inputStyle, width: 120 }} />
              <button onClick={doGrant} disabled={busy || !(Number(amount) > 0)} style={{ ...btnStyle(brandGradient), opacity: busy || !(Number(amount) > 0) ? 0.55 : 1 }}>{t.auGrant}</button>
            </div>
            <input placeholder={t.auReasonPh} title={t.auReason} value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle} />
            {resetArmed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>{t.auResetConfirm}</span>
                <button onClick={doReset} disabled={busy} style={btnStyle('#ef4444')}>{t.auReset}</button>
                <button onClick={() => setResetArmed(false)} style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 12.5, color: '#5b5670', cursor: 'pointer' }}>{t.close}</button>
              </div>
            ) : (
              <button onClick={() => setResetArmed(true)} style={{ alignSelf: 'flex-start', border: '1px solid #fecaca', background: '#fff', borderRadius: 10, padding: '7px 12px', fontWeight: 700, fontSize: 12.5, color: '#dc2626', cursor: 'pointer' }}>{t.auReset}</button>
            )}
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabBtn('timeline', t.audTabTimeline)}
        {tabBtn('heatmap', t.audTabHeatmap)}
        {tabBtn('features', t.audTabFeatures)}
        {tabBtn('audit', t.audTabAudit)}
        {tabBtn('sessions', t.audTabSessions)}
      </div>

      {tab === 'timeline' && id && <UsageEventsTable fixedUserId={id} />}

      {tab === 'heatmap' && (
        <SectionCard title={t.audHeatmapTitle}>
          {heat === null ? <Loader label={t.listLoading} /> : heat.length === 0 ? (
            <div style={{ fontSize: 13, color: '#a59fbb' }}>{t.auOvNoData}</div>
          ) : (
            <Heatmap cells={heat.map((p) => ({ bucket: p.bucket, value: p.totalTokens }))} days={7}
              fmt={(v) => `${fmtTokens(v)} token`} legend={{ low: t.hmLow, high: t.hmHigh }} />
          )}
        </SectionCard>
      )}

      {tab === 'features' && (
        <SectionCard title={`${t.tuByFeature} (${t.tuRawNote})`}>
          {usage.byFeature.length === 0 ? (
            <div style={{ fontSize: 13, color: '#a59fbb' }}>{t.aueEmpty}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {usage.byFeature.map((f) => (
                <div key={f.taskCode}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#3f3a55' }}>{aiTaskLabel(lang, f.taskCode)}</span>
                    <span style={{ fontWeight: 700, color: '#5b5670' }}>{fmtTokens(f.totalTokens)}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: '#ece6f8', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(f.totalTokens / maxFeature) * 100}%`, borderRadius: 999, background: brandGradient }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'audit' && (
        <SectionCard title={t.audAuditAllTime}>
          {audit === null ? <Loader label={t.listLoading} /> : audit.length === 0 ? (
            <div style={{ fontSize: 13, color: '#a59fbb' }}>{t.auHistoryEmpty}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {audit.map((a) => (
                <div key={a.id} style={{ border: '1px solid #f1eef8', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: a.type === 'GRANT' ? '#059669' : '#dc2626' }}>
                      {a.type === 'GRANT' ? `${t.auAdjGrant} +${fmtTokens(a.deltaTokens ?? 0)}` : t.auAdjReset}
                      <span style={{ fontWeight: 600, color: '#a59fbb', marginLeft: 8 }}>{a.billingPeriod}</span>
                    </span>
                    <span style={{ color: '#a59fbb' }}>{fmtDateTime(a.createdAt)}</span>
                  </div>
                  <div style={{ color: '#8a85a0', marginTop: 2 }}>
                    {a.actorEmail && `${t.auBy} ${a.actorEmail}`}{a.reason && ` — ${a.reason}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'sessions' && (
        <SectionCard title={t.audTabSessions}>
          <div style={{ fontSize: 12, color: '#8a85a0', marginBottom: 12 }}>{t.audSessionsNote}</div>
          {sessions === null ? <Loader label={t.listLoading} /> : (
            <>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#3f3a55', marginBottom: 12 }}>
                {t.audActiveSessions}: {sessions.activeSessionCount}
              </div>
              {sessions.recentClients.length === 0 ? (
                <div style={{ fontSize: 13, color: '#a59fbb' }}>{t.audSessionsEmpty}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sessions.recentClients.map((c, i) => (
                    <div key={i} style={{ border: '1px solid #f1eef8', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                      <span style={{ fontWeight: 700, color: '#3f3a55' }}>{c.clientIp}</span>
                      <span style={{ color: '#8a85a0', flex: 1, minWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.userAgent ?? ''}>{c.userAgent || t.aueUnknown}</span>
                      <span style={{ color: '#8a85a0' }}>{t.audRequests}: <b>{c.requestCount}</b></span>
                      <span style={{ color: '#a59fbb' }}>{t.audLastSeen}: {fmtDateTime(c.lastSeenAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}
    </PageContainer>
  );
}
