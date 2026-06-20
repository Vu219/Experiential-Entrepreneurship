import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Card, PlatformTag } from '../components/ui';
import { channels, notifLabels, themeOptions } from '../data';

export default function Settings() {
  const { t, lang, setLang, theme, setTheme, notif, toggleNotif, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const chans = channels(lang);
  const notifs = notifLabels(lang);
  const themes = themeOptions(lang);

  const langBtn = (active: boolean) => ({
    flex: 1,
    border: `1.5px solid ${active ? '#8b5cf6' : '#ece8f6'}`,
    borderRadius: 11,
    padding: 11,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    background: active ? '#faf6ff' : '#fff',
    color: active ? '#7c3aed' : '#3f3a55',
  });

  return (
    <div className="view-pop" style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card style={{ padding: 26 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.seAccounts}</div>
        <div style={{ fontSize: 12.5, color: '#8a85a0', marginBottom: 18 }}>{t.seAccountsSub}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {chans.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #efeaf8', borderRadius: 13, padding: 13 }}>
              <PlatformTag tag={c.tag} bg={c.bg} size={34} radius={9} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#2b2543' }}>{c.name}</span>
              <button
                style={
                  c.on
                    ? { border: '1.5px solid #cdeed8', background: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, color: '#16a34a', cursor: 'pointer' }
                    : { border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 12.5, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }
                }
              >
                {c.btnText}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <Card style={{ padding: 26 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 16 }}>{t.seNotif}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {notifs.map((label, i) => {
              const on = notif[i];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13.5, color: '#3f3a55', flex: 1 }}>{label}</span>
                  <span
                    onClick={() => toggleNotif(i)}
                    style={{
                      width: 42,
                      height: 24,
                      borderRadius: 99,
                      flex: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0 3px',
                      cursor: 'pointer',
                      transition: 'background .15s',
                      background: on ? brandGradient : '#dcd7ea',
                      justifyContent: on ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{ padding: 26 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 16 }}>{t.seLang}</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
            <button onClick={() => setLang('vi')} style={langBtn(lang === 'vi')}>🇻🇳 Tiếng Việt</button>
            <button onClick={() => setLang('en')} style={langBtn(lang === 'en')}>🇬🇧 English</button>
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 4 }}>{t.seTheme}</div>
          <div style={{ fontSize: 12, color: '#8a85a0', marginBottom: 14 }}>{t.seThemeSub}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {themes.map((th) => {
              const active = theme === th.key;
              return (
                <div key={th.key} onClick={() => setTheme(th.key)} style={{ flex: 1, border: `2px solid ${active ? '#8b5cf6' : '#ece8f6'}`, borderRadius: 13, padding: 10, cursor: 'pointer', background: active ? '#faf6ff' : '#fff' }}>
                  <span style={{ display: 'block', height: 38, borderRadius: 9, background: th.grad }} />
                  <span style={{ display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#3f3a55', marginTop: 8 }}>{th.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
