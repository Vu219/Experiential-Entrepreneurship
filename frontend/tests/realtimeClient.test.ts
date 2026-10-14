// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRealtimeClient, WATCHDOG_MS, type RealtimeEnvironment } from '../src/realtime/realtimeClient.ts';
import type { SseEvent } from '../src/realtime/sseParser.ts';

const enc = new TextEncoder();

/** Response SSE giả: phát các mẩu rồi đóng (hoặc giữ mở tới khi bị abort). */
function sse(chunks: string[], signal: AbortSignal | undefined, keepOpen = false): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      if (!keepOpen) controller.close();
      signal?.addEventListener('abort', () => {
        try {
          controller.error(new DOMException('aborted', 'AbortError'));
        } catch {
          /* đã đóng */
        }
      });
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

type Step = (init: RequestInit) => Response;

function harness(steps: Step[], opts: { refresh?: boolean[]; lastId?: string } = {}) {
  const calls: RequestInit[] = [];
  const statuses: string[] = [];
  const events: SseEvent[] = [];
  const refreshCalls: (number | undefined)[] = [];
  const refreshResults = [...(opts.refresh ?? [])];
  let sessionEnded = 0;
  let idle: () => void = () => undefined;
  const idlePromise = new Promise<void>((r) => { idle = r; });
  const env: RealtimeEnvironment = {
    fetch: async (_url, init) => {
      calls.push(init ?? {});
      const step = steps.shift();
      if (!step) {
        idle();
        return new Promise<Response>(() => undefined); // treo: hết kịch bản
      }
      return step(init ?? {});
    },
    // Thu nhỏ thời gian: backoff/Retry-After → 1ms, watchdog → 300ms.
    setTimeout: (fn, ms) => setTimeout(fn, ms === WATCHDOG_MS ? 300 : 1),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    random: () => 0.5,
  };
  const client = createRealtimeClient({
    url: 'http://api/realtime/stream',
    refresh: async (sentAt) => {
      refreshCalls.push(sentAt);
      return refreshResults.shift() ?? false;
    },
    onSessionEnd: () => { sessionEnded++; },
    onEvent: (e) => events.push(e),
    onStatus: (s) => statuses.push(s),
    getLastEventId: () => opts.lastId,
    env,
  });
  return { client, calls, statuses, events, refreshCalls, idlePromise, sessionEnded: () => sessionEnded };
}

const READY = 'event:ready\ndata:{"unreadCount":0,"resync":false}\n\n';
const header = (init: RequestInit, name: string) => (init.headers as Record<string, string>)[name];
const until = (p: Promise<void>, ms = 2000) =>
  Promise.race([p, new Promise<void>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

test('opens with cookies + Accept, reaches open, reconnects after the server closes and sends Last-Event-ID', async () => {
  const h = harness([(i) => sse([READY], i.signal ?? undefined), (i) => sse([READY], i.signal ?? undefined, true)],
    { lastId: 'n-42' });
  h.client.start();
  await until(h.idlePromise).catch(() => undefined);
  await new Promise((r) => setTimeout(r, 20));
  h.client.stop();
  assert.equal(h.calls.length >= 2, true);
  assert.equal(h.calls[0].credentials, 'include');
  assert.match(header(h.calls[0], 'Accept'), /text\/event-stream/);
  assert.equal(header(h.calls[1], 'Last-Event-ID'), 'n-42');
  assert.ok(h.statuses.includes('open'));
  assert.ok(h.statuses.includes('reconnecting'));
});

test('401 → refresh (with the request time) → reconnect', async () => {
  const h = harness([() => new Response(null, { status: 401 }), (i) => sse([READY], i.signal ?? undefined, true)],
    { refresh: [true] });
  h.client.start();
  await new Promise((r) => setTimeout(r, 50));
  h.client.stop();
  assert.equal(h.refreshCalls.length, 1);
  assert.equal(typeof h.refreshCalls[0], 'number');
  assert.equal(h.calls.length, 2);
  assert.ok(h.statuses.includes('open'));
});

test('401 and refresh fails → session ends, client stops for good', async () => {
  const h = harness([() => new Response(null, { status: 401 })], { refresh: [false] });
  h.client.start();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(h.sessionEnded(), 1);
  assert.equal(h.calls.length, 1);
  assert.equal(h.statuses.at(-1), 'stopped');
});

test('replaced (another tab took the slot) → no reconnect', async () => {
  const h = harness([(i) => sse([READY, 'event:replaced\ndata:{}\n\n'], i.signal ?? undefined)]);
  h.client.start();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(h.calls.length, 1);
  assert.equal(h.statuses.at(-1), 'stopped');
});

test('reconnect with reason=token refreshes the session first', async () => {
  const h = harness([
    (i) => sse([READY, 'event:reconnect\ndata:{"reason":"token"}\n\n'], i.signal ?? undefined),
    (i) => sse([READY], i.signal ?? undefined, true),
  ], { refresh: [true] });
  h.client.start();
  await new Promise((r) => setTimeout(r, 50));
  h.client.stop();
  assert.equal(h.refreshCalls.length, 1);
  assert.equal(h.calls.length, 2);
});

test('session.revoked + refresh fails → session ends', async () => {
  const h = harness([(i) => sse([READY, 'event:session.revoked\ndata:{}\n\n'], i.signal ?? undefined)],
    { refresh: [false] });
  h.client.start();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(h.sessionEnded(), 1);
  assert.equal(h.calls.length, 1);
});

test('503 + Retry-After → waits and retries', async () => {
  const h = harness([
    () => new Response('{"code":2201}', { status: 503, headers: { 'Retry-After': '1' } }),
    (i) => sse([READY], i.signal ?? undefined, true),
  ]);
  h.client.start();
  await new Promise((r) => setTimeout(r, 50));
  h.client.stop();
  assert.equal(h.calls.length, 2);
});

test('watchdog aborts a silent connection and reconnects', async () => {
  const h = harness([
    (i) => sse([READY], i.signal ?? undefined, true), // im lặng sau ready → watchdog (300ms trong test)
    (i) => sse([READY], i.signal ?? undefined, true),
  ]);
  h.client.start();
  await new Promise((r) => setTimeout(r, 450));
  h.client.stop();
  assert.equal(h.calls.length, 2);
});

test('stop() aborts the stream and never reconnects (StrictMode double mount)', async () => {
  const h = harness([(i) => sse([READY], i.signal ?? undefined, true), (i) => sse([READY], i.signal ?? undefined, true)]);
  h.client.start();
  await new Promise((r) => setTimeout(r, 20));
  h.client.stop();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(h.calls.length, 1);
  assert.equal(h.statuses.at(-1), 'idle');
  assert.equal(h.events[0].event, 'ready');
});
