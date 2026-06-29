import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { PLATFORMS } from '../../theme';
import type { Platform } from '../../api/brandProfile';

// ===== Shared field styles (đồng bộ với Brand cũ) =====
export const fieldLabel: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', marginBottom: 6 };
export const fieldInput: CSSProperties = { width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 11, padding: '11px 13px', fontSize: 14, color: '#241f3a', background: '#fbfaff' };

/** Nhãn trường + dấu * (bắt buộc) + sub-text mô tả (help). */
export function Field({ label, required, help, error, children }: { label: string; required?: boolean; help?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label style={{ ...fieldLabel, marginBottom: help ? 2 : 6 }}>
        {label}{required && <span style={{ color: '#d6336c' }}> *</span>}
      </label>
      {help && <div style={{ fontSize: 12, color: '#9b94b5', marginBottom: 8 }}>{help}</div>}
      {children}
      {error && <div style={{ fontSize: 12, color: '#d6336c', marginTop: 6 }}>{error}</div>}
    </div>
  );
}

const chipStyle = (active: boolean, grad: string): CSSProperties => ({
  border: `1.5px solid ${active ? 'transparent' : '#ece8f6'}`,
  borderRadius: 10,
  padding: '7px 13px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  background: active ? grad : '#fff',
  color: active ? '#fff' : '#3f3a55',
  transition: 'background .15s',
});

/**
 * Chọn nhiều từ danh sách gợi ý. Khi `creatable` bật → combobox: vừa chọn gợi ý vừa tự gõ
 * giá trị mới (lưu nguyên văn) — giá trị tự nhập (ngoài gợi ý) hiển thị thành chip có nút xoá.
 */
export function ChipMultiSelect({ options, value, onChange, max, creatable }: { options: string[]; value: string[]; onChange: (next: string[]) => void; max?: number; creatable?: boolean }) {
  const { brandGradient, t } = useApp();
  const [draft, setDraft] = useState('');
  const atMax = !!max && value.length >= max; // tôn trọng giới hạn (vd tối đa 5 loại nội dung)
  const toggle = (opt: string) => {
    if (value.includes(opt)) return onChange(value.filter((v) => v !== opt));
    if (atMax) return;
    onChange([...value, opt]);
  };
  const add = (raw: string) => {
    const v = raw.trim();
    setDraft('');
    if (!v || value.includes(v) || atMax) return;
    onChange([...value, v]);
  };
  const custom = creatable ? value.filter((v) => !options.includes(v)) : []; // giá trị tự nhập (ngoài gợi ý)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const on = value.includes(opt);
          return (
            <button key={opt} type="button" aria-pressed={on} onClick={() => toggle(opt)} style={chipStyle(on, brandGradient)}>{opt}</button>
          );
        })}
        {custom.map((v) => (
          <span key={v} style={{ ...chipStyle(true, brandGradient), display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {v}
            <button onClick={() => onChange(value.filter((x) => x !== v))} aria-label="Remove" style={{ border: 'none', background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 6, width: 16, height: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      {creatable && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
            placeholder={t.csAddPh}
            disabled={atMax}
            style={{ ...fieldInput, flex: 1, opacity: atMax ? 0.6 : 1 }}
          />
          <button onClick={() => add(draft)} disabled={atMax} style={{ flex: 'none', border: '1.5px dashed #d6cdf0', background: '#faf8ff', borderRadius: 11, padding: '0 14px', fontSize: 13, fontWeight: 700, color: '#7c5cff', cursor: atMax ? 'not-allowed' : 'pointer', opacity: atMax ? 0.6 : 1 }}>+ {t.csAddCustom}</button>
        </div>
      )}
    </div>
  );
}

/** Tag tự nhập (có nút X xoá) + ô "+ Thêm…": khung giờ / đối tượng / CTA. */
export function TagInput({ value, onChange, addLabel, placeholder, suggestions }: { value: string[]; onChange: (next: string[]) => void; addLabel: string; placeholder?: string; suggestions?: string[] }) {
  const { brandGradient, t } = useApp();
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setDraft('');
  };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));
  const avail = (suggestions ?? []).filter((s) => !value.includes(s));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {value.map((v) => (
          <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: brandGradient, color: '#fff', borderRadius: 10, padding: '6px 10px', fontSize: 13, fontWeight: 600 }}>
            {v}
            <button onClick={() => remove(v)} aria-label="Remove" style={{ border: 'none', background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 6, width: 16, height: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
          placeholder={placeholder ?? t.csAddPh}
          style={{ ...fieldInput, flex: 1 }}
        />
        <button onClick={() => add(draft)} style={{ flex: 'none', border: '1.5px dashed #d6cdf0', background: '#faf8ff', borderRadius: 11, padding: '0 14px', fontSize: 13, fontWeight: 700, color: '#7c5cff', cursor: 'pointer' }}>+ {addLabel}</button>
      </div>
      {avail.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {avail.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} style={{ border: '1px solid #ece8f6', borderRadius: 999, padding: '4px 11px', fontSize: 12.5, fontWeight: 600, color: '#7d6aa3', background: '#fbfaff', cursor: 'pointer' }}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Chọn nền tảng FB/IG/Threads (dùng PlatformTag của design system). */
export function PlatformSelect({ value, onChange }: { value: Platform[]; onChange: (next: Platform[]) => void }) {
  const PLATFORM_ENUM: Record<string, Platform> = { FB: 'FACEBOOK', IG: 'INSTAGRAM', TH: 'THREADS' };
  const toggle = (p: Platform) => onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {PLATFORMS.map((pl) => {
        const enumVal = PLATFORM_ENUM[pl.tag];
        const on = value.includes(enumVal);
        return (
          <button key={pl.tag} type="button" aria-pressed={on} onClick={() => toggle(enumVal)} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${on ? '#c9bdf3' : '#ece8f6'}`, background: on ? '#f6f2ff' : '#fff', borderRadius: 12, padding: '9px 14px', cursor: 'pointer' }}>
            <PlatformTag tag={pl.tag} bg={pl.bg} size={26} radius={8} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#2b2543' }}>{pl.name}</span>
            {on && <Check size={16} color="#7c3aed" strokeWidth={2.4} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

/** Ô logo vuông bo góc: preview ảnh (logoUrl) hoặc placeholder chữ cái đầu tên thương hiệu. */
export function LogoSquare({ logoUrl, brandName, size = 96 }: { logoUrl: string | null; brandName: string; size?: number }) {
  const { brandGradient } = useApp();
  return (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: 18, overflow: 'hidden', background: logoUrl ? '#fff' : brandGradient, border: '1px solid #efe6fb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: size * 0.4 }}>
      {logoUrl ? <img src={logoUrl} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (brandName || 'A')[0].toUpperCase()}
    </div>
  );
}

/** Upload/đổi/xóa logo (tích hợp trực tiếp vào CRUD brandProfile). */
export function LogoUploader({ logoUrl, brandName, onChange }: { logoUrl: string | null; brandName: string; onChange: (url: string | null) => void }) {
  const { t } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string); // base64 data URL cho CRUD xử lý
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <LogoSquare logoUrl={logoUrl} brandName={brandName} />
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0])} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        <button onClick={() => inputRef.current?.click()} style={{ border: '1.5px solid #d6cdf0', background: '#faf8ff', borderRadius: 10, padding: '7px 10px', fontSize: 12.5, fontWeight: 700, color: '#7c5cff', cursor: 'pointer' }}>{t.bpfChangeLogo}</button>
        {logoUrl && <button onClick={() => onChange(null)} style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '7px 10px', fontSize: 12.5, fontWeight: 700, color: '#d6336c', cursor: 'pointer' }}>{t.bpRemoveLogo}</button>}
      </div>
    </div>
  );
}

/** Tag hiển thị read-only (dùng ở card / panel xem). */
export function ReadChips({ items, empty }: { items: string[]; empty?: string }) {
  if (!items.length) return <span style={{ fontSize: 13, color: '#b3acc6' }}>{empty ?? '—'}</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {items.map((v) => (
        <span key={v} style={{ background: '#f4f1fb', color: '#5b4b86', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600 }}>{v}</span>
      ))}
    </div>
  );
}
