// Chạy: npm test  (node --test --experimental-strip-types — không cần thêm dependency)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupRootCauses } from '../src/components/failedPosts/rootCause.ts';
import type { FailedPost } from '../src/api/failedPosts.ts';

let seq = 0;
function post(over: Partial<FailedPost>): FailedPost {
  seq += 1;
  return {
    id: `p${seq}`, scheduleId: `s${seq}`, contentItemId: null, contentVersionId: null,
    platformName: 'INSTAGRAM', accountId: 'acc-1', accountName: '@aima.coffee', accountStatus: 'EXPIRED',
    accountReady: false, caption: null, errorType: 'PERMANENT', errorCode: '190', failedAt: null,
    code: 'AUTH_TOKEN_EXPIRED', category: 'AUTH', severity: 'CRITICAL', owner: 'USER', autoRetry: false,
    actions: [], platformSubcode: null, referenceCode: null, state: 'NEEDS_ACTION', attempt: 1, maxAttempts: null,
    nextRetryAt: null, contentChanged: false,
    ...over,
  };
}

test('groups account-level failures of the same account and code', () => {
  const groups = groupRootCauses([
    post({}), post({}), post({}),
    post({ accountId: 'acc-2' }),                                            // khác tài khoản, chỉ 1 bài
    post({ code: 'CONTENT_DUPLICATE', category: 'CONTENT' }),               // không phải lỗi cấp tài khoản
    post({ state: 'DISMISSED' }),                                            // đã bỏ qua
    post({ state: 'AUTO_RETRYING', code: 'RATE_LIMITED' }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].code, 'AUTH_TOKEN_EXPIRED');
  assert.equal(groups[0].accountId, 'acc-1');
  assert.equal(groups[0].postIds.length, 3);
  assert.equal(groups[0].accountReady, false);
});

test('group is ready only when every post sees an ACTIVE account; larger groups first', () => {
  const groups = groupRootCauses([
    post({ accountId: 'a', accountReady: true }), post({ accountId: 'a', accountReady: true }),
    post({ accountId: 'b', code: 'AUTH_PERMISSION_MISSING', category: 'PERMISSION' }),
    post({ accountId: 'b', code: 'AUTH_PERMISSION_MISSING', category: 'PERMISSION' }),
    post({ accountId: 'b', code: 'AUTH_PERMISSION_MISSING', category: 'PERMISSION' }),
  ]);
  assert.deepEqual(groups.map((g) => [g.accountId, g.postIds.length]), [['b', 3], ['a', 2]]);
  assert.equal(groups[1].accountReady, true);
});

test('single posts are not grouped unless minSize is 1', () => {
  assert.equal(groupRootCauses([post({})]).length, 0);
  assert.equal(groupRootCauses([post({})], 1).length, 1);
});
