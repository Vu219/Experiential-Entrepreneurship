import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Loader, Icon } from '../../components/ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import StatusBadge, { type Tone } from '../../components/admin/StatusBadge';
import { getSystemStatus, type SystemStatus as SystemStatusData, type ServiceStatus } from '../../api/admin';

export default function SystemStatus() {
  const { t, lang, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [data, setData] = useState<SystemStatusData | null>(null);

  const fetchStatus = () => {
    setLoad('loading');
    getSystemStatus(lang).then((d) => { setData(d); setLoad('ok'); }).catch(() => setLoad('error'));
  };
  useEffect(fetchStatus, [lang]);

  const svcMeta = (s: ServiceStatus): { tone: Tone; label: string } =>
    s === 'operational' ? { tone: 'success', label: t.svcOperational }
    : s === 'degraded' ? { tone: 'warning', label: t.svcDegraded }
    : { tone: 'danger', label: t.svcDown };

  if (load === 'loading') return <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}><Card><Loader label={t.listLoading} /></Card></div>;
  if (load === 'error' || !data) return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670', marginBottom: 14 }}>{t.listError}</div>
        <button onClick={fetchStatus} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </Card>
    </div>
  );

  const maxLoad = Math.max(...data.load, 1);

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Service cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 16 }}>
        {data.services.map((svc, i) => {
          const m = svcMeta(svc.status);
          return (
            <Card key={i} style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#2b2543' }}>{svc.name}</span>
                <StatusBadge tone={m.tone} label={m.label} />
              </div>
              <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 10 }}>{t.sysUptime}: <b style={{ color: '#3f3a55' }}>{svc.uptime}</b></div>
            </Card>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Load chart */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 18 }}>{t.sysLoad}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
            {data.load.map((v, i) => (
              <div key={i} title={`${v}%`} style={{ flex: 1, height: `${(v / maxLoad) * 100}%`, borderRadius: 4, background: v > 80 ? 'linear-gradient(#ec4899,#f9a8d4)' : brandGradient, minHeight: 4 }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#a59fbb' }}>
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
          </div>
        </Card>

        {/* Alerts */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 16 }}>{t.sysAlerts}</div>
          {data.alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '26px 8px', color: '#8a85a0' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e8f8ee', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Icon icon={Check} stroke="#16a34a" />
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.sysNoAlerts}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.alerts.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <StatusBadge tone={a.tone} label={a.level} />
                  <div>
                    <div style={{ fontSize: 13, color: '#3f3a55', lineHeight: 1.45 }}>{a.message}</div>
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
