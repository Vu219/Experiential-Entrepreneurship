// Làm mới phiên đăng nhập (POST /auth/refresh) khi gặp 401 — module thuần, test ở tests/sessionRefresh.test.ts.
//
// Backend XOAY VÒNG refresh token: mỗi refresh thu hồi jti cũ. Hai lời gọi song song cùng một cookie refresh thì
// lời gọi thứ hai nhận 401 và user bị văng. Vì vậy:
//  - trong một tab: single-flight — mọi request 401 đồng thời chờ CHUNG một lần refresh;
//  - giữa các tab: khoá Web Locks (cookie dùng chung) — tab đến sau chờ tab trước xong rồi refresh bằng cookie MỚI;
//  - request gửi đi TRƯỚC lần refresh thành công gần nhất chỉ cần thử lại, không refresh thêm.

/** Endpoint không bao giờ kích hoạt refresh (bản thân là xác thực, hoặc 401 mang nghĩa nghiệp vụ). */
const REFRESH_EXEMPT_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/users/register',
  '/users/forgot-password',
  '/users/verify-otp',
  '/users/reset-password',
  '/notifications/unsubscribe',
];

export const REFRESH_LOCK_NAME = 'aima-auth-refresh';

export function isRefreshExempt(url: string | undefined): boolean {
  if (!url) return true;
  const path = url.split('?')[0];
  return REFRESH_EXEMPT_PATHS.some((p) => path === p || path.startsWith(`${p}/`) || path.endsWith(p));
}

/** Request dò phiên lúc tải app (GET /users/me) — 401 sau khi refresh hỏng nghĩa là "chưa đăng nhập", không phải "hết phiên". */
export function isProfileProbe(url: string | undefined): boolean {
  return (url ?? '').split('?')[0].endsWith('/users/me');
}

export interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export interface SessionRefresher {
  /**
   * @param sentAt thời điểm request bị 401 được gửi đi (ms). Có refresh thành công SAU thời điểm đó thì không refresh lại.
   * @returns true = phiên đã được làm mới (thử lại request), false = hết phiên thật.
   */
  refresh(sentAt?: number): Promise<boolean>;
}

export function createSessionRefresher(
  doRefresh: () => Promise<unknown>,
  options: { getLocks?: () => LockManagerLike | undefined; now?: () => number } = {},
): SessionRefresher {
  const now = options.now ?? Date.now;
  let inflight: Promise<boolean> | null = null;
  let lastSuccessAt = 0;

  const run = async (): Promise<boolean> => {
    try {
      await doRefresh();
      lastSuccessAt = now();
      return true;
    } catch {
      return false;
    }
  };

  return {
    refresh(sentAt?: number) {
      if (sentAt !== undefined && lastSuccessAt > 0 && sentAt < lastSuccessAt) return Promise.resolve(true);
      if (inflight) return inflight;
      let locks: LockManagerLike | undefined;
      try {
        locks = options.getLocks?.();
      } catch {
        locks = undefined;
      }
      const task = locks ? locks.request(REFRESH_LOCK_NAME, run) : run();
      inflight = task.catch(() => false).finally(() => {
        inflight = null;
      });
      return inflight;
    },
  };
}
