// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionRefresher,
  isProfileProbe,
  isRefreshExempt,
  REFRESH_LOCK_NAME,
  type LockManagerLike,
} from '../src/api/sessionRefresh.ts';

const tick = () => new Promise((r) => setTimeout(r, 0));

test('concurrent 401s share ONE refresh call', async () => {
  let calls = 0;
  let release!: () => void;
  const refresher = createSessionRefresher(() => {
    calls++;
    return new Promise<void>((r) => { release = r; });
  });
  const all = Promise.all([refresher.refresh(), refresher.refresh(), refresher.refresh()]);
  await tick();
  release();
  assert.deepEqual(await all, [true, true, true]);
  assert.equal(calls, 1);
});

test('failed refresh resolves false and the next 401 tries again', async () => {
  let calls = 0;
  const refresher = createSessionRefresher(async () => {
    calls++;
    throw new Error('401');
  });
  assert.equal(await refresher.refresh(), false);
  assert.equal(await refresher.refresh(), false);
  assert.equal(calls, 2);
});

test('request sent before the last successful refresh is retried without refreshing again', async () => {
  let clock = 1000;
  let calls = 0;
  const refresher = createSessionRefresher(async () => { calls++; }, { now: () => clock });
  assert.equal(await refresher.refresh(900), true); // refresh thành công lúc 1000
  clock = 1500;
  assert.equal(await refresher.refresh(950), true); // gửi lúc 950 (< 1000) → chỉ thử lại
  assert.equal(calls, 1);
  assert.equal(await refresher.refresh(1200), true); // gửi sau lần refresh → refresh thật
  assert.equal(calls, 2);
});

test('refresh runs inside the cross-tab Web Lock when available', async () => {
  const seen: string[] = [];
  const locks: LockManagerLike = {
    request: async (name, cb) => {
      seen.push(name);
      return cb();
    },
  };
  const refresher = createSessionRefresher(async () => undefined, { getLocks: () => locks });
  assert.equal(await refresher.refresh(), true);
  assert.deepEqual(seen, [REFRESH_LOCK_NAME]);
});

test('a broken lock manager falls back to a direct refresh', async () => {
  const refresher = createSessionRefresher(async () => undefined, {
    getLocks: () => { throw new Error('SecurityError'); },
  });
  assert.equal(await refresher.refresh(), true);
});

test('auth endpoints never trigger a refresh', () => {
  for (const url of ['/auth/login', '/auth/refresh', '/auth/logout', '/users/register', '/users/register/verify',
    '/users/forgot-password', '/users/verify-otp', '/users/reset-password', '/notifications/unsubscribe?token=x']) {
    assert.equal(isRefreshExempt(url), true, url);
  }
  for (const url of ['/users/me', '/notifications', '/content-items/jobs/1', '/users/me/notification-preferences']) {
    assert.equal(isRefreshExempt(url), false, url);
  }
});

test('only GET /users/me is the session probe', () => {
  assert.equal(isProfileProbe('/users/me'), true);
  assert.equal(isProfileProbe('/users/me/publishing-settings'), false);
  assert.equal(isProfileProbe('/notifications'), false);
});
