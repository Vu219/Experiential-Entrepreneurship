import { useRef, type KeyboardEvent } from 'react';
import { C } from '../../styles/colors';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

/**
 * Nhóm nút chọn một (thay `<select>` bị cắt chữ): nhãn KHÔNG bị cắt — đủ chỗ thì một hàng, thiếu chỗ thì xuống dòng.
 * radiogroup + mũi tên trái/phải đổi lựa chọn như điều khiển gốc.
 */
export default function SegmentedControl<T extends string>({ value, options, onChange, ariaLabel, invalid = false, size = 'md' }: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  ariaLabel: string;
  invalid?: boolean;
  size?: 'sm' | 'md';
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={ariaLabel} aria-invalid={invalid || undefined}
      style={{
        display: 'inline-flex', flexWrap: 'wrap', gap: 3, padding: 3, borderRadius: 11, maxWidth: '100%',
        background: C.surfaceMuted, border: `1px solid ${invalid ? C.danger : C.border}`,
      }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on}
            tabIndex={on ? 0 : -1} title={o.title} onClick={() => onChange(o.value)} onKeyDown={(e) => onKey(e, i)}
            style={{
              border: 'none', borderRadius: 8, whiteSpace: 'nowrap', cursor: 'pointer',
              padding: size === 'sm' ? '5px 10px' : '6px 12px', fontSize: size === 'sm' ? 12 : 12.5, fontWeight: 700,
              color: on ? C.primaryStrong : C.textSecondary, background: on ? C.surface : 'transparent',
              boxShadow: on ? `0 1px 3px ${C.legacyShadowrgba000_25_}` : 'none', transition: 'background .12s, color .12s',
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
