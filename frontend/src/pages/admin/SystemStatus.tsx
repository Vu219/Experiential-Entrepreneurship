import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card, Loader, Icon } from '../../components/ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import StatusBadge, { type Tone } from '../../components/admin/StatusBadge';
import SectionCard from '../../components/admin/SectionCard';
import PageContainer from '../../components/PageContainer';
import {
  getSystemStatus, getSystemActivity,
  type SystemStatus as SystemStatusData, type ServiceStatus, type SvcHealth,
  type SystemActivity, type ActivityRange,
} from '../../api/admin';
import { getAiStatus, type AiEffectiveStatus } from '../../api/adminAi';

// Trang Trạng thái hệ thống — REALTIME (mục 6): backend chưa có SSE/WebSocket nên dùng
// polling (setTimeout tự quản, không thêm dependency React Query/SWR):
//   • nhóm NHANH 5s  — /admin/system (DB/Redis/AI service + tài nguyên container; alerts
//     đi kèm cùng endpoint nên cũng tươi ở nhịp này);
//   • nhóm CHẬM 15s — /admin/ai/status (sức khoẻ cấu hình AI) + /admin/system/activity.
// Poll lỗi → GIỮ giá trị cũ + badge "mất kết nối" + retry backoff ×2 (tối đa 60s).
// Skeleton chỉ ở lần tải đầu; các refetch sau cập nhật tại chỗ với count-up ~300ms.

const RANGES: ActivityRange[] = ['1h', '24h', '7d', '30d', '1y'];
const FAST_MS = 5_000;
const SLOW_MS = 15_000;
const MAX_BACKOFF_MS = 60_000;

/** Poll fn theo nhịp baseMs; fn trả false (lỗi) → giãn nhịp ×2 tối đa 60s, thành công → về nhịp gốc. */
function usePoll(fn: () => Promise<boolean>, baseMs: number, paused: boolean) {
  useEffect(() => {
    if (paused) return;
    let stopped = false;
    let timer = 0;
    let delay = baseMs;
    const tick = async () => {
      const ok = await fn();
      if (stopped) return;
      delay = ok ? baseMs : Math.min(delay * 2, MAX_BACKOFF_MS);
      timer = window.setTimeout(tick, delay);
    };
    tick();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [fn, baseMs, paused]);
}

/** Số đếm chuyển mượt ~300ms khi giá trị đổi (không nhảy giật giữa các lần refetch). */
function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 300);
      setShown(Math.round(from + (value - from) * k));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toLocaleString('vi-VN')}</>;
}

export default function SystemStatus() {
  const { t, lang, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const nav = useNavigate();

  const [data, setData] = useState<SystemStatusData | null>(null);
  const [ai, setAi] = useState<AiEffectiveStatus | null>(null);
  const [range, setRange] = useState<ActivityRange>('24h');
  const [activity, setActivity] = useState<SystemActivity | null>(null);
  const [actLoading, setActLoading] = useState(true); // chỉ lần tải đầu của mỗi range
  const [initial, setInitial] = useState<'loading' | 'error' | 'ok'>('loading');
  const [paused, setPaused] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [hover, setHover] = useState<number | null>(null); // cột đang trỏ (null = hiện tổng theo kỳ)
  const [alertOpen, setAlertOpen] = useState<string | null>(null); // alert đang mở "xem chi tiết"

  // Nhóm NHANH 5s: health + container + counters + alerts (một endpoint).
  const pollStatus = useCallback(async () => {
    try {
      const s = await getSystemStatus(lang);
      setData(s);
      setUpdatedAt(new Date());
      setDisconnected(false);
      setInitial('ok');
      return true;
    } catch {
      setDisconnected(true);
      setInitial((v) => (v === 'loading' ? 'error' : v));
      return false;
    }
  }, [lang]);
  usePoll(pollStatus, FAST_MS, paused);

  // Nhóm CHẬM 15s: sức khoẻ cấu hình AI + biểu đồ hoạt động theo range đang chọn.
  const pollSlow = useCallback(async () => {
    try {
      const [a, act] = await Promise.all([getAiStatus().catch(() => null), getSystemActivity(range)]);
      setAi(a);
      setActivity(act);
      setActLoading(false);
      return true;
    } catch {
      setActLoading(false);
      return false;
    }
  }, [range]);
  usePoll(pollSlow, SLOW_MS, paused);

  const changeRange = (r: ActivityRange) => {
    if (r === range) return;
    setActLoading(true);
    setHover(null);
    setRange(r); // pollSlow đổi identity → usePoll chạy lại ngay với range mới
  };

  if (initial === 'loading') return <PageContainer><Card><Loader label={t.listLoading} /></Card></PageContainer>;
  if (initial === 'error' || !data) return (
    <PageContainer>
      <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670', marginBottom: 14 }}>{t.listError}</div>
        <button onClick={() => { setInitial('loading'); pollStatus(); }} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </Card>
    </PageContainer>
  );

  const svcMeta = (s: ServiceStatus): { tone: Tone; label: string } =>
    s === 'operational' ? { tone: 'success', label: t.svcOperational }
    : s === 'degraded' ? { tone: 'warning', label: t.svcDegraded }
    : { tone: 'danger', label: t.svcDown };

  // Chỉ số thật theo từng service — chỉ hiện giá trị non-null (rule: không lấy được thì ẩn).
  const metricLines = (svc: SvcHealth): [string, string][] => {
    const out: [string, string][] = [];
    if (svc.latencyMs != null) out.push([t.sysLatency, `${svc.latencyMs} ms`]);
    if (svc.activeConnections != null) out.push([t.sysActiveConns, String(svc.activeConnections)]);
    if (svc.memoryUsed) out.push([t.sysRedisMem, svc.memoryUsed]);
    if (svc.hitRate != null) out.push([t.sysHitRate, `${svc.hitRate}%`]);
    return out;
  };

  const label = { fontSize: 12.5, color: '#8a85a0' } as const;
  const val = { color: '#3f3a55', fontWeight: 600 } as const;

  // Sức khỏe cấu hình AI (dùng /admin/ai/status có sẵn).
  const enabledRoutes = ai ? ai.routes.filter((r) => r.enabled).length : 0;
  const aiOk = ai ? Math.max(0, enabledRoutes - ai.degradedCount - ai.errorCount) : 0;

  const host = data.host;
  const activeBuckets = activity?.buckets ?? [];
  const maxTotal = Math.max(1, ...activeBuckets.map((b) => b.total));
  const hasActivity = activeBuckets.some((b) => b.total > 0);
  const fmtTick = (iso: string) => iso.slice(range === '1y' || range === '30d' ? 5 : 11, 16).replace('T', ' ');
  // Tổng theo kỳ (hiện mặc định) — readout đổi sang bucket đang trỏ khi hover.
  const actSum = activeBuckets.reduce(
    (a, b) => ({ posts: a.posts + b.posts, jobs: a.jobs + b.jobs, errors: a.errors + b.errors }),
    { posts: 0, jobs: 0, errors: 0 },
  );
  const shown = hover != null ? activeBuckets[hover] : null;

  // ===== Chỉ số bổ sung cho card "Hoạt động hệ thống" (mục 6) =====
  const totalEvents = actSum.posts + actSum.jobs + actSum.errors;
  const errRate = totalEvents > 0 ? (actSum.errors / totalEvents) * 100 : null;
  // Throughput request/phút theo bucket (posts + jobs) — sparkline + giá trị bucket cuối.
  const bucketMinutes = activeBuckets.length >= 2
    ? Math.max(1, (new Date(activeBuckets[1].time).getTime() - new Date(activeBuckets[0].time).getTime()) / 60_000)
    : 1;
  const throughputSeries = activeBuckets.map((b) => (b.posts + b.jobs) / bucketMinutes);
  const throughputNow = throughputSeries.length > 0 ? throughputSeries[throughputSeries.length - 1] : 0;
  // Sự cố gần nhất = alert ERROR mới nhất (BE trả alerts mới nhất trước).
  const lastIncident = data.alerts.find((a) => a.level === 'ERROR')?.time ?? null;
  // Nhãn trục X ở nhiều mốc (không chỉ hai đầu): ~6 mốc trải đều theo khoảng đã chọn.
  const tickEvery = Math.max(1, Math.ceil(activeBuckets.length / 6));

  // Gộp cảnh báo trùng nhau thành một dòng ×N (mục 6) — key theo level + message.
  const groupedAlerts: { key: string; tone: Tone; level: string; message: string; time: string; count: number }[] = [];
  {
    const seen = new Map<string, number>();
    for (const a of data.alerts) {
      const key = `${a.level}|${a.message}`;
      const idx = seen.get(key);
      if (idx !== undefined) groupedAlerts[idx].count++;
      else {
        seen.set(key, groupedAlerts.length);
        groupedAlerts.push({ key: a.id, tone: a.tone, level: a.level, message: a.message, time: a.time, count: 1 });
      }
    }
  }

  const fmtClock = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

  return (
    <PageContainer>
      {/* Chỉ báo live: chấm nhấp nháy + thời điểm cập nhật + nút tạm dừng/tiếp tục. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="live-dot" style={{ background: disconnected ? '#ef4444' : paused ? '#a59fbb' : '#22c55e', animationPlayState: paused ? 'paused' : 'running' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: disconnected ? '#dc2626' : '#3f3a55' }}>
          {paused ? t.sysPausedLabel : t.sysLive}
        </span>
        {updatedAt && (
          <span style={{ fontSize: 12, color: '#8a85a0' }}>{t.sysUpdatedAt} {fmtClock(updatedAt)}</span>
        )}
        {disconnected && <StatusBadge tone="danger" label={t.sysDisconnected} />}
        <button
          onClick={() => setPaused((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto', border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}
        >
          {paused ? <Play size={13} strokeWidth={2.2} /> : <Pause size={13} strokeWidth={2.2} />}
          {paused ? t.sysResume : t.sysPause}
        </button>
      </div>

      {/* Service cards + chỉ số thật (poll 5s) */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 16 }}>
        {data.services.map((svc) => {
          const m = svcMeta(svc.status);
          const lines = metricLines(svc);
          return (
            <Card key={svc.key} style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#2b2543' }}>{svc.name}</span>
                <StatusBadge tone={m.tone} label={m.label} />
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {svc.status !== 'operational' && svc.detail && (
                  <div style={{ fontSize: 12, color: '#dc2626', wordBreak: 'break-word' }}>{svc.detail}</div>
                )}
                {lines.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={label}>{k}</span><span style={val}>{v}</span>
                  </div>
                ))}
                {svc.status === 'operational' && lines.length === 0 && (
                  <div style={{ ...label }}>{t.svcOperational}</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Sức khỏe cấu hình AI (poll 15s) + Tài nguyên container (poll 5s) */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (host ? '1fr 1fr' : '1fr'), gap: 16 }}>
        <Card style={{ padding: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2b2543', marginBottom: 14 }}>{t.sysAiHealth}</div>
          {ai ? (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <MiniStat tone="#16a34a" bg="#e8f8ee" value={<AnimatedNumber value={aiOk} />} label={t.sysAiOk} />
                <MiniStat tone="#d97706" bg="#fef3e2" value={<AnimatedNumber value={ai.degradedCount} />} label={t.sysAiDegraded} />
                <MiniStat tone="#dc2626" bg="#fdeaea" value={<AnimatedNumber value={ai.errorCount} />} label={t.sysAiError} />
              </div>
              <div style={{ fontSize: 12, color: '#a59fbb', marginTop: 12 }}>{enabledRoutes} {t.sysAiTasks}</div>
              {!ai.fromDb && (
                <div style={{ fontSize: 12, color: '#d97706', marginTop: 8, background: '#fef8ee', border: '1px solid #f6e2bf', borderRadius: 8, padding: '8px 10px' }}>
                  {t.sysAiFromDbOff}
                </div>
              )}
            </>
          ) : <div style={label}>—</div>}
        </Card>

        {host && (
          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#2b2543' }}>{t.sysHost}</span>
              <span style={{ fontSize: 10.5, color: '#a59fbb' }}>{t.sysHostNote}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {host.cpuLoad != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={label}>{t.sysCpu}</span><span style={val}>{host.cpuLoad}%</span></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={label}>{t.sysMem}</span><span style={val}>{host.memUsedMb} / {host.memMaxMb} MB</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={label}>{t.sysDisk}</span><span style={val}>{host.diskFreeGb} / {host.diskTotalGb} GB</span></div>
            </div>
          </Card>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Hoạt động hệ thống — chỉ số hiện mặc định (readout đổi theo cột đang trỏ) */}
        <SectionCard
          title={t.sysActivity}
          action={
            <div style={{ display: 'flex', gap: 4, background: '#f4f1fb', borderRadius: 10, padding: 3 }}>
              {RANGES.map((r) => (
                <button key={r} onClick={() => changeRange(r)} style={{
                  border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  color: r === range ? '#fff' : '#6b5ca8', background: r === range ? brandGradient : 'transparent',
                }}>{t[`rng${r}` as keyof typeof t] as string}</button>
              ))}
            </div>
          }
        >
          {actLoading ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader /></div>
          ) : !hasActivity ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a59fbb', fontSize: 13.5, fontWeight: 600 }}>
              {t.sysActivityEmpty}
            </div>
          ) : (
            <>
              {/* Hàng chỉ số: đếm tuyệt đối + TỈ LỆ LỖI + THROUGHPUT sparkline (mục 6) */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <MiniStat tone="#6b5ca8" bg="#f4f1fb" value={<AnimatedNumber value={shown ? shown.posts : actSum.posts} />} label={t.sysPosts} />
                <MiniStat tone="#0e7490" bg="#e0f7fb" value={<AnimatedNumber value={shown ? shown.jobs : actSum.jobs} />} label={t.sysJobs} />
                <MiniStat tone="#dc2626" bg="#fde8e8" value={<AnimatedNumber value={shown ? shown.errors : actSum.errors} />} label={t.sysErrors} />
                <MiniStat tone={errRate !== null && errRate > 5 ? '#dc2626' : '#16a34a'} bg={errRate !== null && errRate > 5 ? '#fde8e8' : '#e8f8ee'}
                  value={errRate === null ? '—' : `${errRate.toFixed(1)}%`} label={t.sysErrRate} />
                <div style={{ flex: '1 1 120px', background: '#f4f1fb', borderRadius: 12, padding: '12px 14px', minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, minWidth: 0 }}>
                    <div style={{ flex: 'none' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#6b5ca8', lineHeight: 1 }}>{throughputNow < 10 ? throughputNow.toFixed(1) : Math.round(throughputNow)}</div>
                      <div style={{ fontSize: 12, color: '#6b6580', marginTop: 4, whiteSpace: 'nowrap' }}>{t.sysThroughput}</div>
                    </div>
                    <Sparkline values={throughputSeries} color="#7c3aed" />
                  </div>
                </div>
              </div>

              {/* Hàng đợi job + uptime + sự cố gần nhất + latency percentile (cần API) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginTop: 12, fontSize: 12, color: '#8a85a0' }}>
                <span>
                  {t.sysJobQueue}: <b style={{ color: '#3f3a55' }}>{data.counters.pendingSchedules}</b> {t.sysJobPending}
                  {' · '}{t.sysJobRunning}: <span title={t.sysNeedApi}>—</span>
                  {' · '}<b style={{ color: data.counters.failedLast24h > 0 ? '#dc2626' : '#3f3a55' }}>{data.counters.failedLast24h}</b> {t.sysJobFailed}
                </span>
                <span>{t.sysUptime}: <span title={t.sysNeedApi}>—</span></span>
                {lastIncident && <span>{t.sysLastIncident}: <b style={{ color: '#3f3a55' }}>{lastIncident}</b></span>}
                <span>{t.sysLatencyPct}: <span title={t.sysNeedApi}>— · {t.sysNeedApi}</span></span>
              </div>

              {/* Chú thích màu + ngữ cảnh readout (tổng theo kỳ / thời điểm cột đang trỏ) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, fontSize: 11.5, color: '#8a85a0' }}>
                <Dot color="#7c3aed" label={t.sysActLegendOk} />
                <Dot color="#ec4899" label={t.sysActLegendErr} />
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#6b6580' }}>{shown ? fmtTick(shown.time) : t.sysActInRange}</span>
              </div>
              <div onMouseLeave={() => setHover(null)}
                style={{ display: 'flex', alignItems: 'flex-end', gap: activeBuckets.length > 60 ? 1 : 3, height: 150, marginTop: 14, borderBottom: '1px solid #f1eef8' }}>
                {activeBuckets.map((b, i) => (
                  <div key={i} onMouseEnter={() => setHover(i)}
                    title={`${fmtTick(b.time)} · ${t.sysPosts} ${b.posts} · ${t.sysJobs} ${b.jobs} · ${t.sysErrors} ${b.errors}`}
                    style={{ flex: 1, height: `${(b.total / maxTotal) * 100}%`, minHeight: b.total > 0 ? 3 : 0, borderRadius: 3,
                      background: b.errors > 0 ? 'linear-gradient(#ec4899,#f9a8d4)' : brandGradient,
                      outline: hover === i ? '2px solid rgba(124,58,237,.35)' : 'none', outlineOffset: 1 }} />
                ))}
              </div>
              {/* Trục thời gian trải đều: nhãn ở ~6 mốc, thẳng cột với bucket tương ứng */}
              <div style={{ display: 'flex', gap: activeBuckets.length > 60 ? 1 : 3, marginTop: 8 }}>
                {activeBuckets.map((b, i) => (
                  <span key={i} style={{ flex: 1, fontSize: 10.5, color: '#a59fbb', whiteSpace: 'nowrap', overflow: 'visible' }}>
                    {i % tickEvery === 0 ? fmtTick(b.time) : ''}
                  </span>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        {/* Alerts (gộp dòng trùng ×N + rút gọn, poll 5s) + link sang Logs */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.sysAlerts}</div>
            <button onClick={() => nav('/admin/logs')} style={{ border: 'none', background: 'transparent', color: '#6b5ca8', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{t.sysViewAll} →</button>
          </div>
          {groupedAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '26px 8px', color: '#8a85a0' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e8f8ee', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Icon icon={Check} stroke="#16a34a" />
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.sysNoAlerts}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {groupedAlerts.slice(0, 5).map((a) => {
                const open = alertOpen === a.key;
                return (
                  <div key={a.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
                    <StatusBadge tone={a.tone} label={a.level} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#3f3a55', lineHeight: 1.45, flex: 1, minWidth: 0, ...(open ? { whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }) }} title={open ? undefined : a.message}>
                          {a.message}
                        </div>
                        {a.count > 1 && (
                          <span style={{ flex: 'none', fontSize: 11, fontWeight: 800, color: '#dc2626', background: '#fde8e8', borderRadius: 999, padding: '2px 8px' }}>
                            {t.sysTimes.replace('{n}', String(a.count))}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 3, display: 'flex', gap: 10 }}>
                        <span>{a.time}</span>
                        {a.message.length > 80 && (
                          <button onClick={() => setAlertOpen(open ? null : a.key)} style={{ border: 'none', background: 'none', padding: 0, fontSize: 11.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}>
                            {open ? t.sysXCollapse : t.sysXDetail}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}

function MiniStat({ tone, bg, value, label }: { tone: string; bg: string; value: ReactNode; label: string }) {
  return (
    <div style={{ flex: '1 1 80px', background: bg, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: tone, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b6580', marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** Sparkline SVG thuần (không thư viện) — throughput theo bucket. Vẽ theo viewBox và
 *  co giãn theo chỗ còn lại trong tile (min 0, max `width`) để không tràn ra ngoài
 *  card khi màn hình hẹp; stroke giữ độ dày nhờ non-scaling-stroke. */
function Sparkline({ values, color, width = 110, height = 34 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 0.001);
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - (v / max) * (height - 3) - 1}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" height={height}
      style={{ flex: '1 1 40px', minWidth: 0, maxWidth: width, marginLeft: 'auto' }} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Chấm tròn chú thích màu (cùng pattern dot của StatusBadge).
function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: 'none' }} />
      {label}
    </span>
  );
}

// CẦN API BACKEND BỔ SUNG (mục 6 — hiển thị "—" kèm tooltip trong UI):
// 1. Latency p50/p95/p99: /admin/system/activity (hoặc endpoint mới) cần trả percentile
//    thay vì chỉ trung bình per-service.
// 2. Số job ĐANG CHẠY: /admin/system mới có pendingSchedules + failedLast24h.
// 3. Uptime + thời điểm khởi động: /admin/system cần trả uptimeSeconds.
// 4. SSE/WebSocket đẩy realtime thay polling (hiện dùng polling 5s/15s + backoff).
