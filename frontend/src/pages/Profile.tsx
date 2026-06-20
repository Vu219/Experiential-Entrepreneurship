import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../auth/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Card } from '../components/ui';
import { updateProfile } from '../api/auth';
import { activity } from '../data';

const fieldLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: '#574f6e', marginBottom: 7 } as const;
const fieldInput = { width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 11, padding: '12px 14px', fontSize: 14, color: '#241f3a', background: '#fbfaff', outline: 'none' } as const;

export default function Profile() {
  const { t, lang, logout, brandGradient } = useApp();
  const { user, setUser } = useAuth();
  const { isMobile, isTablet } = useBreakpoint();
  const acts = activity(lang);
  const stacked = isMobile || isTablet;

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const name = fullName || user?.fullName || 'AIMA User';
  const email = user?.email ?? '';
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(-2).join('').toUpperCase();

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const updated = await updateProfile({ fullName, phone, dateOfBirth });
      setUser(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="view-pop" style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1fr 1.4fr', gap: 20, alignItems: 'start' }}>
      {/* Identity card */}
      <Card style={{ padding: 26, textAlign: 'center' }}>
        <div style={{ width: 90, height: 90, borderRadius: '50%', margin: '0 auto 14px', background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 32, boxShadow: '0 16px 30px -14px rgba(139,92,246,.7)' }}>{initials}</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: '#211c38' }}>{name}</div>
        <div style={{ fontSize: 13, color: '#8a85a0', marginTop: 2 }}>{email}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f3edff', borderRadius: 999, padding: '5px 13px' }}>★ {t.userPlan}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {[['142', t.stPosts], ['248K', t.stTotalReach]].map(([v, l], i) => (
            <div key={i} style={{ flex: 1, border: '1px solid #efeaf8', borderRadius: 13, padding: 13 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: '#211c38' }}>{v}</div>
              <div style={{ fontSize: 11, color: '#a59fbb' }}>{l}</div>
            </div>
          ))}
        </div>
        <button onClick={logout} style={{ width: '100%', marginTop: 18, border: '1.5px solid #f3c9d6', background: '#fff', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13.5, color: '#e23d6e', cursor: 'pointer' }}>{t.signOut}</button>
      </Card>

      {/* Edit + activity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card style={{ padding: 26 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 18 }}>{t.prEdit}</div>
          {error && <div style={{ fontSize: 12.5, color: '#e23d6e', background: '#fdeef2', border: '1px solid #f3c9d6', borderRadius: 10, padding: '10px 13px', marginBottom: 14 }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <div>
              <label style={fieldLabel}>{t.lName}</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={fieldInput} />
            </div>
            <div>
              <label style={fieldLabel}>EMAIL</label>
              <input value={email} disabled style={{ ...fieldInput, color: '#8a85a0', cursor: 'not-allowed' }} />
            </div>
            <div>
              <label style={fieldLabel}>{t.prPhone}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0901234567" style={fieldInput} />
            </div>
            <div>
              <label style={fieldLabel}>{t.prDob}</label>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} max={new Date().toISOString().split('T')[0]} style={fieldInput} />
            </div>
          </div>
          <button onClick={save} disabled={saving} style={{ marginTop: 18, border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.75 : 1 }}>{saving ? t.processing : saved ? t.saved : t.save}</button>
        </Card>

        <Card style={{ padding: 26 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 18 }}>{t.prActivity}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {acts.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: a.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{a.tag}</span>
                <span style={{ flex: 1, fontSize: 13.5, color: '#3f3a55' }}>{a.text}</span>
                <span style={{ fontSize: 12, color: '#a59fbb' }}>{a.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
