import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Link2, Mail, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { Icon } from '../../ui';
import type { L10n, LandingLink } from '../../../api/landing';
import { FEATURE_ICONS } from '../../landing/landingIcons';
import { LANDING_LINK_SUGGESTIONS } from '../../../config/landingLinks';

// Ô nhập dùng chung cho trang admin "Quản lý Landing Page". `path` = đường dẫn ô trong nội dung
// section (khớp validations/landingValidation.ts) để tô đỏ đúng ô lỗi.

const ERR = '#e25c84';
export const fieldStyle = { width: '100%', border: '1px solid #ece8f6', borderRadius: 10, padding: '9px 12px', fontSize: 13.5, color: '#241f3a', outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' } as const;
export const labelStyle = { fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 5, display: 'block' } as const;
const hintStyle = { fontSize: 11, color: '#a59fbb', marginTop: 4 } as const;
const langTag: CSSProperties = { position: 'absolute', top: 8, right: 9, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', color: '#b3aacb', pointerEvents: 'none' };

export interface FieldProps {
  path: string;
  errors: Set<string>;
}

const withErr = (bad: boolean, style: CSSProperties = fieldStyle): CSSProperties => (bad ? { ...style, borderColor: ERR, background: '#fff7fa' } : style);

/** Chữ song ngữ: 2 ô VI / EN cạnh nhau (xếp dọc trên mobile). */
export function L10nInput({ label, value, onChange, path, errors, multiline = false, hint }: FieldProps & {
  label: string;
  value: L10n;
  onChange: (v: L10n) => void;
  multiline?: boolean;
  hint?: string;
}) {
  const { isMobile } = useBreakpoint();
  const box = (lng: 'vi' | 'en') => {
    const bad = errors.has(`${path}.${lng}`);
    const common = { value: value[lng], onChange: (e: { target: { value: string } }) => onChange({ ...value, [lng]: e.target.value }), 'aria-invalid': bad, 'aria-label': `${label} (${lng.toUpperCase()})` };
    return (
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        {multiline
          ? <textarea {...common} rows={3} style={{ ...withErr(bad), paddingRight: 34, resize: 'vertical', lineHeight: 1.5 }} />
          : <input {...common} style={{ ...withErr(bad), paddingRight: 34 }} />}
        <span style={langTag}>{lng.toUpperCase()}</span>
      </div>
    );
  };
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
        {box('vi')}
        {box('en')}
      </div>
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

export function TextInput({ label, value, onChange, path, errors, placeholder, hint, type = 'text' }: FieldProps & {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  const bad = errors.has(path);
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={bad} style={withErr(bad)} />
      {hint && <div style={hintStyle}>{hint}</div>}
    </label>
  );
}

export function SelectInput({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Email liên hệ đang sửa ở tab Footer — nguồn gợi ý "mailto:" cho ô link (trang admin cung cấp). */
export const LandingLinkContext = createContext<{ contactEmail: string }>({ contactEmail: '' });

/**
 * Ô đường link có dropdown gợi ý (trang công khai + section trang chủ + mailto email liên hệ).
 * Bấm vào ô → hiện toàn bộ gợi ý; gõ → lọc theo link/tên. Vẫn nhập tự do được.
 */
export function HrefInput({ label, value, onChange, path, errors, placeholder, hint }: FieldProps & {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const { t } = useApp();
  const { contactEmail } = useContext(LandingLinkContext);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(''); // chữ gõ từ lúc mở — rỗng = hiện tất cả
  const [hi, setHi] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bad = errors.has(path);

  const all = useMemo(() => {
    const list: { href: string; label: string; group: string; mail: boolean }[] = LANDING_LINK_SUGGESTIONS.map((sg) => ({ href: sg.href, label: t[sg.label], group: sg.group === 'pages' ? t.lpSugGroupPages : t.lpSugGroupSections, mail: false }));
    const email = contactEmail.trim();
    if (email) list.push({ href: `mailto:${email}`, label: t.lpSugEmail.replace('{email}', email), group: t.lpSugGroupContact, mail: true });
    return list;
  }, [t, contactEmail]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((o) => o.href.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)) : all;
  }, [all, query]);

  const current = all.find((o) => o.href === value.trim());

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const choose = (href: string) => { onChange(href); setOpen(false); setHi(-1); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && matches.length) { e.preventDefault(); setOpen(true); setHi((h) => (h + 1) % matches.length); return; }
    if (e.key === 'ArrowUp' && matches.length) { e.preventDefault(); setOpen(true); setHi((h) => (h <= 0 ? matches.length - 1 : h - 1)); return; }
    if (e.key === 'Enter' && open && hi >= 0 && matches[hi]) { e.preventDefault(); choose(matches[hi].href); return; }
    if (e.key === 'Escape') { setOpen(false); setHi(-1); }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <span style={labelStyle}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setQuery(e.target.value); setHi(-1); setOpen(true); }}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-autocomplete="list"
        aria-invalid={bad}
        aria-label={label}
        style={withErr(bad)}
      />
      {open && matches.length > 0 && (
        <div role="listbox" className="menu-pop menu-pop--left" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 40, background: '#fff', border: '1px solid #ece8f6', borderRadius: 12, boxShadow: '0 12px 32px -10px rgba(40,20,90,.28)', padding: 6, maxHeight: 280, overflowY: 'auto' }}>
          {matches.map((o, i) => (
            <div key={o.href}>
              {(i === 0 || matches[i - 1].group !== o.group) && (
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', color: '#b3aacb', padding: '6px 10px 3px', textTransform: 'uppercase' }}>{o.group}</div>
              )}
              <button
                type="button"
                role="option"
                aria-selected={i === hi}
                // onMouseDown để chạy trước khi input mất focus.
                onMouseDown={(e) => { e.preventDefault(); choose(o.href); }}
                onMouseEnter={() => setHi(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', border: 'none', background: i === hi ? '#f4f1fb' : 'transparent', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}
              >
                <Icon icon={o.mail ? Mail : Link2} size={14} stroke="#a39bbf" />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#3f3a55', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                <code style={{ fontSize: 11.5, color: '#8a85a0', whiteSpace: 'nowrap' }}>{o.mail ? 'mailto:' : o.href}</code>
              </button>
            </div>
          ))}
        </div>
      )}
      {current && <div style={{ ...hintStyle, color: '#7c3aed', fontWeight: 600 }}>→ {current.label}</div>}
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

/** Nút/link: chữ song ngữ + đường link. */
export function LinkInput({ label, value, onChange, path, errors, hrefHint }: FieldProps & {
  label: string;
  value: LandingLink;
  onChange: (v: LandingLink) => void;
  hrefHint?: string;
}) {
  const { t } = useApp();
  return (
    <div style={{ display: 'grid', gap: 10, border: '1px solid #f0ecf8', borderRadius: 12, padding: 12, background: '#fcfbff' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#4b4660' }}>{label}</div>
      <L10nInput label={t.lpFButtonText} value={value.label} onChange={(v) => onChange({ ...value, label: v })} path={`${path}.label`} errors={errors} />
      <HrefInput label={t.lpFLink} value={value.href} onChange={(v) => onChange({ ...value, href: v })} path={`${path}.href`} errors={errors} placeholder="/register" hint={hrefHint ?? t.lpFLinkHint} />
    </div>
  );
}

/** Nhóm có tiêu đề nhỏ — tách các khối trong một tab. */
export function FieldGroup({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {title && (
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 14.5, color: '#211c38' }}>{title}</div>
          {hint && <div style={{ ...hintStyle, marginTop: 2 }}>{hint}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/** Danh sách thêm / xóa / sắp xếp lại (nút lên-xuống). */
export function ListEditor<T>({ title, items, onChange, create, render, itemTitle, limits, path, errors }: FieldProps & {
  title: string;
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  render: (item: T, update: (v: T) => void, index: number) => ReactNode;
  itemTitle: (item: T, index: number) => string;
  limits: readonly [number, number];
}) {
  const { t } = useApp();
  const [min, max] = limits;
  const countBad = errors.has(path);
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const iconBtn = (disabled: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: '1px solid #ece8f6', background: '#fff', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1 });

  return (
    <FieldGroup title={title} hint={t.lpListLimit.replace('{min}', String(min)).replace('{max}', String(max))}>
      {items.map((item, i) => (
        <div key={i} style={{ border: '1px solid #ece8f6', borderRadius: 14, background: '#fff' }}>
          {/* Không overflow:hidden — dropdown gợi ý link trong thẻ con sẽ bị cắt; bo góc ở header thay thế. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#faf8ff', borderBottom: '1px solid #f0ecf8', borderRadius: '13px 13px 0 0' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', background: '#f3edff', borderRadius: 999, padding: '2px 8px' }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: '#4b4660', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itemTitle(item, i)}</span>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title={t.lpMoveUp} aria-label={t.lpMoveUp} style={iconBtn(i === 0)}><Icon icon={ArrowUp} size={14} stroke="#8a85a0" /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} title={t.lpMoveDown} aria-label={t.lpMoveDown} style={iconBtn(i === items.length - 1)}><Icon icon={ArrowDown} size={14} stroke="#8a85a0" /></button>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={items.length <= min} title={t.lpRemove} aria-label={t.lpRemove} style={{ ...iconBtn(items.length <= min), borderColor: '#fbdce7' }}><Icon icon={Trash2} size={14} stroke="#e25c84" /></button>
          </div>
          <div style={{ display: 'grid', gap: 12, padding: 12 }}>
            {render(item, (v) => onChange(items.map((x, j) => (j === i ? v : x))), i)}
          </div>
        </div>
      ))}
      {countBad && <div style={{ fontSize: 12, color: ERR }}>{t.lpListLimit.replace('{min}', String(min)).replace('{max}', String(max))}</div>}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, create()])} style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 6, border: '1px dashed #d9cef5', background: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2.5} /> {t.lpAdd}
        </button>
      )}
    </FieldGroup>
  );
}

/** Chọn icon thẻ tính năng từ bộ có sẵn (FEATURE_ICONS). */
export function IconPicker({ value, onChange, path, errors }: FieldProps & { value: string; onChange: (key: string) => void }) {
  const { t, lang } = useApp();
  const bad = errors.has(path);
  return (
    <div>
      <span style={labelStyle}>{t.lpFIcon}</span>
      <div role="radiogroup" aria-label={t.lpFIcon} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: bad ? 6 : 0, border: bad ? `1px solid ${ERR}` : 'none', borderRadius: 10 }}>
        {Object.entries(FEATURE_ICONS).map(([key, { icon, label }]) => {
          const active = key === value;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              title={lang === 'en' ? label.en : label.vi}
              onClick={() => onChange(key)}
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, cursor: 'pointer', border: `1.5px solid ${active ? '#8b5cf6' : '#ece8f6'}`, background: active ? '#f3edff' : '#fff' }}
            >
              <Icon icon={icon} size={17} stroke={active ? '#7c3aed' : '#8a85a0'} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
