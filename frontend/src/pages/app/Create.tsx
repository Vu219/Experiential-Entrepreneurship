import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { Card, Loader, PlatformTag } from '../../components/ui.tsx';
import { ideas, toneLabels, scriptLines, genCaption, genHashtags, channels } from '../../data.ts';
import { listAllContentStrategies, isStrategyRunnable, type ContentStrategy } from '../../api/contentStrategy.ts';
import {
  startContentGeneration,
  getContentGenerationJob,
  updateContentItem,
  updateContentItemStatus,
  type ContentGenerationJob,
  type GeneratedContentItem,
  type ContentLifecycle,
} from '../../api/contentGeneration.ts';
import type { ApiError } from '../../api/apiClient.ts';

// FR-33: chỉ sửa được trước khi vào pipeline đăng (state machine WORKFLOWS.md).
const EDITABLE_STATUSES: ContentLifecycle[] = ['DRAFT', 'GENERATED', 'NEED_REVIEW', 'APPROVED'];

const parseHashtags = (text: string): string[] =>
  text
    .split(/[\s,]+/)
    .map((h) => h.replace(/^#/, '').trim())
    .filter(Boolean);

export default function Create() {
  const { t, lang, go, brandGradient, activeBrandId } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState(0);
  const [platform, setPlatform] = useState(0);
  const [strategies, setStrategies] = useState<ContentStrategy[]>([]);
  const [strategyId, setStrategyId] = useState('');
  const [job, setJob] = useState<ContentGenerationJob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // FR-33/FR-34: bản nội dung hiện hành (sau chỉnh sửa / đổi trạng thái) — ưu tiên hơn job.contentItem.
  const [item, setItem] = useState<GeneratedContentItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ script: '', caption: '', hashtags: '', mediaPrompt: '' });
  const [actionBusy, setActionBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ideaList = ideas(lang);
  const tones = toneLabels(lang);
  const chans = channels(lang);
  const script = scriptLines(lang);
  const stacked = isMobile || isTablet;
  const activeChannel = chans[platform] ?? chans[0];
  const busy = job?.status === 'PENDING' || job?.status === 'RUNNING';
  const shownItem = item ?? job?.contentItem ?? null;
  const editable = !!shownItem && EDITABLE_STATUSES.includes(shownItem.status);
  const statusLabels: Partial<Record<ContentLifecycle, string>> = {
    GENERATED: t.crStatusGenerated,
    NEED_REVIEW: t.crStatusNeedReview,
    APPROVED: t.crStatusApproved,
  };

  // Chỉ chiến lược ACTIVE mới được dùng để tạo nội dung (FR-13, BR-03).
  useEffect(() => {
    if (!activeBrandId) {
      setStrategies([]);
      setStrategyId('');
      return;
    }
    listAllContentStrategies(activeBrandId)
      .then((rows) => {
        const runnable = rows.filter(isStrategyRunnable);
        setStrategies(runnable);
        setStrategyId(runnable[0]?.id ?? '');
      })
      .catch(() => setStrategies([]));
  }, [activeBrandId]);

  // NFR-04: job chạy nền ở backend — FE poll trạng thái, không chặn UI.
  useEffect(() => {
    if (!job || job.status === 'SUCCESS' || job.status === 'FAILED') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => {
      getContentGenerationJob(job.id)
        .then(setJob)
        .catch((e) => setErrorMsg((e as ApiError).message));
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job]);

  const runGeneration = async (regenerateFrom?: string) => {
    if (!strategyId || busy) return;
    setErrorMsg(null);
    setActionErr(null);
    setItem(null);
    setEditing(false);
    try {
      const newJob = await startContentGeneration({
        strategyId,
        platform: activeChannel.platform,
        topic: topic || undefined,
        regenerateFrom,
      });
      setJob(newJob);
    } catch (e) {
      setErrorMsg((e as ApiError).message);
    }
  };

  const startEditing = () => {
    if (!shownItem) return;
    setDraft({
      script: shownItem.script ?? '',
      caption: shownItem.caption ?? '',
      hashtags: (shownItem.hashtags ?? []).join(' '),
      mediaPrompt: shownItem.mediaPrompt ?? '',
    });
    setActionErr(null);
    setEditing(true);
  };

  // FR-33: lưu chỉnh sửa thủ công (BE trả bản mới nhất, APPROVED bị sửa quay về NEED_REVIEW).
  const saveEdits = async () => {
    if (!shownItem || actionBusy) return;
    setActionBusy(true);
    setActionErr(null);
    try {
      const updated = await updateContentItem(shownItem.id, {
        script: draft.script,
        caption: draft.caption,
        hashtags: parseHashtags(draft.hashtags),
        mediaPrompt: draft.mediaPrompt,
      });
      setItem(updated);
      setEditing(false);
    } catch (e) {
      setActionErr(`${t.crSaveError}: ${(e as ApiError).message}`);
    } finally {
      setActionBusy(false);
    }
  };

  // FR-34: review flow — GENERATED→NEED_REVIEW (gửi duyệt), NEED_REVIEW→APPROVED (phê duyệt).
  const changeStatus = async (status: ContentLifecycle) => {
    if (!shownItem || actionBusy) return;
    setActionBusy(true);
    setActionErr(null);
    try {
      setItem(await updateContentItemStatus(shownItem.id, status));
    } catch (e) {
      setActionErr(`${t.crReviewError}: ${(e as ApiError).message}`);
    } finally {
      setActionBusy(false);
    }
  };

  const chip = (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    border: `1.5px solid ${active ? 'transparent' : '#ece8f6'}`,
    borderRadius: 10,
    padding: '7px 12px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? brandGradient : '#fff',
    color: active ? '#fff' : '#3f3a55',
  });

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1fr 1.15fr', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.crStudio}</div>
          <div style={{ fontSize: 12.5, color: '#8a85a0', marginBottom: 18 }}>{t.pageSubCreate}</div>

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', marginBottom: 8 }}>{t.crStrategy}</label>
          {strategies.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#a59fbb', background: '#faf8fe', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>{t.crNoActiveStrategy}</div>
          ) : (
            <select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: '#241f3a', background: '#fbfaff', outline: 'none', marginBottom: 16 }}
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', marginBottom: 8 }}>{t.crTopic}</label>
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t.crTopicPh} style={{ width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#241f3a', background: '#fbfaff', outline: 'none', resize: 'none', minHeight: 84 }} />

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', margin: '16px 0 8px' }}>{t.crPlatform}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {chans.map((c, i) => (
              <span key={i} onClick={() => setPlatform(i)} style={chip(platform === i)}>
                <PlatformTag tag={c.tag} bg={platform === i ? 'rgba(255,255,255,.25)' : c.bg} size={20} radius={6} fontSize={10} />
                {c.name}
              </span>
            ))}
          </div>

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', margin: '16px 0 8px' }}>{t.crTone}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tones.map((tn, i) => (
              <span key={i} onClick={() => setTone(i)} style={chip(tone === i)}>{tn}</span>
            ))}
          </div>

          {errorMsg && (
            <div style={{ marginTop: 16, fontSize: 12.5, color: '#d1435b', background: '#fdf1f3', borderRadius: 10, padding: '10px 12px' }}>{t.crGenerateError}: {errorMsg}</div>
          )}

          <button
            disabled={!strategyId || busy}
            onClick={() => runGeneration()}
            style={{ width: '100%', marginTop: 22, border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: !strategyId || busy ? 'not-allowed' : 'pointer', opacity: !strategyId || busy ? 0.6 : 1 }}
          >
            {t.crGenerate}
          </button>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 2 }}>{t.crIdeaTitle}</div>
          <div style={{ fontSize: 12.5, color: '#8a85a0', marginBottom: 16 }}>{t.crIdeaSub}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ideaList.map((idea, i) => (
              <div key={i} style={{ border: '1px solid #efeaf8', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: '#fcfbfe' }}>
                <PlatformTag tag={idea.tag} bg={idea.bg} size={34} radius={9} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#2b2543', lineHeight: 1.35 }}>{idea.title}</div>
                  <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 3 }}>{idea.fmt} · {idea.platform}</div>
                </div>
                <div style={{ textAlign: 'center', flex: 'none' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed' }}>{idea.score}</div>
                  <div style={{ fontSize: 9, color: '#a59fbb', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t.crScore}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Preview panel */}
      <Card style={{ position: stacked ? 'static' : 'sticky', top: 98 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PlatformTag tag={activeChannel.tag} bg={activeChannel.bg} size={32} radius={9} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#211c38' }}>{activeChannel.name} · {t.crStudio}</div>
              <div style={{ fontSize: 11.5, color: '#a59fbb', display: 'flex', alignItems: 'center', gap: 6 }}>
                AI generated
                {shownItem && statusLabels[shownItem.status] && (
                  <span style={{ background: shownItem.status === 'APPROVED' ? '#e8f8ef' : shownItem.status === 'NEED_REVIEW' ? '#fef6e7' : '#f3edff', color: shownItem.status === 'APPROVED' ? '#1f9d55' : shownItem.status === 'NEED_REVIEW' ? '#b7791f' : '#7c3aed', borderRadius: 7, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }}>
                    {statusLabels[shownItem.status]}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editable && !editing && (
              <button
                disabled={actionBusy}
                onClick={startEditing}
                style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: '#574f6e', cursor: actionBusy ? 'not-allowed' : 'pointer', opacity: actionBusy ? 0.5 : 1 }}
              >
                {t.crEdit}
              </button>
            )}
            <button
              disabled={job?.status !== 'SUCCESS' || editing}
              onClick={() => runGeneration(shownItem?.caption)}
              style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: '#7c3aed', cursor: job?.status !== 'SUCCESS' || editing ? 'not-allowed' : 'pointer', opacity: job?.status !== 'SUCCESS' || editing ? 0.5 : 1 }}
            >
              ↻ {t.regenerate}
            </button>
          </div>
        </div>

        {busy ? (
          <Loader label={t.crGenerating} />
        ) : job?.status === 'FAILED' ? (
          <div style={{ fontSize: 13.5, color: '#d1435b', background: '#fdf1f3', borderRadius: 12, padding: '14px 16px' }}>
            {t.crGenerateError}{job.errorMessage ? `: ${job.errorMessage}` : ''}
          </div>
        ) : editing ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 9 }}>{t.crScript}</div>
            <textarea value={draft.script} onChange={(e) => setDraft({ ...draft, script: e.target.value })} style={{ width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.5, color: '#241f3a', background: '#fbfaff', outline: 'none', resize: 'vertical', minHeight: 120, marginBottom: 18 }} />

            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 9 }}>{t.crCaption}</div>
            <textarea value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} style={{ width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.55, color: '#241f3a', background: '#fbfaff', outline: 'none', resize: 'vertical', minHeight: 90, marginBottom: 18 }} />

            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 9 }}>{t.crHashtag}</div>
            <input value={draft.hashtags} onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })} placeholder={t.crHashtagHint} style={{ width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#241f3a', background: '#fbfaff', outline: 'none', marginBottom: 18 }} />

            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 9 }}>{t.crMedia}</div>
            <textarea value={draft.mediaPrompt} onChange={(e) => setDraft({ ...draft, mediaPrompt: e.target.value })} style={{ width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#241f3a', background: '#fbfaff', outline: 'none', resize: 'vertical', minHeight: 70 }} />

            {actionErr && (
              <div style={{ marginTop: 14, fontSize: 12.5, color: '#d1435b', background: '#fdf1f3', borderRadius: 10, padding: '10px 12px' }}>{actionErr}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                disabled={actionBusy}
                onClick={saveEdits}
                style={{ flex: 1, border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13.5, color: '#fff', background: brandGradient, cursor: actionBusy ? 'not-allowed' : 'pointer', opacity: actionBusy ? 0.6 : 1 }}
              >
                {t.crSaveEdit}
              </button>
              <button
                disabled={actionBusy}
                onClick={() => setEditing(false)}
                style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '12px 18px', fontWeight: 600, fontSize: 13.5, color: '#574f6e', cursor: actionBusy ? 'not-allowed' : 'pointer' }}
              >
                {t.cancel}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 9 }}>{t.crScript}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {(shownItem?.script.split('\n') ?? script).map((ln, i) => (
                <div key={i} style={{ background: '#faf8fe', borderLeft: '3px solid #8b5cf6', borderRadius: '0 10px 10px 0', padding: '11px 14px', fontSize: 13.5, lineHeight: 1.5, color: '#3f3a55' }}>{ln}</div>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 9 }}>{t.crCaption}</div>
            <div style={{ background: '#faf8fe', borderRadius: 12, padding: '13px 15px', fontSize: 13.5, lineHeight: 1.55, color: '#3f3a55', marginBottom: 18 }}>{shownItem?.caption ?? genCaption(lang)}</div>

            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 9 }}>{t.crHashtag}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
              {(shownItem?.hashtags ?? genHashtags).map((h, i) => (
                <span key={i} style={{ background: '#f3edff', color: '#7c3aed', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600 }}>{h}</span>
              ))}
            </div>

            <div style={{ border: '1.5px dashed #d9cef5', borderRadius: 14, padding: 22, textAlign: 'center', background: 'repeating-linear-gradient(135deg,#faf8fe,#faf8fe 10px,#f4eefc 10px,#f4eefc 20px)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#7c3aed' }}>🎬 {t.crMedia}</div>
              <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 5 }}>{shownItem?.mediaPrompt ?? t.crMediaHint}</div>
            </div>

            {actionErr && (
              <div style={{ marginTop: 14, fontSize: 12.5, color: '#d1435b', background: '#fdf1f3', borderRadius: 10, padding: '10px 12px' }}>{actionErr}</div>
            )}

            {/* FR-34: review flow — Generated → Need Review → Approved (WORKFLOWS.md) */}
            {shownItem?.status === 'GENERATED' && (
              <button
                disabled={actionBusy}
                onClick={() => changeStatus('NEED_REVIEW')}
                style={{ width: '100%', marginTop: 16, border: '1.5px solid #d9cef5', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13.5, color: '#7c3aed', background: '#faf8fe', cursor: actionBusy ? 'not-allowed' : 'pointer', opacity: actionBusy ? 0.6 : 1 }}
              >
                {t.crSubmitReview}
              </button>
            )}
            {shownItem?.status === 'NEED_REVIEW' && (
              <button
                disabled={actionBusy}
                onClick={() => changeStatus('APPROVED')}
                style={{ width: '100%', marginTop: 16, border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13.5, color: '#fff', background: '#1f9d55', cursor: actionBusy ? 'not-allowed' : 'pointer', opacity: actionBusy ? 0.6 : 1 }}
              >
                {t.crApprove}
              </button>
            )}
          </>
        )}

        <button onClick={() => go('calendar')} style={{ width: '100%', marginTop: 18, border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: 'pointer' }}>{t.calNew}</button>
      </Card>
    </div>
  );
}
