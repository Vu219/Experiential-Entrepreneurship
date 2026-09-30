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
import type { PostSchedule } from '../../api/schedules.ts';
import { STATUS_TONE } from './statusMeta.ts';
import { fmtDate, fmtTime, WEEKDAYS_FULL } from './dateUtils.ts';

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
            <span key={i} style={{ color: '#7c3aed', fontWeight: 600 }}>
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
                color: '#7c3aed',
                background: '#f3effc',
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
          color: '#6b6680',
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
            color: '#7c3aed',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 13,
            borderRadius: 6,
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#6025d8')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#7c3aed')}
        >
          <ArrowLeft size={16} />
          <span>{lang === 'en' ? 'Back to Calendar' : 'Lịch đăng bài'}</span>
        </button>
        <span style={{ color: '#c4b5fd' }}>/</span>
        <span style={{ color: '#211c38', fontWeight: 600 }}>
          {lang === 'en' ? 'Schedule Details' : 'Chi tiết lịch đăng'}
        </span>
      </div>

      {/* Card Container lớn màu trắng */}
      <div
        className="bg-white rounded-2xl shadow-sm border border-slate-100/80"
        style={{
          background: '#ffffff',
          borderRadius: 24,
          border: '1px solid #efeaf8',
          boxShadow: '0 4px 24px -6px rgba(33, 28, 56, 0.05), 0 1px 2px rgba(0, 0, 0, 0.02)',
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
            borderBottom: '1px solid #f1edf8',
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
                background: '#f4f0fd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7c3aed',
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
                  color: '#211c38',
                  margin: 0,
                  lineHeight: 1.25,
                }}
              >
                {lang === 'en' ? 'Schedule Details' : 'Chi tiết lịch đăng'}
              </h1>
              <div
                style={{
                  fontSize: 12,
                  color: '#8a85a0',
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
                  border: '1px solid #ece8f6',
                  background: dropdownOpen ? '#f4f1fb' : '#ffffff',
                  color: '#5b5670',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f4f1fb';
                  e.currentTarget.style.borderColor = '#ddd7ed';
                }}
                onMouseLeave={(e) => {
                  if (!dropdownOpen) {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#ece8f6';
                  }
                }}
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
                    background: '#ffffff',
                    borderRadius: 12,
                    border: '1px solid #ece8f6',
                    boxShadow: '0 12px 30px -8px rgba(35, 20, 65, 0.16)',
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
                      color: '#2d2745',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f5fc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <Clock size={15} color="#7c3aed" />
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
                      color: '#2d2745',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f5fc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <PencilLine size={15} color="#6b6680" />
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
                      color: '#2d2745',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f5fc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <Copy size={15} color="#6b6680" />
                    <span>{lang === 'en' ? 'Copy ID' : 'Sao chép ID'}</span>
                  </button>

                  <div style={{ height: 1, background: '#f1edf8', margin: '4px 0' }} />

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
                      color: '#e23d6e',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fdf1f4')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <Trash2 size={15} color="#e23d6e" />
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
                background: '#f4f1fb',
                color: '#6b6680',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ebe5f8';
                e.currentTarget.style.color = '#211c38';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f4f1fb';
                e.currentTarget.style.color = '#6b6680';
              }}
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
                background: '#faf9fe',
                border: '1px solid #f1eef8',
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
                      border: '2px solid #fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
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
                        color: '#211c38',
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
                  <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 3 }}>
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
                  border: `1px solid ${tone.color}35`,
                }}
              >
                {t[`schSt${schedule.status}` as keyof typeof t] as string}
              </span>
            </div>

            {/* Thông báo lỗi / tạm giữ nếu có */}
            {isFailed && (
              <div
                style={{
                  background: '#fdf1f1',
                  border: '1px solid #f9d2d8',
                  borderRadius: 14,
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b91c1c', fontWeight: 800, fontSize: 13.5 }}>
                  <AlertTriangle size={17} />
                  {lang === 'en' ? 'Publishing Failed' : 'Đăng bài không thành công'}
                </div>
                <div style={{ fontSize: 12.5, color: '#991b1b', marginTop: 6, lineHeight: 1.5 }}>
                  {t.schFailedHint}
                </div>
                <button
                  onClick={() => go('failedPosts')}
                  style={{
                    marginTop: 8,
                    background: 'none',
                    border: 'none',
                    color: '#b91c1c',
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
                  background: '#fdf6e7',
                  border: '1px solid #f6e2b3',
                  borderRadius: 14,
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 800, fontSize: 13.5 }}>
                  <AlertTriangle size={17} />
                  {lang === 'en' ? 'Post On Hold' : 'Lịch đăng đang tạm giữ'}
                </div>
                <div style={{ fontSize: 12.5, color: '#92400e', marginTop: 6, lineHeight: 1.5 }}>
                  {t.schOnHoldHint}
                </div>
                {(schedule.holdReasons ?? []).length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
                    {schedule.holdReasons.map((r) => <li key={r}>{t[`schHold${r}` as keyof typeof t] as string}</li>)}
                  </ul>
                )}
                {schedule.overdue && (
                  <div style={{ fontSize: 12.5, color: '#b45309', fontWeight: 700, marginTop: 8, lineHeight: 1.5 }}>{t.schHoldOverdue}</div>
                )}
              </div>
            )}

            {/* Block Thời gian (chia làm 2 card con nằm ngang) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {/* Card 1: Khung giờ đăng */}
              <div
                style={{
                  background: '#faf9fe',
                  border: '1px solid #efeaf8',
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
                    color: '#8a85a0',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  <Clock size={14} />
                  {lang === 'en' ? 'Time (GMT+7)' : 'Khung giờ đăng'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#211c38', marginTop: 4 }}>
                  {timeFormatted}
                </div>
                <div style={{ marginTop: 4 }}>
                  {isPast ? (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#e23d6e',
                        background: '#fdf1f4',
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
                        color: '#16a34a',
                        background: '#eaf8ef',
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
                  background: '#faf9fe',
                  border: '1px solid #efeaf8',
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
                    color: '#8a85a0',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  <Calendar size={14} />
                  {lang === 'en' ? 'Scheduled Date' : 'Ngày đăng'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#211c38', marginTop: 4 }}>
                  {dateFormatted}
                </div>
                <div style={{ fontSize: 12.5, color: '#6b6680', fontWeight: 600, marginTop: 4 }}>
                  {weekdayName}
                </div>
              </div>
            </div>

            {/* Block Nội dung bài viết */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #ede8f6',
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
                    color: '#3f3a55',
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
                    border: '1px solid #e5ddf5',
                    background: copied ? '#eaf8ef' : '#f7f5fd',
                    color: copied ? '#16a34a' : '#7c3aed',
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
                  color: '#2d2745',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {caption ? (
                  renderFormattedCaption(caption, hashtags)
                ) : (
                  <span style={{ fontStyle: 'italic', color: '#a59fbb' }}>{t.schNoCaption}</span>
                )}
              </div>

              {/* Khung Call to action (CTA) */}
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 16px',
                  background: '#f8f6fd',
                  border: '1px solid #ede8f8',
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
                    background: '#ede8f8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#7c3aed',
                    flexShrink: 0,
                  }}
                >
                  <Megaphone size={16} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#6b6680' }}>Call to action:</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>
                    {version?.cta || (lang === 'en' ? 'Leave a comment or click bio link to learn more!' : 'Bấm vào link bio để đăng ký trải nghiệm ngay hôm nay!')}
                  </span>
                </div>
              </div>

              {/* Kịch bản video chi tiết nếu có */}
              {hasScript && (
                <div style={{ marginTop: 14, borderTop: '1px solid #f1edf8', paddingTop: 14 }}>
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
                      color: '#7c3aed',
                      cursor: 'pointer',
                    }}
                  >
                    <Film size={14} />
                    <span>{showScript ? (lang === 'en' ? 'Hide Video Script' : 'Thu gọn kịch bản') : (lang === 'en' ? 'View Video Script & Scenes' : 'Xem kịch bản video & phân cảnh')}</span>
                  </button>

                  {showScript && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {script?.hook?.content && (
                        <div style={{ background: '#faf9fe', padding: 10, borderRadius: 8, fontSize: 12 }}>
                          <span style={{ fontWeight: 800, color: '#7c3aed' }}>HOOK ({script.hook.timing ?? '0-3s'}): </span>
                          <span style={{ color: '#2d2745' }}>{script.hook.content}</span>
                        </div>
                      )}
                      {script?.steps && script.steps.map((st, idx) => (
                        <div key={idx} style={{ background: '#faf9fe', padding: 10, borderRadius: 8, fontSize: 12 }}>
                          <span style={{ fontWeight: 800, color: '#4b4660' }}>{lang === 'en' ? `Step ${st.index ?? idx + 1}: ` : `Phần ${st.index ?? idx + 1}: `}</span>
                          <span style={{ color: '#2d2745' }}>{st.content}</span>
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
                  border: '1px solid #e0daee',
                  background: '#ffffff',
                  color: '#4b4660',
                  borderRadius: 10,
                  padding: '9px 24px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f2fa';
                  e.currentTarget.style.borderColor = '#d2c8ea';
                  e.currentTarget.style.color = '#211c38';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#e0daee';
                  e.currentTarget.style.color = '#4b4660';
                }}
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
                  color: '#3f3a55',
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
                  color: '#6b6680',
                  background: '#f3effc',
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
                background: '#ffffff',
                border: '1px solid #e5e0f2',
                borderRadius: 18,
                overflow: 'hidden',
                boxShadow: '0 8px 24px -8px rgba(70,40,120,0.08)',
              }}
            >
              {/* Header bài post Facebook */}
              <div
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f6f4fa',
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
                          color: '#1f1b33',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#8a85a0', marginTop: 1 }}>
                      <span>{timeFormatted} · {dateFormatted}</span>
                      <span>•</span>
                      <Globe size={11} />
                    </div>
                  </div>
                </div>

                <div style={{ color: '#8a85a0' }}>
                  <MoreHorizontal size={18} />
                </div>
              </div>

              {/* Caption trích lược có nút "... Xem thêm" */}
              <div
                style={{
                  padding: '12px 16px',
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: '#2d2745',
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
                            color: '#65676b',
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
                          color: '#7c3aed',
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
                  <span style={{ fontStyle: 'italic', color: '#a59fbb' }}>{t.schNoCaption}</span>
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
                    background: 'rgba(0,0,0,0.45)',
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
                    background: 'rgba(255, 255, 255, 0.22)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <Play size={20} fill="#ffffff" stroke="none" style={{ marginLeft: 3 }} />
                </div>

                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f3efff' }}>
                  {schedule.platformAccountName || 'AIMA Studio'}
                </div>

                {version?.imagePrompt && (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: '#c9bce8',
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
                    background: 'rgba(0,0,0,0.6)',
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
                  borderTop: '1px solid #f6f4fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  color: '#65676b',
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
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(124, 58, 237, 0.28)',
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
                    color: '#fff',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 16px rgba(124, 58, 237, 0.28)',
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
                    color: '#fff',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 16px rgba(124, 58, 237, 0.28)',
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
                    color: '#fff',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 16px rgba(124, 58, 237, 0.28)',
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
