import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AlertTriangle, CalendarClock, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Modal from '../Modal';
import { TONE_COLORS } from '../../statusTokens';
import { alpha, C } from '../../styles/colors';
import type { ApiError } from '../../api/apiClient';
import {
  AI_FIX_PLAN_LIMIT_CODES, applyAiFix, getAiAssistJob, isAiRunning, startAiFix,
  type AiAssistJob, type AiFixApplyAction, type AiFixApplyResult,
} from '../../api/aiAssist';
import { diffWords, formatHashtags, hasChanges, parseHashtags } from './textDiff';

// "AI sửa nội dung" (failed-posts đợt 2 — A1): chỉ gọi AI khi người dùng bấm (mở modal = bấm); hiện diff caption cũ ↔
// bản sẽ đăng (cập nhật khi người dùng sửa), cho chỉnh rồi mới áp dụng. Dùng ở chi tiết bài lỗi (postId — có "Áp dụng &
// đăng lại" / "Áp dụng & lên lịch") và ở cảnh báo chính sách trước khi đăng (chỉ "Áp dụng").

const POLL_MS = 1500;
const POLL_LIMIT = 80; // ~2 phút — quá thì coi như lỗi (worker kẹt)

export type AiFixOutcome = 'RETRY' | 'SCHEDULE' | 'SAVE';

export default function AiFixModal({
  contentVersionId,
  postId,
  onClose,
  onApplied,
}: {
  contentVersionId: string;
  /** Bài lỗi đang sửa → có "đăng lại" / "lên lịch"; bỏ trống = sửa từ cảnh báo trước khi đăng. */
  postId?: string | null;
  onClose: () => void;
  onApplied: (outcome: AiFixOutcome, result: AiFixApplyResult) => void;
}) {
  const { t, brandGradient, go } = useApp();
  const [job, setJob] = useState<AiAssistJob | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  // Bị chặn bởi giới hạn của gói (hết lần / gói không gồm) → gợi ý nâng gói thay cho "Thử lại".
  const [planLimited, setPlanLimited] = useState(false);
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<AiFixOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Một job cho MỖI lần bấm (StrictMode chạy effect 2 lần ở dev — không được tạo 2 job AI, tốn token + lượt).
  const started = useRef<{ attempt: number; job: Promise<AiAssistJob> } | null>(null);

  // Bắt đầu một lần cho mỗi lần mở / bấm "Thử lại" rồi poll tới khi xong.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    const poll = (id: string) => {
      timer = setTimeout(async () => {
        try {
          const next = await getAiAssistJob(id);
          if (cancelled) return;
          if (isAiRunning(next.status) && ++polls < POLL_LIMIT) {
            poll(id);
            return;
          }
          setJob(isAiRunning(next.status) ? { ...next, status: 'FAILED', errorMessage: null } : next);
          if (next.status === 'SUCCESS' && next.fix) {
            setCaption(next.fix.caption);
            setTags(formatHashtags(next.fix.hashtags));
          }
        } catch (e) {
          if (!cancelled) setStartError((e as ApiError).message);
        }
      }, POLL_MS);
    };
    if (!started.current || started.current.attempt !== attempt) {
      started.current = { attempt, job: startAiFix(contentVersionId, postId) };
    }
    setJob(null);
    setStartError(null);
    setPlanLimited(false);
    started.current.job
      .then((job) => {
        if (cancelled) return;
        setJob(job);
        poll(job.id);
      })
      .catch((e) => {
        if (cancelled) return;
        setStartError((e as ApiError).message);
        setPlanLimited(AI_FIX_PLAN_LIMIT_CODES.includes((e as ApiError).code ?? 0));
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [contentVersionId, postId, attempt]);

  const fix = job?.status === 'SUCCESS' ? job.fix : null;
  const segments = useMemo(() => (fix ? diffWords(fix.originalCaption, caption) : []), [fix, caption]);
  const working = !startError && (!job || isAiRunning(job.status));

  const apply = async (outcome: AiFixOutcome) => {
    if (!job || !fix || saving) return;
    const nextTags = parseHashtags(tags);
    if (!caption.trim()) {
      setFormError(t.aiFixEmpty);
      return;
    }
    if (!hasChanges(fix.originalCaption, caption) && formatHashtags(nextTags) === formatHashtags(fix.originalHashtags)) {
      setFormError(t.aiFixNoChange);
      return;
    }
    setFormError(null);
    setSaving(outcome);
    const action: AiFixApplyAction = outcome === 'RETRY' ? 'RETRY_NOW' : 'SAVE';
    try {
      const result = await applyAiFix(job.id, caption.trim(), nextTags, action);
      onApplied(outcome, result);
    } catch (e) {
      setFormError((e as ApiError).message);
      setSaving(null);
    }
  };

  return (
    <Modal title={t.aiFixTitle} subtitle={t.aiFixIntro} onClose={onClose} maxWidth={720} animateScale>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {working && (
          <div role="status" style={{ ...box, display: 'flex', alignItems: 'center', gap: 10, color: TONE_COLORS.ai.color, background: TONE_COLORS.ai.bg }}>
            <Loader2 size={16} className="icon-spin" aria-hidden />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t.aiFixWorking}</span>
          </div>
        )}

        {(startError || job?.status === 'FAILED') && (
          <div role="alert" style={{ ...box, color: TONE_COLORS.danger.color, background: TONE_COLORS.danger.bg }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{t.aiFixFailed}</div>
            <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{startError ?? job?.errorMessage ?? ''}</div>
            {planLimited && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                <span style={{ fontSize: 12.5, color: C.textMuted }}>{t.aiFixUpgradeHint}</span>
                <button type="button" onClick={() => { onClose(); go('pricing'); }} className="btn-grad"
                  style={{ border: 'none', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>
                  {t.pcUpgrade}
                </button>
              </div>
            )}
            {!startError && (
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-soft" style={{ ...ghostBtn, marginTop: 10 }}>
                <RotateCcw size={13} aria-hidden /> {t.aiFixRetry}
              </button>
            )}
          </div>
        )}

        {fix && (
          <>
            {job?.stale && (
              <div role="status" style={{ ...box, display: 'flex', gap: 8, color: TONE_COLORS.warning.color, background: TONE_COLORS.warning.bg, fontSize: 12.5 }}>
                <AlertTriangle size={15} aria-hidden style={{ flex: 'none', marginTop: 1 }} /> {t.aiFixStale}
              </div>
            )}

            {fix.changes.length > 0 && (
              <Section title={t.aiFixChanges}>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {fix.changes.map((c, i) => <li key={i} style={{ fontSize: 13, color: C.ink650, lineHeight: 1.5 }}>{c}</li>)}
                </ul>
              </Section>
            )}

            <Section title={t.aiFixDiff} aside={
              <span style={{ display: 'inline-flex', gap: 8, fontSize: 11.5 }}>
                <span style={removedStyle}>{t.aiFixRemoved}</span>
                <span style={addedStyle}>{t.aiFixAdded}</span>
              </span>
            }>
              <div style={{ ...box, background: C.surfaceSubtle, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: C.ink750 }}>
                {segments.map((s, i) => (
                  <span key={i} style={s.kind === 'removed' ? removedStyle : s.kind === 'added' ? addedStyle : undefined}>{s.text}</span>
                ))}
              </div>
            </Section>

            <Section title={t.aiFixEditLabel}>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={6}
                aria-label={t.aiFixEditLabel}
                style={{ ...input, resize: 'vertical', minHeight: 120, lineHeight: 1.6 }}
              />
            </Section>
            <Section title={t.aiFixHashtags}>
              <input value={tags} onChange={(e) => setTags(e.target.value)} aria-label={t.aiFixHashtags} style={input} />
              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 5 }}>{t.aiFixHashtagsHint}</div>
            </Section>

            {formError && <div role="alert" style={{ fontSize: 12.5, color: C.rose }}>{formError}</div>}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} className="btn-soft" style={ghostBtn} disabled={saving !== null}>{t.cancel}</button>
              {postId && (
                <button type="button" onClick={() => apply('SCHEDULE')} className="btn-soft" style={ghostBtn} disabled={saving !== null}>
                  {saving === 'SCHEDULE' ? <Loader2 size={13} className="icon-spin" aria-hidden /> : <CalendarClock size={13} aria-hidden />}
                  {t.aiFixApplySchedule}
                </button>
              )}
              <button
                type="button"
                onClick={() => apply(postId ? 'RETRY' : 'SAVE')}
                className="btn-grad"
                disabled={saving !== null}
                style={{ ...ghostBtn, border: 'none', color: C.onBrand, background: brandGradient, opacity: saving ? 0.7 : 1 }}
              >
                {saving === 'RETRY' || saving === 'SAVE' ? <Loader2 size={13} className="icon-spin" aria-hidden /> : <Sparkles size={13} aria-hidden />}
                {postId ? t.aiFixApplyRetry : t.aiFixApply}
              </button>
            </div>
          </>
        )}

        <div style={{ fontSize: 11.5, color: C.textMuted, borderTop: `1px solid ${C.surfaceMuted}`, paddingTop: 10 }}>{t.aiFixTokenNote}</div>
      </div>
    </Modal>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', color: C.textMuted }}>{title}</div>
        {aside}
      </div>
      {children}
    </div>
  );
}

const box: CSSProperties = { borderRadius: 11, padding: '10px 13px' };
const input: CSSProperties = {
  width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 11, padding: '9px 12px', fontSize: 13.5,
  color: C.textStrong, background: C.surfaceSubtle, outline: 'none', fontFamily: 'inherit',
};
const ghostBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${C.border}`, background: C.surface,
  borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: C.ink600, cursor: 'pointer',
};
const removedStyle: CSSProperties = {
  textDecoration: 'line-through', color: TONE_COLORS.danger.color, background: alpha(TONE_COLORS.danger.color, 0.1), borderRadius: 4,
};
const addedStyle: CSSProperties = {
  color: TONE_COLORS.success.color, background: alpha(TONE_COLORS.success.color, 0.12), borderRadius: 4, fontWeight: 600,
};
