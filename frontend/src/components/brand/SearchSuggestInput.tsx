import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Ô tìm kiếm có dropdown gợi ý (dựa trên danh sách tên đang có) — kiểu dáng đồng bộ
 * SearchInput của admin. KHÔNG gọi API theo từng phím gõ: chỉ submit khi nhấn Enter
 * hoặc chọn một gợi ý; xóa trắng ô thì reset tìm kiếm ngay.
 */
export default function SearchSuggestInput({
  value,
  onChange,
  onSubmit,
  suggestions,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Bắt đầu tìm kiếm thật (gọi API) với từ khóa đã chốt. */
  onSubmit: (q: string) => void;
  /** Nguồn gợi ý: tên các bản ghi đang có. */
  suggestions: string[];
  placeholder?: string;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1); // index gợi ý đang chọn bằng phím mũi tên
  const wrapRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [value, suggestions]);

  // Đóng dropdown khi click ra ngoài.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const submit = (q: string) => { setOpen(false); setHi(-1); onSubmit(q.trim()); };
  const choose = (s: string) => { onChange(s); submit(s); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && matches.length) { e.preventDefault(); setOpen(true); setHi((h) => (h + 1) % matches.length); return; }
    if (e.key === 'ArrowUp' && matches.length) { e.preventDefault(); setOpen(true); setHi((h) => (h <= 0 ? matches.length - 1 : h - 1)); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (open && hi >= 0 && matches[hi]) choose(matches[hi]); else submit(value); return; }
    if (e.key === 'Escape') { setOpen(false); setHi(-1); }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: '1 1 220px', minWidth: 180, maxWidth: 340 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#f4f2fb', border: '1px solid #ece8f6', borderRadius: 10, padding: '8px 12px' }}>
        <Search size={16} color="#a39bbf" strokeWidth={1.8} />
        <input
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            setHi(-1);
            setOpen(v.trim().length > 0);
            if (!v.trim()) submit(''); // xóa trắng → reset kết quả ngay, không cần Enter
          }}
          onFocus={() => { if (value.trim()) setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? t.admSearchPh}
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-autocomplete="list"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: '#241f3a' }}
        />
      </div>
      {open && matches.length > 0 && (
        <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40, background: '#fff', border: '1px solid #ece8f6', borderRadius: 12, boxShadow: '0 12px 32px -10px rgba(40,20,90,.28)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto' }}>
          {matches.map((s, i) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={i === hi}
              // onMouseDown (không phải onClick) để chạy trước khi input mất focus/đóng dropdown.
              onMouseDown={(e) => { e.preventDefault(); choose(s); }}
              onMouseEnter={() => setHi(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', border: 'none', background: i === hi ? '#f4f1fb' : 'transparent', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontWeight: 600, color: '#3f3a55', cursor: 'pointer' }}
            >
              <Search size={13} color="#a39bbf" strokeWidth={1.8} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
