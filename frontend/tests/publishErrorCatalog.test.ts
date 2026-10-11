// Chạy: npm test  (node --test --experimental-strip-types — không cần thêm dependency)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLISH_ERROR_CATEGORIES, PUBLISH_ERROR_CODES, platformDisplayName, publishErrorActionLabel,
  publishErrorCategoryLabel, publishErrorCopy, toPublishErrorCode,
} from '../src/api/publishErrorCatalog.ts';

// Mã của enum backend PublishErrorCode (backend/src/main/java/com/aima/enums/PublishErrorCode.java) — giữ đồng bộ.
const BACKEND_CODES = [
  'POLICY_VIOLATION', 'POLICY_TEMPORARY_BLOCK', 'AUTH_TOKEN_EXPIRED', 'AUTH_PASSWORD_CHANGED', 'AUTH_APP_REMOVED',
  'AUTH_PERMISSION_MISSING', 'AUTH_PAGE_ROLE_MISSING', 'ACCOUNT_CHECKPOINT', 'ACCOUNT_RESTRICTED',
  'ACCOUNT_DISCONNECTED', 'ACCOUNT_TYPE_UNSUPPORTED', 'RATE_LIMITED', 'QUOTA_EXCEEDED', 'CONTENT_TOO_LONG',
  'CONTENT_DUPLICATE', 'CONTENT_INVALID', 'MEDIA_REQUIRED', 'MEDIA_INVALID', 'PLATFORM_TEMPORARY', 'PLATFORM_OUTAGE',
  'NETWORK_TIMEOUT', 'PUBLISH_INTERRUPTED', 'PLATFORM_UNSUPPORTED', 'INTERNAL_ERROR', 'UNKNOWN',
];

test('catalog covers exactly the backend codes', () => {
  assert.deepEqual([...PUBLISH_ERROR_CODES].sort(), [...BACKEND_CODES].sort());
});

test('every code has a full vi + en copy with steps', () => {
  for (const code of PUBLISH_ERROR_CODES) {
    for (const lang of ['vi', 'en'] as const) {
      const copy = publishErrorCopy(lang, code, { platform: 'Facebook', account: 'AIMA Coffee' });
      assert.ok(copy.title.length > 0, `${code} ${lang} title`);
      assert.ok(copy.what.length > 0, `${code} ${lang} what`);
      assert.ok(copy.why.length > 0, `${code} ${lang} why`);
      assert.ok(copy.steps.length > 0, `${code} ${lang} steps`);
      const all = [copy.title, copy.what, copy.why, ...copy.steps].join(' ');
      assert.ok(!all.includes('{platform}') && !all.includes('{account}'), `${code} ${lang} placeholders replaced`);
    }
  }
});

test('params are interpolated, missing params fall back to generic words', () => {
  const copy = publishErrorCopy('vi', 'AUTH_TOKEN_EXPIRED', { platform: 'Instagram', account: '@aima.coffee' });
  assert.equal(copy.title, 'Kết nối Instagram đã hết hạn');
  assert.ok(copy.what.includes('@aima.coffee'));
  const generic = publishErrorCopy('vi', 'AUTH_TOKEN_EXPIRED');
  assert.equal(generic.title, 'Kết nối nền tảng đã hết hạn');
  assert.ok(publishErrorCopy('en', 'AUTH_TOKEN_EXPIRED').what.includes('the account'));
  // Câu bắt đầu bằng {platform} mà thiếu tên nền tảng vẫn viết hoa chữ đầu.
  assert.equal(publishErrorCopy('vi', 'POLICY_TEMPORARY_BLOCK').title, 'Nền tảng đang tạm chặn tài khoản đăng bài');
  assert.equal(publishErrorCopy('en', 'RATE_LIMITED').title, 'The platform is rate limiting requests');
});

test('unknown / missing / newer backend codes never throw and map to UNKNOWN', () => {
  for (const code of ['SOMETHING_NEW', '', null, undefined, '190']) {
    assert.equal(toPublishErrorCode(code), 'UNKNOWN', String(code));
    assert.equal(publishErrorCopy('vi', code).title, 'Đăng bài thất bại');
  }
});

test('copy never contains raw technical markers', () => {
  for (const code of PUBLISH_ERROR_CODES) {
    for (const lang of ['vi', 'en'] as const) {
      const copy = publishErrorCopy(lang, code, { platform: 'Threads', account: 'x' });
      const all = [copy.title, copy.what, copy.why, ...copy.steps].join(' ');
      for (const marker of ['Exception', 'OAuthException', 'stack', 'fbtrace', 'HTTP ']) {
        assert.ok(!all.includes(marker), `${code} ${lang} contains ${marker}`);
      }
    }
  }
});

test('category and action labels', () => {
  for (const category of PUBLISH_ERROR_CATEGORIES) {
    assert.ok(publishErrorCategoryLabel('vi', category).length > 0);
    assert.ok(publishErrorCategoryLabel('en', category).length > 0);
  }
  assert.equal(publishErrorCategoryLabel('vi', 'NOPE'), 'Chưa phân loại');
  assert.equal(publishErrorActionLabel('vi', 'OPEN_PLATFORM', { platform: 'Facebook' }), 'Mở Facebook');
  assert.equal(publishErrorActionLabel('en', 'RETRY_NOW'), 'Retry now');
  assert.equal(publishErrorActionLabel('vi', 'AI_FIX'), 'AI sửa nội dung');
  assert.equal(platformDisplayName('THREADS'), 'Threads');
  assert.equal(platformDisplayName(null), '');
});
