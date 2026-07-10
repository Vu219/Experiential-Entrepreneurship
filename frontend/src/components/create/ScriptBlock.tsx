import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Icon } from '../ui';
import type { ScriptSection } from '../../api/contentCreationService';
import type { Dict } from '../../i18n';

export type ScriptBlockVariant = 'hook' | 'step' | 'cta';

const VARIANT_META: Record<ScriptBlockVariant, { labelKey: keyof Dict; badgeBg: string; badgeColor: string }> = {
  hook: { labelKey: 'cwHook', badgeBg: '#f3edff', badgeColor: '#7c3aed' },
  step: { labelKey: 'cwStepWord', badgeBg: '#e0f7fb', badgeColor: '#0e7490' },
  cta: { labelKey: 'cwEndCta', badgeBg: '#fdeef5', badgeColor: '#be185d' },
};

const inputBase = {
  width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '11px 14px',
  fontSize: 13.5, lineHeight: 1.55, color: '#241f3a', background: '#fbfaff', outline: 'none',
} as const;
const badgeStyle = (bg: string, color: string) =>
  ({ display: 'inline-block', flex: 'none', background: bg, color, borderRadius: 7, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }) as const;
const timingChip = {
  display: 'inline-block', flex: 'none', background: '#fff', border: '1px solid #ece7f6',
  color: '#8a85a0', borderRadius: 7, padding: '1px 8px', fontSize: 10.5, fontWeight: 700,
} as const;
const sceneLabel = { fontSize: 11.5, fontWeight: 700, color: '#8a85a0', marginBottom: 6 } as const;

/**
 * MỘT khung dùng chung cho một phần kịch bản video (hook / bước / CTA) ở CẢ ba màn
 * tạo–xem–sửa: bố cục 2 cột — nội dung cột trái, "Gợi ý cảnh quay" cột phải tương ứng.
 * - `editable=false` → text read-only; `editable=true` → textarea (mốc 3 wizard + sửa tại chỗ).
 * - `collapsible` (chỉ có nghĩa khi editable): accordion — thu gọn còn 1–2 dòng, bấm mở để sửa.
 * - Màn hẹp (mobile) xếp chồng: nội dung trên, gợi ý cảnh quay dưới.
 */
export default function ScriptBlock({
  variant,
  index,
  section,
  editable = false,
  onChange,
  onRemove,
  collapsible = false,
  expanded = true,
  onToggle,
}: {
  variant: ScriptBlockVariant;
  /** Số thứ tự bước (chỉ variant='step'). */
  index?: number;
  section: ScriptSection;
  editable?: boolean;
  onChange?: (patch: Partial<ScriptSection>) => void;
  /** Nút xóa bước (chỉ editor, variant='step'). */
  onRemove?: () => void;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();
  const v = VARIANT_META[variant];
  const label = variant === 'step' ? `${t.cwStepWord} ${index}` : t[v.labelKey];
  const withTiming = variant !== 'step';
  const box = { background: '#faf8fe', border: '1px solid #ece7f6', borderRadius: 14, padding: '12px 14px' } as const;

  // Thu gọn (accordion mốc 3): cả khối là MỘT nút mở — badge + timing + trích 2 dòng nội dung.
  if (collapsible && !expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        aria-label={`${label} — ${t.cwExpand}`}
        style={{ ...box, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={badgeStyle(v.badgeBg, v.badgeColor)}>{label}</span>
          {section.timing && <span style={timingChip}>⏱ {section.timing}</span>}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', color: '#a59fbb' }}>
            <Icon icon={ChevronDown} size={15} stroke="#a59fbb" />
          </span>
        </span>
        <span style={{ fontSize: 12.5, lineHeight: 1.55, color: '#6b6680', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {section.content || t.cwEmptySection}
        </span>
      </button>
    );
  }

  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Hàng đầu: badge phần + mốc thời gian (chip khi xem / input khi sửa) + xóa bước + thu gọn */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <span style={badgeStyle(v.badgeBg, v.badgeColor)}>{label}</span>
        {editable && withTiming ? (
          <input
            value={section.timing}
            onChange={(e) => onChange?.({ timing: e.target.value })}
            placeholder={t.cwTimingPh}
            aria-label={t.cwTiming}
            style={{ ...inputBase, width: 96, padding: '5px 9px', fontSize: 12 }}
          />
        ) : (
          section.timing && <span style={timingChip}>⏱ {section.timing}</span>
        )}
        {(onRemove || collapsible) && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 2 }}>
            {onRemove && (
              <button
                onClick={onRemove}
                aria-label={t.cwRemoveStep}
                title={t.cwRemoveStep}
                style={{ display: 'inline-flex', alignItems: 'center', border: 'none', background: 'transparent', color: '#b7b2c8', cursor: 'pointer', padding: 3 }}
              >
                <Icon icon={X} size={14} stroke="#b7b2c8" />
              </button>
            )}
            {collapsible && (
              <button
                onClick={onToggle}
                aria-expanded
                aria-label={`${label} — ${t.cwCollapse}`}
                title={t.cwCollapse}
                style={{ display: 'inline-flex', alignItems: 'center', border: 'none', background: 'transparent', color: '#a59fbb', cursor: 'pointer', padding: 3 }}
              >
                <Icon icon={ChevronUp} size={15} stroke="#a59fbb" />
              </button>
            )}
          </span>
        )}
      </div>

      {/* Thân 2 cột: trái = nội dung, phải = gợi ý cảnh quay tương ứng; mobile xếp chồng */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1.15fr) minmax(0,1fr)', gap: isMobile ? 10 : 14, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          {editable ? (
            <textarea
              value={section.content}
              onChange={(e) => onChange?.({ content: e.target.value })}
              aria-label={label}
              style={{ ...inputBase, resize: 'vertical', minHeight: 64 }}
            />
          ) : (
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: '#3f3a55', whiteSpace: 'pre-line' }}>{section.content}</div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={sceneLabel}>🎬 {t.cwScene}</div>
          {editable ? (
            <textarea
              value={section.sceneSuggestion}
              onChange={(e) => onChange?.({ sceneSuggestion: e.target.value })}
              aria-label={t.cwScene}
              style={{ ...inputBase, resize: 'vertical', minHeight: 64, fontSize: 12.5 }}
            />
          ) : (
            <div style={{ background: '#fff', border: '1px dashed #e3dcf4', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.55, color: '#6b6680', whiteSpace: 'pre-line' }}>
              {section.sceneSuggestion || '—'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
