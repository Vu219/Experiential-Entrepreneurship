import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useAppStore } from '../store/useAppStore';
import { DARK_MODE_ENABLED, type ColorMode } from '../store/colorMode';
import { C } from '../styles/colors';

const OPTIONS: { mode: ColorMode; icon: LucideIcon; key: 'cmLight' | 'cmDark' | 'cmSystem' }[] = [
  { mode: 'light', icon: Sun, key: 'cmLight' },
  { mode: 'dark', icon: Moon, key: 'cmDark' },
  { mode: 'system', icon: Monitor, key: 'cmSystem' },
];

/** Nút chọn chế độ Sáng / Tối / Theo hệ thống trên Topbar (cạnh nút ngôn ngữ).
 *  Ẩn hoàn toàn khi cờ VITE_ENABLE_DARK_MODE tắt. */
export default function ColorModeToggle() {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();
  const mode = useAppStore((s) => s.colorMode);
  const setColorMode = useAppStore((s) => s.setColorMode);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!DARK_MODE_ENABLED) return null;
  const Current = OPTIONS.find((o) => o.mode === mode)?.icon ?? Sun;

  return (
    <div ref={wrapRef} className="color-mode-toggle" style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.cmLabel}
        title={t.cmLabel}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        style={{
          width: isMobile ? 38 : 42, height: isMobile ? 38 : 42, borderRadius: 11,
          background: C.surfaceMuted, border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        <Current size={19} color={C.ink550} strokeWidth={1.8} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t.cmLabel}
          className="menu-pop"
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              setOpen(false);
              triggerRef.current?.focus();
              return;
            }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
            const current = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
              : (current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          }}
          style={{
            position: isMobile ? 'fixed' : 'absolute', right: isMobile ? 16 : 0,
            top: isMobile ? 62 : '100%', marginTop: 8, width: 200, maxWidth: 'calc(100vw - 32px)',
            background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
            boxShadow: C.shadowPop, overflow: 'hidden', zIndex: 120, padding: '6px 0',
          }}
        >
          {OPTIONS.map(({ mode: m, icon: OptIcon, key }) => {
            const selected = m === mode;
            return (
              <button
                key={m}
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setColorMode(m);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="menu-item"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                  border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  ...(selected ? { color: C.primary } : null),
                }}
              >
                <span className="menu-item__icon" style={{ display: 'flex', ...(selected ? { color: C.primary } : null) }}>
                  <OptIcon size={17} />
                </span>
                <span style={{ flex: 1, textAlign: 'left' }}>{t[key]}</span>
                {selected && <Check size={15} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
