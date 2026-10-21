import { useId, useState, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { C } from '../styles/colors';

/**
 * Icon "?" kèm giải thích ngắn hiện khi hover / focus (bàn phím) — thay cho đoạn chú thích dài dưới ô nhập.
 * Nội dung gắn `aria-describedby` để trình đọc màn hình đọc được.
 */
export default function Tooltip({ text, children, width = 260 }: { text: string; children?: ReactNode; width?: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-describedby={id} aria-label={text}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, padding: 0,
          border: 'none', background: 'transparent', color: C.textFaint, cursor: 'help', borderRadius: 6,
        }}>
        {children ?? <HelpCircle size={14} strokeWidth={2} aria-hidden />}
      </button>
      <span id={id} role="tooltip" style={{
        position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', zIndex: 30,
        width: 'max-content', maxWidth: width, padding: '8px 10px', borderRadius: 9, background: C.ink900, color: C.surface,
        fontSize: 12, lineHeight: 1.45, fontWeight: 500, boxShadow: C.shadowModal, pointerEvents: 'none',
        opacity: open ? 1 : 0, visibility: open ? 'visible' : 'hidden', transition: 'opacity .12s',
        whiteSpace: 'normal', textAlign: 'left',
      }}>
        {text}
      </span>
    </span>
  );
}
