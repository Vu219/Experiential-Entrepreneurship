import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import StatCard from '../../components/admin/StatCard';
import SectionCard from '../../components/admin/SectionCard';
import StatusBadge from '../../components/admin/StatusBadge';
import { DataTable } from '../../components/admin/AdminListPage';
import { adminStats, adminUsers, planDist, health } from '../../data';

// Dữ liệu vẫn là MOCK (data.ts) — đợt này chỉ đồng bộ UI về bộ component quản trị
// dùng chung (StatCard / SectionCard / DataTable / StatusBadge), chưa nối API thật.
export default function Overview() {
  const { t, lang, go, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const sCards = adminStats(lang);
  const users = adminUsers(lang);
  const hl = health(lang);
  const stacked = isMobile || isTablet;

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 18 }}>
        {sCards.map((s, i) => (
          <StatCard key={i} icon={s.icon} iconBg={s.bg} iconColor={s.color} value={s.value} label={s.label} pill={s.trend} pillTone="success" />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.7fr 1fr', gap: 20, alignItems: 'start' }}>
        <SectionCard
          flush
          title={t.adRecent}
          action={
            <span onClick={() => go('adminUsers')} style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6', cursor: 'pointer' }}>
              {t.viewAll}
            </span>
          }
        >
          <DataTable head={[t.colName, t.colPlan, t.colStatus, t.colPosts, t.colJoined]} minWidth={560}>
            {users.map((u, i) => (
              <tr key={i} style={{ borderTop: '1px solid #f1eef8' }}>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 32, height: 32, flex: 'none', borderRadius: '50%', background: brandGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{u.initials}</span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#2b2543' }}>{u.name}</div>
                      <div style={{ fontSize: 11.5, color: '#a59fbb' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '13px 16px' }}><StatusBadge tone={u.planTone} label={u.plan} /></td>
                <td style={{ padding: '13px 16px' }}><StatusBadge tone={u.statusTone} label={u.status} /></td>
                <td style={{ padding: '13px 16px', fontSize: 13.5, fontWeight: 600, color: '#2b2543' }}>{u.posts}</td>
                <td style={{ padding: '13px 16px', fontSize: 13, color: '#8a85a0' }}>{u.joined}</td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionCard title={t.adPlanDist}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {planDist.map((p, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#3f3a55' }}>{p.plan}</span>
                    <span style={{ fontSize: 13, color: '#8a85a0' }}>{p.count} · {p.pct}</span>
                  </div>
                  <div style={{ height: 9, borderRadius: 99, background: '#f1eef9', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, width: p.pct, background: p.color }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={t.adHealth}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {hl.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13.5, color: '#3f3a55' }}>{h.label}</span>
                  <StatusBadge tone={h.tone} label={h.value} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
