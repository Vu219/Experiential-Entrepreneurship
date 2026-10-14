import { Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useUiStore } from '../../store/useUiStore';
import { C } from '../../styles/colors';
import type { SearchArea } from '../../search/types';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
/** Nhãn phím tắt mở ô tìm kiếm theo hệ điều hành. */
export const SHORTCUT_LABEL = IS_MAC ? '⌘K' : 'Ctrl K';

/**
 * Lối vào ô tìm kiếm toàn cục trên topbar. Desktop: GIỮ NGUYÊN khung của ô tìm kiếm cũ (cùng padding/bo góc/
 * co giãn theo sidebar — quy ước "3 khối độc lập") nhưng là nút mở palette. Mobile: nút icon cạnh chuông.
 */
export default function SearchTrigger({ variant, area, maxWidth }: { variant: 'bar' | 'icon'; area: SearchArea; maxWidth?: number }) {
  const { t } = useApp();
  const openPalette = useUiStore((s) => s.openPalette);
  const placeholder = area === 'admin' ? t.gsPhAdmin : t.searchPh;

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={openPalette}
        aria-label={t.gsDialog}
        aria-haspopup="dialog"
        style={{
          width: 38, height: 38, borderRadius: 11, background: C.surfaceMuted, border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none',
        }}
      >
        <Search size={18} color={C.ink550} strokeWidth={1.8} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      aria-label={`${placeholder} (${SHORTCUT_LABEL})`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: C.surfaceMuted, border: `1px solid ${C.border}`, borderRadius: 12, padding: '9px 14px',
        flex: '1 1 auto', minWidth: 44, maxWidth, transition: 'max-width .2s ease',
        cursor: 'text', textAlign: 'left', font: 'inherit', overflow: 'hidden',
      }}
    >
      <Search size={17} color={C.ink350} strokeWidth={1.8} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {placeholder}
      </span>
      <kbd
        aria-hidden
        style={{
          flex: 'none', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: C.textMuted,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '2px 7px',
        }}
      >
        {SHORTCUT_LABEL}
      </kbd>
    </button>
  );
}
