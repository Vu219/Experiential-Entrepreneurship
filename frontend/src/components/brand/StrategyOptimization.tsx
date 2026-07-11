import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, History, Loader2, Sparkles, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TONE_COLORS, type Tone } from '../../statusTokens';
import {
  decideAdjustment, getOptimizationJob, listAdjustments, startOptimization,
  ERR_NO_ANALYZED_POSTS,
  type AppliedStatus, type StrategyAdjustment,
} from '../../api/strategyOptimization';
import type { ApiError } from '../../api/apiClient';

const POLL_MS = 3000;

const DECISION_TONE: Record<AppliedStatus, Tone> = { PENDING: 'warning', APPLIED: 'success', REJECTED: 'neutral' };

/**
 * FR-65..FR-68 — mục "Tối ưu từ dữ liệu" trong chi tiết chiến lược: chạy job AI phân tích
 * bài đã đăng → đề xuất điều chỉnh; user chấp nhận/từ chối từng đề xuất; lịch sử gấp gọn.
 */
export default function StrategyOptimization({ strategyId }: { strategyId: string }) {
  const { t, brandGradient } = useApp();
  const [adjustments, setAdjustments] = useState<StrategyAdjustment[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(() => {
    listAdjustments(strategyId).then(setAdjustments).catch(() => undefined);
  }, [strategyId]);

  useEffect(() => {
    reload();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [reload]);

  const poll = useCallback((jobId: string) => {
    pollTimer.current = setTimeout(async () => {
      try {
        const job = await getOptimizationJob(jobId);
        if (job.status === 'SUCCESS') {
          setRunning(false);
          setImprovements(job.futureImprovements);
          reload();
        } else if (job.status === 'FAILED') {
          setRunning(false);
          setError(job.errorMessage || t.soErrRun);
        } else {
          poll(jobId);
        }
      } catch {
        setRunning(false);
        setError(t.soErrRun);
      }
    }, POLL_MS);
  }, [reload, t.soErrRun]);

  const run = async () => {
    setError(null);
    setImprovements([]);
    setRunning(true);
    try {
      const job = await startOptimization(strategyId);
      poll(job.id);
    } catch (e) {
      setRunning(false);
      const err = e as ApiError;
      setError(err.code === ERR_NO_ANALYZED_POSTS ? t.soNoData : err.message);
    }
  };

  const decide = async (id: string, status: 'APPLIED' | 'REJECTED') => {
    setBusyId(id);
    try {
      const updated = await decideAdjustment(id, status);
      setAdjustments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const pending = adjustments.filter((a) => a.appliedStatus === 'PENDING');
  const decided = adjustments.filter((a) => a.appliedStatus !== 'PENDING');

  return (
    <div style={{ border: '1px solid #efeaf8', borderRadius: 13, padding: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Sparkles size={15} color="#7c3aed" />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#7c3aed' }}>{t.soTitle}</span>
        </div>
        <button
          onClick={run}
          disabled={running}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10,
            padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: '#fff',
            background: brandGradient, cursor: running ? 'default' : 'pointer', opacity: running ? 0.6 : 1,
          }}
        >
          {running ? <Loader2 size={14} style={{ animation: 'spinslow 1s linear infinite' }} /> : <Sparkles size={14} />}
          {running ? t.soRunning : t.soRun}
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 6, lineHeight: 1.5 }}>{t.soSub}</div>

      {error && (
        <div style={{ fontSize: 12.5, color: '#b45309', background: '#fdf6e7', borderRadius: 9, padding: '8px 11px', marginTop: 10, lineHeight: 1.5 }}>{error}</div>
      )}

      {improvements.length > 0 && (
        <div style={{ marginTop: 12, background: '#f8f5ff', border: '1px solid #e9defb', borderRadius: 11, padding: '11px 13px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#6d28d9', marginBottom: 6 }}>{t.soImprovements}</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {improvements.map((line, i) => (
              <li key={i} style={{ fontSize: 12.5, color: '#4b4660', lineHeight: 1.5 }}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {pending.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {pending.map((a) => (
            <AdjustmentCard key={a.id} adjustment={a} busy={busyId === a.id} onDecide={decide} />
          ))}
        </div>
      )}
      {!running && pending.length === 0 && adjustments.length === 0 && !error && (
        <div style={{ fontSize: 12.5, color: '#a39bbf', marginTop: 10 }}>{t.soEmpty}</div>
      )}

      {decided.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', padding: 0 }}
          >
            <History size={13} />
            {t.soHistory} ({decided.length})
            <ChevronDown size={13} style={{ transition: 'transform .2s', transform: historyOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
          {historyOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {decided.map((a) => (
                <AdjustmentCard key={a.id} adjustment={a} busy={false} onDecide={decide} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdjustmentCard({ adjustment: a, busy, onDecide }: {
  adjustment: StrategyAdjustment;
  busy: boolean;
  onDecide: (id: string, status: 'APPLIED' | 'REJECTED') => void;
}) {
  const { t } = useApp();
  const tone = TONE_COLORS[DECISION_TONE[a.appliedStatus]];
  const decisionLabel = a.appliedStatus === 'APPLIED' ? t.soApplied : a.appliedStatus === 'REJECTED' ? t.soRejected : t.soPending;

  return (
    <div style={{ border: '1px solid #efeaf8', borderRadius: 11, padding: '11px 13px', background: '#fcfbfe', opacity: busy ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2b2543', lineHeight: 1.45 }}>{a.adjustmentContent}</div>
          {a.rationale && <div style={{ fontSize: 12, color: '#6f6a86', lineHeight: 1.5, marginTop: 4 }}>{a.rationale}</div>}
          {a.insightContent && (
            <div style={{ fontSize: 11.5, color: '#8a85a0', lineHeight: 1.5, marginTop: 6, borderLeft: '2px solid #e3d9fb', paddingLeft: 8 }}>
              {a.insightContent}
            </div>
          )}
        </div>
        <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, color: tone.color, background: tone.bg }}>
          {decisionLabel}
        </span>
      </div>
      {a.appliedStatus === 'PENDING' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => onDecide(a.id, 'APPLIED')} disabled={busy} style={decisionBtn('#16a34a', '#e8f8ee')}>
            <Check size={13} /> {t.soAccept}
          </button>
          <button onClick={() => onDecide(a.id, 'REJECTED')} disabled={busy} style={decisionBtn('#64748b', '#eef2f7')}>
            <X size={13} /> {t.soReject}
          </button>
        </div>
      )}
    </div>
  );
}

const decisionBtn = (color: string, bg: string) => ({
  display: 'flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 9,
  padding: '6px 12px', fontSize: 12, fontWeight: 700, color, background: bg, cursor: 'pointer',
}) as const;
