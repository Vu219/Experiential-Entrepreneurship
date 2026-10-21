import { useState, type DragEvent } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { moveItem, type FeatureWarning } from '../../../utils/planForm';
import { C } from '../../../styles/colors';

/**
 * Trình soạn danh sách dòng tính năng của card gói (thay textarea): mỗi mục một ô, thêm/xoá, kéo thả hoặc ↑/↓ để sắp
 * xếp (bàn phím dùng được), "Tạo gợi ý từ giới hạn" thêm các dòng sinh từ giới hạn thật, cảnh báo dòng nói khác gói.
 */
export default function FeatureListEditor({ label, items, onChange, warnings, onSuggest, placeholder }: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  warnings: FeatureWarning[];
  /** Có thì hiện nút "Tạo gợi ý từ giới hạn" (trả các dòng gợi ý). */
  onSuggest?: () => string[];
  placeholder?: string;
}) {
  const { t } = useApp();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  // Chỉ kéo được khi nắm tay cầm — để ô nhập bên trong vẫn bôi đen / sửa chữ bình thường.
  const [armed, setArmed] = useState<number | null>(null);

  const set = (i: number, v: string) => onChange(items.map((x, idx) => (idx === i ? v : x)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);
  const suggest = () => {
    if (!onSuggest) return;
    const existing = new Set(items.map((x) => x.trim().toLowerCase()));
    const extra = onSuggest().filter((x) => !existing.has(x.trim().toLowerCase()));
    onChange([...items.filter((x) => x.trim()), ...extra]);
  };

  const onDragStart = (i: number) => (e: DragEvent) => {
    setDragFrom(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
  };
  const onDrop = (i: number) => (e: DragEvent) => {
    e.preventDefault();
    if (dragFrom != null) onChange(moveItem(items, dragFrom, i));
    setDragFrom(null);
    setDragOver(null);
  };

  const warningText = (w: FeatureWarning): string => {
    const name = w.platform ? { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' }[w.platform] : '';
    switch (w.kind) {
      case 'platformExcluded': return t.plWarnPlatformExcluded.replace('{platform}', name);
      case 'platformLocked': return t.plWarnPlatformLocked.replace('{platform}', name);
      case 'brandCount': return t.plWarnBrandCount.replace('{n}', w.expected ?? '');
      default: return t.plWarnChannelCount.replace('{n}', w.expected ?? '');
    }
  };

  const iconBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flex: 'none',
    border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.textMuted, cursor: 'pointer' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.textStrong }}>{label}</span>
        <span style={{ fontSize: 11.5, color: C.textFaint }}>{t.plListHint}</span>
        {onSuggest && (
          <button type="button" onClick={suggest} style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${C.accentLine}`,
            background: C.accentSoft, color: C.primary, borderRadius: 9, padding: '5px 11px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
          }}>
            <Sparkles size={13} strokeWidth={2.2} aria-hidden />{t.plSuggestFromLimits}
          </button>
        )}
      </div>

      {items.length === 0 && (
        <div style={{ fontSize: 12.5, color: C.textMuted, padding: '10px 12px', border: `1px dashed ${C.border}`, borderRadius: 10 }}>
          {t.plListEmpty}
        </div>
      )}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((value, i) => {
          const rowWarnings = warnings.filter((w) => w.line === i);
          return (
            <li key={i} draggable={armed === i} onDragStart={onDragStart(i)} onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
              onDragLeave={() => setDragOver((v) => (v === i ? null : v))} onDrop={onDrop(i)}
              onDragEnd={() => { setDragFrom(null); setDragOver(null); setArmed(null); }}
              style={{
                display: 'flex', flexDirection: 'column', gap: 4, borderRadius: 10, padding: 4,
                outline: dragOver === i && dragFrom !== i ? `2px dashed ${C.violetLight}` : 'none',
                opacity: dragFrom === i ? 0.5 : 1,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span aria-hidden onMouseDown={() => setArmed(i)} onMouseUp={() => setArmed(null)}
                  style={{ display: 'inline-flex', color: C.textFaint, cursor: 'grab', flex: 'none' }}>
                  <GripVertical size={16} />
                </span>
                <input value={value} onChange={(e) => set(i, e.target.value)} placeholder={placeholder}
                  aria-label={`${label} ${i + 1}`} aria-invalid={rowWarnings.length > 0 || undefined}
                  style={{
                    flex: 1, minWidth: 0, border: `1.5px solid ${rowWarnings.length ? C.warning : C.border}`, borderRadius: 9,
                    padding: '7px 10px', fontSize: 13, color: C.textStrong, background: C.surface, outline: 'none',
                    textOverflow: 'ellipsis',
                  }} />
                <button type="button" style={iconBtn} disabled={i === 0} aria-label={t.plMoveUp}
                  onClick={() => onChange(moveItem(items, i, i - 1))}><ArrowUp size={14} /></button>
                <button type="button" style={iconBtn} disabled={i === items.length - 1} aria-label={t.plMoveDown}
                  onClick={() => onChange(moveItem(items, i, i + 1))}><ArrowDown size={14} /></button>
                <button type="button" style={{ ...iconBtn, color: C.danger }} aria-label={t.plRemoveLine}
                  onClick={() => remove(i)}><Trash2 size={14} /></button>
              </div>
              {rowWarnings.map((w, k) => (
                <span key={k} role="note" style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11.5,
                  color: C.warning, paddingLeft: 22, lineHeight: 1.4 }}>
                  <AlertTriangle size={12} strokeWidth={2.2} aria-hidden style={{ flex: 'none', marginTop: 1 }} />{warningText(w)}
                </span>
              ))}
            </li>
          );
        })}
      </ol>

      <button type="button" onClick={add} style={{
        alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px dashed ${C.border}`,
        background: C.surface, color: C.textSecondary, borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer',
      }}>
        <Plus size={14} strokeWidth={2.4} aria-hidden />{t.plAddLine}
      </button>
    </div>
  );
}
