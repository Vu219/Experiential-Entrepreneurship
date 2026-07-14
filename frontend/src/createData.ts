import type { Lang } from './types';
import type { Platform } from './api/brandProfile';
import type { ContentLifecycle } from './api/contentGeneration';
import type {
  BrandVoiceCheck,
  ContentListItem,
  ContentVersion,
  GenerationResult,
  VideoScript,
} from './api/contentCreationService';

// ===== Mock data màn Tạo nội dung (list-first + wizard) =====
// Chỉ dùng trong giai đoạn dựng UI — contentCreationService đọc từ đây thay vì backend.
// Khi nối API thật, file này chỉ còn là fallback demo (giống trendsData.ts với trang Trends).

const P = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

// Ảnh preview placeholder: SVG gradient data-URI — không tải asset ngoài, không copy từ create/.
export function placeholderImage(seed: number): string {
  const palettes: [string, string][] = [
    ['#8b5cf6', '#22d3ee'],
    ['#ec4899', '#f59e0b'],
    ['#6366f1', '#ec4899'],
    ['#22d3ee', '#16a34a'],
  ];
  const [a, b] = palettes[Math.abs(seed) % palettes.length];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs>` +
    `<rect width='900' height='900' fill='url(#g)'/>` +
    `<circle cx='680' cy='240' r='150' fill='rgba(255,255,255,.18)'/>` +
    `<circle cx='230' cy='660' r='210' fill='rgba(255,255,255,.12)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ===== Lớp 1 — danh sách nội dung đã tạo (của user hiện tại) =====

export function mockContentList(lang: Lang): ContentListItem[] {
  const rows: [string, string, Platform[], ContentLifecycle, number, string, string, boolean][] = [
    // [title, excerpt, platforms, status, brandVoice, brandName, updatedAt, isDraft]
    [
      P(lang, '5 mẹo tăng tương tác cho fanpage nhỏ', '5 tips to boost engagement for small pages'),
      P(lang, 'Tạm biệt cảnh đăng bài mà không ai xem 👋 Đây là 5 mẹo mình dùng mỗi ngày...', 'Say goodbye to posts nobody sees 👋 Here are 5 tips I use every day...'),
      ['FACEBOOK', 'INSTAGRAM'], 'POSTED', 92, 'AIMA Studio', '2026-07-04T09:30:00Z', false,
    ],
    [
      P(lang, 'Carousel: Quy trình content 5 phút với AI', 'Carousel: A 5-minute content workflow with AI'),
      P(lang, 'Quy trình 5 giờ → 5 phút. Swipe để xem từng bước AIMA lên bài giúp bạn ➡️', 'From 5 hours to 5 minutes. Swipe to see each step ➡️'),
      ['INSTAGRAM'], 'SCHEDULED', 89, 'AIMA Studio', '2026-07-03T15:20:00Z', false,
    ],
    [
      P(lang, 'Xu hướng AI Marketing 2026 cho SME', 'AI Marketing trends 2026 for SMEs'),
      P(lang, 'Năm 2026, SME không cần đội content 5 người. Bạn cần một quy trình đúng...', 'In 2026 SMEs don’t need a 5-person content team. You need the right workflow...'),
      ['FACEBOOK'], 'NEED_REVIEW', 88, 'AIMA Studio', '2026-07-02T11:05:00Z', false,
    ],
    [
      P(lang, 'Thread: 3 hiểu lầm về tự động hoá marketing', 'Thread: 3 myths about marketing automation'),
      P(lang, 'Tự động hoá không có nghĩa là mất chất riêng. 3 hiểu lầm phổ biến nhất 🧵', 'Automation doesn’t mean losing your voice. The 3 most common myths 🧵'),
      ['THREADS'], 'GENERATED', 85, 'AIMA Skincare', '2026-07-01T08:45:00Z', false,
    ],
    [
      P(lang, 'Routine skincare 3 bước cho người mới', 'A 3-step skincare routine for beginners'),
      P(lang, 'Da xỉn màu, lỗ chân lông to? Chỉ 3 bước đơn giản mỗi ngày...', 'Dull skin, large pores? Just 3 simple steps a day...'),
      ['FACEBOOK', 'INSTAGRAM', 'THREADS'], 'DRAFT', 0, 'AIMA Skincare', '2026-06-30T17:10:00Z', true,
    ],
    [
      P(lang, 'Case study: 30 ngày để kênh tự vận hành', 'Case study: 30 days to a self-running channel'),
      P(lang, 'Từ 2 bài/tuần viết tay đến 12 bài/tuần tự động — số liệu thật sau 30 ngày.', 'From 2 handwritten posts a week to 12 automated — real numbers after 30 days.'),
      ['FACEBOOK', 'INSTAGRAM', 'THREADS'], 'APPROVED', 94, 'AIMA Studio', '2026-06-28T13:00:00Z', false,
    ],
  ];
  return rows.map((r, i) => ({
    id: `mock-content-${i + 1}`,
    title: r[0],
    excerpt: r[1],
    platforms: r[2],
    status: r[3],
    brandVoice: r[4],
    brandId: r[5] === 'AIMA Studio' ? 'mock-brand-1' : 'mock-brand-2',
    brandName: r[5],
    updatedAt: r[6],
    isDraft: r[7],
    // Bản nháp seed đang dừng ở mốc Chọn nguồn — "Tiếp tục" vào lại bước 1.
    draftStep: r[7] ? (1 as const) : undefined,
  }));
}

/** Tiêu đề hiển thị cho bản nháp wizard đang ở mốc Chọn nguồn (mock — API thật do backend đặt). */
export const draftListTitle = (lang: Lang): string =>
  P(lang, 'Bản nháp — đang chọn nguồn', 'Draft — choosing source');

// Trend/idea gắn kèm ở mốc 1 đã chuyển sang dữ liệu research THẬT —
// xem listAttachableTrends trong api/contentCreationService.ts.

// ===== Mốc 2 — nội dung AI sinh ra (mỗi nền tảng một ContentVersion) =====

function mockScript(lang: Lang, platform: Platform, v: number): VideoScript {
  const shorter = platform === 'THREADS';
  return {
    hook: {
      content: P(
        lang,
        v === 0 ? 'Bạn mất 5 giờ mỗi tuần chỉ để nghĩ xem hôm nay đăng gì?' : 'Đăng đều mỗi ngày mà tương tác vẫn giậm chân tại chỗ?',
        v === 0 ? 'Spending 5 hours a week just deciding what to post?' : 'Posting daily but engagement is stuck?',
      ),
      sceneSuggestion: P(lang, 'Cận cảnh gương mặt nhìn thẳng ống kính, text nổi câu hỏi.', 'Close-up facing the camera, question as on-screen text.'),
      timing: '0-3s',
    },
    steps: [
      {
        index: 1,
        content: P(lang, 'Thiết lập hồ sơ thương hiệu một lần để AI hiểu giọng điệu của bạn.', 'Set up your brand profile once so AI learns your voice.'),
        sceneSuggestion: P(lang, 'Quay màn hình dashboard AIMA, zoom vào phần hồ sơ.', 'Screen recording of the AIMA dashboard, zoom on the profile.'),
      },
      {
        index: 2,
        content: P(lang, 'AI quét xu hướng ngành và viết bản nháp cho từng nền tảng.', 'AI scans industry trends and drafts posts for each platform.'),
        sceneSuggestion: P(lang, 'B-roll gõ phím + overlay danh sách trend chạy nhanh.', 'Typing b-roll + fast-scrolling trend list overlay.'),
      },
      ...(shorter
        ? []
        : [{
            index: 3,
            content: P(lang, 'Bạn duyệt, tinh chỉnh và để hệ thống đăng đúng khung giờ vàng.', 'You review, polish, and let the system publish at prime time.'),
            sceneSuggestion: P(lang, 'Quay tay bấm nút Duyệt trên điện thoại, cắt cảnh nhanh.', 'Hand tapping Approve on a phone, quick cuts.'),
          }]),
    ],
    cta: {
      content: P(lang, 'Theo dõi để nhận thêm mẹo content marketing mỗi ngày!', 'Follow for more content marketing tips every day!'),
      sceneSuggestion: P(lang, 'Logo AIMA + nút follow phóng to, nhạc chốt.', 'AIMA logo + enlarged follow button, closing beat.'),
      timing: shorter ? '12-15s' : '25-30s',
    },
  };
}

function mockCaption(lang: Lang, platform: Platform, v: number): string {
  const base = P(
    lang,
    v === 0
      ? 'Tạm biệt việc bí ý tưởng 👋 AIMA biến quy trình content 5 giờ thành 5 phút. Sáng tạo, lên lịch và đăng bài — tất cả tự động.'
      : 'Content đều đặn không cần đội ngũ 5 người 💡 Một quy trình đúng đáng giá hơn nghìn ý tưởng rời rạc.',
    v === 0
      ? 'Say goodbye to creative block 👋 AIMA turns a 5-hour content process into 5 minutes. Create, schedule & publish — all automatically.'
      : 'Consistent content without a 5-person team 💡 The right workflow beats a thousand scattered ideas.',
  );
  if (platform === 'THREADS') return base.split('.')[0] + '.';
  return base;
}

const MOCK_HASHTAGS: Record<Platform, string[]> = {
  FACEBOOK: ['#AIMarketing', '#ContentMarketing', '#AIMA', '#SME'],
  INSTAGRAM: ['#AIMarketing', '#ContentCreator', '#MarketingAutomation', '#AIMA', '#SocialMediaTips', '#ContentStrategy'],
  THREADS: ['#AIMarketing', '#ContentTips'],
};

function mockMediaPrompt(lang: Lang, platform: Platform): string {
  return P(
    lang,
    `Ảnh vuông tông tím pastel: bàn làm việc gọn gàng, laptop mở dashboard AIMA, ánh sáng tự nhiên, phong cách tối giản hiện đại. Chừa khoảng trống góc trên cho tiêu đề. (${platform === 'INSTAGRAM' ? 'Tỷ lệ 1:1, màu rực hơn cho feed IG' : platform === 'THREADS' ? 'Tối giản, ít chữ' : 'Tỷ lệ 4:5, dễ đọc trên feed FB'})`,
    `Square image in pastel purple: tidy desk, laptop showing the AIMA dashboard, natural light, modern minimal style. Leave top corner space for a headline. (${platform === 'INSTAGRAM' ? '1:1 ratio, more vivid for the IG feed' : platform === 'THREADS' ? 'Minimal, little text' : '4:5 ratio, easy to read on the FB feed'})`,
  );
}

export function mockBrandVoice(lang: Lang, v: number): BrandVoiceCheck {
  const scores = [92, 88, 95, 90];
  return {
    score: scores[v % scores.length],
    tone: P(lang, 'Trẻ trung, Thân thiện, Chuyên nghiệp', 'Youthful, Friendly, Professional'),
    wording: P(lang, 'Tích cực, Đơn giản, Dễ hiểu', 'Positive, Simple, Easy to read'),
    message: P(lang, 'Phù hợp với mục tiêu thương hiệu', 'Aligned with your brand goals'),
    summary: P(lang, 'Nội dung phù hợp với giọng điệu thương hiệu.', 'The content matches your brand voice.'),
  };
}

let mockVersionSeq = 0;

/** Sinh 1 GenerationResult mock: mỗi nền tảng một ContentVersion riêng (BR-04). */
export function mockGeneration(lang: Lang, platforms: Platform[], versionIndex: number, note?: string): GenerationResult {
  const now = new Date().toISOString();
  const versions: ContentVersion[] = platforms.map((platform) => ({
    id: `mock-version-${++mockVersionSeq}`,
    platform,
    // Bản mock là nội dung vừa tạo, chưa qua job định dạng.
    status: 'GENERATED',
    script: mockScript(lang, platform, versionIndex % 2),
    caption: mockCaption(lang, platform, versionIndex % 2),
    hashtags: MOCK_HASHTAGS[platform],
    cta: P(lang, 'Dùng thử AIMA miễn phí — link ở bio!', 'Try AIMA for free — link in bio!'),
    mediaPrompt: mockMediaPrompt(lang, platform),
    imageUrl: null,
    brandVoice: mockBrandVoice(lang, versionIndex),
    createdAt: now,
  }));
  return { id: `mock-gen-${Date.now()}-${versionIndex}`, note, createdAt: now, versions };
}
