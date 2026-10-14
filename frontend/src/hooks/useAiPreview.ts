import { useEffect, useState } from 'react';
import { subscribeRealtime } from '../realtime/events';
import { applyAiDelta, applyAiReset, EMPTY_PREVIEW, type AiPreviewState } from '../realtime/aiPreview';

/** Nội dung AI đang sinh của một job (sự kiện `ai.delta` / `ai.reset`); jobId đổi / null → xoá. */
export function useAiPreview(jobId: string | undefined): AiPreviewState {
  const [state, setState] = useState<AiPreviewState>(EMPTY_PREVIEW);

  useEffect(() => {
    setState(EMPTY_PREVIEW);
    if (!jobId) return;
    const offDelta = subscribeRealtime('ai.delta', (e) => {
      if (e.jobId === jobId) setState((s) => applyAiDelta(s, e));
    });
    const offReset = subscribeRealtime('ai.reset', (e) => {
      if (e.jobId === jobId) setState((s) => applyAiReset(s, e));
    });
    return () => {
      offDelta();
      offReset();
    };
  }, [jobId]);

  return state;
}
