// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForJob } from '../src/realtime/waitForJob.ts';
import type { JobUpdatedEvent } from '../src/realtime/events.ts';

type Job = { id: string; status: string };

function bus() {
  let handler: ((e: JobUpdatedEvent) => void) | null = null;
  return {
    subscribe: (h: (e: JobUpdatedEvent) => void) => { handler = h; return () => { handler = null; }; },
    emit: (e: Partial<JobUpdatedEvent>) => handler?.({ v: 1, ts: '', kind: 'GENERATION', jobId: 'j1', status: 'RUNNING', ...e }),
    get subscribed() { return handler !== null; },
  };
}

test('realtime open: terminal event wakes the wait immediately (no 15s poll)', async () => {
  const b = bus();
  let fetches = 0;
  const started = Date.now();
  const p = waitForJob<Job>({
    jobId: 'j1', initial: { id: 'j1', status: 'PENDING' }, isDone: (j) => j.status === 'SUCCESS',
    fetch: async () => { fetches++; return { id: 'j1', status: fetches >= 2 ? 'SUCCESS' : 'RUNNING' }; },
    pollMs: () => 30, isRealtimeOpen: () => true, subscribe: b.subscribe,
  });
  await new Promise((r) => setTimeout(r, 60)); // vòng đầu (30ms) → fetch RUNNING, rồi chờ 15s an toàn
  b.emit({ jobId: 'other', status: 'SUCCESS' }); // job khác: bỏ qua
  b.emit({ status: 'SUCCESS' });
  const job = await p;
  assert.equal(job.status, 'SUCCESS');
  assert.equal(fetches, 2);
  assert.ok(Date.now() - started < 2000);
  assert.equal(b.subscribed, false, 'huỷ đăng ký khi xong');
});

test('realtime closed: falls back to the caller poll cadence', async () => {
  const b = bus();
  let fetches = 0;
  const job = await waitForJob<Job>({
    jobId: 'j1', initial: { id: 'j1', status: 'PENDING' }, isDone: (j) => j.status !== 'PENDING' && j.status !== 'RUNNING',
    fetch: async () => { fetches++; return { id: 'j1', status: fetches >= 3 ? 'FAILED' : 'RUNNING' }; },
    pollMs: () => 5, isRealtimeOpen: () => false, subscribe: b.subscribe,
  });
  assert.equal(job.status, 'FAILED');
  assert.equal(fetches, 3);
});

test('progress events are forwarded; deadline throws the caller error', async () => {
  const b = bus();
  const seen: (string | null | undefined)[] = [];
  const p = waitForJob<Job>({
    jobId: 'j1', initial: { id: 'j1', status: 'RUNNING' }, isDone: () => false,
    fetch: async () => ({ id: 'j1', status: 'RUNNING' }),
    pollMs: () => 10, isRealtimeOpen: () => true, subscribe: b.subscribe,
    onEvent: (e) => seen.push(e.stage), deadline: Date.now() + 80, onDeadline: () => new Error('AI_TIMEOUT'),
  });
  b.emit({ stage: 'PREPARING' });
  b.emit({ stage: 'GENERATING' });
  await assert.rejects(p, /AI_TIMEOUT/);
  assert.deepEqual(seen, ['PREPARING', 'GENERATING']);
});

test('already finished initial job resolves without waiting', async () => {
  const job = await waitForJob<Job>({
    jobId: 'j1', initial: { id: 'j1', status: 'SUCCESS' }, isDone: (j) => j.status === 'SUCCESS',
    fetch: async () => { throw new Error('should not fetch'); }, pollMs: () => 1000, subscribe: bus().subscribe,
  });
  assert.equal(job.status, 'SUCCESS');
});
