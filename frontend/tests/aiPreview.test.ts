// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAiDelta, applyAiReset, EMPTY_PREVIEW, previewSections } from '../src/realtime/aiPreview.ts';

test('deltas append per field in seq order; late/duplicate seq ignored', () => {
  let s = EMPTY_PREVIEW;
  s = applyAiDelta(s, { seq: 1, path: 'caption', append: 'Xin ' });
  s = applyAiDelta(s, { seq: 2, path: 'caption', append: 'chào' });
  s = applyAiDelta(s, { seq: 2, path: 'caption', append: 'chào' }); // trùng
  s = applyAiDelta(s, { seq: 1, path: 'caption', append: 'X' });    // tới trễ
  assert.equal(s.fields.caption, 'Xin chào');
  s = applyAiDelta(s, { seq: 3, path: 'caption', append: 'Chào bạn', replace: true });
  assert.equal(s.fields.caption, 'Chào bạn');
});

test('reset clears the preview but keeps seq so the fallback model continues', () => {
  let s = applyAiDelta(EMPTY_PREVIEW, { seq: 5, path: 'caption', append: 'abc' });
  s = applyAiReset(s, { reason: 'fallback' });
  assert.deepEqual(s.fields, {});
  assert.equal(s.resets, 1);
  s = applyAiDelta(s, { seq: 6, path: 'caption', append: 'new' });
  assert.equal(s.fields.caption, 'new');
});

test('sections follow the AI output order and numeric step order', () => {
  const sections = previewSections({
    caption: 'Cap', 'script.steps[10].content': 'B10', 'script.steps[2].content': 'B2',
    'script.hook.content': 'Hook', 'script.hook.scene_suggestion': 'ignored', 'hashtags[0]': '#a', 'hashtags[1]': '',
    media_prompt: 'Video',
  });
  assert.deepEqual(sections.map((s) => s.key), ['hook', 'steps', 'caption', 'hashtags', 'media']);
  assert.deepEqual(sections[1].lines, ['B2', 'B10']);
  assert.deepEqual(sections[3].lines, ['#a']);
});
