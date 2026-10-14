// Khung xem trước nội dung AI đang sinh: gộp `ai.delta` / `ai.reset` của MỘT job thành {path → chữ}. Hàm thuần —
// test ở tests/aiPreview.test.ts. Chỉ là xem trước: kết quả thật luôn GET lại từ DB khi job SUCCESS.
import type { AiDeltaEvent, AiResetEvent } from './events.ts';

export interface AiPreviewState {
  /** seq lớn nhất đã áp dụng — sự kiện tới trễ / trùng (seq ≤ seq) bị bỏ. */
  seq: number;
  fields: Record<string, string>;
  /** Số lần chuyển model dự phòng giữa chừng (hiện "Đang thử model dự phòng"). */
  resets: number;
}

export const EMPTY_PREVIEW: AiPreviewState = { seq: 0, fields: {}, resets: 0 };

export function applyAiDelta(state: AiPreviewState, event: Pick<AiDeltaEvent, 'seq' | 'path' | 'append'> & { replace?: boolean }): AiPreviewState {
  if (event.seq <= state.seq) return state;
  const previous = state.fields[event.path] ?? '';
  return {
    ...state,
    seq: event.seq,
    fields: { ...state.fields, [event.path]: event.replace ? event.append : previous + event.append },
  };
}

export function applyAiReset(state: AiPreviewState, _event?: Pick<AiResetEvent, 'reason'>): AiPreviewState {
  // seq giữ nguyên: delta mới của model dự phòng vẫn tăng tiếp (backend đánh seq theo job).
  return { seq: state.seq, fields: {}, resets: state.resets + 1 };
}

export interface PreviewSection {
  key: 'hook' | 'steps' | 'cta' | 'caption' | 'hashtags' | 'media';
  lines: string[];
}

/** Sắp field đã nhận theo thứ tự đầu ra của AI: kịch bản (hook → steps → cta) → caption → hashtags → CTA → media prompt. */
export function previewSections(fields: Record<string, string>): PreviewSection[] {
  const pick = (re: RegExp) => Object.keys(fields)
    .filter((k) => re.test(k))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((k) => fields[k])
    .filter((v) => v.trim() !== '');
  const sections: PreviewSection[] = [
    { key: 'hook', lines: pick(/^script\.hook\.content$/) },
    { key: 'steps', lines: pick(/^script\.steps\[\d+\]\.content$/) },
    { key: 'cta', lines: pick(/^(script\.cta\.content|cta)$/) },
    { key: 'caption', lines: pick(/^caption$/) },
    { key: 'hashtags', lines: pick(/^hashtags\[\d+\]$/) },
    { key: 'media', lines: pick(/^media_prompt$/) },
  ];
  return sections.filter((s) => s.lines.length > 0);
}
