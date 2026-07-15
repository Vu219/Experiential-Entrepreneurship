import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, Icon } from '../ui';
import { brandToneLabels, industryOptions, audienceSampleOptions } from '../../data';
import { createBrandProfile, updateBrandProfile, listAllBrandProfiles, type BrandProfile, type BrandProfileInput, type Platform } from '../../api/brandProfile';
import { validateBrandProfile, type BrandFormErrors } from '../../validations/brandValidation';
import type { Dict } from '../../i18n';
import AiBrandPanel from './AiBrandPanel';
import { brandHealth } from './brandHealth';
import { Field, ChipMultiSelect, ComboInput, TagInput, PlatformSelect, LogoUploader, fieldInput } from './chips';
import { useToast } from '../toast/ToastProvider';

const splitTags = (s: string | null): string[] => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export default function BrandProfileForm({ profile, onClose, onSaved }: { profile: BrandProfile | null; onClose: () => void; onSaved: (p: BrandProfile, created: boolean) => void }) {
  const { t, lang, brandGradient } = useApp();
  // 4 mốc responsive: mobile <640 (field xếp dọc), mobile+tablet <1024 (panel AI xuống dưới thay vì 2 cột).
  const { width } = useBreakpoint();
  const isMobile = width < 640;
  const stack = width < 1024;
  const tones = brandToneLabels(lang);
  // Ngành hàng là COMBOBOX (chọn gợi ý HOẶC gõ tự do) — bỏ option "Khác" vì gõ tự do đã thay nó.
  const industries = industryOptions(lang).filter((o) => o !== 'Khác' && o !== 'Other');
  // Gợi ý thêm từ ngành hàng của các hồ sơ ĐÃ LƯU (giá trị user từng nhập) — tránh phân mảnh
  // dữ liệu kiểu "F&B" vs "Ẩm thực": người dùng thấy lại đúng chữ mình đã dùng để chọn lại.
  const [savedIndustries, setSavedIndustries] = useState<string[]>([]);
  useEffect(() => {
    listAllBrandProfiles()
      .then((all) => setSavedIndustries(all.map((p) => p.industry).filter(Boolean)))
      .catch(() => {});
  }, []);
  const industrySuggestions = [...new Set([...industries, ...savedIndustries])];

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
  const [errors, setErrors] = useState<BrandFormErrors>({});
  const [saving, setSaving] = useState<'full' | 'draft' | null>(null);
  const toast = useToast();

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
    logoUrl,
    brandKeywords: keywords,
    brandDos: dos,
    brandDonts: donts,
  });

  const persist = async (payload: BrandProfileInput, kind: 'full' | 'draft') => {
    setSaving(kind);
    try {
      const saved = profile ? await updateBrandProfile(profile.id, payload) : await createBrandProfile(payload);
      toast.success(t.bpSaved);
      onSaved(saved, !profile);
    } catch (err) {
      toast.error((err as Error).message);
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
        <button onClick={onClose} className="btn-soft" style={backBtn}><Icon icon={ChevronLeft} size={18} stroke="#5b5670" />{t.bpBack}</button>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 20, color: '#211c38' }}>{profile ? t.bpfEdit : t.bpfNew}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: stack ? '1fr' : 'minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }}>
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
                    <ComboInput value={industry} onChange={setIndustry} suggestions={industrySuggestions} placeholder={t.bpfIndustryPh} />
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#d6336c', marginBottom: 7 }}>{t.bpDont}</div>
                  <TagInput value={donts} onChange={setDonts} addLabel={t.bpDont} />
                </div>
              </div>
            </Field>
          </Section>

          {/* Cụm 3 — Kênh đăng (tần suất & khung giờ đã chuyển sang Chiến lược content) */}
          <Section title={t.bpSecChannels}>
            <Field label={t.bpfPlatforms} required error={err('platforms')}>
              <PlatformSelect value={platforms} onChange={setPlatforms} />
            </Field>
          </Section>

          {/* Nút lưu — gọn trên 1 hàng, không full-width */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 2 }}>
            <button onClick={submit} disabled={busy} className="btn-grad" style={{ border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1 }}>{saving === 'full' ? t.processing : t.bpfSave}</button>
            <button onClick={saveDraft} disabled={busy} className="btn-outline" style={{ border: '1.5px solid #d6cdf0', background: '#faf8ff', borderRadius: 12, padding: '12px 22px', fontSize: 14, fontWeight: 700, color: '#7c5cff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1 }}>{saving === 'draft' ? t.processing : t.bpSaveDraft}</button>
            <button onClick={onClose} disabled={busy} className="btn-soft" style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '12px 22px', fontSize: 14, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.cancel}</button>
          </div>
        </div>

        {/* Cột phải — panel AI preview theo dữ liệu đang nhập (mobile/tablet: xếp xuống dưới form) */}
        <div style={{ position: stack ? 'static' : 'sticky', top: 90 }}>
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
