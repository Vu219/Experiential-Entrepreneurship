// Client SSE tự viết (fetch + ReadableStream) cho GET /realtime/stream.
//
// NGOẠI LỆ của quy tắc "chỉ gọi API qua axios client" (frontend/CLAUDE.md): axios không đọc được luồng trên trình
// duyệt. Không dùng EventSource gốc vì không thấy HTTP status (không phân biệt 401 để refresh) và không tự đặt được
// Last-Event-ID khi nối lại thủ công. Phụ thuộc môi trường (fetch, đồng hồ, document/window) được tiêm vào để test
// bằng node --test (tests/realtimeClient.test.ts).
import { backoffDelay, createSseParser, type SseEvent } from './sseParser.ts';
import type { RealtimeStatus } from '../store/useRealtimeStore.ts';

export const WATCHDOG_MS = 45_000; // server gửi :hb mỗi 20s — 45s im lặng = kết nối chết nửa vời
export const HIDDEN_CLOSE_MS = 5 * 60_000; // tab ẩn > 5 phút → đóng; hiện lại → mở + resync
export const REVOKED_REFRESH_DELAY_MS = 1200;

export interface RealtimeEnvironment {
  fetch: typeof fetch;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  random: () => number;
  /** Đăng ký nghe thay đổi môi trường: tab ẩn/hiện, mất/có mạng. Trả hàm huỷ. */
  watch?: (listener: { visibility: (visible: boolean) => void; online: (online: boolean) => void }) => () => void;
  isVisible?: () => boolean;
  isOnline?: () => boolean;
}

export interface RealtimeClientOptions {
  url: string;
  /** Làm mới phiên bằng cookie refresh (dùng chung với axios). */
  refresh: (sentAt?: number) => Promise<boolean>;
  /** Refresh thất bại → hết phiên thật. */
  onSessionEnd: () => void;
  onEvent: (event: SseEvent) => void;
  onStatus: (status: RealtimeStatus) => void;
  getLastEventId: () => string | undefined;
  env: RealtimeEnvironment;
}

export interface RealtimeClient {
  start(): void;
  stop(): void;
}

type AfterStream = 'backoff' | 'now' | 'refresh-then-now' | 'revoked' | 'stop';

export function createRealtimeClient(opts: RealtimeClientOptions): RealtimeClient {
  const { env } = opts;
  let running = false;
  let controller: AbortController | null = null;
  let attempt = 0;
  let hidden = false;
  let hiddenTimer: unknown = null;
  let pausedForHidden = false;
  let offline = false;
  let wake: (() => void) | null = null;
  let unwatch: (() => void) | null = null;
  let consecutiveAuthFailures = 0;

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const handle = env.setTimeout(() => {
        wake = null;
        resolve();
      }, ms);
      wake = () => {
        env.clearTimeout(handle);
        wake = null;
        resolve();
      };
    });

  const waitUntilResumable = async () => {
    while (running && (pausedForHidden || offline)) {
      opts.onStatus('paused');
      await new Promise<void>((resolve) => {
        wake = () => {
          wake = null;
          resolve();
        };
      });
    }
  };

  const onVisibility = (visible: boolean) => {
    hidden = !visible;
    if (hidden) {
      if (hiddenTimer === null) {
        hiddenTimer = env.setTimeout(() => {
          hiddenTimer = null;
          if (!hidden) return;
          pausedForHidden = true;
          controller?.abort();
        }, HIDDEN_CLOSE_MS);
      }
      return;
    }
    if (hiddenTimer !== null) {
      env.clearTimeout(hiddenTimer);
      hiddenTimer = null;
    }
    if (pausedForHidden) {
      pausedForHidden = false;
      attempt = 0;
    }
    wake?.(); // hiện lại → nối lại ngay, không chờ hết backoff
  };

  const onOnline = (online: boolean) => {
    offline = !online;
    if (offline) {
      controller?.abort();
    } else {
      attempt = 0;
      wake?.();
    }
  };

  /** Đọc một luồng tới khi đóng; trả việc cần làm tiếp theo. */
  const readStream = async (body: ReadableStream<Uint8Array>, signal: AbortController): Promise<AfterStream> => {
    let after: AfterStream = 'backoff';
    let watchdog: unknown = null;
    const armWatchdog = () => {
      if (watchdog !== null) env.clearTimeout(watchdog);
      watchdog = env.setTimeout(() => signal.abort(), WATCHDOG_MS);
    };
    const parser = createSseParser((event) => {
      switch (event.event) {
        case 'ready':
          attempt = 0;
          consecutiveAuthFailures = 0;
          opts.onStatus('open');
          break;
        case 'replaced':
          after = 'stop';
          break;
        case 'reconnect':
          after = event.data.includes('"token"') ? 'refresh-then-now' : 'now';
          break;
        case 'session.revoked':
          after = 'revoked';
          break;
        default:
          break;
      }
      opts.onEvent(event);
    });
    const reader = body.getReader();
    const decoder = new TextDecoder();
    armWatchdog();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        armWatchdog();
        parser.push(decoder.decode(value, { stream: true }));
      }
    } catch {
      // abort (watchdog / tab ẩn / mất mạng / stop) hoặc lỗi mạng giữa chừng
    } finally {
      if (watchdog !== null) env.clearTimeout(watchdog);
      parser.reset();
      try {
        reader.releaseLock();
      } catch {
        /* đã nhả */
      }
    }
    return after;
  };

  const loop = async () => {
    let first = true;
    while (running) {
      await waitUntilResumable();
      if (!running) return;
      opts.onStatus(first ? 'connecting' : 'reconnecting');
      first = false;
      controller = new AbortController();
      const sentAt = Date.now();
      const lastId = opts.getLastEventId();
      let response: Response;
      try {
        response = await env.fetch(opts.url, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            Accept: 'text/event-stream, application/json',
            ...(lastId ? { 'Last-Event-ID': lastId } : {}),
          },
          signal: controller.signal,
        });
      } catch {
        if (!running) return;
        if (!pausedForHidden && !offline) await sleep(backoffDelay(attempt++, env.random));
        continue;
      }

      if (response.status === 401) {
        consecutiveAuthFailures++;
        const refreshed = consecutiveAuthFailures <= 2 && (await opts.refresh(sentAt));
        if (!running) return;
        if (refreshed) continue;
        stopInternal('stopped');
        opts.onSessionEnd();
        return;
      }
      if (response.status === 403) {
        stopInternal('stopped');
        return;
      }
      if (!response.ok || !response.body) {
        const retryAfter = Number(response.headers.get('Retry-After'));
        await sleep(retryAfter > 0 ? retryAfter * 1000 : backoffDelay(attempt++, env.random));
        continue;
      }

      const after = await readStream(response.body, controller);
      if (!running) return;
      if (pausedForHidden || offline) continue;
      if (after === 'stop') {
        stopInternal('stopped');
        return;
      }
      if (after === 'revoked') {
        // logout_time lưu theo ms còn `iat` của JWT tính theo GIÂY: token làm mới trong cùng giây với lệnh đăng xuất
        // bị coi là đã thu hồi (và filter xoá luôn cookie refresh). Chờ sang giây sau rồi mới refresh.
        await sleep(REVOKED_REFRESH_DELAY_MS + Math.round(env.random() * 800));
        if (!running) return;
      }
      if (after === 'refresh-then-now' || after === 'revoked') {
        const ok = await opts.refresh();
        if (!running) return;
        if (!ok) {
          stopInternal('stopped');
          opts.onSessionEnd();
          return;
        }
        continue;
      }
      if (after === 'now') continue;
      opts.onStatus('reconnecting');
      await sleep(backoffDelay(attempt++, env.random));
    }
  };

  const stopInternal = (status: RealtimeStatus) => {
    running = false;
    controller?.abort();
    controller = null;
    wake?.();
    if (hiddenTimer !== null) {
      env.clearTimeout(hiddenTimer);
      hiddenTimer = null;
    }
    unwatch?.();
    unwatch = null;
    opts.onStatus(status);
  };

  return {
    start() {
      if (running) return;
      running = true;
      attempt = 0;
      consecutiveAuthFailures = 0;
      hidden = env.isVisible ? !env.isVisible() : false;
      offline = env.isOnline ? !env.isOnline() : false;
      pausedForHidden = false;
      unwatch = env.watch?.({ visibility: onVisibility, online: onOnline }) ?? null;
      if (hidden) onVisibility(false);
      void loop();
    },
    stop() {
      if (!running) return;
      stopInternal('idle');
    },
  };
}

/** Môi trường trình duyệt thật. */
export function browserRealtimeEnvironment(): RealtimeEnvironment {
  return {
    fetch: (input, init) => fetch(input, init),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
    random: Math.random,
    isVisible: () => document.visibilityState === 'visible',
    isOnline: () => navigator.onLine !== false,
    watch: ({ visibility, online }) => {
      const onVis = () => visibility(document.visibilityState === 'visible');
      const onOn = () => online(true);
      const onOff = () => online(false);
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('online', onOn);
      window.addEventListener('offline', onOff);
      return () => {
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('online', onOn);
        window.removeEventListener('offline', onOff);
      };
    },
  };
}
