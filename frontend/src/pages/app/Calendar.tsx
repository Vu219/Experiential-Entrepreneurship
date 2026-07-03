import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { Card, PlatformTag } from '../../components/ui.tsx';
import { calendarDays, weekdays, upcoming } from '../../data.ts';

export default function Calendar() {
  const { t, lang, go, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const days = calendarDays();
  const wd = weekdays(lang);
  const up = upcoming(lang);
  const stacked = isMobile || isTablet;

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.5fr 1fr', gap: 20, alignItems: 'start' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: '#211c38' }}>{t.calMonth}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={navBtn}>‹</span>
              <span style={navBtn}>›</span>
            </div>
          </div>
          <button onClick={() => go('create')} style={{ border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.calNew}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 8 }}>
          {wd.map((w, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#a59fbb' }}>{w}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
          {days.map((d, i) => (
            <div
              key={i}
              style={{
                minHeight: isMobile ? 48 : 62,
                borderRadius: 11,
                padding: isMobile ? '5px 6px' : '7px 8px',
                border: `1px solid ${d.today ? '#c4b5fd' : '#f1eef8'}`,
                background: d.today ? '#f6f1ff' : '#fcfbfe',
                opacity: d.muted ? 0.38 : 1,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700, color: d.today ? '#7c3aed' : '#3f3a55' }}>{d.day}</span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 5 }}>
                {d.dots.map((bg, j) => (
                  <span key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: bg }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.calUpcoming}</div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#16a34a', background: '#e8f8ee', borderRadius: 999, padding: '4px 10px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
            {t.calAuto}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {up.map((u, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, border: '1px solid #efeaf8', borderRadius: 14, padding: 13, background: '#fcfbfe' }}>
              <div style={{ textAlign: 'center', flex: 'none', width: 50 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#211c38' }}>{u.time}</div>
                <div style={{ fontSize: 10.5, color: '#a59fbb' }}>{u.date}</div>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: '#efeaf8' }} />
              <PlatformTag tag={u.tag} bg={u.bg} size={30} radius={8} fontSize={11} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2b2543', lineHeight: 1.35 }}>{u.title}</div>
                <div style={{ fontSize: 11, color: '#a59fbb', marginTop: 2 }}>{u.platform}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const navBtn = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: '1px solid #ece8f6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#8a85a0',
  cursor: 'pointer',
} as const;
