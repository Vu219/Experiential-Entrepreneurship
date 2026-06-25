import { useState, type ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { strategyGoalOptions, contentTypeOptions, contentStyleOptions, ctaSampleOptions, audienceSampleOptions, TIME_SLOT_OPTIONS, POSTS_PER_WEEK_OPTIONS } from '../../data';
import { createContentStrategy, updateContentStrategy, type ContentStrategy, type ContentStrategyInput, type Platform } from '../../api/contentStrategy';
import { validateStrategy, type StrategyFormErrors } from '../../validations/brandValidation';
import type { Dict } from '../../i18n';
import StrategySummary from './StrategySummary';
import { Field, ChipMultiSelect, TagInput, PlatformSelect, fieldInput } from './chips';

/** Form Tạo/Sửa chiến lược (panel phải) — 8 mục 01–08 + tóm tắt sống + nút lưu/hủy/xóa. */
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
  const [postsPerWeek, setPostsPerWeek] = useState<number>(strategy?.postsPerWeek ?? 3);
  const [platforms, setPlatforms] = useState<Platform[]>(strategy?.platforms ?? ['FACEBOOK', 'INSTAGRAM']);
  const [timeSlots, setTimeSlots] = useState<string[]>(strategy?.timeSlots ?? []);
  const [audiences, setAudiences] = useState<string[]>(strategy?.audiences ?? []);
  const [styles, setStyles] = useState<string[]>(strategy?.styles ?? []);
  const [ctas, setCtas] = useState<string[]>(strategy?.ctas ?? []);
  const [errors, setErrors] = useState<StrategyFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  const summaryLike = { goals, postsPerWeek, platforms, audiences, styles, ctas };

  const submit = async () => {
    const errs = validateStrategy({ name, goals, contentTypes, platforms });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const payload: ContentStrategyInput = {
      brandId,
      name: name.trim(),
      status: strategy?.status ?? 'DRAFT', // tạo mới = Nháp
      goals, contentTypes, postsPerWeek, platforms, timeSlots, audiences, styles, ctas,
    };
    setSaving(true);
    setApiError('');
    try {
      const saved = strategy ? await updateContentStrategy(strategy.id, payload) : await createContentStrategy(payload);
      onSaved(saved, !strategy);
    } catch (err) {
      setApiError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const err = (k: keyof StrategyFormErrors) => (errors[k] ? t[errors[k] as keyof Dict] : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18, color: '#211c38' }}>{strategy ? t.csEditBtn : t.csCreate}</div>
        <span style={{ fontSize: 12.5, color: '#8a85a0' }}>{t.csForBrand}: <strong style={{ color: '#5b4b86' }}>{brandName}</strong></span>
      </div>

      {apiError && <div style={{ fontSize: 12.5, color: '#e23d6e', background: '#fdeef2', border: '1px solid #f3c9d6', borderRadius: 10, padding: '10px 13px' }}>{apiError}</div>}

      <Field label={t.csName} required error={err('name')}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.csNamePh} style={fieldInput} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Box><Field step="01" label={t.csGoal} required help={t.csGoalHelp} error={err('goals')}><ChipMultiSelect options={strategyGoalOptions(lang)} value={goals} onChange={setGoals} /></Field></Box>
        <Box><Field step="02" label={t.csTypes} required help={t.csTypesHelp} error={err('contentTypes')}><ChipMultiSelect options={contentTypeOptions(lang)} value={contentTypes} onChange={setContentTypes} max={5} /></Field></Box>
        <Box><Field step="03" label={t.csFreq} required help={t.csFreqHelp}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {POSTS_PER_WEEK_OPTIONS.map((n) => (
              <button key={n} onClick={() => setPostsPerWeek(n)} style={{ border: `1.5px solid ${postsPerWeek === n ? 'transparent' : '#ece8f6'}`, background: postsPerWeek === n ? 'var(--brand)' : '#fff', color: postsPerWeek === n ? '#fff' : '#3f3a55', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{n} {t.csPostsPerWeek}</button>
            ))}
          </div>
        </Field></Box>
        <Box><Field step="04" label={t.csPlatforms} required help={t.csPlatformsHelp} error={err('platforms')}><PlatformSelect value={platforms} onChange={setPlatforms} /></Field></Box>
        <Box><Field step="05" label={t.csTimes} required help={t.csTimesHelp}><TagInput value={timeSlots} onChange={setTimeSlots} addLabel={t.csAddTime} suggestions={TIME_SLOT_OPTIONS} /></Field></Box>
        <Box><Field step="06" label={t.csAudience} required help={t.csAudienceHelp}><TagInput value={audiences} onChange={setAudiences} addLabel={t.csAddAudience} suggestions={audienceSampleOptions(lang)} /></Field></Box>
        <Box><Field step="07" label={t.csStyle} required help={t.csStyleHelp}><ChipMultiSelect options={contentStyleOptions(lang)} value={styles} onChange={setStyles} /></Field></Box>
        <Box><Field step="08" label={t.csCta} required help={t.csCtaHelp}><TagInput value={ctas} onChange={setCtas} addLabel={t.csAddCta} suggestions={ctaSampleOptions(lang)} /></Field></Box>
      </div>

      <StrategySummary s={summaryLike} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {strategy && onDelete && <button onClick={onDelete} style={{ border: '1px solid #f3c9d6', background: '#fff', borderRadius: 12, padding: '11px 18px', fontSize: 14, fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}>{t.csDeleteBtn}</button>}
        <button onClick={onCancel} style={{ marginLeft: 'auto', border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.csCancel}</button>
        <button onClick={submit} disabled={saving} style={{ border: 'none', borderRadius: 12, padding: '11px 26px', fontSize: 14, fontWeight: 700, color: '#fff', background: 'var(--brand)', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.75 : 1 }}>{saving ? t.processing : t.csSave}</button>
      </div>
    </div>
  );
}

function Box({ children }: { children: ReactNode }) {
  return <div style={{ border: '1px solid #efeaf8', borderRadius: 13, padding: 15 }}>{children}</div>;
}
