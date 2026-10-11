import type { FailedPost } from './api/failedPosts.ts';
import type {
  PublishErrorAction, PublishErrorCategory, PublishErrorCode, PublishErrorSeverity,
} from './api/publishErrorCatalog.ts';

// Dữ liệu MINH HOẠ cho trang "Bài lỗi & cần xử lý" — CHỈ dùng ở môi trường dev (import.meta.env.DEV) khi chưa có
// bài lỗi thật hoặc không gọi được máy chủ; bản build production KHÔNG hiển thị (rỗng → empty state, lỗi → khối lỗi
// + Thử lại) để dữ liệu giả không che mất tình trạng thật. Cùng shape với API thật: chỉ có MÃ lỗi chuẩn hoá,
// câu chữ lấy từ catalog như dữ liệu thật.

const META: Record<PublishErrorCode, { category: PublishErrorCategory; severity: PublishErrorSeverity; autoRetry: boolean }> = {
  POLICY_VIOLATION: { category: 'POLICY', severity: 'ERROR', autoRetry: false },
  POLICY_TEMPORARY_BLOCK: { category: 'POLICY', severity: 'CRITICAL', autoRetry: false },
  AUTH_TOKEN_EXPIRED: { category: 'AUTH', severity: 'CRITICAL', autoRetry: false },
  AUTH_PASSWORD_CHANGED: { category: 'AUTH', severity: 'CRITICAL', autoRetry: false },
  AUTH_APP_REMOVED: { category: 'AUTH', severity: 'CRITICAL', autoRetry: false },
  AUTH_PERMISSION_MISSING: { category: 'PERMISSION', severity: 'CRITICAL', autoRetry: false },
  AUTH_PAGE_ROLE_MISSING: { category: 'PERMISSION', severity: 'CRITICAL', autoRetry: false },
  ACCOUNT_CHECKPOINT: { category: 'ACCOUNT', severity: 'CRITICAL', autoRetry: false },
  ACCOUNT_RESTRICTED: { category: 'ACCOUNT', severity: 'CRITICAL', autoRetry: false },
  ACCOUNT_DISCONNECTED: { category: 'ACCOUNT', severity: 'ERROR', autoRetry: false },
  ACCOUNT_TYPE_UNSUPPORTED: { category: 'ACCOUNT', severity: 'ERROR', autoRetry: false },
  RATE_LIMITED: { category: 'RATE_LIMIT', severity: 'WARNING', autoRetry: true },
  QUOTA_EXCEEDED: { category: 'QUOTA', severity: 'WARNING', autoRetry: false },
  CONTENT_TOO_LONG: { category: 'CONTENT', severity: 'ERROR', autoRetry: false },
  CONTENT_DUPLICATE: { category: 'CONTENT', severity: 'ERROR', autoRetry: false },
  CONTENT_INVALID: { category: 'CONTENT', severity: 'ERROR', autoRetry: false },
  MEDIA_REQUIRED: { category: 'MEDIA', severity: 'ERROR', autoRetry: false },
  MEDIA_INVALID: { category: 'MEDIA', severity: 'ERROR', autoRetry: false },
  PLATFORM_TEMPORARY: { category: 'PLATFORM', severity: 'WARNING', autoRetry: true },
  PLATFORM_OUTAGE: { category: 'PLATFORM', severity: 'WARNING', autoRetry: true },
  NETWORK_TIMEOUT: { category: 'NETWORK', severity: 'WARNING', autoRetry: true },
  PUBLISH_INTERRUPTED: { category: 'NETWORK', severity: 'WARNING', autoRetry: true },
  PLATFORM_UNSUPPORTED: { category: 'INTERNAL', severity: 'ERROR', autoRetry: false },
  INTERNAL_ERROR: { category: 'INTERNAL', severity: 'ERROR', autoRetry: false },
  UNKNOWN: { category: 'UNKNOWN', severity: 'ERROR', autoRetry: false },
};

let seq = 0;
function mock(
  code: PublishErrorCode,
  platformName: FailedPost['platformName'],
  accountName: string,
  caption: string | null,
  failedAt: string,
  actions: PublishErrorAction[],
  over: Partial<FailedPost> = {},
): FailedPost {
  seq += 1;
  const meta = META[code];
  return {
    id: `mock-${seq}`,
    scheduleId: `mock-sch-${seq}`,
    contentItemId: `mock-ci-${seq}`,
    contentVersionId: `mock-cv-${seq}`,
    platformName,
    accountId: `mock-acc-${platformName}`,
    accountName,
    accountStatus: meta.category === 'AUTH' ? 'EXPIRED' : 'ACTIVE',
    accountReady: meta.category !== 'AUTH',
    caption,
    errorType: meta.category === 'POLICY' ? 'POLICY_VIOLATION' : meta.autoRetry ? 'TEMPORARY' : 'PERMANENT',
    errorCode: null,
    failedAt,
    code,
    category: meta.category,
    severity: meta.severity,
    owner: meta.autoRetry || meta.category === 'INTERNAL' ? 'SYSTEM' : 'USER',
    autoRetry: meta.autoRetry,
    actions,
    platformSubcode: null,
    referenceCode: `ERR-${(0xa1b2c0 + seq).toString(16).toUpperCase()}`,
    state: 'NEEDS_ACTION',
    attempt: meta.autoRetry ? 4 : 1,
    maxAttempts: meta.autoRetry ? 4 : null,
    nextRetryAt: null,
    contentChanged: false,
    ...over,
  };
}

const RECONNECT: PublishErrorAction[] = ['RECONNECT_ACCOUNT', 'RETRY_NOW', 'DISMISS'];

function build(): FailedPost[] {
  seq = 0;
  return [
    mock('POLICY_VIOLATION', 'FACEBOOK', 'AIMA Coffee House',
      'Giảm 50% toàn bộ menu — cam kết rẻ nhất thị trường, không đâu bằng!', '2026-07-13T09:24:00',
      ['EDIT_CONTENT', 'DISMISS']),
    mock('AUTH_TOKEN_EXPIRED', 'INSTAGRAM', '@aima.coffee',
      'Bí quyết pha cold brew tại nhà chỉ với 3 bước đơn giản ☕', '2026-07-13T07:10:00', RECONNECT),
    mock('AUTH_TOKEN_EXPIRED', 'INSTAGRAM', '@aima.coffee',
      'Behind the scenes: quy trình rang xay tại xưởng AIMA 🔥', '2026-07-12T18:40:00', RECONNECT),
    mock('AUTH_TOKEN_EXPIRED', 'INSTAGRAM', '@aima.coffee',
      'Toàn cảnh quán mới tại Quận 3 — hẹn bạn ghé chơi cuối tuần này 🌿', '2026-07-12T11:05:00', RECONNECT),
    mock('RATE_LIMITED', 'THREADS', '@aima.coffee',
      'Bạn thuộc team cà phê sữa hay team cà phê đen? Comment cho mình biết nhé!', '2026-07-12T20:45:00',
      [], { state: 'AUTO_RETRYING', attempt: 2, nextRetryAt: '2026-07-12T21:00:00' }),
    mock('CONTENT_TOO_LONG', 'THREADS', '@aima.coffee',
      'Một buổi sáng chậm rãi cùng ly bạc xỉu nóng ☁️ — câu chuyện dài về hạt cà phê Cầu Đất…',
      '2026-07-11T08:15:00', ['EDIT_CONTENT', 'RETRY_NOW', 'DISMISS'], { contentChanged: true }),
    mock('CONTENT_DUPLICATE', 'FACEBOOK', 'AIMA Coffee House',
      'Săn deal cuối tuần: mua 1 tặng 1 cho mọi loại trà trái cây 🍊', '2026-07-10T11:48:00',
      ['EDIT_CONTENT', 'DISMISS']),
    mock('POLICY_TEMPORARY_BLOCK', 'FACEBOOK', 'AIMA Coffee House',
      'Thuốc bổ từ cà phê: chữa đau đầu, hết stress ngay lập tức!', '2026-07-09T19:20:00',
      ['OPEN_PLATFORM', 'RECONNECT_ACCOUNT', 'RETRY_NOW', 'DISMISS'], { accountReady: false, accountStatus: 'ERROR' }),
    mock('PLATFORM_TEMPORARY', 'THREADS', '@aima.coffee',
      'Poll nhanh: mở cửa tới 23h hay 24h? Vote ngay bên dưới 👇', '2026-07-09T06:55:00',
      ['RETRY_NOW', 'DISMISS']),
    mock('MEDIA_REQUIRED', 'INSTAGRAM', '@aima.coffee',
      'Giới thiệu blend mới: hương caramel và hạt dẻ rang 🌰', '2026-07-08T15:40:00',
      ['CHANGE_ACCOUNT', 'DISMISS'], { accountStatus: 'ACTIVE', accountReady: true }),
    mock('INTERNAL_ERROR', 'FACEBOOK', 'AIMA Coffee House', null, '2026-07-08T10:05:00',
      ['RETRY_NOW', 'CONTACT_SUPPORT', 'DISMISS']),
    mock('UNKNOWN', 'THREADS', '@aima.coffee',
      'Ảnh hậu trường buổi chụp menu mùa hè 2026 📸', '2026-07-07T21:30:00',
      ['RETRY_NOW', 'CONTACT_SUPPORT'], { state: 'DISMISSED' }),
  ];
}

/** Toàn bộ dữ liệu minh hoạ (bản mới mỗi lần gọi) — trang lọc/phân trang client-side trên danh sách này. */
export function mockFailedPosts(): FailedPost[] {
  return build();
}
