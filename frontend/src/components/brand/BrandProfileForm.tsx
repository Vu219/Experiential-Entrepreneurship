import { useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, Icon } from '../ui';
import { brandToneLabels, industryOptions, audienceSampleOptions, TIME_SLOT_OPTIONS } from '../../data';
import { createBrandProfile, updateBrandProfile, type BrandProfile, type BrandProfileInput, type Platform, type PostingFrequency } from '../../api/brandProfile';
import { validateBrandProfile, type BrandFormErrors } from '../../validations/brandValidation';
import type { Dict } from '../../i18n';
import AiBrandPanel from './AiBrandPanel';
import { brandHealth } from './brandHealth';
import { Field, ChipMultiSelect, TagInput, PlatformSelect, LogoUploader, fieldInput } from './chips';

const splitTags = (s: string | null): string[] => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

const FREQ_OPTIONS: [PostingFrequency, keyof Dict][] = [
  ['DAILY', 'freqDaily'],
  ['WEEKLY', 'freqWeekly'],
  ['BIWEEKLY', 'freqBiweekly'],
  ['MONTHLY', 'freqMonthly'],
];

export default function BrandProfileForm({ profile, onClose, onSaved }: { profile: BrandProfile | null; onClose: () => void; onSaved: (p: BrandProfile, created: boolean) => void }) {
  const { t, lang, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const tones = brandToneLabels(lang);
  const industries = industryOptions(lang);

  const [name, setName] = useState(profile?.brandName ?? '');
  const [industry, setIndustry] = useState(profile?.industry ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(profile?.logoUrl ?? null);
  const [voiceTones, setVoiceTones] = useState<string[]>(splitTags(profile?.brandVoice ?? null));
  const [audiences, setAudiences] = useState<string[]>(splitTags(profile?.targetAudience ?? null));
  const [keywords, setKeywords] = useState<string[]>(profile?.brandKeywords ?? []);
  const [dos, setDos] = useState<string[]>(profile?.brandDos ?? []);
  const [donts, setDonts] = useState<string[]>(profile?.brandDonts ?? []);
  const [platforms, setPlatforms] = useState<Platform[]>(profile?.platforms ?? []);
  const [frequency, setFrequency] = useState<PostingFrequency>(profile?.postingFrequency ?? 'WEEKLY');
  const [times, setTimes] = useState<string[]>(profile?.preferredTimes ?? []);
  const [errors, setErrors] = useState<BrandFormErrors>({});
  const [saving, setSaving] = useState<'full' | 'draft' | null>(null);
  const [apiError, setApiError] = useState('');

  const targetAudience = audiences.join(', ');
  const health = useMemo(
    () => brandHealth({ brandName: name, industry, targetAudience, description, brandVoice: voiceTones.join(', '), platforms }),
    [name, industry, targetAudience, description, voiceTones, platforms],
  );

  const buildPayload = (): BrandProfileInput => ({
    brandName: name.trim(),
    industry: industry.trim(),
    description: description.trim() || undefined,
    brandVoice: voiceTones.join(', ') || undefined,
    targetAudience: targetAudience.trim(),
    platforms,
    postingFrequency: frequency,
    preferredTimes: times,
    logoUrl, // mock: base64/data URL. TODO(backend): upload lên storage thật.
    brandKeywords: keywords,
    brandDos: dos,
    brandDonts: donts,
  });

  const persist = async (payload: BrandProfileInput, kind: 'full' | 'draft') => {
    setSaving(kind);
    setApiError('');
    try {
      const saved = profile ? await updateBrandProfile(profile.id, payload) : await createBrandProfile(payload);
      onSaved(saved, !profile);
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  // "Lưu hồ sơ thương hiệu" — validate đầy đủ FR-09.
  const submit = () => {
    const errs = validateBrandProfile({ brandName: name, industry, targetAudience, platforms });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    persist(buildPayload(), 'full');
  };

  // "Lưu nháp" — lưu tạm, KHÔNG bắt buộc FR-09 (chỉ cần có tên để nhận diện).
  const saveDraft = () => {
    if (!name.trim()) { setErrors({ brandName: 'errBrandNameReq' }); return; }
    setErrors({});
    persist(buildPayload(), 'draft');
  };

  const err = (k: keyof BrandFormErrors) => (errors[k] ? t[errors[k] as keyof Dict] : undefined);
  const busy = saving !== null;

  return (
    <div className="view-pop" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={backBtn}><Icon path="M15 6l-6 6 6 6" size={18} stroke="#5b5670" />{t.bpBack}</button>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: '#211c38' }}>{profile ? t.bpfEdit : t.bpfNew}</div>
      </div>

      {apiError && <div style={{ fontSize: 12.5, color: '#e23d6e', background: '#fdeef2', border: '1px solid #f3c9d6', borderRadius: 10, padding: '10px 13px' }}>{apiError}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Cột chính — form chia 3 cụm có tiêu đề */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cụm 1 — Thông tin thương hiệu: logo trái / tên+ngành phải / mô tả dưới */}
          <Section title={t.bpSecInfo}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 18, alignItems: isMobile ? 'center' : 'flex-start' }}>
              <Field label={t.bpfLogo}>
                <LogoUploader logoUrl={logoUrl} brandName={name} onChange={setLogoUrl} />
              </Field>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, width: isMobile ? '100%' : undefined }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  <Field label={t.bpfName} required error={err('brandName')}>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.bpfNamePh} style={fieldInput} />
                  </Field>
                  <Field label={t.bpfIndustry} required error={err('industry')}>
                    <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ ...fieldInput, cursor: 'pointer' }}>
                      <option value="">{t.bpfIndustry}…</option>
                      {industries.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label={t.bpfDesc}>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t.bpfDescPh} rows={4} style={{ ...fieldInput, resize: 'vertical' }} />
                </Field>
              </div>
            </div>
          </Section>

          {/* Cụm 2 — Định vị thương hiệu */}
          <Section title={t.bpSecPosition}>
            <Field label={t.bpfTone}>
              <ChipMultiSelect options={tones} value={voiceTones} onChange={setVoiceTones} />
            </Field>
            <Field label={t.bpfAudience} required error={err('targetAudience')}>
              <TagInput value={audiences} onChange={setAudiences} addLabel={t.csAddAudience} placeholder={t.bpfAudienceAdd} suggestions={audienceSampleOptions(lang)} />
            </Field>
            <Field label={t.bpKeywords}>
              <TagInput value={keywords} onChange={setKeywords} addLabel={t.bpAddKeyword} />
            </Field>
            <Field label={t.bpDoDont}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginBottom: 7 }}>{t.bpDo}</div>
                  <TagInput value={dos} onChange={setDos} addLabel={t.bpDo} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 7 }}>{t.bpDont}</div>
                  <TagInput value={donts} onChange={setDonts} addLabel={t.bpDont} />
                </div>
              </div>
            </Field>
          </Section>

          {/* Cụm 3 — Lịch & Kênh đăng */}
          <Section title={t.bpSecSchedule}>
            <Field label={t.bpfPlatforms} required error={err('platforms')}>
              <PlatformSelect value={platforms} onChange={setPlatforms} />
            </Field>
            <Field label={t.bpfFreq}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {FREQ_OPTIONS.map(([val, key]) => {
                  const on = frequency === val;
                  return (
                    <span key={val} onClick={() => setFrequency(val)} style={{ border: `1.5px solid ${on ? 'transparent' : '#ece8f6'}`, borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: on ? brandGradient : '#fff', color: on ? '#fff' : '#3f3a55' }}>{t[key]}</span>
                  );
                })}
              </div>
            </Field>
            <Field label={t.bpfTimes}>
              <ChipMultiSelect options={TIME_SLOT_OPTIONS} value={times} onChange={setTimes} />
            </Field>
          </Section>

          {/* Nút lưu — gọn trên 1 hàng, không full-width */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 2 }}>
            <button onClick={submit} disabled={busy} style={{ border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1 }}>{saving === 'full' ? t.processing : t.bpfSave}</button>
            <button onClick={saveDraft} disabled={busy} style={{ border: '1.5px solid #d6cdf0', background: '#faf8ff', borderRadius: 12, padding: '12px 22px', fontSize: 14, fontWeight: 700, color: '#7c5cff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1 }}>{saving === 'draft' ? t.processing : t.bpSaveDraft}</button>
            <button onClick={onClose} disabled={busy} style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '12px 22px', fontSize: 14, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.cancel}</button>
          </div>
        </div>

        {/* Cột phải — panel AI preview theo dữ liệu đang nhập (health + cần bổ sung + keywords + do/don't) */}
        <div style={{ position: isMobile ? 'static' : 'sticky', top: 90 }}>
          <AiBrandPanel percent={health.percent} missing={health.missing} keywords={keywords} dos={dos} donts={donts} sticky={false} />
        </div>
      </div>
    </div>
  );
}

const backBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 13.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' } as const;

/** Một cụm form: card có tiêu đề rõ ràng. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: '#211c38', borderBottom: '1px solid #f1eef8', paddingBottom: 12 }}>{title}</div>
      {children}
    </Card>
  );
}
