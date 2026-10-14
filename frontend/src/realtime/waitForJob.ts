// Chờ một tác vụ nền xong: nghe `job.updated` qua luồng realtime, GET lại job khi nhận trạng thái cuối. Luồng không mở
// (hoặc lỡ sự kiện) → quay về đúng nhịp poll cũ của nơi gọi; luồng mở thì chỉ poll an toàn mỗi 15s.
// Phụ thuộc (subscribe / trạng thái luồng / đồng hồ) tiêm được để test — tests/waitForJob.test.ts.
import { subscribeRealtime, type JobUpdatedEvent } from './events.ts';

export const SSE_SAFETY_POLL_MS = 15_000;
const TERMINAL = new Set(['SUCCESS', 'FAILED', 'COMPLETED']);

export interface WaitForJobOptions<T> {
  jobId: string;
  initial: T;
  fetch: () => Promise<T>;
  isDone: (job: T) => boolean;
  /** Nhịp poll khi KHÔNG có realtime (giữ như trước), theo số vòng. */
  pollMs: (round: number) => number;
  /** Mốc tuyệt đối (ms); quá hạn → ném lỗi do `onDeadline` trả về. */
  deadline?: number;
  onDeadline?: (job: T) => Error;
  /** Mọi `job.updated` của job này (tiến độ: stage / progress). */
  onEvent?: (event: JobUpdatedEvent) => void;
  isRealtimeOpen?: () => boolean;
  subscribe?: (handler: (event: JobUpdatedEvent) => void) => () => void;
  now?: () => number;
}

export async function waitForJob<T>(opts: WaitForJobOptions<T>): Promise<T> {
  const now = opts.now ?? Date.now;
  const isOpen = opts.isRealtimeOpen ?? (() => false);
  const subscribe = opts.subscribe ?? ((h) => subscribeRealtime('job.updated', h));
  let terminalSeen = false;
  let wake: (() => void) | null = null;

  const unsubscribe = subscribe((event) => {
    if (event.jobId !== opts.jobId) return;
    opts.onEvent?.(event);
    if (TERMINAL.has(event.status)) {
      terminalSeen = true;
      wake?.();
    }
  });

  const pause = (ms: number) => new Promise<void>((resolve) => {
    const timer = setTimeout(() => { wake = null; resolve(); }, ms);
    wake = () => { clearTimeout(timer); wake = null; resolve(); };
  });

  try {
    let job = opts.initial;
    let round = 0;
    while (!opts.isDone(job)) {
      if (opts.deadline !== undefined && now() >= opts.deadline) {
        throw opts.onDeadline ? opts.onDeadline(job) : new Error('JOB_TIMEOUT');
      }
      if (!terminalSeen) {
        // Vòng đầu luôn ngắn: job có thể xong TRƯỚC khi kịp đăng ký nghe (sự kiện đó bị lỡ).
        let wait = round === 0 || !isOpen() ? opts.pollMs(round) : SSE_SAFETY_POLL_MS;
        if (opts.deadline !== undefined) wait = Math.max(0, Math.min(wait, opts.deadline - now()));
        round++;
        await pause(wait);
      }
      terminalSeen = false;
      job = await opts.fetch();
    }
    return job;
  } finally {
    unsubscribe();
  }
}
