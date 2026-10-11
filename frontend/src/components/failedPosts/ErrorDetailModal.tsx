import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2, ChevronLeft, ChevronRight, Clock, Copy, EyeOff, ExternalLink, LifeBuoy, Link2, PencilLine,
  RefreshCw, RotateCcw, Sparkles, X, XCircle, type LucideIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { PlatformTag } from '../ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { TONE_COLORS } from '../../statusTokens.ts';
import { PLATFORM_TO_TAG } from '../../api/connections.ts';
import { getFailedPost, type FailedPost, type FailedPostAttempt } from '../../api/failedPosts.ts';
import {
  platformDisplayName, publishErrorActionLabel, publishErrorCopy, type PublishErrorAction,
} from '../../api/publishErrorCatalog.ts';
import { attemptStatusLabel, fmtDate, fmtTime, STATE_TONE, stateLabel, toneOf, type FpDict } from './shared.ts';
import { C } from '../../styles/colors';

// Modal "Chi tiết lỗi" căn giữa (bottom sheet ở mobile) của layout master–detail:
//  1. tiêu đề thân thiện + badge vòng đời; nền tảng · tài khoản · thời gian · lượt thử;
//  2. "Chuyện gì đã xảy ra" / "Vì sao" / "Cách khắc phục" từng bước — câu chữ từ catalog theo MÃ chuẩn;
//  3. nút hành động theo `actions[]` backend trả (đã lọc theo vòng đời / nội dung đã sửa);
//  4. mã tham chiếu + nút sao chép; timeline các lần thử; nội dung bài gốc;
//  5. Trước/Sau để lướt qua các bài lỗi.
// KHÔNG còn khối "Phản hồi từ nền tảng" / mã HTTP: message gốc chỉ dành cho admin.
// Đóng bằng X / Esc / click overlay; khóa scroll nền; focus trap + trả focus về dòng vừa bấm (pattern Modal.tsx).

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const ACTION_ICON: Record<PublishErrorAction, LucideIcon> = {
  RECONNECT_ACCOUNT: Link2,
  EDIT_CONTENT: PencilLine,
  RETRY_NOW: RotateCcw,
  CHANGE_ACCOUNT: RefreshCw,
  OPEN_PLATFORM: ExternalLink,
  DISMISS: EyeOff,
  CONTACT_SUPPORT: LifeBuoy,
  AI_FIX: Sparkles,
};

/** Lỗi nội dung: sau khi sửa, "Thử lại ngay" đọc là "Đăng lại". */
const repostLabel = (post: FailedPost) =>
  post.contentChanged && (post.category === 'CONTENT' || post.category === 'MEDIA' || post.code === 'POLICY_VIOLATION');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: C.textMuted, letterSpacing: 0.2, textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function ActionBtn({ icon: IconCmp, label, onClick, disabled, primary = false, title }: {
  icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; primary?: boolean; title?: string;
}) {
  const { brandGradient } = useApp();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={primary ? 'btn-grad' : 'btn-soft'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '8px 13px',
        fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        border: primary ? 'none' : `1px solid ${C.border}`,
        background: primary ? brandGradient : C.surface,
        color: primary ? C.onBrand : C.ink600,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <IconCmp size={13} strokeWidth={2} />
      {label}
    </button>
  );
}


function resolutionLabel(a: FailedPostAttempt, t: FpDict): string | null {
  switch (a.resolution) {
    case 'RETRIED': return t.fpResRetried;
    case 'DISMISSED': return t.fpResDismissed;
    case 'CANCELLED': return t.fpResCancelled;
    default: return null;
  }
}

/** Timeline dựng từ chính dòng danh sách khi không gọi được API chi tiết (dữ liệu minh hoạ). */
function attemptsFromRow(post: FailedPost): FailedPostAttempt[] {
  return [{
    retryCount: Math.max(post.attempt - 1, 0),
    status: 'FAILED',
    code: post.code,
    platformCode: post.errorCode,
    startedAt: post.failedAt,
    finishedAt: post.failedAt,
    nextRetryAt: null,
    referenceCode: post.referenceCode,
    resolution: post.state === 'DISMISSED' ? 'DISMISSED' : null,
  }];
}

function Timeline({ post, demo }: { post: FailedPost; demo: boolean }) {
  const { t, lang } = useApp();
  const [attempts, setAttempts] = useState<FailedPostAttempt[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setAttempts(null);
    setFailed(false);
    if (demo) {
      setAttempts(attemptsFromRow(post));
      return;
    }
    getFailedPost(post.id)
      .then((d) => { if (alive) setAttempts(d.attempts); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [post, demo]);

  if (failed) return <div style={{ fontSize: 12.5, color: C.textMuted }}>{t.fpTimelineError}</div>;
  if (!attempts) return <div style={{ fontSize: 12.5, color: C.textMuted }}>{t.fpTimelineLoading}</div>;

  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
      {attempts.map((a, i) => {
        const ok = a.status === 'SUCCESS';
        const bad = a.status === 'FAILED';
        const tone = ok ? TONE_COLORS.success : bad ? TONE_COLORS.danger : TONE_COLORS.info;
        const IconCmp = ok ? CheckCircle2 : bad ? XCircle : Clock;
        const when = a.finishedAt ?? a.nextRetryAt ?? a.startedAt;
        const resolution = resolutionLabel(a, t);
        return (
          <li key={i} style={{ display: 'flex', gap: 10, position: 'relative', paddingBottom: i < attempts.length - 1 ? 12 : 0 }}>
            {i < attempts.length - 1 && (
              <span aria-hidden style={{ position: 'absolute', left: 9, top: 20, bottom: 0, width: 2, background: C.surfaceMuted }} />
            )}
            <IconCmp size={20} color={tone.color} strokeWidth={2} style={{ flex: 'none', background: C.surface, borderRadius: 999 }} aria-hidden />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5 }}>
                <span style={{ fontWeight: 700, color: C.ink750 }}>{t.fpAttemptN.replace('{n}', String(i + 1))}</span>
                <span style={{ fontWeight: 700, color: tone.color }}>{attemptStatusLabel(a.status, t)}</span>
                {resolution && <span style={{ color: C.textMuted }}>· {resolution}</span>}
                <span style={{ color: C.textFaint, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtDate(when)} {fmtTime(when)}
                </span>
              </div>
              {bad && a.code && (
                <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                  {publishErrorCopy(lang, a.code, { platform: platformDisplayName(post.platformName), account: post.accountName }).title}
                  {a.referenceCode && <span style={{ color: C.textFaint, fontFamily: 'ui-monospace, monospace' }}> · {a.referenceCode}</span>}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function ErrorDetailModal({
  post,
  index,
  total,
  busy,
  demo,
  onClose,
  onNavigate,
  onAction,
  onCopyReference,
}: {
  post: FailedPost;
  /** Vị trí bài trong danh sách đã lọc (đánh số từ 0) — hiển thị i/n cạnh nút Trước/Sau. */
  index: number;
  total: number;
  busy: boolean;
  /** Dữ liệu minh hoạ (dev) — không gọi API chi tiết. */
  demo: boolean;
  onClose: () => void;
  /** -1 = bài trước, +1 = bài sau (trong danh sách đã lọc). */
  onNavigate: (dir: -1 | 1) => void;
  onAction: (action: PublishErrorAction, post: FailedPost) => void;
  onCopyReference: (reference: string) => void;
}) {
  const { t, lang } = useApp();
  const { isMobile } = useBreakpoint();
  const panelRef = useRef<HTMLDivElement>(null);

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

  const platform = platformDisplayName(post.platformName);
  const copy = publishErrorCopy(lang, post.code, { platform, account: post.accountName });
  const tone = toneOf(post);
  const stateTone = TONE_COLORS[STATE_TONE[post.state]];
  const platformTag = PLATFORM_TO_TAG[post.platformName] ?? post.platformName.slice(0, 2);
  const attemptText = post.maxAttempts
    ? t.fpAttemptOf.replace('{n}', String(post.attempt)).replace('{max}', String(post.maxAttempts))
    : t.fpAttemptN.replace('{n}', String(Math.max(post.attempt, 1)));

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
          width: '100%', maxWidth: isMobile ? '100%' : 700, background: C.surface,
          borderRadius: isMobile ? '20px 20px 0 0' : 20,
          boxShadow: `0 40px 80px -30px ${C.legacyShadowrgba6030110_55_}`, padding: 22, position: 'relative',
          maxHeight: isMobile ? '92vh' : 'calc(100vh - 36px)', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16, opacity: busy ? 0.7 : 1,
        }}
      >
        {/* Header: tiêu đề thân thiện của lỗi + vòng đời */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingRight: 36 }}>
          <span aria-hidden style={{ width: 4, alignSelf: 'stretch', borderRadius: 999, background: tone.color, flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 16.5, color: C.textStrong, lineHeight: 1.35 }}>
              {copy.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 7, fontSize: 12, color: C.textMuted }}>
              <PlatformTag tag={platformTag} bg={PLATFORM_BG[platformTag] ?? C.gray} size={20} radius={6} />
              <span style={{ fontWeight: 700, color: C.ink600 }}>{post.accountName ?? '—'}</span>
              <span aria-hidden>·</span>
              <span>{fmtDate(post.failedAt)} {fmtTime(post.failedAt)}</span>
              <span aria-hidden>·</span>
              <span>{attemptText}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, color: stateTone.color, background: stateTone.bg }}>
                {stateLabel(post.state, t)}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t.close}
          style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, border: 'none', borderRadius: 9, background: C.surfaceMuted, color: C.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={16} strokeWidth={2} />
        </button>

        {post.state === 'AUTO_RETRYING' && post.nextRetryAt && (
          <div role="status" style={{ display: 'flex', gap: 9, alignItems: 'center', background: TONE_COLORS.info.bg, color: TONE_COLORS.info.color, borderRadius: 11, padding: '10px 13px', fontSize: 12.5, fontWeight: 600 }}>
            <Clock size={15} strokeWidth={2} aria-hidden />
            {t.fpNextRetryAt.replace('{time}', `${fmtTime(post.nextRetryAt)} ${fmtDate(post.nextRetryAt)}`)}
          </div>
        )}

        <Section title={t.fpWhat}>
          <div style={{ fontSize: 13.5, color: C.ink750, lineHeight: 1.6 }}>{copy.what}</div>
        </Section>
        <Section title={t.fpWhy}>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>{copy.why}</div>
        </Section>
        <Section title={t.fpHowToFix}>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {copy.steps.map((step, i) => (
              <li key={i} style={{ fontSize: 13, color: C.ink650, lineHeight: 1.55 }}>{step}</li>
            ))}
          </ol>
        </Section>

        {/* Bạn muốn làm gì tiếp theo? — nút theo actions[] của backend */}
        {post.actions.length > 0 && (
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>{t.fpNext}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {post.actions.map((action, i) => {
                const blocked = action === 'RETRY_NOW' && !post.accountReady;
                const label = action === 'RETRY_NOW' && repostLabel(post)
                  ? t.fpRepost
                  : publishErrorActionLabel(lang, action, { platform });
                return (
                  <ActionBtn
                    key={action}
                    icon={ACTION_ICON[action]}
                    label={label}
                    primary={i === 0}
                    disabled={busy || blocked}
                    title={blocked ? t.fpAccountNotReady : undefined}
                    onClick={() => onAction(action, post)}
                  />
                );
              })}
            </div>
            {post.actions.includes('RETRY_NOW') && !post.accountReady && (
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>{t.fpAccountNotReady}</div>
            )}
            {post.actions.includes('EDIT_CONTENT') && !post.actions.includes('RETRY_NOW') && (
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8 }}>{t.fpEditFirst}</div>
            )}
          </div>
        )}

        {post.referenceCode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: C.surfaceSubtle, border: `1px solid ${C.surfaceMuted}`, borderRadius: 11, padding: '9px 12px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>{t.fpReference}</span>
            <code style={{ fontSize: 12.5, fontWeight: 800, color: C.ink750, fontFamily: 'ui-monospace, monospace' }}>{post.referenceCode}</code>
            <button
              onClick={() => onCopyReference(post.referenceCode!)}
              className="btn-soft"
              aria-label={t.fpCopyReference}
              title={t.fpCopyReference}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 8, padding: '5px 9px', fontSize: 12, fontWeight: 700, color: C.ink600, cursor: 'pointer' }}
            >
              <Copy size={12} strokeWidth={2} />
              {t.fpCopyReference}
            </button>
          </div>
        )}

        <Section title={t.fpTimeline}>
          <Timeline post={post} demo={demo} />
        </Section>

        <Section title={t.fpPostContent}>
          <div style={{ fontSize: 13, color: C.ink750, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: C.surfaceSubtle, borderRadius: 11, padding: '10px 13px' }}>
            {post.caption || t.fpNoCaption}
          </div>
        </Section>

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
