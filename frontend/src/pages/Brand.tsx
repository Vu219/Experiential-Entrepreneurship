import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Card, PlatformTag } from '../components/ui';
import { brandToneLabels, brandColors, channels } from '../data';
import {
  listBrandProfiles,
  createBrandProfile,
  updateBrandProfile,
  type BrandProfile,
  type Platform,
} from '../api/brandProfile';

const fieldLabel = { display: 'block', fontSize: 12, fontWeight: 700, color: '#574f6e', marginBottom: 7 } as const;
const fieldInput = { width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 11, padding: '12px 14px', fontSize: 14, color: '#241f3a', background: '#fbfaff', outline: 'none' } as const;

export default function Brand() {
  const { t, lang, brand, setBrand, toggleBrandTone, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const tones = brandToneLabels(lang);

  const [current, setCurrent] = useState<BrandProfile | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>(['FACEBOOK', 'INSTAGRAM']);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load the user's primary (first) brand profile and hydrate the form.
  useEffect(() => {
    listBrandProfiles()
      .then((list) => {
        const first = list[0];
        if (!first) return;
        setCurrent(first);
        setPlatforms(first.platforms.length ? first.platforms : ['FACEBOOK']);
        setBrand({
          name: first.brandName,
          industry: first.industry,
          slogan: first.description ?? first.brandVoice ?? '',
          audience: first.targetAudience,
        });
      })
      .catch((err) => setError((err as Error).message || t.brLoadErr));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const chans = channels(lang, platforms);

  const save = async () => {
    setError('');
    setSaving(true);
    const voice = brand.toneIdx.map((i) => tones[i]).filter(Boolean).join(', ');
    const payload = {
      brandName: brand.name,
      industry: brand.industry,
      description: brand.slogan,
      brandVoice: voice,
      targetAudience: brand.audience,
      platforms: platforms.length ? platforms : (['FACEBOOK'] as Platform[]),
      postingFrequency: current?.postingFrequency ?? 'WEEKLY',
      preferredTimes: current?.preferredTimes?.length ? current.preferredTimes : ['08:00-09:00'],
    };
    try {
      const result = current ? await updateBrandProfile(current.id, payload) : await createBrandProfile(payload);
      setCurrent(result);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const chip = (active: boolean) => ({
    border: `1.5px solid ${active ? 'transparent' : '#ece8f6'}`,
    borderRadius: 10,
    padding: '7px 13px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? brandGradient : '#fff',
    color: active ? '#fff' : '#3f3a55',
  });

  return (
    <div className="view-pop" style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 22 }}>{(brand.name || 'A')[0]}</div>
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: '#211c38' }}>{brand.name}</div>
            <div style={{ fontSize: 13, color: '#8a85a0' }}>{t.pageSubBrand}</div>
          </div>
        </div>

        {error && <div style={{ fontSize: 12.5, color: '#e23d6e', background: '#fdeef2', border: '1px solid #f3c9d6', borderRadius: 10, padding: '10px 13px', marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 18 }}>
          <div>
            <label style={fieldLabel}>{t.brName}</label>
            <input value={brand.name} onChange={(e) => setBrand({ name: e.target.value })} style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>{t.brIndustry}</label>
            <input value={brand.industry} onChange={(e) => setBrand({ industry: e.target.value })} style={fieldInput} />
          </div>
          <div style={{ gridColumn: isMobile ? 'auto' : '1 / 3' }}>
            <label style={fieldLabel}>{t.brSlogan}</label>
            <input value={brand.slogan} onChange={(e) => setBrand({ slogan: e.target.value })} style={fieldInput} />
          </div>
          <div style={{ gridColumn: isMobile ? 'auto' : '1 / 3' }}>
            <label style={fieldLabel}>{t.brAudience}</label>
            <input value={brand.audience} onChange={(e) => setBrand({ audience: e.target.value })} style={fieldInput} />
          </div>
        </div>

        <label style={{ ...fieldLabel, margin: '20px 0 9px' }}>{t.brToneT}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tones.map((label, i) => (
            <span key={i} onClick={() => toggleBrandTone(i)} style={chip(brand.toneIdx.includes(i))}>{label}</span>
          ))}
        </div>

        <label style={{ ...fieldLabel, margin: '20px 0 9px' }}>{t.brColors}</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {brandColors.map((c, i) => (
            <span key={i} style={{ width: 40, height: 40, borderRadius: 11, background: c, boxShadow: `0 6px 14px -6px ${c}` }} />
          ))}
        </div>

        <button onClick={save} disabled={saving} style={{ marginTop: 24, border: 'none', borderRadius: 12, padding: '13px 26px', fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.75 : 1 }}>{saving ? t.processing : saved ? t.saved : t.save}</button>
      </Card>

      <Card style={{ padding: 26 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 16 }}>{t.brChannels}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {chans.map((c, i) => (
            <div key={i} onClick={() => togglePlatform(c.platform)} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #efeaf8', borderRadius: 13, padding: 13, cursor: 'pointer' }}>
              <PlatformTag tag={c.tag} bg={c.bg} size={34} radius={9} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#2b2543' }}>{c.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: c.on ? '#16a34a' : '#94a3b8', background: c.on ? '#e8f8ee' : '#eef2f7', padding: '5px 12px', borderRadius: 999 }}>{c.pillText}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
