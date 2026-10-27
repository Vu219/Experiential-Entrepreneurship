import { BarChart3, CalendarClock, Link2, PenLine, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { L10n } from '../api/landing';
import type { ContentItemStatus } from '../api/contentGeneration';

// Nội dung trang Tài nguyên công khai (/resources) — song ngữ vi/en, đọc bằng `tr(text, lang)`.
// Văn bản dài nên đặt riêng ở đây thay vì i18n.ts (cùng cách với config/legalContent.ts).
// ⚠️ Mô tả phải khớp HÀNH VI THẬT của sản phẩm (retry 5/15/30 phút, Instagram chưa tự đăng,
// giờ vàng cần ≥ 10 bài, chỉ tạo media prompt…). Đổi hành vi → cập nhật văn bản này cùng lúc.

const l = (vi: string, en: string): L10n => ({ vi, en });

/** id các khối trên trang — footer/landing link tới `/resources#<id>`. */
export const RESOURCE_SECTION = {
  start: 'getting-started',
  guides: 'guides',
  tips: 'tips',
  docs: 'docs',
  about: 'about',
} as const;

export const RESOURCES_HERO = {
  eyebrow: l('Trung tâm tài nguyên', 'Resource center'),
  title: l('Mọi thứ bạn cần để làm marketing cùng AIMA', 'Everything you need to market with AIMA'),
  subtitle: l(
    'Hướng dẫn từng bước, kiến thức marketing đa nền tảng và tài liệu sản phẩm — từ lúc thiết lập thương hiệu đến bài đăng đầu tiên.',
    'Step-by-step guides, multi-platform marketing know-how and product docs — from setting up your brand to your first published post.',
  ),
  nav: [
    { id: RESOURCE_SECTION.start, label: l('Bắt đầu nhanh', 'Quick start') },
    { id: RESOURCE_SECTION.guides, label: l('Hướng dẫn tính năng', 'Feature guides') },
    { id: RESOURCE_SECTION.tips, label: l('Kiến thức marketing', 'Marketing tips') },
    { id: RESOURCE_SECTION.docs, label: l('Tài liệu sản phẩm', 'Product docs') },
    { id: RESOURCE_SECTION.about, label: l('Về AIMA', 'About AIMA') },
  ],
};

export const RESOURCES_START = {
  title: l('Bắt đầu nhanh trong 5 bước', 'Get started in 5 steps'),
  subtitle: l('Làm theo thứ tự này cho lần đầu sử dụng — mỗi bước chỉ mất vài phút.', 'Follow this order the first time — each step takes just a few minutes.'),
  steps: [
    {
      title: l('Tạo hồ sơ thương hiệu', 'Create a brand profile'),
      description: l(
        'Khai báo ngành hàng, khách hàng mục tiêu, giọng điệu và sản phẩm. AI chỉ tạo nội dung khi đã có hồ sơ thương hiệu.',
        'Describe your industry, target audience, tone of voice and products. The AI only creates content once a brand profile exists.',
      ),
    },
    {
      title: l('Xây dựng chiến lược nội dung', 'Build a content strategy'),
      description: l(
        'Chọn mục tiêu, nền tảng, tần suất đăng và chủ đề chính. Một thương hiệu có thể có nhiều chiến lược.',
        'Pick goals, platforms, posting frequency and key topics. One brand can have several strategies.',
      ),
    },
    {
      title: l('Kết nối kênh đăng', 'Connect your channels'),
      description: l(
        'Liên kết Trang Facebook, Instagram Business và Threads qua đăng nhập Meta. AIMA chỉ đăng lên kênh bạn đã kết nối.',
        'Link your Facebook Page, Instagram Business and Threads through Meta login. AIMA only publishes to channels you connect.',
      ),
    },
    {
      title: l('Nghiên cứu xu hướng & tạo bài', 'Research trends & create posts'),
      description: l(
        'Bấm "Research ngay" để AI tìm xu hướng và gợi ý ý tưởng, rồi tạo bài và định dạng riêng cho từng nền tảng.',
        'Hit "Research now" so the AI finds trends and suggests ideas, then create posts formatted for each platform.',
      ),
    },
    {
      title: l('Duyệt, lên lịch & đo lường', 'Review, schedule & measure'),
      description: l(
        'Duyệt hoặc chỉnh sửa bài, chọn giờ đăng. Sau khi đăng, AIMA tự thu thập số liệu để bạn tối ưu.',
        'Approve or edit, then pick a time. Once published, AIMA collects the metrics so you can optimize.',
      ),
    },
  ],
};

export interface ResourceGuide {
  icon: LucideIcon;
  title: L10n;
  description: L10n;
  points: L10n[];
}

export const RESOURCES_GUIDES = {
  title: l('Hướng dẫn theo tính năng', 'Feature guides'),
  subtitle: l('Cách dùng từng phần của AIMA và những điều nên biết trước.', 'How to use each part of AIMA — and what to know up front.'),
  items: [
    {
      icon: Link2,
      title: l('Kết nối Facebook, Instagram & Threads', 'Connect Facebook, Instagram & Threads'),
      description: l('Liên kết một lần, AIMA đăng bài thay bạn theo lịch.', 'Link once and AIMA publishes for you on schedule.'),
      points: [
        l('Facebook: AIMA đăng lên Trang (Page) bạn quản lý — không đăng lên trang cá nhân.', 'Facebook: AIMA posts to Pages you manage — never to your personal profile.'),
        l('Instagram: chuyển sang tài khoản Doanh nghiệp/Nhà sáng tạo, liên kết với Trang Facebook rồi kết nối lại.', 'Instagram: switch to a Business/Creator account, link it to your Facebook Page, then reconnect.'),
        l('Threads: đăng nhập tài khoản Threads trong hộp thoại kết nối riêng.', 'Threads: sign in to your Threads account in its own connect dialog.'),
        l('Token được mã hoá; khi kênh cần kết nối lại, bạn nhận thông báo và bài đã lên lịch được tạm giữ.', 'Tokens are encrypted; if a channel needs reconnecting you are notified and scheduled posts are held.'),
      ],
    },
    {
      icon: TrendingUp,
      title: l('Nghiên cứu xu hướng', 'Trend research'),
      description: l('Tìm chủ đề đang lên, sát với thương hiệu của bạn.', 'Find rising topics that fit your brand.'),
      points: [
        l('Chọn hồ sơ, chiến lược, nền tảng và số ý tưởng (1–20) rồi bấm "Research ngay".', 'Choose a profile, strategy, platforms and number of ideas (1–20), then hit "Research now".'),
        l('AI tổng hợp từ tìm kiếm web, Google Trends và lịch marketing, kèm mức độ phù hợp và nguồn dẫn.', 'The AI combines web search, Google Trends and the marketing calendar, with relevance and sources.'),
        l('Đặt lịch research tự động hằng ngày hoặc hằng tuần; lưu ý tưởng hay để dùng sau.', 'Schedule automatic daily or weekly research; save good ideas for later.'),
      ],
    },
    {
      icon: PenLine,
      title: l('Tạo & định dạng nội dung', 'Create & format content'),
      description: l('Nội dung bám hồ sơ thương hiệu và chiến lược, không viết ngẫu nhiên.', 'Content follows your brand profile and strategy — never random.'),
      points: [
        l('AI viết script, caption, hashtag và lời kêu gọi hành động.', 'The AI writes the script, caption, hashtags and call to action.'),
        l('Mỗi nền tảng có một bản định dạng riêng về độ dài, giọng điệu và hashtag.', 'Each platform gets its own version — length, tone and hashtags.'),
        l('AIMA tạo media prompt (mô tả hình ảnh/video) để bạn tự sản xuất — không tự sinh ảnh/video.', 'AIMA writes media prompts (image/video descriptions) for you to produce — it does not generate images or video.'),
        l('Sửa thủ công, gửi duyệt hoặc duyệt trước khi lên lịch.', 'Edit by hand, send for review or approve before scheduling.'),
      ],
    },
    {
      icon: CalendarClock,
      title: l('Lên lịch & tự động đăng', 'Schedule & auto-publish'),
      description: l('Đăng đúng giờ, kể cả khi bạn không online.', 'Publish on time, even when you are offline.'),
      points: [
        l('Chọn giờ cụ thể hoặc đăng ngay; theo dõi hàng đợi ở trang Lịch đăng bài.', 'Pick an exact time or publish now; track the queue on the Calendar page.'),
        l('Khung giờ vàng gợi ý theo hiệu quả bài của chính bạn khi đã có từ 10 bài; ít hơn thì dùng giờ mặc định của nền tảng.', 'Golden hours are based on your own results once you have 10+ posts; before that, platform defaults are used.'),
        l('Bật "bắt buộc duyệt" để bài chưa duyệt không bao giờ tự đăng.', 'Turn on "require approval" so unapproved posts never publish.'),
        l('Instagram cần ảnh/video nên chưa tự đăng được — hãy đăng thủ công bằng media prompt.', 'Instagram needs an image/video, so it cannot auto-publish yet — post manually using the media prompt.'),
      ],
    },
    {
      icon: TriangleAlert,
      title: l('Xử lý bài đăng lỗi', 'Handle failed posts'),
      description: l('Biết vì sao bài lỗi và cần làm gì tiếp theo.', 'Know why a post failed and what to do next.'),
      points: [
        l('Lỗi tạm thời (mạng, quá tải, giới hạn tần suất) được tự thử lại tối đa 3 lần.', 'Temporary errors (network, overload, rate limits) are retried automatically up to 3 times.'),
        l('Lỗi cố định như token hết hạn hay vi phạm chính sách không thử lại — bạn nhận thông báo kèm hướng xử lý.', 'Permanent errors such as an expired token or a policy violation are not retried — you get a notice with next steps.'),
        l('Trang "Bài lỗi & cần xử lý" gom nguyên nhân, cho thử lại, bỏ qua hoặc nhờ AI sửa nội dung vi phạm.', 'The "Failed posts" page groups causes and lets you retry, dismiss or have the AI fix flagged content.'),
      ],
    },
    {
      icon: BarChart3,
      title: l('Phân tích hiệu quả', 'Performance analytics'),
      description: l('Số liệu thật từ nền tảng, tự cập nhật sau khi đăng.', 'Real platform metrics, updated automatically after publishing.'),
      points: [
        l('Lượt xem, cảm xúc, bình luận và chia sẻ được thu thập tự động.', 'Views, reactions, comments and shares are collected automatically.'),
        l('Xem theo ngày, theo nền tảng, top bài viết và khung giờ tương tác.', 'See daily trends, per-platform results, top posts and engagement hours.'),
        l('AI dùng kết quả để gợi ý tối ưu chiến lược cho các bài tiếp theo.', 'The AI uses the results to suggest strategy improvements for future posts.'),
      ],
    },
  ] satisfies ResourceGuide[],
};

export const RESOURCES_TIPS = {
  title: l('Kiến thức marketing', 'Marketing tips'),
  subtitle: l('Nguyên tắc ngắn gọn giúp nội dung hiệu quả hơn trên mạng xã hội.', 'Short principles that make your social content work harder.'),
  items: [
    {
      title: l('Giữ chân người đọc trong 3 giây đầu', 'Win the first 3 seconds'),
      body: l(
        'Câu mở đầu quyết định người đọc có dừng lại hay không. Nêu vấn đề, con số hoặc câu hỏi gây tò mò ngay dòng đầu.',
        'Your opening line decides whether people stop scrolling. Lead with a problem, a number or a curious question.',
      ),
    },
    {
      title: l('Mỗi nền tảng một cách nói', 'Speak each platform’s language'),
      body: l(
        'Facebook hợp bài kể chuyện dài hơn, Instagram cần hình ảnh dẫn dắt và caption gọn, Threads hợp câu ngắn mang tính trò chuyện.',
        'Facebook suits longer storytelling, Instagram needs a strong visual and a tight caption, Threads favors short conversational lines.',
      ),
    },
    {
      title: l('Đều đặn quan trọng hơn dày đặc', 'Consistency beats volume'),
      body: l(
        'Lịch đăng ổn định giúp người theo dõi quen nhịp và nền tảng hiểu kênh của bạn. Chọn tần suất bạn duy trì được lâu dài.',
        'A steady schedule trains your audience and helps platforms understand your channel. Pick a frequency you can sustain.',
      ),
    },
    {
      title: l('Bám xu hướng có chọn lọc', 'Ride trends selectively'),
      body: l(
        'Chỉ chọn trend liên quan đến khách hàng và sản phẩm của bạn. Trend lệch thương hiệu có thể mang lượt xem nhưng không mang khách hàng.',
        'Only pick trends that relate to your audience and products. An off-brand trend may bring views, but not customers.',
      ),
    },
    {
      title: l('Một lời kêu gọi duy nhất', 'One clear call to action'),
      body: l(
        'Mỗi bài nên dẫn tới một hành động: bình luận, nhắn tin, lưu bài hay truy cập link. Nhiều lời kêu gọi cùng lúc khiến người đọc không làm gì cả.',
        'Each post should drive one action: comment, message, save or click. Several asks at once usually means none happens.',
      ),
    },
    {
      title: l('Đo lường rồi mới tối ưu', 'Measure before you optimize'),
      body: l(
        'So sánh các bài ở cùng mốc thời gian sau khi đăng, giữ lại định dạng hiệu quả và chỉ thay đổi từng yếu tố một.',
        'Compare posts at the same age after publishing, keep what works and change one element at a time.',
      ),
    },
  ],
};

/** Thứ tự hiện các trạng thái tổng của bài — nhãn/màu lấy từ CONTENT_STATUS_META (giống app). */
export const RESOURCE_STATUS_ORDER: ContentItemStatus[] = [
  'DRAFT', 'GENERATED', 'FORMATTED', 'SCHEDULED', 'ON_HOLD', 'POSTING', 'POSTED', 'PARTIALLY_POSTED', 'FAILED',
];

export const RESOURCES_DOCS = {
  title: l('Tài liệu sản phẩm', 'Product docs'),
  subtitle: l('Tra cứu nhanh cách AIMA vận hành.', 'A quick reference for how AIMA works.'),
  statusTitle: l('Trạng thái bài đăng', 'Post statuses'),
  statuses: {
    DRAFT: l('Bài chưa có nội dung hoàn chỉnh.', 'The post has no complete content yet.'),
    GENERATED: l('AI đã viết nội dung, chưa định dạng cho nền tảng.', 'The AI has written content, not yet formatted per platform.'),
    FORMATTED: l('Đã có bản cho từng nền tảng, sẵn sàng lên lịch.', 'Platform versions are ready to schedule.'),
    SCHEDULED: l('Đã lên lịch, chờ đến giờ đăng.', 'Scheduled and waiting for its time.'),
    ON_HOLD: l('Tạm giữ — ví dụ kênh cần kết nối lại hoặc bài chờ duyệt.', 'On hold — e.g. a channel needs reconnecting or the post awaits approval.'),
    POSTING: l('Đang đăng hoặc đang chờ thử lại.', 'Publishing now or waiting to retry.'),
    POSTED: l('Đã đăng thành công trên mọi nền tảng đã lên lịch.', 'Published on every scheduled platform.'),
    PARTIALLY_POSTED: l('Đã đăng trên một số nền tảng, nền tảng khác chưa thành công.', 'Published on some platforms; others have not succeeded.'),
    FAILED: l('Đăng thất bại — xem nguyên nhân và cách xử lý ở trang Bài lỗi.', 'Publishing failed — see the cause and fix on the Failed posts page.'),
  } satisfies Record<ContentItemStatus, L10n>,
  statusNote: l(
    'Trạng thái duyệt (Cần duyệt / Đã duyệt / Cần sửa) hiển thị riêng, không thay thế trạng thái trên.',
    'Review status (Needs review / Approved / Changes requested) is shown separately and does not replace the statuses above.',
  ),
  retryTitle: l('Khi đăng bài gặp lỗi', 'When publishing fails'),
  retryIntro: l('Lỗi tạm thời (hết thời gian chờ, giới hạn tần suất, lỗi mạng) được tự thử lại:', 'Temporary errors (timeouts, rate limits, network issues) are retried automatically:'),
  retrySteps: [
    l('Lần 1 — sau 5 phút', 'Attempt 1 — after 5 minutes'),
    l('Lần 2 — sau 15 phút', 'Attempt 2 — after 15 minutes'),
    l('Lần 3 — sau 30 phút', 'Attempt 3 — after 30 minutes'),
  ],
  retryFinal: l('Vẫn lỗi sau 3 lần → bài chuyển "Thất bại" và bạn nhận thông báo.', 'Still failing after 3 attempts → the post becomes "Failed" and you are notified.'),
  noRetryTitle: l('Không thử lại, báo bạn ngay', 'Not retried — you are told right away'),
  noRetry: [
    l('Token kết nối hết hạn', 'Expired connection token'),
    l('Định dạng media không hợp lệ', 'Invalid media format'),
    l('Tài khoản bị khoá', 'Locked account'),
    l('Nội dung vi phạm chính sách nền tảng', 'Content that violates platform policy'),
  ],
  linksTitle: l('Gói dịch vụ & pháp lý', 'Plans & legal'),
  links: [
    { href: '/pricing', label: l('Bảng giá & so sánh gói', 'Pricing & plan comparison'), description: l('Hạn mức và tính năng của từng gói.', 'Limits and features of each plan.') },
    { href: '/terms', label: l('Điều khoản sử dụng', 'Terms of service'), description: l('Quyền và trách nhiệm khi dùng AIMA.', 'Your rights and responsibilities with AIMA.') },
    { href: '/privacy', label: l('Chính sách bảo mật', 'Privacy policy'), description: l('Dữ liệu được thu thập và bảo vệ thế nào.', 'What data is collected and how it is protected.') },
    { href: '/data-deletion', label: l('Xoá dữ liệu', 'Data deletion'), description: l('Cách yêu cầu xoá dữ liệu khỏi AIMA.', 'How to request data deletion from AIMA.') },
  ],
};

export const RESOURCES_ABOUT = {
  title: l('Về AIMA', 'About AIMA'),
  paragraphs: [
    l(
      'AIMA – AI Marketing Assistant là nền tảng AI tự động hoá content marketing đa nền tảng: nghiên cứu xu hướng, tạo nội dung, định dạng theo từng nền tảng, lên lịch, tự đăng và phân tích hiệu quả.',
      'AIMA – AI Marketing Assistant is an AI platform that automates multi-platform content marketing: trend research, content creation, per-platform formatting, scheduling, auto-publishing and performance analytics.',
    ),
    l(
      'Bạn thiết lập thương hiệu một lần — AIMA lo phần việc lặp lại, còn bạn luôn là người duyệt và quyết định cuối cùng.',
      'Set up your brand once — AIMA handles the repetitive work, while you always review and have the final say.',
    ),
  ],
  audienceTitle: l('AIMA dành cho', 'Built for'),
  audiences: [
    { title: l('Nhà sáng tạo nội dung', 'Content creators'), description: l('Giữ nhịp đăng đều mà không mất cả ngày viết bài.', 'Keep a steady posting rhythm without spending all day writing.') },
    { title: l('Hộ kinh doanh nhỏ', 'Micro-businesses'), description: l('Có kênh bán hàng hoạt động đều đặn dù không có người làm marketing riêng.', 'Run active sales channels without a dedicated marketer.') },
    { title: l('Doanh nghiệp vừa và nhỏ', 'Small & medium businesses'), description: l('Chuẩn hoá quy trình nội dung trên nhiều kênh và đo lường được hiệu quả.', 'Standardize content across channels and measure what works.') },
  ],
  contactTitle: l('Liên hệ & hỗ trợ', 'Contact & support'),
  contactText: l('Cần hỗ trợ, góp ý hoặc muốn hợp tác? Gửi email cho chúng tôi:', 'Need help, have feedback or want to partner? Email us:'),
};
