import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Film,
  Globe,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  PencilLine,
  Play,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { useToast } from '../toast/ToastProvider.tsx';
import { PlatformTag } from '../ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { PLATFORM_TO_TAG } from '../../api/connections.ts';
import { TONE_COLORS } from '../../statusTokens.ts';
import { alpha } from '../../styles/colors.ts';
import type { PostSchedule } from '../../api/schedules.ts';
import { STATUS_TONE } from './statusMeta.ts';
import { fmtDate, fmtTime, WEEKDAYS_FULL } from './dateUtils.ts';
import { C } from '../../styles/colors';

interface ScheduleDetailModalProps {
  schedule: PostSchedule | null;
  isOpen: boolean;
  onClose: () => void;
  onReschedule: (schedule: PostSchedule) => void;
  onCancel: (schedule: PostSchedule) => void;
  /** Mở đúng bài của lịch để sửa nội dung. */
  onEditContent: (schedule: PostSchedule) => void;
  onPublishNow?: (schedule: PostSchedule) => void;
  confirmingCancel?: boolean;
  busy?: boolean;
}

/** Tách hashtags và text từ caption để highlight đẹp mắt */
function renderFormattedCaption(text: string, hashtags: string[] = []) {
  if (!text) return null;

  const parts = text.split(/(#[a-zA-Z0-9_\u00C0-\u1EF9]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('#')) {
          return (
            <span key={i} style={{ color: C.primary, fontWeight: 600 }}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
      {hashtags.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {hashtags.map((h, i) => (
            <span
              key={i}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.primary,
                background: C.surfaceMuted,
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              #{h.replace(/^#/, '')}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export default function ScheduleDetailModal({
  schedule,
  isOpen,
  onClose,
  onReschedule,
  onCancel,
  onEditContent,
  onPublishNow,
  confirmingCancel = false,
  busy = false,
}: ScheduleDetailModalProps) {
  const { t, lang, go, brandGradient } = useApp();
  const toast = useToast();
  const { isMobile } = useBreakpoint();
  const panelRef = useRef<HTMLDivElement>(null);
  const [showScript, setShowScript] = useState(false);
  const [copied, setCopied] = useState(false);

  // Esc listener và khóa scroll khi modal mở
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !schedule) return null;

  const tone = TONE_COLORS[STATUS_TONE[schedule.status]] ?? TONE_COLORS.neutral;
  const tag = PLATFORM_TO_TAG[schedule.platformName] ?? schedule.platformName.slice(0, 2);
  const version = schedule.contentVersion;
  const caption = version?.formattedCaption ?? '';
  const hashtags = version?.formattedHashtags ?? [];
  const script = version?.script;
  const hasScript = !!(script?.hook?.content || (script?.steps && script.steps.length > 0) || script?.cta?.content);

  // Tính toán thời gian
  const dateObj = new Date(schedule.scheduledTime.slice(0, 19));
  const weekdayIndex = (dateObj.getDay() + 6) % 7;
  const langKey = (lang === 'en' ? 'en' : 'vi') as 'vi' | 'en';
  const weekdayName = WEEKDAYS_FULL[langKey]?.[weekdayIndex] ?? WEEKDAYS_FULL.vi[weekdayIndex];
  const timeFormatted = fmtTime(schedule.scheduledTime);
  const dateFormatted = fmtDate(schedule.scheduledTime);
  const isPast = dateObj.getTime() < Date.now();

  const canPublishNow = schedule.status === 'SCHEDULED' || schedule.status === 'ON_HOLD';
  const canReschedule = schedule.status === 'SCHEDULED' || schedule.status === 'ON_HOLD';
  const canCancel = schedule.status === 'SCHEDULED' || schedule.status === 'ON_HOLD' || schedule.status === 'FAILED';

  const isFailed = schedule.status === 'FAILED';
  const isOnHold = schedule.status === 'ON_HOLD';
  const isPosted = schedule.status === 'POSTED';

  const handleCopyCaption = async () => {
    if (!caption) return;
    try {
      const fullText =
        hashtags.length > 0
          ? `${caption}\n\n${hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}`
          : caption;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success(lang === 'en' ? 'Caption copied to clipboard!' : 'Đã sao chép nội dung bài viết!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(lang === 'en' ? 'Failed to copy' : 'Không thể sao chép văn bản');
    }
  };

  return createPortal(
    <div
      onMouseDown={onClose}
      className="modal-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: C.legacyBgrgba201438055_,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 12 : 20,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={lang === 'en' ? 'Schedule Details' : 'Chi tiết lịch đăng'}
        onMouseDown={(e) => e.stopPropagation()}
        className="modal-scale-in"
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : 940,
          maxHeight: isMobile ? '92vh' : '88vh',
          background: C.surface,
          borderRadius: isMobile ? 20 : 24,
          boxShadow: `0 32px 80px -20px ${C.legacyShadowrgba402090045_}, 0 0 1px 1px ${C.legacyShadowrgba12458237008_}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Header Modal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: `1px solid ${C.border}`,
            background: C.surface,
            flex: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: C.surfaceMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.primary,
              }}
            >
              <Calendar size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 17, color: C.textStrong }}>
                {lang === 'en' ? 'Schedule Details' : 'Chi tiết lịch đăng'}
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>
                ID: <code style={{ fontFamily: 'monospace' }}>{schedule.id.slice(0, 8)}</code>
                {schedule.contentVersion?.id && (
                  <span> · Version: <code style={{ fontFamily: 'monospace' }}>{schedule.contentVersion.id.slice(0, 8)}</code></span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              border: 'none',
              borderRadius: 9,
              background: C.surfaceMuted,
              color: C.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            className={"dm-hover-b61817e"}


          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Nội dung 2 cột cuộn nội bộ */}
        <div
          className="custom-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: isMobile ? '16px' : '22px 24px',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.25fr 1fr',
            gap: 22,
            alignItems: 'start',
          }}
        >
          {/* CỘT BÊN TRÁI (~55% - 60%): Thông tin bài viết, kênh, trạng thái, thời gian, kịch bản */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Card Kênh & Trạng thái */}
            <div
              style={{
                background: C.surfaceSubtle,
                border: `1px solid ${C.surfaceMuted}`,
                borderRadius: 16,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                {schedule.platformAccountAvatarUrl ? (
                  <img
                    src={schedule.platformAccountAvatarUrl}
                    alt={schedule.platformAccountName}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `2px solid ${C.shell}`,
                      boxShadow: `0 2px 8px ${C.legacyShadowrgba000008_}`,
                    }}
                  />
                ) : (
                  <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={42} radius={12} fontSize={14} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 14.5,
                        color: C.textStrong,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {schedule.platformAccountName}
                    </span>
                    <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={18} radius={5} fontSize={9} />
                  </div>
                  <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                    {schedule.platformName === 'FACEBOOK'
                      ? 'Facebook Fanpage'
                      : schedule.platformName === 'INSTAGRAM'
                      ? 'Instagram Business'
                      : 'Threads Profile'}
                  </div>
                </div>
              </div>

              <span
                style={{
                  flex: 'none',
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: 999,
                  color: tone.color,
                  background: tone.bg,
                  border: `1px solid ${alpha(tone.color, 0x35 / 255)}`,
                }}
              >
                {t[`schSt${schedule.status}` as keyof typeof t] as string}
              </span>
            </div>

            {/* Thông báo cảnh báo nếu FAILED hoặc ON_HOLD */}
            {isFailed && (
              <div
                style={{
                  background: C.legacyBgfdf1f1,
                  border: `1px solid ${C.legacyBorderf9d2d8}`,
                  borderRadius: 14,
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.legacyTextb91c1c, fontWeight: 800, fontSize: 13 }}>
                  <AlertTriangle size={16} />
                  {lang === 'en' ? 'Publishing Failed' : 'Đăng bài không thành công'}
                </div>
                <div style={{ fontSize: 12, color: C.legacyText991b1b, marginTop: 6, lineHeight: 1.5 }}>
                  {t.schFailedHint}
                </div>
                <button
                  onClick={() => {
                    onClose();
                    go('failedPosts');
                  }}
                  style={{
                    marginTop: 8,
                    background: 'none',
                    border: 'none',
                    color: C.legacyTextb91c1c,
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {lang === 'en' ? 'Open Failed Posts Center' : 'Mở Trung tâm bài lỗi & khắc phục'}
                  <ChevronRight size={13} />
                </button>
              </div>
            )}

            {isOnHold && (
              <div
                style={{
                  background: C.legacyBgfdf6e7,
                  border: `1px solid ${C.legacyBorderf6e2b3}`,
                  borderRadius: 14,
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.amberText, fontWeight: 800, fontSize: 13 }}>
                  <AlertTriangle size={16} />
                  {lang === 'en' ? 'Post On Hold' : 'Lịch đăng đang tạm giữ'}
                </div>
                <div style={{ fontSize: 12, color: C.legacyText92400e, marginTop: 6, lineHeight: 1.5 }}>
                  {t.schOnHoldHint}
                </div>
              </div>
            )}

            {/* Khối Thời gian đăng */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div style={{ background: C.surfaceSubtle, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' }}>
                  <Clock size={13} />
                  {lang === 'en' ? 'Time (GMT+7)' : 'Khung giờ đăng'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.textStrong, marginTop: 4 }}>
                  {timeFormatted}
                </div>
                <div style={{ fontSize: 11, color: isPast ? C.rose : C.success, fontWeight: 600, marginTop: 2 }}>
                  {isPast ? (lang === 'en' ? 'Past time' : 'Đã qua giờ') : (lang === 'en' ? 'Upcoming' : 'Sắp đến')}
                </div>
              </div>

              <div style={{ background: C.surfaceSubtle, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' }}>
                  <Calendar size={13} />
                  {lang === 'en' ? 'Scheduled Date' : 'Ngày đăng'}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.textStrong, marginTop: 4 }}>
                  {dateFormatted}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  {weekdayName}
                </div>
              </div>
            </div>

            {/* Khối Caption & Hashtags có nút Sao chép */}
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {lang === 'en' ? 'Post Content' : 'Nội dung bài viết'}
                </span>
                <button
                  onClick={handleCopyCaption}
                  disabled={!caption}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    border: `1px solid ${C.legacyBordere5e0f2}`,
                    background: copied ? C.successSoft : C.surfaceSubtle,
                    color: copied ? C.success : C.primary,
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: caption ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? (lang === 'en' ? 'Copied' : 'Đã sao chép') : (lang === 'en' ? 'Copy Text' : 'Sao chép văn bản')}</span>
                </button>
              </div>

              <div
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  color: C.ink750,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 160,
                  overflowY: 'auto',
                  paddingRight: 4,
                }}
                className="custom-scrollbar"
              >
                {caption ? (
                  renderFormattedCaption(caption, hashtags)
                ) : (
                  <span style={{ fontStyle: 'italic', color: C.textFaint }}>{t.schNoCaption}</span>
                )}
              </div>

              {version?.cta && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: `1px solid ${C.surfaceMuted}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary }}>Call to action:</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.primary, background: C.legacyBgefe9fb, padding: '3px 10px', borderRadius: 6 }}>
                    {version.cta}
                  </span>
                </div>
              )}
            </div>

            {/* Video Script / Phân cảnh (nếu có) */}
            {hasScript && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <button
                  onClick={() => setShowScript(!showScript)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: C.surfaceSubtle,
                    border: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: C.ink750 }}>
                    <Film size={15} color={C.primary} />
                    <span>{lang === 'en' ? 'Video Script & Scene Details' : 'Kịch bản Video & Phân cảnh'}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.primary }}>
                    {showScript ? (lang === 'en' ? 'Hide' : 'Thu gọn') : (lang === 'en' ? 'View' : 'Xem chi tiết')}
                  </span>
                </button>

                {showScript && (
                  <div style={{ padding: 14, background: C.surface, display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${C.border}` }}>
                    {script?.hook?.content && (
                      <div style={{ background: C.surfaceSubtle, padding: 10, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: C.primary, marginBottom: 4 }}>
                          HOOK ({script.hook.timing ?? '0-3s'})
                        </div>
                        <div style={{ fontSize: 12.5, color: C.ink750, lineHeight: 1.5 }}>{script.hook.content}</div>
                        {script.hook.sceneSuggestion && (
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                            Gợi ý cảnh: {script.hook.sceneSuggestion}
                          </div>
                        )}
                      </div>
                    )}

                    {script?.steps && script.steps.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {script.steps.map((st, idx) => (
                          <div key={idx} style={{ background: C.surface, border: `1px solid ${C.surfaceMuted}`, padding: 10, borderRadius: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: C.ink650, marginBottom: 2 }}>
                              {lang === 'en' ? `Step ${st.index ?? idx + 1}` : `Phần ${st.index ?? idx + 1}`}
                            </div>
                            <div style={{ fontSize: 12.5, color: C.ink750, lineHeight: 1.5 }}>{st.content}</div>
                            {st.sceneSuggestion && (
                              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                                Gợi ý cảnh: {st.sceneSuggestion}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {script?.cta?.content && (
                      <div style={{ background: C.surfaceSubtle, padding: 10, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: C.primary, marginBottom: 4 }}>
                          CTA KẾT THÚC ({script.cta.timing ?? 'Cuối'})
                        </div>
                        <div style={{ fontSize: 12.5, color: C.ink750, lineHeight: 1.5 }}>{script.cta.content}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CỘT BÊN PHẢI (~40% - 45%): Mockup bài đăng trực quan */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {lang === 'en' ? 'Social Post Mockup' : 'Bản xem trước mạng xã hội'}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted, background: C.surfaceMuted, padding: '2px 8px', borderRadius: 999 }}>
                {version?.mediaFormat ?? (schedule.platformName === 'INSTAGRAM' ? 'Post (1:1)' : 'Standard Post')}
              </span>
            </div>

            {/* Khung bài đăng mạng xã hội chân thực */}
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.legacyBordere5e0f2}`,
                borderRadius: 18,
                overflow: 'hidden',
                boxShadow: `0 10px 25px -10px ${C.legacyShadowrgba7040120012_}`,
              }}
            >
              {/* Header bài đăng */}
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.bg}` }}>
                <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={32} radius={8} fontSize={11} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textStrong, lineHeight: 1.3 }}>
                    {schedule.platformAccountName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textMuted }}>
                    <span>{timeFormatted} · {dateFormatted}</span>
                    <span>•</span>
                    <Globe size={11} />
                  </div>
                </div>
              </div>

              {/* Caption preview ngắn */}
              <div
                style={{
                  padding: '12px 14px',
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: C.ink750,
                  maxHeight: 90,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
                className="custom-scrollbar"
              >
                {caption ? renderFormattedCaption(caption, hashtags) : (
                  <span style={{ fontStyle: 'italic', color: C.textFaint }}>{t.schNoCaption}</span>
                )}
              </div>

              {/* Media Preview Box */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: version?.mediaFormat === 'REELS' || version?.mediaFormat === 'STORY' ? '9/16' : '16/9',
                  maxHeight: 220,
                  background: 'linear-gradient(135deg, #1f1838 0%, #352668 50%, #4f2d7f 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  color: '#fff',
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, opacity: 0.15, background: 'radial-gradient(circle at center, #8b5cf6 0%, transparent 70%)' }} />

                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: C.legacyBgrgba255255255018_,
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                    boxShadow: `0 4px 12px ${C.legacyShadowrgba00002_}`,
                  }}
                >
                  {version?.mediaFormat === 'REELS' ? (
                    <Play size={18} fill="#fff" stroke="none" style={{ marginLeft: 2 }} />
                  ) : (
                    <ImageIcon size={20} color="#fff" />
                  )}
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: C.legacyTextf3efff }}>
                  {version?.mediaFormat ?? (schedule.platformName === 'INSTAGRAM' ? 'Instagram Photo' : 'Featured Image')}
                </div>

                {version?.imagePrompt && (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: C.legacyTextc9bce8,
                      maxWidth: '85%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 4,
                    }}
                    title={version.imagePrompt}
                  >
                    Prompt: {version.imagePrompt}
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    background: C.legacyBgrgba00005_,
                    backdropFilter: 'blur(4px)',
                    padding: '2px 7px',
                    borderRadius: 5,
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  Feed Mockup
                </div>
              </div>

              {/* Social Interactions Bar Mockup */}
              <div
                style={{
                  padding: '10px 14px',
                  borderTop: `1px solid ${C.bg}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  color: C.textMuted,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Heart size={14} />
                  <span>Like</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MessageCircle size={14} />
                  <span>Comment</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Share2 size={14} />
                  <span>Share</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Modal cố định */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 24px',
            borderTop: `1px solid ${C.border}`,
            background: C.surface,
            flex: 'none',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                background: C.surface,
                color: C.ink550,
                cursor: 'pointer',
              }}
            >
              {lang === 'en' ? 'Close' : 'Đóng'}
            </button>

            {canCancel && (
              <button
                onClick={() => onCancel(schedule)}
                disabled={busy}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: `1px solid ${confirmingCancel ? C.rose : C.legacyBorderf2c9d4}`,
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: confirmingCancel ? '#e23d6e' : C.surface,
                  color: confirmingCancel ? '#fff' : C.rose,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Trash2 size={14} />
                {confirmingCancel ? t.schConfirmCancel : isFailed ? t.schResetFailed : t.schCancel}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {(isFailed || schedule.status === 'SCHEDULED') && (
              <button
                onClick={() => onEditContent(schedule)}
                disabled={busy}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: C.surface,
                  color: C.ink650,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                <PencilLine size={14} />
                {t.schEditContent}
              </button>
            )}

            {canReschedule && (
              <button
                onClick={() => onReschedule(schedule)}
                disabled={busy}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: `1px solid ${C.legacyBorderd4cbf2}`,
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: C.bg,
                  color: C.primary,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                <Clock size={14} />
                {schedule.status === 'ON_HOLD' ? t.schReactivate : t.schReschedule}
              </button>
            )}

            {isFailed && (
              <button
                onClick={() => onReschedule(schedule)}
                disabled={busy}
                className="btn-grad"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: brandGradient,
                  color: C.onBrand,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                <RotateCcw size={14} />
                {lang === 'en' ? 'Retry Post' : 'Thử lại ngay'}
              </button>
            )}

            {canPublishNow && onPublishNow && (
              <button
                onClick={() => onPublishNow(schedule)}
                disabled={busy}
                className="btn-grad"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: brandGradient,
                  color: C.onBrand,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                <Send size={14} />
                {lang === 'en' ? 'Publish Now' : 'Đăng ngay'}
              </button>
            )}

            {isPosted && (
              <button
                onClick={() => {
                  onClose();
                  go('analytics');
                }}
                className="btn-grad"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: brandGradient,
                  color: C.onBrand,
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={14} />
                {lang === 'en' ? 'View Analytics' : 'Xem hiệu quả'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
