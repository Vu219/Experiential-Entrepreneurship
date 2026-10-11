import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Copy, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import Drawer, { type DrawerVariant } from '../../Drawer';
import { formatDateTimeVN } from '../../../utils/format';
import StatusBadge from '../StatusBadge';
import { Icon, PlatformTag } from '../../ui';
import { PLATFORM_BG } from '../../../theme';
import { TONE_COLORS, type Tone } from '../../../statusTokens';
import { AP_PLATFORM_NAME } from './platforms';
import { reasonBadge, reasonCopy, retryHint } from './rejectionReasons';
import {
  getPostProblemDetail, type AdminPostAttempt, type AdminPostProblem, type AdminPostProblemDetail,
} from '../../../api/admin';
import { publishErrorCopy } from '../../../api/publishErrorCatalog';
import { attemptStatusLabel } from '../../failedPosts/shared';
import { C } from '../../../styles/colors';

// Khối F: panel chi tiết bài viết. Vỏ là Drawer dùng chung; component này chỉ lo NỘI DUNG.
//  - Lý do = mã lỗi chuẩn (catalog dùng chung với trang người dùng): nhóm + tiêu đề + chuyện gì / vì sao / các bước
//    người dùng được hướng dẫn — admin thấy ĐÚNG câu người dùng thấy.
//  - "Phản hồi gốc": lỗi thô của lần cuối (JSON) ĐÃ REDACT phía backend — chỉ admin xem được; kèm mã tham chiếu.
//  - Timeline mọi lần thử + cách đã xử lý (thử lại / bỏ qua / huỷ lịch).
//  - "Thử lại thay người dùng": bắt buộc lý do (activity log), cùng luật chặn với nút của người dùng.

const sectionLabel = {
  fontSize: 12, fontWeight: 700, color: C.textFaint, marginBottom: 8, marginTop: 20,
} as const;

const mono = 'ui-monospace,Menlo,Consolas,monospace';

const CAPTION_CLAMP_LINES = 4;

const STATE_TONE: Record<AdminPostProblemDetail['state'], Tone> = {
  NEEDS_ACTION: 'danger', AUTO_RETRYING: 'info', DISMISSED: 'neutral', RESOLVED: 'success',
};

/** JSON redact từ backend → thụt dòng cho dễ đọc; không phải JSON thì giữ nguyên văn. */
function pretty(raw: string | null): string {
  if (!raw) return '—';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function AttemptRow({ attempt, index, post }: { attempt: AdminPostAttempt; index: number; post: AdminPostProblem }) {
  const { t, lang } = useApp();
  const ok = attempt.status === 'SUCCESS';
  const bad = attempt.status === 'FAILED';
  const tone = ok ? TONE_COLORS.success : bad ? TONE_COLORS.danger : TONE_COLORS.info;
  const IconCmp = ok ? CheckCircle2 : bad ? XCircle : Clock;
  const when = attempt.finishedAt ?? attempt.nextRetryAt ?? attempt.startedAt;
  const resolution = attempt.resolution === 'RETRIED' ? t.apResRetried
    : attempt.resolution === 'DISMISSED' ? t.apResDismissed
      : attempt.resolution === 'CANCELLED' ? t.apResCancelled : null;
  return (
    <li style={{ display: 'flex', gap: 9, fontSize: 12.5 }}>
      <IconCmp size={16} color={tone.color} strokeWidth={2} style={{ flex: 'none', marginTop: 1 }} aria-hidden />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: C.ink750 }}>{t.apAttemptN.replace('{n}', String(index + 1))}</span>
          <span style={{ fontWeight: 700, color: tone.color }}>{attemptStatusLabel(attempt.status, t)}</span>
          {resolution && <span style={{ color: C.textMuted }}>· {resolution}</span>}
          <span style={{ marginLeft: 'auto', color: C.textFaint }}>{when ? formatDateTimeVN(when.replace(' ', 'T')) : ''}</span>
        </div>
        {bad && attempt.code && (
          <div style={{ color: C.textSecondary, marginTop: 2, lineHeight: 1.5 }}>
            {publishErrorCopy(lang, attempt.code, { platform: AP_PLATFORM_NAME[post.platform], account: post.accountName }).title}
            <span style={{ fontFamily: mono, color: C.textFaint }}>
              {' '}· {attempt.code}{attempt.platformCode ? ` · ${attempt.platformCode}` : ''}
              {attempt.platformSubcode ? `/${attempt.platformSubcode}` : ''}
              {attempt.referenceCode ? ` · ${attempt.referenceCode}` : ''}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

export default function PostProblemDetail({
  post,
  variant,
  width,
  stickyTop,
  stickyMaxHeight,
  busy,
  onClose,
  onCopyContent,
  onCopyReference,
  onRetry,
}: {
  post: AdminPostProblem;
  variant: DrawerVariant;
  width?: number;
  stickyTop?: number;
  stickyMaxHeight?: string;
  busy: boolean;
  onClose: () => void;
  onCopyContent: (post: AdminPostProblem) => void;
  onCopyReference: (reference: string) => void;
  /** Thử lại thay người dùng — trả true khi thành công (panel thu ô lý do lại). */
  onRetry: (post: AdminPostProblem, reason: string) => Promise<boolean>;
}) {
  const { t, lang, brandGradient } = useApp();
  const badge = reasonBadge(post, lang);
  const copy = reasonCopy(post, lang);
  const isSystem = post.kind === 'system';
  const caption = post.content.trim();
  const [captionOpen, setCaptionOpen] = useState(false);
  const [detail, setDetail] = useState<AdminPostProblemDetail | null>(null);
  const [detailState, setDetailState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [retryOpen, setRetryOpen] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let alive = true;
    setDetailState('loading');
    setRetryOpen(false);
    setReason('');
    getPostProblemDetail(post.id)
      .then((d) => { if (alive) { setDetail(d); setDetailState('ok'); } })
      .catch(() => { if (alive) setDetailState('error'); });
    return () => { alive = false; };
  }, [post.id, reloadKey]);

  const canRetry = detail?.state === 'NEEDS_ACTION' || detail?.state === 'DISMISSED';
  const submitRetry = async () => {
    if (!reason.trim()) return;
    if (await onRetry(post, reason.trim())) {
      setRetryOpen(false);
      setReason('');
      setReloadKey((k) => k + 1);
    }
  };

  return (
    <Drawer
      title={t.apDrawerTitle}
      variant={variant}
      width={width}
      stickyTop={stickyTop}
      stickyMaxHeight={stickyMaxHeight}
      closeLabel={t.close}
      icon={<Icon icon={Sparkles} size={16} stroke={C.violetLight} />}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {retryOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="ap-retry-reason" style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>{t.apRetryReason}</label>
              <textarea
                id="ap-retry-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder={t.apRetryReasonPh}
                style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', background: C.surface, color: C.text }}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {canRetry && (
              <button
                onClick={() => (retryOpen ? submitRetry() : setRetryOpen(true))}
                disabled={busy || (retryOpen && !reason.trim())}
                className="btn-grad"
                style={{
                  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none',
                  background: brandGradient, borderRadius: 11, padding: '11px 0', fontSize: 13.5, fontWeight: 700,
                  color: C.onBrand, cursor: busy ? 'wait' : 'pointer', opacity: busy || (retryOpen && !reason.trim()) ? 0.6 : 1,
                }}
              >
                <RotateCcw size={15} strokeWidth={2} />
                {retryOpen ? t.apRetryConfirm : t.apRetryOnBehalf}
              </button>
            )}
            <button
              onClick={() => onCopyContent(post)}
              disabled={!caption}
              className="btn-soft"
              style={{
                flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: `1px solid ${C.border}`, background: C.surface, borderRadius: 11, padding: '11px 0',
                fontSize: 13.5, fontWeight: 700, cursor: caption ? 'pointer' : 'default',
                color: caption ? C.ink550 : C.ink200,
              }}
            >
              <Copy size={15} strokeWidth={1.8} />
              {t.apCopyContent}
            </button>
          </div>
        </div>
      }
    >
      {/* Đầu panel: nhận diện bài viết */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span
          aria-hidden
          style={{
            width: 46, height: 46, flex: 'none', borderRadius: 13, background: PLATFORM_BG[post.platform],
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19,
          }}
        >
          {(caption[0] ?? '#').toUpperCase()}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: C.textStrong, lineHeight: 1.45,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {caption ? caption.split(/\r?\n/)[0] : t.apNoContent}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, fontSize: 12, color: C.textMuted }}>
            <PlatformTag tag={post.platform} bg={PLATFORM_BG[post.platform]} size={18} radius={999} />
            {AP_PLATFORM_NAME[post.platform]}
            <span aria-hidden>·</span>
            <span>{post.user}</span>
          </div>
          <div style={{ fontSize: 12, color: C.textFaint, marginTop: 3 }}>
            {formatDateTimeVN(post.date.replace(' ', 'T'))}
          </div>
        </div>
      </div>

      {/* Nội dung bài: mặc định gói 4 dòng, bấm "Xem thêm" mới xổ hết. */}
      {caption && (
        <>
          <div style={sectionLabel}>{t.postContent}</div>
          <div style={{
            fontSize: 13, color: C.ink600, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            ...(captionOpen ? {} : {
              display: '-webkit-box',
              WebkitLineClamp: CAPTION_CLAMP_LINES,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }),
          }}>
            {caption}
          </div>
          <button
            onClick={() => setCaptionOpen((v) => !v)}
            style={{
              border: 'none', background: 'transparent', padding: '6px 0 0', fontSize: 12.5,
              fontWeight: 700, color: C.primary, cursor: 'pointer',
            }}
          >
            {captionOpen ? t.apSeeLess : t.apSeeMore}
          </button>
        </>
      )}

      <div style={sectionLabel}>{t.colStatus}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <StatusBadge tone={isSystem ? 'warning' : 'danger'} label={isSystem ? t.stSysError : t.stRejected} />
        {detail && <StatusBadge tone={STATE_TONE[detail.state]} label={t[`apState_${detail.state}` as const]} />}
      </div>

      <div style={sectionLabel}>{isSystem ? t.apColCause : t.apDrawerReason}</div>
      <StatusBadge tone={badge.tone} label={badge.label} />
      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink750, lineHeight: 1.5, marginTop: 8 }}>{copy.title}</div>
      <div style={{ fontSize: 12.5, color: C.ink600, lineHeight: 1.6, marginTop: 4 }}>{copy.what} {copy.why}</div>

      <div style={sectionLabel}>{t.apUserGuidance}</div>
      <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {copy.steps.map((step, i) => (
          <li key={i} style={{ fontSize: 12.5, color: C.ink600, lineHeight: 1.55 }}>{step}</li>
        ))}
      </ol>

      {/* Phản hồi gốc của nền tảng — đã redact phía backend, chỉ admin xem */}
      <div style={sectionLabel}>{t.apRawResponse}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{
          fontSize: 11.5, fontWeight: 800, fontFamily: mono,
          color: C.legacyText6b5ca8, background: C.surfaceMuted, borderRadius: 7, padding: '3px 9px',
        }}>
          {post.code}
        </span>
        <span style={{
          fontSize: 11.5, fontWeight: 800, fontFamily: mono,
          color: C.legacyText6b5ca8, background: C.surfaceMuted, borderRadius: 7, padding: '3px 9px',
        }}>
          {t.apErrCode} {post.errorCode ?? '—'}{post.platformSubcode ? `/${post.platformSubcode}` : ''}
        </span>
        {post.referenceCode && (
          <button
            onClick={() => onCopyReference(post.referenceCode!)}
            title={t.apCopyReference}
            className="btn-soft"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 7, padding: '3px 9px', fontSize: 11.5, fontWeight: 800, fontFamily: mono, color: C.ink600, cursor: 'pointer' }}
          >
            <Copy size={11} strokeWidth={2} />
            {post.referenceCode}
          </button>
        )}
        {isSystem && post.retryCount !== null && (
          <span style={{ fontSize: 12, color: C.textMuted }}>
            {t.apColRetry}: {t.apRetryOf.replace('{n}', String(post.retryCount))}
            {post.nextRetryAt
              ? ` · ${t.apNextRetry} ${formatDateTimeVN(post.nextRetryAt.replace(' ', 'T'))}`
              : ` · ${retryHint(post, t)}`}
          </span>
        )}
      </div>
      <pre style={{
        margin: 0, background: '#1f1b2e', color: C.legacyTextffd9d9, borderRadius: 10, padding: '12px 14px',
        fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: mono,
        maxHeight: 260, overflowY: 'auto',
      }}>
        {detailState === 'ok' ? pretty(detail?.rawError ?? post.errorMessage) : (post.errorMessage ?? '—')}
      </pre>
      <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 6 }}>{t.apRedactedNote}</div>

      <div style={sectionLabel}>{t.apTimeline}</div>
      {detailState === 'loading' && <div style={{ fontSize: 12.5, color: C.textMuted }}>{t.apTimelineLoading}</div>}
      {detailState === 'error' && (
        <button onClick={() => setReloadKey((k) => k + 1)} className="btn-soft"
          style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: C.primary, cursor: 'pointer' }}>
          {t.apTimelineRetry}
        </button>
      )}
      {detailState === 'ok' && detail && (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {detail.attempts.map((a, i) => <AttemptRow key={i} attempt={a} index={i} post={post} />)}
        </ol>
      )}
    </Drawer>
  );
}
