// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backoffDelay, createSseParser, type SseEvent } from '../src/realtime/sseParser.ts';

function collect() {
  const events: SseEvent[] = [];
  const comments: string[] = [];
  const parser = createSseParser((e) => events.push(e), (c) => comments.push(c));
  return { events, comments, parser };
}

test('parses the exact frame Spring SseEmitter writes', () => {
  const { events, parser } = collect();
  parser.push('retry:3000\n:open\n\nevent:ready\ndata:{"unreadCount":2,"v":1}\n\n');
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { event: 'ready', data: '{"unreadCount":2,"v":1}' });
});

test('lines split across chunks, including between \\r and \\n', () => {
  const { events, parser } = collect();
  for (const chunk of ['event:notification.cre', 'ated\r', '\nid:abc\r\nda', 'ta:{"x":1}\r', '\n\r', '\n']) {
    parser.push(chunk);
  }
  assert.deepEqual(events, [{ event: 'notification.created', data: '{"x":1}', id: 'abc' }]);
});

test('multi-line data joins with \\n; one leading space stripped; default name is message', () => {
  const { events, parser } = collect();
  parser.push('data: line1\ndata:  line2\n\n');
  assert.deepEqual(events, [{ event: 'message', data: 'line1\n line2' }]);
});

test('comments (heartbeat) are reported and never dispatched as events', () => {
  const { events, comments, parser } = collect();
  parser.push(':hb\n\n:hb\n\n');
  assert.equal(events.length, 0);
  assert.deepEqual(comments, ['hb', 'hb']);
});

test('event without data is dropped; fields reset between events', () => {
  const { events, parser } = collect();
  parser.push('event:orphan\n\nevent:a\nid:1\ndata:x\n\ndata:y\n\n');
  assert.deepEqual(events, [
    { event: 'a', data: 'x', id: '1' },
    { event: 'message', data: 'y' },
  ]);
});

test('reset discards a half-received event (stream cut mid-event)', () => {
  const { events, parser } = collect();
  parser.push('event:job.updated\ndata:{"half"');
  parser.reset();
  parser.push('event:ready\ndata:{}\n\n');
  assert.deepEqual(events, [{ event: 'ready', data: '{}' }]);
});

test('retry field is parsed only when numeric', () => {
  const { events, parser } = collect();
  parser.push('retry:abc\ndata:a\n\nretry:2500\ndata:b\n\n');
  assert.equal(events[0].retry, undefined);
  assert.equal(events[1].retry, 2500);
});

test('backoff grows 1→2→4… capped at 30s with bounded jitter', () => {
  const mid = () => 0.5; // jitter 0
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 10].map((a) => backoffDelay(a, mid)),
    [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  assert.equal(backoffDelay(5, () => 1), 36000);
  assert.equal(backoffDelay(5, () => 0), 24000);
});
