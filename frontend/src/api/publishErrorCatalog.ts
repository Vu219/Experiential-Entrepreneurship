import type { Lang } from '../types';

// Catalog lỗi ĐĂNG BÀI: mã chuẩn AIMA (enum PublishErrorCode phía backend) → câu thân thiện vi/en
// "Chuyện gì đã xảy ra / Vì sao / Cách khắc phục". Backend chỉ gửi MÃ + tham số (tên tài khoản, nền tảng);
// KHÔNG BAO GIỜ hiển thị message gốc của nền tảng / chuỗi kỹ thuật cho người dùng (chỉ admin thấy).
// Thêm mã mới: enum backend + migration CHECK + một mục ở CATALOG dưới đây (test bắt thiếu mục).
// Module thuần (chỉ import type) để test bằng `node --test` — xem tests/publishErrorCatalog.test.ts.

export const PUBLISH_ERROR_CODES = [
  'POLICY_VIOLATION', 'POLICY_TEMPORARY_BLOCK',
  'AUTH_TOKEN_EXPIRED', 'AUTH_PASSWORD_CHANGED', 'AUTH_APP_REMOVED', 'AUTH_PERMISSION_MISSING', 'AUTH_PAGE_ROLE_MISSING',
  'ACCOUNT_CHECKPOINT', 'ACCOUNT_RESTRICTED', 'ACCOUNT_DISCONNECTED', 'ACCOUNT_TYPE_UNSUPPORTED',
  'RATE_LIMITED', 'QUOTA_EXCEEDED',
  'CONTENT_TOO_LONG', 'CONTENT_DUPLICATE', 'CONTENT_INVALID',
  'MEDIA_REQUIRED', 'MEDIA_INVALID',
  'PLATFORM_TEMPORARY', 'PLATFORM_OUTAGE', 'NETWORK_TIMEOUT', 'PUBLISH_INTERRUPTED',
  'PLATFORM_UNSUPPORTED', 'INTERNAL_ERROR', 'UNKNOWN',
] as const;
export type PublishErrorCode = (typeof PUBLISH_ERROR_CODES)[number];

export const PUBLISH_ERROR_CATEGORIES = [
  'POLICY', 'AUTH', 'PERMISSION', 'ACCOUNT', 'RATE_LIMIT', 'MEDIA', 'CONTENT', 'NETWORK', 'PLATFORM', 'QUOTA',
  'INTERNAL', 'UNKNOWN',
] as const;
export type PublishErrorCategory = (typeof PUBLISH_ERROR_CATEGORIES)[number];

export type PublishErrorSeverity = 'WARNING' | 'ERROR' | 'CRITICAL';
export type PublishErrorOwner = 'USER' | 'SYSTEM';
export type PublishErrorAction =
  | 'RECONNECT_ACCOUNT' | 'EDIT_CONTENT' | 'RETRY_NOW' | 'CHANGE_ACCOUNT' | 'OPEN_PLATFORM' | 'DISMISS' | 'CONTACT_SUPPORT'
  | 'AI_FIX';

/** Tham số thay vào câu: {platform} {account}. Thiếu → chữ chung ("nền tảng" / "tài khoản"). */
export interface PublishErrorParams {
  platform?: string | null;
  account?: string | null;
}

export interface PublishErrorCopy {
  title: string;
  /** Chuyện gì đã xảy ra. */
  what: string;
  /** Vì sao. */
  why: string;
  /** Cách khắc phục từng bước. */
  steps: string[];
}

type Bilingual = { vi: PublishErrorCopy; en: PublishErrorCopy };

const RECONNECT_STEPS_VI = [
  'Vào Cài đặt → Kết nối và bấm "Kết nối lại" cho {account}.',
  'Đăng nhập {platform} và cấp lại đầy đủ quyền AIMA yêu cầu.',
  'Quay lại đây và bấm "Thử lại ngay" — các bài cùng lỗi có thể thử lại hàng loạt.',
];
const RECONNECT_STEPS_EN = [
  'Go to Settings → Connections and click "Reconnect" for {account}.',
  'Sign in to {platform} and grant every permission AIMA asks for.',
  'Come back here and click "Retry now" — posts with the same error can be retried together.',
];
const AUTO_RETRY_STEPS_VI = [
  'Không cần làm gì khi bài đang được tự thử lại.',
  'Nếu đã hết lượt tự thử, bấm "Thử lại ngay" sau ít phút.',
];
const AUTO_RETRY_STEPS_EN = [
  'Nothing to do while the post is being retried automatically.',
  'If automatic retries are used up, click "Retry now" in a few minutes.',
];

const CATALOG: Record<PublishErrorCode, Bilingual> = {
  POLICY_VIOLATION: {
    vi: {
      title: 'Nội dung vi phạm chính sách của {platform}',
      what: '{platform} đã từ chối bài viết này trên {account}.',
      why: 'Nền tảng đánh giá nội dung vi phạm Tiêu chuẩn cộng đồng hoặc chính sách quảng cáo — thường do tuyên bố phóng đại, cam kết tuyệt đối hoặc nội dung sức khỏe/tài chính chưa kiểm chứng.',
      steps: [
        'Đọc lại caption, bỏ các tuyên bố tuyệt đối ("nhất", "100%", "cam kết hoàn tiền") và công dụng sức khỏe chưa kiểm chứng.',
        'Bấm "Sửa nội dung" để chỉnh bản {platform} rồi lưu.',
        'Bấm "Thử lại ngay". Hệ thống không tự đăng lại bài vi phạm.',
      ],
    },
    en: {
      title: 'Content breaks {platform} policies',
      what: '{platform} rejected this post on {account}.',
      why: 'The platform judged the content to break its Community Standards or advertising policies — usually exaggerated claims, absolute guarantees, or unverified health/finance statements.',
      steps: [
        'Reread the caption and remove absolute claims ("best", "100%", "money-back guarantee") and unverified health benefits.',
        'Click "Edit content" to adjust the {platform} version, then save.',
        'Click "Retry now". The system never reposts a policy violation on its own.',
      ],
    },
  },
  POLICY_TEMPORARY_BLOCK: {
    vi: {
      title: '{platform} đang tạm chặn tài khoản đăng bài',
      what: '{platform} tạm thời không cho {account} đăng bài mới.',
      why: 'Nền tảng nghi ngờ có hành vi vi phạm chính sách (ví dụ đăng quá dày hoặc nội dung bị báo cáo) nên khoá tạm tính năng đăng. Các bài đã lên lịch của tài khoản này được tạm giữ.',
      steps: [
        'Mở {platform} và xem thông báo / Hộp thư hỗ trợ để biết thời gian bị chặn.',
        'Chờ hết thời gian chặn (thường vài giờ đến vài ngày) và rà lại các nội dung gần đây.',
        'Vào Cài đặt → Kết nối để xác thực lại tài khoản, sau đó bấm "Thử lại ngay".',
      ],
    },
    en: {
      title: '{platform} has temporarily blocked posting',
      what: '{platform} is temporarily not letting {account} publish new posts.',
      why: 'The platform suspects a policy violation (for example posting too often or reported content) and paused posting. Scheduled posts for this account are on hold.',
      steps: [
        'Open {platform} and check its notifications / Support Inbox for how long the block lasts.',
        'Wait until the block ends (usually hours to a few days) and review your recent content.',
        'Go to Settings → Connections to re-validate the account, then click "Retry now".',
      ],
    },
  },
  AUTH_TOKEN_EXPIRED: {
    vi: {
      title: 'Kết nối {platform} đã hết hạn',
      what: 'AIMA không còn quyền đăng lên {account}.',
      why: 'Phiên đăng nhập mà {platform} cấp cho AIMA đã hết hạn hoặc bị thu hồi (ví dụ bạn đăng xuất khỏi mọi thiết bị hoặc gỡ quyền). Các bài đã lên lịch của tài khoản này được tạm giữ.',
      steps: RECONNECT_STEPS_VI,
    },
    en: {
      title: 'The {platform} connection has expired',
      what: 'AIMA can no longer post to {account}.',
      why: 'The session {platform} granted to AIMA expired or was revoked (for example you logged out of all devices or removed permissions). Scheduled posts for this account are on hold.',
      steps: RECONNECT_STEPS_EN,
    },
  },
  AUTH_PASSWORD_CHANGED: {
    vi: {
      title: 'Tài khoản {platform} vừa đổi mật khẩu',
      what: 'Kết nối cũ tới {account} không còn hiệu lực.',
      why: 'Khi mật khẩu thay đổi, {platform} tự thu hồi phiên đăng nhập của mọi ứng dụng bên thứ ba, gồm cả AIMA.',
      steps: RECONNECT_STEPS_VI,
    },
    en: {
      title: 'The {platform} password was changed',
      what: 'The old connection to {account} is no longer valid.',
      why: 'When a password changes, {platform} revokes the sessions of every third-party app, including AIMA.',
      steps: RECONNECT_STEPS_EN,
    },
  },
  AUTH_APP_REMOVED: {
    vi: {
      title: 'AIMA đã bị gỡ khỏi tài khoản {platform}',
      what: '{account} không còn cấp quyền cho AIMA.',
      why: 'Ứng dụng AIMA đã bị gỡ trong phần "Ứng dụng và trang web" của {platform}, nên mọi quyền đăng bài bị thu hồi.',
      steps: RECONNECT_STEPS_VI,
    },
    en: {
      title: 'AIMA was removed from the {platform} account',
      what: '{account} no longer grants access to AIMA.',
      why: 'AIMA was removed under "Apps and websites" in {platform}, so every posting permission was revoked.',
      steps: RECONNECT_STEPS_EN,
    },
  },
  AUTH_PERMISSION_MISSING: {
    vi: {
      title: 'AIMA thiếu quyền đăng bài',
      what: '{platform} từ chối vì AIMA chưa có đủ quyền đăng lên {account}.',
      why: 'Khi kết nối, một số quyền cần thiết (ví dụ quản lý bài viết trên Trang) chưa được bật hoặc đã bị gỡ sau đó.',
      steps: [
        'Vào Cài đặt → Kết nối và bấm "Kết nối lại" cho {account}.',
        'Ở màn hình cấp quyền của {platform}, bật TẤT CẢ các quyền AIMA yêu cầu và chọn đúng Trang/tài khoản.',
        'Bấm "Thử lại ngay".',
      ],
    },
    en: {
      title: 'AIMA is missing posting permissions',
      what: '{platform} refused because AIMA does not have enough permissions to post to {account}.',
      why: 'Some required permissions (for example managing Page posts) were not enabled when connecting, or were removed later.',
      steps: [
        'Go to Settings → Connections and click "Reconnect" for {account}.',
        'On the {platform} permission screen, enable EVERY permission AIMA asks for and pick the right Page/account.',
        'Click "Retry now".',
      ],
    },
  },
  AUTH_PAGE_ROLE_MISSING: {
    vi: {
      title: 'Bạn không còn quyền quản lý Trang',
      what: 'Tài khoản đã kết nối không còn vai trò quản lý trên {account}.',
      why: 'Vai trò của bạn trên Trang đã bị gỡ hoặc hạ xuống mức không được đăng bài.',
      steps: [
        'Nhờ quản trị viên Trang cấp lại cho bạn vai trò có quyền đăng bài.',
        'Vào Cài đặt → Kết nối và kết nối lại tài khoản.',
        'Bấm "Thử lại ngay".',
      ],
    },
    en: {
      title: 'You no longer manage this Page',
      what: 'The connected account no longer has a role on {account}.',
      why: 'Your Page role was removed or downgraded to one that cannot publish.',
      steps: [
        'Ask a Page admin to give you a role that can publish again.',
        'Go to Settings → Connections and reconnect the account.',
        'Click "Retry now".',
      ],
    },
  },
  ACCOUNT_CHECKPOINT: {
    vi: {
      title: '{platform} yêu cầu xác minh tài khoản',
      what: '{account} đang bị {platform} tạm khoá để xác minh.',
      why: 'Nền tảng phát hiện hoạt động bất thường hoặc tài khoản chưa được xác nhận nên yêu cầu bạn đăng nhập để xác minh.',
      steps: [
        'Đăng nhập {platform} trên trình duyệt/ứng dụng và làm theo hướng dẫn xác minh.',
        'Vào Cài đặt → Kết nối để xác thực lại kết nối.',
        'Bấm "Thử lại ngay".',
      ],
    },
    en: {
      title: '{platform} needs to verify the account',
      what: '{platform} has locked {account} until it is verified.',
      why: 'The platform detected unusual activity or an unconfirmed account and wants you to sign in to verify it.',
      steps: [
        'Sign in to {platform} in a browser/app and follow the verification steps.',
        'Go to Settings → Connections to re-validate the connection.',
        'Click "Retry now".',
      ],
    },
  },
  ACCOUNT_RESTRICTED: {
    vi: {
      title: 'Tài khoản bị {platform} hạn chế',
      what: '{account} đang bị hạn chế nên không đăng được bài.',
      why: '{platform} đã giới hạn tài khoản (ví dụ do vi phạm hoặc bị khoá). Các bài đã lên lịch của tài khoản này được tạm giữ.',
      steps: [
        'Mở {platform} để xem chi tiết hạn chế và gửi kháng nghị nếu cần.',
        'Khi hạn chế được gỡ, vào Cài đặt → Kết nối để xác thực lại kết nối.',
        'Bấm "Thử lại ngay".',
      ],
    },
    en: {
      title: '{platform} has restricted the account',
      what: '{account} is restricted and cannot publish.',
      why: '{platform} limited the account (for example after a violation or a lock). Scheduled posts for this account are on hold.',
      steps: [
        'Open {platform} to see the restriction details and appeal if needed.',
        'Once lifted, go to Settings → Connections to re-validate the connection.',
        'Click "Retry now".',
      ],
    },
  },
  ACCOUNT_DISCONNECTED: {
    vi: {
      title: 'Kết nối tài khoản không còn hoạt động',
      what: 'Kết nối {account} đã bị ngắt hoặc không còn hiệu lực khi tới giờ đăng.',
      why: 'Tài khoản đã bị ngắt khỏi AIMA hoặc đang lỗi, nên hệ thống tạm giữ bài thay vì đăng.',
      steps: [
        'Kết nối lại tài khoản trong Cài đặt → Kết nối, hoặc',
        'Đổi bài sang một tài khoản khác cùng nền tảng trong Lịch đăng.',
      ],
    },
    en: {
      title: 'The account connection is no longer active',
      what: 'The connection to {account} was removed or invalid at publish time.',
      why: 'The account was disconnected from AIMA or is in an error state, so the post was put on hold instead of published.',
      steps: [
        'Reconnect the account in Settings → Connections, or',
        'Move the post to another account on the same platform in the Calendar.',
      ],
    },
  },
  ACCOUNT_TYPE_UNSUPPORTED: {
    vi: {
      title: 'Facebook chỉ cho đăng lên Trang',
      what: 'Bài được lên lịch vào tài khoản cá nhân {account}.',
      why: 'Facebook không cho ứng dụng bên thứ ba đăng lên trang cá nhân — chỉ đăng được lên Trang (Fanpage) bạn quản lý.',
      steps: [
        'Bấm "Lên lịch lại" để huỷ lịch hiện tại.',
        'Chọn một Trang Facebook làm tài khoản đăng rồi lên lịch lại.',
      ],
    },
    en: {
      title: 'Facebook only allows posting to Pages',
      what: 'The post was scheduled to the personal profile {account}.',
      why: 'Facebook does not let third-party apps post to personal profiles — only to Pages you manage.',
      steps: [
        'Click "Reschedule" to cancel the current schedule.',
        'Pick a Facebook Page as the target account and schedule again.',
      ],
    },
  },
  RATE_LIMITED: {
    vi: {
      title: '{platform} đang giới hạn tần suất',
      what: '{platform} tạm thời từ chối vì có quá nhiều yêu cầu trong thời gian ngắn.',
      why: 'Đây là giới hạn tự động của nền tảng, không phải lỗi nội dung. AIMA tự thử lại sau 5, 15 và 30 phút (hoặc lâu hơn nếu nền tảng yêu cầu chờ).',
      steps: AUTO_RETRY_STEPS_VI,
    },
    en: {
      title: '{platform} is rate limiting requests',
      what: '{platform} temporarily refused because of too many requests in a short time.',
      why: 'This is an automatic platform limit, not a content problem. AIMA retries after 5, 15 and 30 minutes (or later if the platform asks to wait).',
      steps: AUTO_RETRY_STEPS_EN,
    },
  },
  QUOTA_EXCEEDED: {
    vi: {
      title: 'Đã chạm hạn mức đăng bài của {platform}',
      what: '{account} đã đăng tối đa số bài {platform} cho phép trong 24 giờ.',
      why: 'Mỗi tài khoản chỉ được đăng một số bài nhất định trong 24 giờ (ví dụ Threads: 250 bài).',
      steps: [
        'Chờ hạn mức được làm mới (tối đa 24 giờ).',
        'Bấm "Thử lại ngay" sau đó, hoặc dời lịch sang thời điểm khác.',
      ],
    },
    en: {
      title: '{platform} posting quota reached',
      what: '{account} has published the maximum number of posts {platform} allows in 24 hours.',
      why: 'Each account can only publish a limited number of posts per 24 hours (for example Threads: 250).',
      steps: [
        'Wait for the quota to reset (up to 24 hours).',
        'Then click "Retry now", or reschedule to a later time.',
      ],
    },
  },
  CONTENT_TOO_LONG: {
    vi: {
      title: 'Nội dung vượt giới hạn của {platform}',
      what: 'Caption hoặc số hashtag của bản {platform} vượt mức nền tảng cho phép.',
      why: 'Mỗi nền tảng có giới hạn riêng (Threads 500 ký tự; Instagram 2.200 ký tự và 30 hashtag; Facebook 63.206 ký tự). AIMA chặn trước khi gửi để bài không bị cắt.',
      steps: [
        'Bấm "Sửa nội dung", rút gọn caption hoặc bớt hashtag rồi lưu.',
        'Bấm "Thử lại ngay".',
      ],
    },
    en: {
      title: 'Content exceeds the {platform} limit',
      what: 'The caption or number of hashtags in the {platform} version is over the platform limit.',
      why: 'Each platform has its own limits (Threads 500 characters; Instagram 2,200 characters and 30 hashtags; Facebook 63,206 characters). AIMA blocks it before sending so the post is not cut off.',
      steps: [
        'Click "Edit content", shorten the caption or remove hashtags, then save.',
        'Click "Retry now".',
      ],
    },
  },
  CONTENT_DUPLICATE: {
    vi: {
      title: 'Bài trùng với bài vừa đăng',
      what: '{platform} từ chối vì nội dung giống hệt bài trước đó trên {account}.',
      why: 'Nền tảng không cho đăng liên tiếp hai bài có nội dung y hệt để chống spam.',
      steps: [
        'Bấm "Sửa nội dung" và thay đổi caption (thêm ý mới, đổi câu mở đầu…) rồi lưu.',
        'Bấm "Thử lại ngay".',
      ],
    },
    en: {
      title: 'Duplicate of the previous post',
      what: '{platform} refused because the content is identical to the previous post on {account}.',
      why: 'The platform blocks consecutive identical posts to prevent spam.',
      steps: [
        'Click "Edit content", change the caption (new angle, different opening…) and save.',
        'Click "Retry now".',
      ],
    },
  },
  CONTENT_INVALID: {
    vi: {
      title: 'Nội dung bài chưa hợp lệ',
      what: '{platform} không chấp nhận một phần nội dung của bài.',
      why: 'Thường do liên kết không truy cập được, ký tự/định dạng không hỗ trợ hoặc tham số bài viết không hợp lệ.',
      steps: [
        'Kiểm tra các liên kết trong caption còn mở được.',
        'Bấm "Sửa nội dung", bỏ ký tự lạ rồi lưu.',
        'Bấm "Thử lại ngay". Nếu vẫn lỗi, gửi mã tham chiếu cho bộ phận hỗ trợ.',
      ],
    },
    en: {
      title: 'Post content is not valid',
      what: '{platform} did not accept part of the post content.',
      why: 'Usually an unreachable link, unsupported characters/formatting, or an invalid post parameter.',
      steps: [
        'Check that every link in the caption still opens.',
        'Click "Edit content", remove unusual characters and save.',
        'Click "Retry now". If it still fails, send the reference code to support.',
      ],
    },
  },
  MEDIA_REQUIRED: {
    vi: {
      title: '{platform} yêu cầu ảnh hoặc video',
      what: 'Bài không thể đăng lên {platform} vì chỉ có nội dung chữ.',
      why: '{platform} bắt buộc mỗi bài có ảnh/video, trong khi AIMA hiện chỉ tạo media prompt (mô tả) để bạn tự sản xuất hình ảnh.',
      steps: [
        'Dùng media prompt của bài để tạo ảnh/video và đăng thủ công trên {platform}, hoặc',
        'Bấm "Lên lịch lại" để đăng bài này lên Facebook/Threads dạng chữ.',
      ],
    },
    en: {
      title: '{platform} requires an image or video',
      what: 'The post cannot be published to {platform} because it is text only.',
      why: '{platform} requires every post to have an image/video, while AIMA currently only creates media prompts (descriptions) for you to produce the visuals.',
      steps: [
        'Use the post\'s media prompt to create an image/video and post it manually on {platform}, or',
        'Click "Reschedule" to publish this post to Facebook/Threads as text.',
      ],
    },
  },
  MEDIA_INVALID: {
    vi: {
      title: 'Ảnh/video không hợp lệ',
      what: '{platform} không xử lý được ảnh/video của bài.',
      why: 'Định dạng, dung lượng, thời lượng hoặc tỷ lệ khung hình nằm ngoài mức nền tảng hỗ trợ.',
      steps: [
        'Kiểm tra định dạng (ảnh JPG/PNG, video MP4 H.264), thời lượng và tỷ lệ khung hình.',
        'Thay media trong "Sửa nội dung" rồi đăng lại.',
      ],
    },
    en: {
      title: 'Image/video is not valid',
      what: '{platform} could not process the post\'s image/video.',
      why: 'Its format, size, duration or aspect ratio is outside what the platform supports.',
      steps: [
        'Check the format (JPG/PNG images, MP4 H.264 video), duration and aspect ratio.',
        'Replace the media in "Edit content" and repost.',
      ],
    },
  },
  PLATFORM_TEMPORARY: {
    vi: {
      title: '{platform} đang gặp lỗi tạm thời',
      what: 'Máy chủ {platform} không xử lý được yêu cầu đăng bài lúc này.',
      why: 'Lỗi đến từ phía nền tảng và thường tự hết sau ít phút. AIMA tự thử lại tối đa 3 lần (sau 5, 15, 30 phút).',
      steps: AUTO_RETRY_STEPS_VI,
    },
    en: {
      title: '{platform} has a temporary error',
      what: 'The {platform} servers could not handle the publish request right now.',
      why: 'The error comes from the platform and usually clears within minutes. AIMA retries up to 3 times (after 5, 15, 30 minutes).',
      steps: AUTO_RETRY_STEPS_EN,
    },
  },
  PLATFORM_OUTAGE: {
    vi: {
      title: '{platform} đang gặp sự cố diện rộng',
      what: 'Nhiều bài đăng lên {platform} cùng lỗi trong thời gian ngắn.',
      why: 'Nền tảng có dấu hiệu gián đoạn trên diện rộng. AIMA tạm hoãn tự thử lại cho tới khi {platform} ổn định để không tốn lượt thử.',
      steps: [
        'Không cần làm gì — bài sẽ được thử lại khi sự cố qua.',
        'Bạn có thể bấm "Thử lại ngay" khi thấy {platform} đã hoạt động bình thường.',
      ],
    },
    en: {
      title: '{platform} is having a wide outage',
      what: 'Many posts to {platform} failed the same way in a short time.',
      why: 'The platform appears to be broadly disrupted. AIMA pauses automatic retries until {platform} recovers so no attempts are wasted.',
      steps: [
        'Nothing to do — the post will be retried once the outage is over.',
        'You can click "Retry now" once {platform} is working normally again.',
      ],
    },
  },
  NETWORK_TIMEOUT: {
    vi: {
      title: 'Mất kết nối tới {platform}',
      what: 'Yêu cầu đăng bài không nhận được phản hồi từ {platform}.',
      why: 'Kết nối mạng giữa AIMA và {platform} bị gián đoạn hoặc quá thời gian chờ. Trước khi thử lại, AIMA kiểm tra bài đã lên nền tảng chưa để tránh đăng trùng.',
      steps: AUTO_RETRY_STEPS_VI,
    },
    en: {
      title: 'Lost connection to {platform}',
      what: 'The publish request got no response from {platform}.',
      why: 'The network between AIMA and {platform} was interrupted or timed out. Before retrying, AIMA checks whether the post already went live to avoid duplicates.',
      steps: AUTO_RETRY_STEPS_EN,
    },
  },
  PUBLISH_INTERRUPTED: {
    vi: {
      title: 'Tiến trình đăng bị gián đoạn',
      what: 'Quá trình đăng bài bị ngắt giữa chừng.',
      why: 'Máy chủ AIMA khởi động lại khi đang đăng. Trước khi thử lại, AIMA kiểm tra bài đã lên nền tảng chưa để tránh đăng trùng.',
      steps: AUTO_RETRY_STEPS_VI,
    },
    en: {
      title: 'Publishing was interrupted',
      what: 'The publishing process stopped halfway.',
      why: 'The AIMA server restarted while publishing. Before retrying, AIMA checks whether the post already went live to avoid duplicates.',
      steps: AUTO_RETRY_STEPS_EN,
    },
  },
  PLATFORM_UNSUPPORTED: {
    vi: {
      title: 'Nền tảng chưa hỗ trợ đăng tự động',
      what: 'AIMA chưa thể tự đăng bài lên {platform}.',
      why: 'Tính năng đăng tự động cho nền tảng này chưa sẵn sàng.',
      steps: [
        'Đăng thủ công trên {platform}, hoặc lên lịch bài cho nền tảng khác.',
        'Liên hệ hỗ trợ kèm mã tham chiếu nếu cần thêm thông tin.',
      ],
    },
    en: {
      title: 'Automatic posting is not supported yet',
      what: 'AIMA cannot publish to {platform} automatically yet.',
      why: 'Automatic publishing for this platform is not available yet.',
      steps: [
        'Post manually on {platform}, or schedule the post for another platform.',
        'Contact support with the reference code if you need more information.',
      ],
    },
  },
  INTERNAL_ERROR: {
    vi: {
      title: 'Lỗi hệ thống của AIMA',
      what: 'AIMA gặp lỗi nội bộ khi đăng bài này.',
      why: 'Đây là lỗi phía AIMA, không phải do nội dung hay tài khoản của bạn. Lỗi đã được ghi nhận cho đội kỹ thuật.',
      steps: [
        'Bấm "Thử lại ngay" sau ít phút.',
        'Nếu vẫn lỗi, gửi mã tham chiếu cho bộ phận hỗ trợ.',
      ],
    },
    en: {
      title: 'AIMA system error',
      what: 'AIMA hit an internal error while publishing this post.',
      why: 'This is on AIMA\'s side, not caused by your content or account. The error has been logged for the engineering team.',
      steps: [
        'Click "Retry now" in a few minutes.',
        'If it keeps failing, send the reference code to support.',
      ],
    },
  },
  UNKNOWN: {
    vi: {
      title: 'Đăng bài thất bại',
      what: '{platform} từ chối bài viết với một lỗi AIMA chưa nhận diện được.',
      why: 'Lỗi đã được chuyển cho đội kỹ thuật phân loại; giải thích chi tiết sẽ có khi lỗi được phân loại.',
      steps: [
        'Bấm "Thử lại ngay" — nhiều lỗi lạ chỉ xảy ra một lần.',
        'Nếu vẫn lỗi, gửi mã tham chiếu cho bộ phận hỗ trợ.',
      ],
    },
    en: {
      title: 'Publishing failed',
      what: '{platform} rejected the post with an error AIMA does not recognize yet.',
      why: 'The error was sent to the engineering team for classification; a detailed explanation will follow once it is classified.',
      steps: [
        'Click "Retry now" — many unusual errors happen only once.',
        'If it keeps failing, send the reference code to support.',
      ],
    },
  },
};

const CATEGORY_LABELS: Record<PublishErrorCategory, { vi: string; en: string }> = {
  POLICY: { vi: 'Vi phạm chính sách', en: 'Policy' },
  AUTH: { vi: 'Kết nối & đăng nhập', en: 'Sign-in' },
  PERMISSION: { vi: 'Quyền truy cập', en: 'Permissions' },
  ACCOUNT: { vi: 'Tài khoản', en: 'Account' },
  RATE_LIMIT: { vi: 'Giới hạn tần suất', en: 'Rate limit' },
  MEDIA: { vi: 'Ảnh/video', en: 'Media' },
  CONTENT: { vi: 'Nội dung', en: 'Content' },
  NETWORK: { vi: 'Kết nối mạng', en: 'Network' },
  PLATFORM: { vi: 'Sự cố nền tảng', en: 'Platform issue' },
  QUOTA: { vi: 'Hạn mức đăng', en: 'Posting quota' },
  INTERNAL: { vi: 'Lỗi hệ thống', en: 'System error' },
  UNKNOWN: { vi: 'Chưa phân loại', en: 'Unclassified' },
};

const ACTION_LABELS: Record<PublishErrorAction, { vi: string; en: string }> = {
  RECONNECT_ACCOUNT: { vi: 'Kết nối lại', en: 'Reconnect account' },
  EDIT_CONTENT: { vi: 'Sửa nội dung', en: 'Edit content' },
  RETRY_NOW: { vi: 'Thử lại ngay', en: 'Retry now' },
  CHANGE_ACCOUNT: { vi: 'Lên lịch lại', en: 'Reschedule' },
  OPEN_PLATFORM: { vi: 'Mở {platform}', en: 'Open {platform}' },
  DISMISS: { vi: 'Bỏ qua', en: 'Dismiss' },
  CONTACT_SUPPORT: { vi: 'Liên hệ hỗ trợ', en: 'Contact support' },
  AI_FIX: { vi: 'AI sửa nội dung', en: 'Fix with AI' },
};

const FALLBACK: Record<Lang, { platform: string; account: string }> = {
  vi: { platform: 'nền tảng', account: 'tài khoản' },
  en: { platform: 'the platform', account: 'the account' },
};

/** Mã từ backend → mã đã biết; null/lạ (backend mới hơn FE) → UNKNOWN, không bao giờ nổ. */
export function toPublishErrorCode(code: string | null | undefined): PublishErrorCode {
  return code && (PUBLISH_ERROR_CODES as readonly string[]).includes(code) ? (code as PublishErrorCode) : 'UNKNOWN';
}

export function toPublishErrorCategory(category: string | null | undefined): PublishErrorCategory {
  return category && (PUBLISH_ERROR_CATEGORIES as readonly string[]).includes(category)
    ? (category as PublishErrorCategory)
    : 'UNKNOWN';
}

function fill(text: string, lang: Lang, params: PublishErrorParams): string {
  const platform = params.platform?.trim() || FALLBACK[lang].platform;
  const account = params.account?.trim() || FALLBACK[lang].account;
  const out = text.split('{platform}').join(platform).split('{account}').join(account);
  // Từ thay thế chung ("nền tảng"/"the platform") đứng đầu câu → viết hoa chữ đầu.
  return text.startsWith('{platform}') ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

/** Câu hiển thị (đã thay tham số) của một lỗi đăng bài. */
export function publishErrorCopy(lang: Lang, code: string | null | undefined, params: PublishErrorParams = {}): PublishErrorCopy {
  const copy = CATALOG[toPublishErrorCode(code)][lang];
  return {
    title: fill(copy.title, lang, params),
    what: fill(copy.what, lang, params),
    why: fill(copy.why, lang, params),
    steps: copy.steps.map((s) => fill(s, lang, params)),
  };
}

export function publishErrorCategoryLabel(lang: Lang, category: string | null | undefined): string {
  return CATEGORY_LABELS[toPublishErrorCategory(category)][lang];
}

export function publishErrorActionLabel(lang: Lang, action: PublishErrorAction, params: PublishErrorParams = {}): string {
  return fill(ACTION_LABELS[action][lang], lang, params);
}

/** Tên hiển thị nền tảng từ enum backend (FACEBOOK → Facebook). */
export function platformDisplayName(platform: string | null | undefined): string {
  if (!platform) return '';
  return platform.charAt(0) + platform.slice(1).toLowerCase();
}
