import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Copy,
  Film,
  Globe,
  Image as ImageIcon,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  PencilLine,
  Play,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  ThumbsUp,
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

export interface ScheduleDetailViewProps {
  schedule: PostSchedule;
  onBack: () => void;
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
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {hashtags.map((h, i) => (
            <span
              key={i}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.primary,
                background: C.surfaceMuted,
                padding: '3px 9px',
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

export default function ScheduleDetailView({
  schedule,
  onBack,
  onReschedule,
  onCancel,
  onEditContent,
  onPublishNow,
  confirmingCancel = false,
  busy = false,
}: ScheduleDetailViewProps) {
  const { t, lang, go, brandGradient } = useApp();
  const toast = useToast();
  const { isMobile } = useBreakpoint();

  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mockupExpanded, setMockupExpanded] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn lên trên đầu trang ngay khúc breadcrumb "Lịch đăng bài / Chi tiết lịch đăng"
  useLayoutEffect(() => {
    const orig = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    document.documentElement.style.scrollBehavior = orig;
  }, [schedule.id]);

  useEffect(() => {
    const scrollToTop = () => {
      const orig = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const breadcrumb = document.getElementById('schedule-detail-breadcrumb');
      if (breadcrumb) {
        breadcrumb.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
      document.documentElement.style.scrollBehavior = orig;
    };

    scrollToTop();
    const frameId = requestAnimationFrame(scrollToTop);
    const timer1 = setTimeout(scrollToTop, 50);
    const timer2 = setTimeout(scrollToTop, 150);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [schedule.id]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

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

  const isFailed = schedule.status === 'FAILED';
  const isOnHold = schedule.status === 'ON_HOLD';
  const isPosted = schedule.status === 'POSTED';
  const isScheduled = schedule.status === 'SCHEDULED';

  const isVideo = version?.mediaFormat === 'REELS' || version?.mediaFormat === 'STORY' || hasScript;

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

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(schedule.id);
      toast.success(lang === 'en' ? 'Schedule ID copied!' : 'Đã sao chép mã ID lịch đăng!');
      setDropdownOpen(false);
    } catch {
      toast.error(lang === 'en' ? 'Failed to copy ID' : 'Không thể sao chép ID');
    }
  };

  return (
    <div ref={containerRef} style={{ width: '100%', maxWidth: '100%' }}>
      {/* Breadcrumb quay lại */}
      <div
        id="schedule-detail-breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          fontSize: 13,
          color: C.textSecondary,
          scrollMarginTop: 85,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            padding: '4px 8px 4px 0',
            color: C.primary,
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 13,
            borderRadius: 6,
            transition: 'color 0.15s ease',
          }}
          className={"dm-hover-9f72e0d"}


        >
          <ArrowLeft size={16} />
          <span>{lang === 'en' ? 'Back to Calendar' : 'Lịch đăng bài'}</span>
        </button>
        <span style={{ color: C.legacyTextc4b5fd }}>/</span>
        <span style={{ color: C.textStrong, fontWeight: 600 }}>
          {lang === 'en' ? 'Schedule Details' : 'Chi tiết lịch đăng'}
        </span>
      </div>

      {/* Card Container lớn màu trắng */}
      <div
        className="bg-[var(--c-shell)] rounded-2xl shadow-sm border border-slate-100/80"
        style={{
          background: C.surface,
          borderRadius: 24,
          border: `1px solid ${C.border}`,
          boxShadow: `0 4px 24px -6px ${C.legacyShadowrgba332856005_}, 0 1px 2px ${C.legacyShadowrgba000002_}`,
          padding: isMobile ? '20px 16px' : '28px 32px',
        }}
      >
        {/* HEADER CARD */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 22,
            borderBottom: `1px solid ${C.surfaceMuted}`,
            marginBottom: 26,
            gap: 16,
          }}
        >
          {/* Góc trái: Icon lịch, tiêu đề lớn, ID & Version */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: C.surfaceMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.primary,
                flexShrink: 0,
              }}
            >
              <Calendar size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 800,
                  fontSize: isMobile ? 18 : 22,
                  color: C.textStrong,
                  margin: 0,
                  lineHeight: 1.25,
                }}
              >
                {lang === 'en' ? 'Schedule Details' : 'Chi tiết lịch đăng'}
              </h1>
              <div
                style={{
                  fontSize: 12,
                  color: C.textMuted,
                  marginTop: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  ID: <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{schedule.id.slice(0, 8)}</code>
                </span>
                <span>·</span>
                <span>
                  Version:{' '}
                  <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {schedule.contentVersion?.id ? schedule.contentVersion.id.slice(0, 8) : 'd7dc9756'}
                  </code>
                </span>
              </div>
            </div>
          </div>

          {/* Góc phải: Menu hành động nhanh "..." & Nút "X" đóng */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            {/* Nút "..." dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="Actions"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: dropdownOpen ? C.surfaceMuted : C.surface,
                  color: C.ink550,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                className={"dm-hover-32465b1"}


              >
                <MoreHorizontal size={18} />
              </button>

              {dropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: 200,
                    background: C.surface,
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    boxShadow: `0 12px 30px -8px ${C.legacyShadowrgba352065016_}`,
                    padding: 6,
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onReschedule(schedule);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.ink750,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    className={"dm-hover-0863acb"}


                  >
                    <Clock size={15} color={C.primary} />
                    <span>{schedule.status === 'ON_HOLD' ? t.schReactivate : t.schReschedule}</span>
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onEditContent(schedule);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.ink750,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    className={"dm-hover-ac7312d"}


                  >
                    <PencilLine size={15} color={C.textSecondary} />
                    <span>{t.schEditContent}</span>
                  </button>

                  <button
                    onClick={handleCopyId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.ink750,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    className={"dm-hover-0298a54"}


                  >
                    <Copy size={15} color={C.textSecondary} />
                    <span>{lang === 'en' ? 'Copy ID' : 'Sao chép ID'}</span>
                  </button>

                  <div style={{ height: 1, background: C.surfaceMuted, margin: '4px 0' }} />

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onCancel(schedule);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.rose,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    className={"dm-hover-2c0f366"}


                  >
                    <Trash2 size={15} color={C.rose} />
                    <span>{confirmingCancel ? t.schConfirmCancel : t.schCancel}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Nút "X" đóng */}
            <button
              onClick={onBack}
              aria-label="Close"
              style={{
                width: 38,
                height: 38,
                border: 'none',
                borderRadius: 10,
                background: C.surfaceMuted,
                color: C.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              className={"dm-hover-1c7c845"}


            >
              <X size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* BỐ CỤC 2 CỘT: Cột Trái (~60%) & Cột Phải (~40%) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.35fr 1fr',
            gap: isMobile ? 24 : 32,
            alignItems: isMobile ? 'start' : 'stretch',
          }}
        >
          {/* CỘT TRÁI (~60% width) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Block Kênh đăng */}
            <div
              style={{
                background: C.surfaceSubtle,
                border: `1px solid ${C.surfaceMuted}`,
                borderRadius: 16,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                {schedule.platformAccountAvatarUrl ? (
                  <img
                    src={schedule.platformAccountAvatarUrl}
                    alt={schedule.platformAccountName}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `2px solid ${C.shell}`,
                      boxShadow: `0 2px 8px ${C.legacyShadowrgba000008_}`,
                    }}
                  />
                ) : (
                  <PlatformTag
                    tag={tag}
                    bg={PLATFORM_BG[tag] ?? '#1877F2'}
                    size={46}
                    radius={999}
                    fontSize={15}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 15.5,
                        color: C.textStrong,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {schedule.platformAccountName || 'AIMA Marketing'}
                    </span>
                    {/* Tích xanh verify Facebook / Page */}
                    <span
                      title="Trang đã xác thực"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 17,
                        height: 17,
                        borderRadius: '50%',
                        backgroundColor: '#1877F2',
                        color: '#ffffff',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={11} strokeWidth={3.5} />
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                    {schedule.platformName === 'FACEBOOK'
                      ? 'Facebook Fanpage'
                      : schedule.platformName === 'INSTAGRAM'
                      ? 'Instagram Business'
                      : 'Threads Profile'}
                  </div>
                </div>
              </div>

              {/* Badge trạng thái góc phải */}
              <span
                style={{
                  flex: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '6px 14px',
                  borderRadius: 999,
                  color: tone.color,
                  background: tone.bg,
                  border: `1px solid ${alpha(tone.color, 0x35 / 255)}`,
                }}
              >
                {t[`schSt${schedule.status}` as keyof typeof t] as string}
              </span>
            </div>

            {/* Thông báo lỗi / tạm giữ nếu có */}
            {isFailed && (
              <div
                style={{
                  background: C.legacyBgfdf1f1,
                  border: `1px solid ${C.legacyBorderf9d2d8}`,
                  borderRadius: 14,
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.legacyTextb91c1c, fontWeight: 800, fontSize: 13.5 }}>
                  <AlertTriangle size={17} />
                  {lang === 'en' ? 'Publishing Failed' : 'Đăng bài không thành công'}
                </div>
                <div style={{ fontSize: 12.5, color: C.legacyText991b1b, marginTop: 6, lineHeight: 1.5 }}>
                  {t.schFailedHint}
                </div>
                <button
                  onClick={() => go('failedPosts')}
                  style={{
                    marginTop: 8,
                    background: 'none',
                    border: 'none',
                    color: C.legacyTextb91c1c,
                    fontSize: 12.5,
                    fontWeight: 700,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {lang === 'en' ? 'Open Failed Posts Center →' : 'Mở Trung tâm bài lỗi & khắc phục →'}
                </button>
              </div>
            )}

            {isOnHold && (
              <div
                style={{
                  background: C.legacyBgfdf6e7,
                  border: `1px solid ${C.legacyBorderf6e2b3}`,
                  borderRadius: 14,
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.amberText, fontWeight: 800, fontSize: 13.5 }}>
                  <AlertTriangle size={17} />
                  {lang === 'en' ? 'Post On Hold' : 'Lịch đăng đang tạm giữ'}
                </div>
                <div style={{ fontSize: 12.5, color: C.legacyText92400e, marginTop: 6, lineHeight: 1.5 }}>
                  {t.schOnHoldHint}
                </div>
                {(schedule.holdReasons ?? []).length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: C.legacyText92400e, lineHeight: 1.6 }}>
                    {schedule.holdReasons.map((r) => <li key={r}>{t[`schHold${r}` as keyof typeof t] as string}</li>)}
                  </ul>
                )}
                {schedule.overdue && (
                  <div style={{ fontSize: 12.5, color: C.amberText, fontWeight: 700, marginTop: 8, lineHeight: 1.5 }}>{t.schHoldOverdue}</div>
                )}
              </div>
            )}

            {/* Block Thời gian (chia làm 2 card con nằm ngang) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {/* Card 1: Khung giờ đăng */}
              <div
                style={{
                  background: C.surfaceSubtle,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '14px 18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  <Clock size={14} />
                  {lang === 'en' ? 'Time (GMT+7)' : 'Khung giờ đăng'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.textStrong, marginTop: 4 }}>
                  {timeFormatted}
                </div>
                <div style={{ marginTop: 4 }}>
                  {isPast ? (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: C.rose,
                        background: C.legacyBgfdf1f4,
                        padding: '2px 8px',
                        borderRadius: 6,
                        display: 'inline-block',
                      }}
                    >
                      {lang === 'en' ? 'Past time' : 'Đã qua giờ'}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: C.success,
                        background: C.legacyBgeaf8ef,
                        padding: '2px 8px',
                        borderRadius: 6,
                        display: 'inline-block',
                      }}
                    >
                      {lang === 'en' ? 'Upcoming' : 'Sắp đến'}
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2: Ngày đăng */}
              <div
                style={{
                  background: C.surfaceSubtle,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '14px 18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  <Calendar size={14} />
                  {lang === 'en' ? 'Scheduled Date' : 'Ngày đăng'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.textStrong, marginTop: 4 }}>
                  {dateFormatted}
                </div>
                <div style={{ fontSize: 12.5, color: C.textSecondary, fontWeight: 600, marginTop: 4 }}>
                  {weekdayName}
                </div>
              </div>
            </div>

            {/* Block Nội dung bài viết */}
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: '18px 20px',
              }}
            >
              {/* Header block: Tiêu đề + Nút Sao chép */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: C.text,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {lang === 'en' ? 'Post Content' : 'Nội dung bài viết'}
                </span>
                <button
                  onClick={handleCopyCaption}
                  disabled={!caption}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: `1px solid ${C.legacyBordere5ddf5}`,
                    background: copied ? C.legacyBgeaf8ef : C.bg,
                    color: copied ? C.success : C.primary,
                    borderRadius: 8,
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: caption ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? (lang === 'en' ? 'Copied' : 'Đã sao chép') : (lang === 'en' ? 'Copy Text' : 'Sao chép văn bản')}</span>
                </button>
              </div>

              {/* Toàn bộ văn bản caption bài đăng & Hashtags */}
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: C.ink750,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {caption ? (
                  renderFormattedCaption(caption, hashtags)
                ) : (
                  <span style={{ fontStyle: 'italic', color: C.textFaint }}>{t.schNoCaption}</span>
                )}
              </div>

              {/* Khung Call to action (CTA) */}
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 16px',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: C.border,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: C.primary,
                    flexShrink: 0,
                  }}
                >
                  <Megaphone size={16} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.textSecondary }}>Call to action:</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>
                    {version?.cta || (lang === 'en' ? 'Leave a comment or click bio link to learn more!' : 'Bấm vào link bio để đăng ký trải nghiệm ngay hôm nay!')}
                  </span>
                </div>
              </div>

              {/* Kịch bản video chi tiết nếu có */}
              {hasScript && (
                <div style={{ marginTop: 14, borderTop: `1px solid ${C.surfaceMuted}`, paddingTop: 14 }}>
                  <button
                    onClick={() => setShowScript(!showScript)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: C.primary,
                      cursor: 'pointer',
                    }}
                  >
                    <Film size={14} />
                    <span>{showScript ? (lang === 'en' ? 'Hide Video Script' : 'Thu gọn kịch bản') : (lang === 'en' ? 'View Video Script & Scenes' : 'Xem kịch bản video & phân cảnh')}</span>
                  </button>

                  {showScript && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {script?.hook?.content && (
                        <div style={{ background: C.surfaceSubtle, padding: 10, borderRadius: 8, fontSize: 12 }}>
                          <span style={{ fontWeight: 800, color: C.primary }}>HOOK ({script.hook.timing ?? '0-3s'}): </span>
                          <span style={{ color: C.ink750 }}>{script.hook.content}</span>
                        </div>
                      )}
                      {script?.steps && script.steps.map((st, idx) => (
                        <div key={idx} style={{ background: C.surfaceSubtle, padding: 10, borderRadius: 8, fontSize: 12 }}>
                          <span style={{ fontWeight: 800, color: C.ink650 }}>{lang === 'en' ? `Step ${st.index ?? idx + 1}: ` : `Phần ${st.index ?? idx + 1}: `}</span>
                          <span style={{ color: C.ink750 }}>{st.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer bên trái: Nút "Đóng" đơn giản dạng outline/ghost button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <button
                onClick={onBack}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: `1px solid ${C.legacyBordere0daee}`,
                  background: C.surface,
                  color: C.ink650,
                  borderRadius: 10,
                  padding: '9px 24px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                className={"dm-hover-0a5405d"}


              >
                {lang === 'en' ? 'Close' : 'Đóng'}
              </button>
            </div>
          </div>

          {/* CỘT PHẢI (~40% width) - BẢN XEM TRƯỚC MẠNG XÃ HỘI (Feed Mockup) */}
          <div style={{ minWidth: 0 }}>
            <div
              className="custom-scrollbar"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: isMobile ? 'static' : 'sticky',
                top: 86,
                maxHeight: isMobile ? 'none' : 'calc(100vh - 102px)',
                overflowY: isMobile ? 'visible' : 'auto',
                zIndex: 10,
              }}
            >
            {/* Header cột phải: Tiêu đề + badge tag "video" hoặc "image" */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 2px',
              }}
            >
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: C.text,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {lang === 'en' ? 'Social Feed Mockup' : 'Bản xem trước mạng xã hội'}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: C.textSecondary,
                  background: C.surfaceMuted,
                  padding: '3px 10px',
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  textTransform: 'lowercase',
                }}
              >
                {isVideo ? <Film size={12} /> : <ImageIcon size={12} />}
                <span>{isVideo ? 'video' : 'image'}</span>
              </span>
            </div>

            {/* Giao diện giả lập bài post Facebook hoàn chỉnh */}
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.legacyBordere5e0f2}`,
                borderRadius: 18,
                overflow: 'hidden',
                boxShadow: `0 8px 24px -8px ${C.legacyShadowrgba7040120008_}`,
              }}
            >
              {/* Header bài post Facebook */}
              <div
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: `1px solid ${C.bg}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#1877F2'} size={38} radius={999} fontSize={13} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: C.textStrong,
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {schedule.platformAccountName || 'AIMA Marketing'}
                      </span>
                      <span
                        title="Trang đã xác thực"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          backgroundColor: '#1877F2',
                          color: '#ffffff',
                          flexShrink: 0,
                        }}
                      >
                        <Check size={9} strokeWidth={3.5} />
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>
                      <span>{timeFormatted} · {dateFormatted}</span>
                      <span>•</span>
                      <Globe size={11} />
                    </div>
                  </div>
                </div>

                <div style={{ color: C.textMuted }}>
                  <MoreHorizontal size={18} />
                </div>
              </div>

              {/* Caption trích lược có nút "... Xem thêm" */}
              <div
                style={{
                  padding: '12px 16px',
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: C.ink750,
                  wordBreak: 'break-word',
                }}
              >
                {caption ? (
                  <div>
                    {mockupExpanded || caption.length <= 150 ? (
                      renderFormattedCaption(caption, hashtags)
                    ) : (
                      <>
                        <span>{caption.slice(0, 150)}</span>
                        <button
                          onClick={() => setMockupExpanded(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            marginLeft: 4,
                            color: C.legacyText65676b,
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: 13,
                          }}
                        >
                          ... Xem thêm
                        </button>
                      </>
                    )}
                    {mockupExpanded && caption.length > 150 && (
                      <button
                        onClick={() => setMockupExpanded(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          marginLeft: 6,
                          color: C.primary,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        (Thu gọn)
                      </button>
                    )}
                  </div>
                ) : (
                  <span style={{ fontStyle: 'italic', color: C.textFaint }}>{t.schNoCaption}</span>
                )}
              </div>

              {/* Khung phát Video / Ảnh mockup chuẩn tỉ lệ 16:9 */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: version?.mediaFormat === 'REELS' || version?.mediaFormat === 'STORY' ? '9/16' : '16/9',
                  maxHeight: 240,
                  background: 'linear-gradient(135deg, #18112d 0%, #291b4f 50%, #43226a 100%)',
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
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.18,
                    background: 'radial-gradient(circle at center, #8b5cf6 0%, transparent 70%)',
                  }}
                />

                {/* Badge loại phương tiện ở góc trên */}
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    background: C.legacyBgrgba000045_,
                    backdropFilter: 'blur(4px)',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {isVideo ? <Film size={11} /> : <ImageIcon size={11} />}
                  <span>{version?.mediaFormat ?? (isVideo ? 'Video 16:9' : 'Image 16:9')}</span>
                </div>

                {/* Nút Play tròn ở giữa */}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: C.legacyBgrgba255255255022_,
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: `1px solid ${C.legacyBorderrgba255255255035_}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                    boxShadow: `0 8px 24px ${C.legacyShadowrgba00003_}`,
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                  className={"dm-hover-f679a8a"}


                >
                  <Play size={20} fill="#ffffff" stroke="none" style={{ marginLeft: 3 }} />
                </div>

                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.legacyTextf3efff }}>
                  {schedule.platformAccountName || 'AIMA Studio'}
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
                      marginTop: 3,
                    }}
                    title={version.imagePrompt}
                  >
                    Prompt: {version.imagePrompt}
                  </div>
                )}

                {/* Tag "Feed Mockup" ở góc dưới */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    background: C.legacyBgrgba00006_,
                    backdropFilter: 'blur(4px)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: 0.3,
                  }}
                >
                  Feed Mockup
                </div>
              </div>

              {/* Thanh tương tác mô phỏng bên dưới (Like, Comment, Share) */}
              <div
                style={{
                  padding: '10px 16px',
                  borderTop: `1px solid ${C.bg}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  color: C.legacyText65676b,
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <ThumbsUp size={15} />
                  <span>{lang === 'en' ? 'Like' : 'Thích'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <MessageCircle size={15} />
                  <span>{lang === 'en' ? 'Comment' : 'Bình luận'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <Share2 size={15} />
                  <span>{lang === 'en' ? 'Share' : 'Chia sẻ'}</span>
                </div>
              </div>
            </div>

            {/* Nút hành động chính ở góc dưới cùng bên phải */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              {isPosted && (
                <button
                  onClick={() => go('analytics')}
                  className="btn-grad"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 22px',
                    fontSize: 13.5,
                    fontWeight: 700,
                    background: brandGradient,
                    color: C.onBrand,
                    cursor: 'pointer',
                    boxShadow: `0 4px 16px ${C.legacyShadowrgba12458237028_}`,
                  }}
                >
                  <Sparkles size={16} />
                  <span>{lang === 'en' ? 'View Analytics' : 'Xem hiệu quả'}</span>
                </button>
              )}

              {isScheduled && onPublishNow && (
                <button
                  onClick={() => onPublishNow(schedule)}
                  disabled={busy}
                  className="btn-grad"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 22px',
                    fontSize: 13.5,
                    fontWeight: 700,
                    background: brandGradient,
                    color: C.onBrand,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    boxShadow: `0 4px 16px ${C.legacyShadowrgba12458237028_}`,
                  }}
                >
                  <Send size={16} />
                  <span>{busy ? (lang === 'en' ? 'Publishing...' : 'Đang đăng...') : (lang === 'en' ? 'Publish Now' : 'Đăng ngay')}</span>
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
                    gap: 8,
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 22px',
                    fontSize: 13.5,
                    fontWeight: 700,
                    background: brandGradient,
                    color: C.onBrand,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    boxShadow: `0 4px 16px ${C.legacyShadowrgba12458237028_}`,
                  }}
                >
                  <RotateCcw size={16} />
                  <span>{lang === 'en' ? 'Retry Post' : 'Thử lại ngay'}</span>
                </button>
              )}

              {isOnHold && (
                <button
                  onClick={() => onReschedule(schedule)}
                  disabled={busy}
                  className="btn-grad"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 22px',
                    fontSize: 13.5,
                    fontWeight: 700,
                    background: brandGradient,
                    color: C.onBrand,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    boxShadow: `0 4px 16px ${C.legacyShadowrgba12458237028_}`,
                  }}
                >
                  <Clock size={16} />
                  <span>{t.schReactivate}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
