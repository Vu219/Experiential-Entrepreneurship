// Chạy: npm test  (node --test --experimental-strip-types — không cần thêm dependency)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiErrorMessage, toAiErrorCode } from '../src/api/aiErrorMessages.ts';

const VI: Record<string, string> = {
  AI_PROVIDER_OVERLOADED: 'Hệ thống AI đang quá tải, vui lòng thử lại sau ít phút.',
  AI_QUOTA_EXHAUSTED: 'Đã đạt giới hạn sử dụng AI hôm nay. Vui lòng thử lại sau hoặc liên hệ quản trị viên.',
  AI_TIMEOUT: 'Quá trình tạo nội dung mất nhiều thời gian hơn dự kiến. Nội dung có thể vẫn đang được tạo, hãy kiểm tra Thư viện nội dung sau ít phút.',
  AI_BAD_REQUEST: 'Yêu cầu không hợp lệ, vui lòng chỉnh lại nội dung đầu vào.',
  AI_UNAVAILABLE: 'Không thể tạo nội dung lúc này, vui lòng thử lại.',
};

test('each AI error code maps to its Vietnamese message', () => {
  for (const [code, msg] of Object.entries(VI)) {
    assert.equal(aiErrorMessage('vi', code), msg, code);
  }
});

test('unknown / missing / legacy codes fall back to the generic message', () => {
  for (const code of ['SOMETHING_NEW', 'AI_SERVICE_ERROR', undefined, null, '']) {
    assert.equal(aiErrorMessage('vi', code), VI.AI_UNAVAILABLE, String(code));
  }
});

test('numeric envelope codes map to the same messages', () => {
  assert.equal(aiErrorMessage('vi', 1908), VI.AI_PROVIDER_OVERLOADED);
  assert.equal(aiErrorMessage('vi', 1909), VI.AI_QUOTA_EXHAUSTED);
  assert.equal(aiErrorMessage('vi', 1907), VI.AI_TIMEOUT);
  assert.equal(aiErrorMessage('vi', 1954), VI.AI_BAD_REQUEST);
  assert.equal(aiErrorMessage('vi', 1904), VI.AI_UNAVAILABLE);
  assert.equal(toAiErrorCode(1906), null, 'non-AI business error is not remapped');
});

test('never echoes raw provider text, JSON or stack traces', () => {
  const raw = '{"detail":{"error_code":"X","message":"429 RESOURCE_EXHAUSTED"}}\n    at com.aima.Foo(Foo.java:1)';
  const msg = aiErrorMessage('vi', raw);
  assert.equal(msg, VI.AI_UNAVAILABLE);
  assert.ok(!msg.includes('{') && !msg.includes(' at '));
});

test('English variants exist for every code', () => {
  for (const code of Object.keys(VI)) {
    const en = aiErrorMessage('en', code);
    assert.ok(en.length > 0 && en !== VI[code], code);
  }
});
