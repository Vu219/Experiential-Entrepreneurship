import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card, Loader, Icon } from '../../components/ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import StatusBadge, { type Tone } from '../../components/admin/StatusBadge';
import {
  getSystemStatus, getSystemActivity,
  type SystemStatus as SystemStatusData, type ServiceStatus, type SvcHealth,
  type SystemActivity, type ActivityRange,
} from '../../api/admin';
import { getAiStatus, type AiEffectiveStatus } from '../../api/adminAi';

const RANGES: ActivityRange[] = ['1h', '24h', '7d', '30d', '1y'];

export default function SystemStatus() {
  const { t, lang, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const nav = useNavigate();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [data, setData] = useState<SystemStatusData | null>(null);
  const [ai, setAi] = useState<AiEffectiveStatus | null>(null);
  const [range, setRange] = useState<ActivityRange>('24h');
  const [activity, setActivity] = useState<SystemActivity | null>(null);
  const [actLoading, setActLoading] = useState(true);

  const fetchStatus = () => {
    setLoad('loading');
    Promise.all([getSystemStatus(lang), getAiStatus().catch(() => null)])
      .then(([s, a]) => { setData(s); setAi(a); setLoad('ok'); })
      .catch(() => setLoad('error'));
  };
  useEffect(fetchStatus, [lang]);

  useEffect(() => {
    setActLoading(true);
    getSystemActivity(range).then(setActivity).catch(() => setActivity(null)).finally(() => setActLoading(false));
  }, [range]);

  if (load === 'loading') return <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}><Card><Loader label={t.listLoading} /></Card></div>;
  if (load === 'error' || !data) return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670', marginBottom: 14 }}>{t.listError}</div>
        <button onClick={fetchStatus} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </Card>
    </div>
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

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Service cards + chỉ số thật */}
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

      {/* Sức khỏe cấu hình AI + Tài nguyên container */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (host ? '1fr 1fr' : '1fr'), gap: 16 }}>
        <Card style={{ padding: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2b2543', marginBottom: 14 }}>{t.sysAiHealth}</div>
          {ai ? (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <MiniStat tone="#16a34a" bg="#e8f8ee" value={aiOk} label={t.sysAiOk} />
                <MiniStat tone="#d97706" bg="#fef3e2" value={ai.degradedCount} label={t.sysAiDegraded} />
                <MiniStat tone="#dc2626" bg="#fdeaea" value={ai.errorCount} label={t.sysAiError} />
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
        {/* Activity chart + range selector */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.sysActivity}</div>
              <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 2 }}>{t.sysActivitySub}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: '#f4f1fb', borderRadius: 10, padding: 3 }}>
              {RANGES.map((r) => (
                <button key={r} onClick={() => setRange(r)} style={{
                  border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  color: r === range ? '#fff' : '#6b5ca8', background: r === range ? brandGradient : 'transparent',
                }}>{t[`rng${r}` as keyof typeof t] as string}</button>
              ))}
            </div>
          </div>

          {actLoading ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader /></div>
          ) : !hasActivity ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a59fbb', fontSize: 13.5, fontWeight: 600 }}>
              {t.sysActivityEmpty}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: activeBuckets.length > 60 ? 1 : 3, height: 160, marginTop: 14 }}>
                {activeBuckets.map((b, i) => (
                  <div key={i} title={`${fmtTick(b.time)} · ${t.sysPosts} ${b.posts} · ${t.sysJobs} ${b.jobs} · ${t.sysErrors} ${b.errors}`}
                    style={{ flex: 1, height: `${(b.total / maxTotal) * 100}%`, minHeight: b.total > 0 ? 3 : 0, borderRadius: 3, background: b.errors > 0 ? 'linear-gradient(#ec4899,#f9a8d4)' : brandGradient }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#a59fbb' }}>
                <span>{fmtTick(activeBuckets[0].time)}</span>
                <span>{fmtTick(activeBuckets[activeBuckets.length - 1].time)}</span>
              </div>
            </>
          )}
        </Card>

        {/* Alerts (gọn top-5) + link sang Logs */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.sysAlerts}</div>
            <button onClick={() => nav('/admin/logs')} style={{ border: 'none', background: 'transparent', color: '#6b5ca8', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{t.sysViewAll} →</button>
          </div>
          {data.alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '26px 8px', color: '#8a85a0' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e8f8ee', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Icon icon={Check} stroke="#16a34a" />
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.sysNoAlerts}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.alerts.slice(0, 5).map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
                  <StatusBadge tone={a.tone} label={a.level} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#3f3a55', lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.message}>{a.message}</div>
                    <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 3 }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ tone, bg, value, label }: { tone: string; bg: string; value: number; label: string }) {
  return (
    <div style={{ flex: '1 1 80px', background: bg, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: tone, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b6580', marginTop: 4 }}>{label}</div>
    </div>
  );
}
