import { memo } from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import Tooltip from '../../Tooltip';
import Switch from '../Switch';
import SegmentedControl, { type SegmentOption } from '../SegmentedControl';
import { PlatformTag } from '../../ui';
import { PLATFORM_BG } from '../../../theme';
import { ALL_PLATFORMS, type PlanLimitField } from '../../../api/planLimits';
import type { PlatformEnum } from '../../../api/connections';
import type { LimitDraft, LimitError, NumberMode } from '../../../utils/planForm';
import { C } from '../../../styles/colors';

const TAG: Record<PlatformEnum, string> = { FACEBOOK: 'FB', INSTAGRAM: 'IG', THREADS: 'TH' };
const NAME: Record<PlatformEnum, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

/**
 * Một giới hạn của gói trên MỘT dòng gọn: nhãn + "?" giải thích, điều khiển bên phải.
 * QUOTA/CAP: [Giới hạn | Không giới hạn | Tắt | Mặc định*] + ô số có hậu tố đơn vị khi "Giới hạn";
 * FLAG: công tắc Bật/Tắt (+ "Mặc định" cho gói lõi); SET (nền tảng): chip chọn nhiều có icon.
 * (*) "Mặc định hệ thống" chỉ hiện với 3 gói lõi — gói tự tạo phải chọn giá trị cụ thể.
 */
function LimitRow({ field, draft, onChange, isCore, error, defaultText, lockedPlatforms }: {
  field: PlanLimitField;
  draft: LimitDraft;
  onChange: (next: LimitDraft) => void;
  isCore: boolean;
  error?: LimitError;
  /** Mô tả giá trị mặc định hệ thống (gói lõi). */
  defaultText?: string;
  /** Nền tảng đang khoá toàn hệ thống — vẫn chọn được nhưng có ghi chú. */
  lockedPlatforms: PlatformEnum[];
}) {
  const { t } = useApp();
  const dict = t as unknown as Record<string, string>;
  const label = dict[`plk_${field.key}`] ?? field.key;
  const help = dict[`plkHelp_${field.key}`] ?? '';
  const unit = field.unit ? dict[`plu_${field.unit}`] : '';
  const errorText = error === 'required' ? t.plLimitRequired : error === 'invalid' ? t.plLimitInvalid : '';

  let control;
  if (draft.kind === 'number') {
    const options: SegmentOption<NumberMode>[] = [
      { value: 'limit', label: t.plModeLimit },
      { value: 'unlimited', label: t.plModeUnlimited },
      { value: 'off', label: t.plModeOff },
      ...(isCore || draft.mode === 'default'
        ? [{ value: 'default' as NumberMode, label: t.plModeDefault, title: defaultText }] : []),
    ];
    control = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
        <SegmentedControl size="sm" ariaLabel={label} value={draft.mode} options={options} invalid={!!error}
          onChange={(mode) => onChange({ ...draft, mode })} />
        {draft.mode === 'limit' && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', borderRadius: 10, overflow: 'hidden', minWidth: 0,
            border: `1.5px solid ${error === 'invalid' ? C.danger : C.border}`, background: C.surface,
          }}>
            <input value={draft.n} inputMode="numeric" aria-label={`${label}${unit ? ` (${unit})` : ''}`}
              aria-invalid={error === 'invalid' || undefined}
              onChange={(e) => onChange({ ...draft, n: e.target.value.replace(/[^\d]/g, '') })}
              style={{ width: 84, minWidth: 0, border: 'none', outline: 'none', padding: '6px 9px', fontSize: 13,
                fontWeight: 700, color: C.textStrong, background: 'transparent' }} placeholder="0" />
            {unit && (
              <span style={{ padding: '6px 9px', fontSize: 12, color: C.textMuted, background: C.surfaceMuted,
                borderLeft: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{unit}</span>
            )}
          </span>
        )}
      </div>
    );
  } else if (draft.kind === 'flag') {
    control = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {(isCore || draft.mode === 'default') && (
          <SegmentedControl size="sm" ariaLabel={label} value={draft.mode === 'default' ? 'default' : 'custom'}
            options={[{ value: 'custom', label: t.plModeCustom }, { value: 'default', label: t.plModeDefault, title: defaultText }]}
            onChange={(v) => onChange({ kind: 'flag', mode: v === 'default' ? 'default' : 'on' })} invalid={!!error} />
        )}
        {draft.mode !== 'default' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={draft.mode === 'on'} title={label} onChange={(on) => onChange({ kind: 'flag', mode: on ? 'on' : 'off' })} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: draft.mode === 'on' ? C.primaryStrong : C.textMuted, minWidth: 28 }}>
              {draft.mode === 'on' ? t.plFlagOn : t.plFlagOff}
            </span>
          </span>
        )}
      </div>
    );
  } else {
    const toggle = (p: PlatformEnum) => onChange({
      kind: 'set', mode: 'list',
      platforms: draft.platforms.includes(p) ? draft.platforms.filter((x) => x !== p) : ALL_PLATFORMS.filter((x) => x === p || draft.platforms.includes(x)),
    });
    control = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', minWidth: 0 }}>
        {(isCore || draft.mode === 'default') && (
          <SegmentedControl size="sm" ariaLabel={label} value={draft.mode} invalid={!!error}
            options={[{ value: 'list', label: t.plModeCustom }, { value: 'default', label: t.plModeDefault, title: defaultText }]}
            onChange={(mode) => onChange({ ...draft, mode })} />
        )}
        {draft.mode === 'list' && (
          <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ALL_PLATFORMS.map((p) => {
              const on = draft.platforms.includes(p);
              const locked = lockedPlatforms.includes(p);
              return (
                <button key={p} type="button" aria-pressed={on} onClick={() => toggle(p)}
                  title={locked ? t.plPlatformLockedNote : undefined}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 6px', borderRadius: 10,
                    border: on ? `1.5px solid ${C.violetLight}` : `1px solid ${C.border}`,
                    background: on ? C.primarySoft : C.surface, color: on ? C.primaryStrong : C.textSecondary,
                    fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  }}>
                  <PlatformTag tag={TAG[p]} bg={on ? PLATFORM_BG[TAG[p]] : C.ink200} size={20} radius={6} fontSize={9.5} />
                  {NAME[p]}
                  {locked && <Lock size={11} strokeWidth={2.4} aria-label={t.plPlatformLockedNote} />}
                </button>
              );
            })}
          </div>
        )}
        {draft.mode === 'list' && draft.platforms.some((p) => lockedPlatforms.includes(p)) && (
          <span style={{ fontSize: 11.5, color: C.warning }}>{t.plPlatformLockedNote}</span>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, padding: '11px 12px', borderRadius: 12, minWidth: 0,
      border: `1px solid ${error ? C.danger : C.surfaceMuted}`, background: C.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.textStrong, minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
        {help && <Tooltip text={help} />}
      </div>
      {control}
      {draft.mode === 'default' && defaultText && (
        <span style={{ fontSize: 11.5, color: C.textMuted }}>{t.plDefaultIs.replace('{value}', defaultText)}</span>
      )}
      {errorText && <span role="alert" style={{ fontSize: 11.5, fontWeight: 600, color: C.danger }}>{errorText}</span>}
    </div>
  );
}

export default memo(LimitRow);
