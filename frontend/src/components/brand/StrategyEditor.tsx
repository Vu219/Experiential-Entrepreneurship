import { useState, type ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { strategyGoalOptions, contentTypeOptions, contentStyleOptions, ctaSampleOptions, audienceSampleOptions, TIME_SLOT_OPTIONS, FREQUENCY_UNIT_OPTIONS } from '../../data';
import { createContentStrategy, updateContentStrategy, type ContentStrategy, type ContentStrategyInput, type Platform, type FrequencyUnit } from '../../api/contentStrategy';
import { validateStrategy, type StrategyFormErrors } from '../../validations/brandValidation';
import type { Dict } from '../../i18n';
import StrategySummary from './StrategySummary';
import { Field, ChipMultiSelect, TagInput, PlatformSelect, fieldInput } from './chips';

/** Form Tạo/Sửa chiến lược (panel phải) — 8 mục thuộc tính + tóm tắt sống + nút lưu/hủy/xóa. */
export default function StrategyEditor({ strategy, brandId, brandName, onCancel, onSaved, onDelete }: {
  strategy: ContentStrategy | null;
  brandId: string;
  brandName: string;
  onCancel: () => void;
  onSaved: (s: ContentStrategy, created: boolean) => void;
  onDelete?: () => void;
}) {
  const { t, lang } = useApp();
  const [name, setName] = useState(strategy?.name ?? '');
  const [goals, setGoals] = useState<string[]>(strategy?.goals ?? []);
  const [contentTypes, setContentTypes] = useState<string[]>(strategy?.contentTypes ?? []);
  const [frequencyCount, setFrequencyCount] = useState<number>(strategy?.frequencyCount ?? 3);
  const [frequencyUnit, setFrequencyUnit] = useState<FrequencyUnit>(strategy?.frequencyUnit ?? 'WEEK');
  const [platforms, setPlatforms] = useState<Platform[]>(strategy?.platforms ?? ['FACEBOOK', 'INSTAGRAM']);
  const [timeSlots, setTimeSlots] = useState<string[]>(strategy?.timeSlots ?? []);
  const [audiences, setAudiences] = useState<string[]>(strategy?.audiences ?? []);
  const [styles, setStyles] = useState<string[]>(strategy?.styles ?? []);
  const [ctas, setCtas] = useState<string[]>(strategy?.ctas ?? []);
  const [errors, setErrors] = useState<StrategyFormErrors>({});
  const [saving, setSaving] = useState<'full' | 'draft' | null>(null);
  const [apiError, setApiError] = useState('');

  const summaryLike = { goals, frequencyCount, frequencyUnit, platforms, audiences, styles, ctas };

  const persist = async (status: ContentStrategy['status'], kind: 'full' | 'draft') => {
    const payload: ContentStrategyInput = {
      brandId,
      name: name.trim(),
      status,
      goals, contentTypes, frequencyCount, frequencyUnit, platforms, timeSlots, audiences, styles, ctas,
    };
    setSaving(kind);
    setApiError('');
    try {
      const saved = strategy ? await updateContentStrategy(strategy.id, payload) : await createContentStrategy(payload);
      onSaved(saved, !strategy);
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  // Lưu chính — validate đầy đủ FR-13; giữ status hiện tại, tạo mới mặc định Nháp.
  const submit = () => {
    const errs = validateStrategy({ name, goals, contentTypes, platforms });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    persist(strategy?.status ?? 'DRAFT', 'full');
  };

  // Lưu nháp — chỉ cần tên để nhận diện; luôn lưu ở trạng thái Nháp.
  const saveDraft = () => {
    if (!name.trim()) { setErrors({ name: 'csErrName' }); return; }
    setErrors({});
    persist('DRAFT', 'draft');
  };

  const err = (k: keyof StrategyFormErrors) => (errors[k] ? t[errors[k] as keyof Dict] : undefined);
  const busy = saving !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18, color: '#211c38' }}>{strategy ? t.csEditBtn : t.csCreate}</div>
        <span style={{ fontSize: 12.5, color: '#8a85a0' }}>{t.csForBrand}: <strong style={{ color: '#5b4b86' }}>{brandName}</strong></span>
      </div>

      {apiError && <div style={{ fontSize: 12.5, color: '#d6336c', background: '#fdeef2', border: '1px solid #f3c9d6', borderRadius: 10, padding: '10px 13px' }}>{apiError}</div>}

      <Field label={t.csName} required error={err('name')}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.csNamePh} style={fieldInput} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Box><Field label={t.csGoal} required help={t.csGoalHelp} error={err('goals')}><ChipMultiSelect options={strategyGoalOptions(lang)} value={goals} onChange={setGoals} creatable /></Field></Box>
        <Box><Field label={t.csTypes} required help={t.csTypesHelp} error={err('contentTypes')}><ChipMultiSelect options={contentTypeOptions(lang)} value={contentTypes} onChange={setContentTypes} max={5} creatable /></Field></Box>
        <Box><Field label={t.csFreq} required help={t.csFreqHelp}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min={1}
              max={100}
              value={frequencyCount}
              onChange={(e) => setFrequencyCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              style={{ ...fieldInput, width: 90, textAlign: 'center', padding: '9px 10px' }}
            />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#5b5670' }}>{t.csPostsPer}</span>
            <select
              value={frequencyUnit}
              onChange={(e) => setFrequencyUnit(e.target.value as FrequencyUnit)}
              style={{ ...fieldInput, width: 'auto', flex: 1, cursor: 'pointer', padding: '9px 12px' }}
            >
              {FREQUENCY_UNIT_OPTIONS(lang).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </Field></Box>
        <Box><Field label={t.csPlatforms} required help={t.csPlatformsHelp} error={err('platforms')}><PlatformSelect value={platforms} onChange={setPlatforms} /></Field></Box>
        <Box><Field label={t.csTimes} required help={t.csTimesHelp}><TagInput value={timeSlots} onChange={setTimeSlots} addLabel={t.csAddTime} suggestions={TIME_SLOT_OPTIONS} /></Field></Box>
        <Box><Field label={t.csAudience} required help={t.csAudienceHelp}><TagInput value={audiences} onChange={setAudiences} addLabel={t.csAddAudience} suggestions={audienceSampleOptions(lang)} /></Field></Box>
        <Box><Field label={t.csStyle} required help={t.csStyleHelp}><ChipMultiSelect options={contentStyleOptions(lang)} value={styles} onChange={setStyles} creatable /></Field></Box>
        <Box><Field label={t.csCta} required help={t.csCtaHelp}><TagInput value={ctas} onChange={setCtas} addLabel={t.csAddCta} suggestions={ctaSampleOptions(lang)} /></Field></Box>
      </div>

      <div style={{
        position: 'sticky',
        bottom: -22,
        margin: '32px -22px -22px -22px',
        padding: '20px 22px',
        background: '#fff',
        borderTop: '1px solid #efeaf8',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 -10px 30px rgba(0,0,0,0.03)'
      }}>
        <StrategySummary s={summaryLike} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {strategy && onDelete && <button onClick={onDelete} disabled={busy} style={{ border: '1px solid #f3c9d6', background: '#fff', borderRadius: 12, padding: '11px 18px', fontSize: 14, fontWeight: 700, color: '#d6336c', cursor: 'pointer' }}>{t.csDeleteBtn}</button>}
          <button onClick={onCancel} disabled={busy} className="btn-soft" style={{ marginLeft: 'auto', border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.csCancel}</button>
          <button onClick={saveDraft} disabled={busy} className="btn-outline" style={{ border: '1.5px solid #d6cdf0', background: '#faf8ff', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 700, color: '#7c5cff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1 }}>{saving === 'draft' ? t.processing : t.bpSaveDraft}</button>
          <button onClick={submit} disabled={busy} className="btn-grad" style={{ border: 'none', borderRadius: 12, padding: '11px 26px', fontSize: 14, fontWeight: 700, color: '#fff', background: 'var(--brand)', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1 }}>{saving === 'full' ? t.processing : t.csSave}</button>
        </div>
      </div>
    </div>
  );
}

function Box({ children }: { children: ReactNode }) {
  return <div style={{ border: '1px solid #efeaf8', borderRadius: 13, padding: 15 }}>{children}</div>;
}
