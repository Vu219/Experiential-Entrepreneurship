import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Clock, FileText, Globe, Hash, PencilLine, Sparkles, Trash2, X, type LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { PlatformTag } from '../ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { PLATFORM_TO_TAG } from '../../api/connections.ts';
import type { FailedPost } from '../../api/failedPosts.ts';
import { fmtDate, fmtTime, httpDetailOf, isPolicy, toneOf, typeLabel } from './shared.ts';
import { C } from '../../styles/colors';

// Modal "Chi tiết lỗi" căn giữa màn hình (bottom sheet ở mobile) của layout master–detail:
// header (tiêu đề bài + badge loại lỗi + X), lưới meta 4 ô có icon, thông điệp nền tảng,
// 2 tab (Nội dung gốc / Phản hồi từ nền tảng), hàng hành động và nút Trước/Sau để lướt
// qua các bài lỗi không cần đóng. Vi phạm chính sách (BR-07): KHÔNG retry — nhấn mạnh sửa nội dung.
// Đóng bằng X / Esc / click overlay; khóa scroll nền; focus trap + trả focus về dòng vừa bấm
// (cùng pattern với components/Modal.tsx — modal này cần header/footer riêng nên không dùng chung).

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function MetaCell({ icon: IconCmp, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div style={{ background: C.surfaceSubtle, border: `1px solid ${C.surfaceMuted}`, borderRadius: 12, padding: '10px 13px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: C.textFaint, letterSpacing: 0.3, textTransform: 'uppercase' }}>
        <IconCmp size={12} strokeWidth={1.8} aria-hidden />
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink750, marginTop: 4, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, disabled, primary = false, danger = false }: {
  icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; primary?: boolean; danger?: boolean;
}) {
  const { brandGradient } = useApp();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={primary ? 'btn-grad' : 'btn-soft'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '8px 13px',
        fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        border: primary ? 'none' : `1px solid ${danger ? C.legacyBorderf2c9d4 : C.border}`,
        background: primary ? brandGradient : C.surface,
        color: primary ? C.onBrand : danger ? C.rose : C.ink600,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export default function ErrorDetailModal({
  post,
  index,
  total,
  busy,
  onClose,
  onNavigate,
  onEdit,
  onRegen,
  onDelete,
}: {
  post: FailedPost;
  /** Vị trí bài trong danh sách đã lọc (đánh số từ 0) — hiển thị i/n cạnh nút Trước/Sau. */
  index: number;
  total: number;
  busy: boolean;
  onClose: () => void;
  /** -1 = bài trước, +1 = bài sau (trong danh sách đã lọc). */
  onNavigate: (dir: -1 | 1) => void;
  onEdit: (post: FailedPost) => void;
  onRegen: (post: FailedPost) => void;
  onDelete: (post: FailedPost) => void;
}) {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();
  const panelRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'original' | 'response'>('original');
  // Lướt sang bài khác trong modal → quay về tab "Nội dung gốc".
  useEffect(() => { setTab('original'); }, [post.id]);

  // Esc + focus trap + khóa scroll nền + trả focus về dòng vừa bấm khi đóng (pattern Modal.tsx).
  useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(focusTimer);
      prevFocused?.focus?.();
    };
  }, [onClose]);

  const policy = isPolicy(post);
  const tone = toneOf(post);
  const platformTag = PLATFORM_TO_TAG[post.platformName] ?? post.platformName.slice(0, 2);

  // "Phản hồi từ nền tảng" dựng lại từ các trường FailedPost theo shape lỗi Graph API.
  const rawResponse = JSON.stringify(
    { error: { code: post.errorCode ? Number(post.errorCode) : null, type: httpDetailOf(post).split('· ')[1] ?? 'GraphError', message: post.errorMessage } },
    null,
    2,
  );

  const tabBtn = (key: 'original' | 'response', label: string) => {
    const active = tab === key;
    return (
      <button
        key={key}
        onClick={() => setTab(key)}
        style={{
          border: 'none', background: 'transparent', padding: '9px 2px', marginRight: 18, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 700, color: active ? C.primary : C.textMuted,
          borderBottom: `2px solid ${active ? C.primary : 'transparent'}`,
        }}
      >
        {label}
      </button>
    );
  };

  const navBtn = (dir: -1 | 1, label: string, icon: ReactNode) => {
    const disabled = dir === -1 ? index <= 0 : index >= total - 1;
    return (
      <button
        onClick={() => !disabled && onNavigate(dir)}
        disabled={disabled}
        className="btn-soft"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: '7px 12px', background: C.surface, fontSize: 12.5, fontWeight: 700,
          color: disabled ? C.ink200 : C.ink600, cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {dir === -1 && icon}
        {label}
        {dir === 1 && icon}
      </button>
    );
  };

  // Render qua portal ở document.body để overlay phủ toàn màn hình (không bị nhốt trong .view-pop).
  return createPortal(
    <div
      onMouseDown={onClose}
      className="modal-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: C.legacyBgrgba000_45_, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        padding: isMobile ? 0 : 18,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.fpDetail}
        onMouseDown={(e) => e.stopPropagation()}
        className={isMobile ? 'view-pop' : 'modal-scale-in'}
        style={{
          width: '100%', maxWidth: isMobile ? '100%' : 680, background: C.surface,
          borderRadius: isMobile ? '20px 20px 0 0' : 20,
          boxShadow: `0 40px 80px -30px ${C.legacyShadowrgba6030110_55_}`, padding: 22, position: 'relative',
          maxHeight: isMobile ? '92vh' : 'calc(100vh - 36px)', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 14, opacity: busy ? 0.7 : 1,
        }}
      >
        {/* Header: tiêu đề bài + badge loại lỗi + nút đóng */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingRight: 36 }}>
          <div style={{ flex: 1, minWidth: 0, fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15.5, color: C.textStrong, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {post.caption || t.fpNoCaption}
          </div>
          <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 800, padding: '3px 10px', borderRadius: 999, color: tone.color, background: tone.bg, marginTop: 2 }}>
            {typeLabel(post, t)}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, border: 'none', borderRadius: 9, background: C.surfaceMuted, color: C.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={16} strokeWidth={2} />
        </button>

        {/* Lưới meta 4 ô (mobile 2×2) */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 9 }}>
          <MetaCell icon={Hash} label={t.fpErrorCode}>
            <span style={{ fontFamily: 'ui-monospace, monospace', color: tone.color }}>{post.errorCode ? `#${post.errorCode}` : '—'}</span>
          </MetaCell>
          <MetaCell icon={Globe} label={t.fpHttpDetail}>{httpDetailOf(post)}</MetaCell>
          <MetaCell icon={FileText} label={t.fpPostId}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{post.contentItemId ?? post.id}</span>
          </MetaCell>
          <MetaCell icon={Clock} label={t.fpColTime}>{fmtDate(post.failedAt)} {fmtTime(post.failedAt)}</MetaCell>
        </div>

        {/* Thông điệp từ nền tảng */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textMuted, marginBottom: 6 }}>{t.fpPlatformMsg}</div>
          <div style={{ fontSize: 12.5, color: policy ? C.legacyTextb91c1c : C.amberText, background: policy ? C.legacyBgfdf1f1 : C.legacyBgfdf6e7, borderRadius: 10, padding: '10px 13px', lineHeight: 1.55 }}>
            {post.errorMessage || (policy ? t.fpPolicyExplain : t.fpTechExplain)}
          </div>
        </div>

        {/* 2 tab: Nội dung gốc / Phản hồi từ nền tảng */}
        <div>
          <div style={{ borderBottom: `1px solid ${C.surfaceMuted}` }}>
            {tabBtn('original', t.fpTabOriginal)}
            {tabBtn('response', t.fpTabResponse)}
          </div>
          {tab === 'original' ? (
            <div style={{ padding: '12px 2px 0', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <PlatformTag tag={platformTag} bg={PLATFORM_BG[platformTag] ?? '#6b7280'} size={30} radius={9} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>{post.accountName ?? '—'}</div>
                <div style={{ fontSize: 13, color: C.ink750, lineHeight: 1.6, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                  {post.caption || t.fpNoCaption}
                </div>
              </div>
            </div>
          ) : (
            <pre style={{ margin: '12px 0 0', background: '#241f3a', color: C.legacyTexte9e4f9, borderRadius: 12, padding: 14, fontSize: 11.5, lineHeight: 1.6, overflowX: 'auto', fontFamily: 'ui-monospace, monospace' }}>
              {rawResponse}
            </pre>
          )}
        </div>

        {/* Bạn muốn làm gì tiếp theo? */}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>{t.fpNext}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionBtn icon={<PencilLine size={13} />} label={t.fpActEdit} primary onClick={() => onEdit(post)} disabled={busy} />
            <ActionBtn icon={<Sparkles size={13} />} label={t.fpActRegen} onClick={() => onRegen(post)} disabled={busy} />
            <ActionBtn icon={<Trash2 size={13} />} label={t.fpActDelete} danger onClick={() => onDelete(post)} disabled={busy} />
          </div>
          {policy && <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 8, lineHeight: 1.5 }}>{t.fpPolicyExplain}</div>}
        </div>

        {/* Trước / Sau — lướt qua các bài lỗi ngay trong modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${C.surfaceMuted}`, paddingTop: 12 }}>
          {navBtn(-1, t.pgPrev, <ChevronLeft size={14} strokeWidth={2} />)}
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textFaint }}>{index + 1}/{total}</span>
          {navBtn(1, t.pgNext, <ChevronRight size={14} strokeWidth={2} />)}
        </div>
      </div>
    </div>,
    document.body,
  );
}
