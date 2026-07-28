import type { getDict } from '../../../i18n';
import type { Tone } from '../../../statusTokens';
import type { AdminPostProblem, PublishErrorType } from '../../../api/admin';

// NGUỒN DUY NHẤT cho phân loại lý do lỗi của trang "Bài đăng lỗi & bị từ chối":
// nhãn badge, tone màu và đoạn hướng dẫn chỉnh sửa đều khai báo ở đây — không rải rác
// trong bảng/drawer. Thêm một phân loại = thêm 1 dòng trong REASON_META, không sửa chỗ nào khác.
//
// Vì sao phải suy ra ở FE: backend chỉ phân 3 loại kỹ thuật (PublishErrorType) theo cách XỬ LÝ
// (retry được hay không — FR-56), còn người quản trị cần biết bị từ chối VÌ ĐIỀU GÌ. Phân loại
// dưới đây đọc từ chính thông điệp nền tảng trả về (dữ liệu thật), KHÔNG bịa thêm dữ liệu:
// không khớp từ khoá nào thì lùi về đúng phân loại thô của backend.

export type ApDict = ReturnType<typeof getDict>;

export type RejectionCategory =
  | 'POLICY'
  | 'BANNED_CONTENT'
  | 'COPYRIGHT'
  | 'RESTRICTED_AD'
  | 'TECHNICAL';

interface ReasonMeta {
  /** Tone ngữ nghĩa trong TONE_COLORS — badge lấy màu từ đó, không hex rời. */
  tone: Tone;
  labelKey: keyof ApDict;
  /** Đoạn hướng dẫn chỉnh sửa viết sẵn (khối "Đề xuất từ AI") — tĩnh, không gọi AI. */
  adviceKey: keyof ApDict;
}

/**
 * Chỉ 7 tone ngữ nghĩa tồn tại trong `statusTokens.ts`, nên 5 phân loại dùng lại 3 tone theo
 * MỨC ĐỘ chứ không mỗi loại một màu tự chế: đỏ = vi phạm nội dung (chặn cứng, phải sửa bài),
 * tím = vấn đề bản quyền, cam = hạn chế phân phối và lỗi kỹ thuật (còn đường xử lý lại).
 */
export const REASON_META: Record<RejectionCategory, ReasonMeta> = {
  POLICY: { tone: 'danger', labelKey: 'apCatPolicy', adviceKey: 'apAdvicePolicy' },
  BANNED_CONTENT: { tone: 'danger', labelKey: 'apCatBanned', adviceKey: 'apAdviceBanned' },
  COPYRIGHT: { tone: 'purple', labelKey: 'apCatCopyright', adviceKey: 'apAdviceCopyright' },
  RESTRICTED_AD: { tone: 'warning', labelKey: 'apCatRestrictedAd', adviceKey: 'apAdviceRestrictedAd' },
  TECHNICAL: { tone: 'warning', labelKey: 'apCatTechnical', adviceKey: 'apAdviceTechnical' },
};

/**
 * Từ khoá trong thông điệp GỐC của nền tảng → phân loại chi tiết. Chỉ áp dụng cho bài bị từ chối
 * vì vi phạm; lỗi kỹ thuật không cần bóc tách thêm. Thứ tự trong mảng là thứ tự ưu tiên xét.
 */
const MESSAGE_HINTS: [RejectionCategory, string[]][] = [
  ['COPYRIGHT', ['copyright', 'intellectual property', 'trademark', 'bản quyền', 'sở hữu trí tuệ']],
  ['BANNED_CONTENT', ['prohibited', 'banned', 'not allowed', 'unsupported content', 'bị cấm', 'không được phép']],
  ['RESTRICTED_AD', ['restricted', 'limited distribution', 'ad policy', 'bị hạn chế', 'hạn chế phân phối']],
];

/**
 * Phân loại một bài lỗi. `errorType` (backend) quyết định nhánh lớn; thông điệp nền tảng chỉ dùng
 * để làm mịn thêm trong nhánh vi phạm chính sách.
 */
export function categorize(errorType: PublishErrorType | null, errorMessage: string | null): RejectionCategory {
  if (errorType !== 'POLICY_VIOLATION') {
    return 'TECHNICAL';
  }
  const message = (errorMessage ?? '').toLowerCase();
  const hit = MESSAGE_HINTS.find(([, keywords]) => keywords.some((k) => message.includes(k)));
  return hit ? hit[0] : 'POLICY';
}

export const categoryOf = (post: AdminPostProblem): RejectionCategory =>
  categorize(post.errorType, post.errorMessage);

/**
 * Mã lỗi Graph API thường gặp → CÂU MÔ TẢ thân thiện.
 * (Cùng bộ mã với trang hồi phục phía user, chép sang để hai cụm không import chéo nhau.)
 */
const CODE_REASON_KEY: Record<string, keyof ApDict> = {
  '368': 'apReason368',
  '190': 'apReason190',
  '100': 'apReason100',
  '4': 'apReason4',
  '2': 'apReason2',
};

/** Câu lùi về khi mã lỗi không nằm trong bảng trên — vẫn nói được bản chất theo loại lỗi. */
const TYPE_REASON_KEY: Record<NonNullable<PublishErrorType>, keyof ApDict> = {
  POLICY_VIOLATION: 'apReasonPolicyFallback',
  TEMPORARY: 'apReasonTemporaryFallback',
  PERMANENT: 'apReasonPermanentFallback',
};

/**
 * Dòng mô tả lý do hiển thị trong BẢNG.
 *
 * TUYỆT ĐỐI không trả `errorMessage` thô: đó là chuỗi kỹ thuật của nền tảng/ORM (ví dụ
 * "Could not initialize proxy [com.aima.entity...]") — rò chi tiết nội bộ ra màn hình quản trị
 * và người đọc cũng không hiểu. Luôn dịch qua mã lỗi, không map được thì lùi theo loại lỗi.
 * Chuỗi thô vẫn giữ NGUYÊN VẸN trong panel chi tiết (khối mono) để admin đối chiếu khi cần.
 */
export function reasonText(post: AdminPostProblem, t: ApDict): string {
  const byCode = post.errorCode ? CODE_REASON_KEY[post.errorCode] : undefined;
  if (byCode) {
    return t[byCode];
  }
  return post.errorType ? t[TYPE_REASON_KEY[post.errorType]] : t.apReasonUnknown;
}

/**
 * "Chi tiết vi phạm" trong drawer: nền tảng trả về MỘT chuỗi, tách thành các gạch đầu dòng theo
 * dấu câu/xuống dòng. Không thêm ý nào không có trong thông điệp gốc.
 */
export function violationBullets(post: AdminPostProblem): string[] {
  const raw = (post.errorMessage ?? '').trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(/\r?\n|(?<=[.;])\s+/)
    .map((line) => line.replace(/[.;]\s*$/, '').trim())
    .filter((line) => line.length > 0);
}
