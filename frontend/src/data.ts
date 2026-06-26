import type { Lang } from './types';
import { getDict } from './i18n';
import { PLATFORM_BG, tagOf } from './theme';

// ===== SVG path icons (single-path, stroked) =====
export const ICON = {
  dashboard: 'M3 3h8v8H3zM13 3h8v8h-8zM13 13h8v8h-8zM3 13h8v8H3z',
  create: 'M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z',
  calendar: 'M7 2v4M17 2v4M3.5 9h17M4 5h16v16H4z',
  analytics: 'M4 21V11M10 21V4M16 21v-6M3 21h18',
  trends: 'M3 16l5-5 4 4 8-8M16 7h5v5',
  brand: 'M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 21l-5.2 2.8 1-5.8L3.5 8.2l5.9-.9z',
  profile: 'M12 11a4 4 0 100-8 4 4 0 000 8zM5 21a7 7 0 0114 0',
  settings:
    'M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2zM12 15a3 3 0 100-6 3 3 0 000 6z',
  admin: 'M12 3l8 3v6c0 4.5-3 7.5-8 9-5-1.5-8-4.5-8-9V6z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z',
  bell: 'M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 01-3.4 0',
  logout: 'M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3 M10 17l5-5-5-5 M15 12H3',
} as const;

const P = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

// ===== Landing flow cards =====
const FLOW_ICONS = [
  'M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 21l-5.2 2.8 1-5.8L3.5 8.2l5.9-.9z',
  'M3 16l5-5 4 4 8-8M16 7h5v5',
  'M4 21V11M10 21V4M16 21v-6M3 21h18',
  'M7 2v4M17 2v4M3.5 9h17M4 5h16v16H4z',
  'M2 12s3.5-7 10-7 10 7 10 7',
  'M9 11l3 3L22 4',
];
export function flowCards(lang: Lang) {
  const data: [string, string][] =
    lang === 'en'
      ? [
          ['Trend research', 'AI scans industry trends and competitors in real time.'],
          ['Idea suggestions', 'Topics, angles and formats tailored to your brand voice.'],
          ['Content creation', 'Generate scripts, captions, hashtags & media per platform.'],
          ['Schedule & auto-post', 'Smart scheduling and 24/7 auto publishing across platforms.'],
          ['Collect data', 'Automatically measure the real performance of every post.'],
          ['Analyze & optimize', 'Analyze results and optimize strategy for the next posts.'],
        ]
      : [
          ['Nghiên cứu xu hướng', 'AI quét xu hướng theo ngành hàng và đối thủ theo thời gian thực.'],
          ['Đề xuất ý tưởng', 'Gợi ý chủ đề, góc nhìn và định dạng phù hợp với thương hiệu của bạn.'],
          ['Tạo nội dung', 'Tạo script, caption, hashtag và media tối ưu cho từng nền tảng.'],
          ['Lên lịch & tự đăng', 'Lập lịch thông minh và tự động đăng bài 24/7 đa nền tảng.'],
          ['Thu thập dữ liệu', 'Tự động đo lường hiệu quả thực tế của mỗi bài đăng.'],
          ['Phân tích & tối ưu', 'Phân tích kết quả và tối ưu chiến lược cho các bài sau.'],
        ];
  return data.map((c, i) => ({ title: c[0], desc: c[1], icon: FLOW_ICONS[i] }));
}

const PILLAR_ICONS = [
  'M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z',
  'M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z',
  'M4 21V11M10 21V4M16 21v-6M3 21h18',
];
export function pillars(lang: Lang) {
  const data: [string, string][] =
    lang === 'en'
      ? [
          ['Smart', 'AI analyzes and optimizes content performance'],
          ['Automatic', 'Schedule and auto-post 24/7'],
          ['Effective', 'Measure and continuously optimize strategy'],
        ]
      : [
          ['Thông minh', 'AI phân tích và tối ưu hiệu quả nội dung'],
          ['Tự động', 'Lên lịch và đăng bài tự động 24/7'],
          ['Hiệu quả', 'Đo lường và tối ưu chiến lược liên tục'],
        ];
  return data.map((p, i) => ({ title: p[0], desc: p[1], icon: PILLAR_ICONS[i] }));
}

// ===== Dashboard / Analytics stats =====
export function stats(lang: Lang) {
  const d = getDict(lang);
  return [
    { value: '248.6K', label: d.stTotalReach, trend: '+12.6%', icon: ICON.eye, bg: 'linear-gradient(135deg,#e7f6ff,#eef2ff)', color: '#3b82f6', trendColor: '#16a34a', trendBg: '#e8f8ee' },
    { value: '8.4%', label: d.stEngagement, trend: '+2.4%', icon: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z', bg: 'linear-gradient(135deg,#ffe9f3,#fae9ff)', color: '#ec4899', trendColor: '#16a34a', trendBg: '#e8f8ee' },
    { value: '142', label: d.stPosts, trend: '+18', icon: ICON.analytics, bg: 'linear-gradient(135deg,#f1e9ff,#e9f0ff)', color: '#8b5cf6', trendColor: '#16a34a', trendBg: '#e8f8ee' },
    { value: '12', label: d.stScheduled, trend: '+3', icon: ICON.calendar, bg: 'linear-gradient(135deg,#e7fff4,#e9f7ff)', color: '#10b981', trendColor: '#16a34a', trendBg: '#e8f8ee' },
  ];
}

export function weekChart(lang: Lang) {
  const vals = [54, 72, 48, 88, 64, 96, 78];
  const labels = lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  return vals.map((v, i) => ({ h: v + '%', label: labels[i] }));
}

export const platformUsage = [
  { name: 'Facebook', tag: 'FB', pct: '78%', bg: PLATFORM_BG.FB },
  { name: 'Instagram', tag: 'IG', pct: '71%', bg: PLATFORM_BG.IG },
  { name: 'Threads', tag: 'TH', pct: '54%', bg: PLATFORM_BG.TH },
];

export function posts(lang: Lang) {
  const d = getDict(lang);
  const ST: Record<string, [string, string, string]> = {
    pub: [d.stPublished, '#16a34a', '#e8f8ee'],
    sch: [d.stScheduledS, '#7c3aed', '#f1e9ff'],
    rev: [d.stReview, '#d97706', '#fdf0dc'],
  };
  const rows: [string, string, string, string, keyof typeof ST, string, string][] =
    lang === 'en'
      ? [
          ['5 tips to grow your Facebook reach', 'Facebook', 'FB', PLATFORM_BG.FB, 'pub', '58.2K', 'Jun 18'],
          ['Carousel: Building your personal brand', 'Instagram', 'IG', PLATFORM_BG.IG, 'pub', '24.8K', 'Jun 17'],
          ['Thread: Marketing automation in 5 posts', 'Threads', 'TH', PLATFORM_BG.TH, 'sch', '—', 'Jun 20'],
          ['Reel: AI Marketing in 2026', 'Instagram', 'IG', PLATFORM_BG.IG, 'rev', '—', 'Jun 21'],
        ]
      : [
          ['5 mẹo tăng lượt tiếp cận trên Facebook', 'Facebook', 'FB', PLATFORM_BG.FB, 'pub', '58.2K', '18/06'],
          ['Carousel: Hành trình xây dựng thương hiệu cá nhân', 'Instagram', 'IG', PLATFORM_BG.IG, 'pub', '24.8K', '17/06'],
          ['Thread: Tự động hoá marketing trong 5 bài', 'Threads', 'TH', PLATFORM_BG.TH, 'sch', '—', '20/06'],
          ['Reel: AI Marketing 2026', 'Instagram', 'IG', PLATFORM_BG.IG, 'rev', '—', '21/06'],
        ];
  return rows.map((r) => {
    const st = ST[r[4]];
    return { title: r[0], platform: r[1], tag: r[2], bg: r[3], status: st[0], stColor: st[1], stBg: st[2], reach: r[5], date: r[6] };
  });
}

// ===== Create page =====
export function ideas(lang: Lang) {
  const rows: [string, string, string, string, string][] =
    lang === 'en'
      ? [
          ['Reel: "Get ready with me" — founder edition', 'Instagram', PLATFORM_BG.IG, '92', 'Reel'],
          ['Carousel: 5 personal branding mistakes', 'Instagram', PLATFORM_BG.IG, '88', 'Carousel'],
          ['Thread: Marketing automation in 5 posts', 'Threads', PLATFORM_BG.TH, '85', 'Thread'],
          ['Post: AI Marketing trends 2026 for SMEs', 'Facebook', PLATFORM_BG.FB, '80', 'Post'],
        ]
      : [
          ['Reel "Get ready with me" phiên bản chủ doanh nghiệp', 'Instagram', PLATFORM_BG.IG, '92', 'Reel'],
          ['Carousel: 5 sai lầm khi xây thương hiệu cá nhân', 'Instagram', PLATFORM_BG.IG, '88', 'Carousel'],
          ['Thread: Tự động hoá marketing trong 5 bài', 'Threads', PLATFORM_BG.TH, '85', 'Thread'],
          ['Bài viết: Xu hướng AI Marketing 2026 cho SME', 'Facebook', PLATFORM_BG.FB, '80', 'Bài viết'],
        ];
  return rows.map((r) => ({ title: r[0], platform: r[1], tag: tagOf(r[1]), bg: r[2], score: r[3], fmt: r[4] }));
}

export const toneLabels = (lang: Lang) =>
  lang === 'en' ? ['Inspiring', 'Playful', 'Professional', 'Friendly'] : ['Truyền cảm hứng', 'Hài hước', 'Chuyên nghiệp', 'Gần gũi'];

export function scriptLines(lang: Lang) {
  return lang === 'en'
    ? ['Hook (0–3s): "Spending 5 hours a week just thinking up content?"', 'Body (3–25s): Show how AIMA auto-generates ideas & writes the script.', 'CTA (25–30s): "Try AIMA free — link in bio!"']
    : ['Hook (0–3s): "Bạn mất 5 giờ mỗi tuần chỉ để nghĩ nội dung?"', 'Thân (3–25s): Cách AIMA tự lên ý tưởng & viết kịch bản giúp bạn.', 'CTA (25–30s): "Thử AIMA miễn phí — link ở bio!"'];
}
export const genCaption = (lang: Lang) =>
  lang === 'en'
    ? 'Say goodbye to creative block 👋 AIMA turns a 5-hour content process into 5 minutes. Create, schedule & publish — all automatically.'
    : 'Tạm biệt việc bí ý tưởng 👋 AIMA biến quy trình content 5 giờ thành 5 phút. Sáng tạo, lên lịch và đăng bài — tất cả tự động.';
export const genHashtags = ['#AIMarketing', '#ContentCreator', '#MarketingAutomation', '#AIMA', '#SocialMediaTips', '#ContentStrategy'];

// ===== Calendar =====
export function calendarDays() {
  const dots: Record<number, string[]> = {
    3: [PLATFORM_BG.FB], 5: [PLATFORM_BG.IG, PLATFORM_BG.TH], 9: [PLATFORM_BG.FB], 12: [PLATFORM_BG.IG, PLATFORM_BG.TH],
    15: [PLATFORM_BG.IG], 18: [PLATFORM_BG.FB, PLATFORM_BG.IG, PLATFORM_BG.TH], 20: [PLATFORM_BG.TH], 23: [PLATFORM_BG.FB],
    26: [PLATFORM_BG.IG, PLATFORM_BG.FB], 28: [PLATFORM_BG.TH],
  };
  const out = [];
  for (let i = 0; i < 35; i++) {
    const day = i + 1;
    const inMonth = day >= 1 && day <= 30;
    out.push({ day: inMonth ? day : day <= 0 ? 31 + day : day - 30, muted: !inMonth, today: day === 19, dots: dots[day] || [] });
  }
  return out;
}
export const weekdays = (lang: Lang) => (lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);

export function upcoming(lang: Lang) {
  const rows: [string, string, string, string, string][] =
    lang === 'en'
      ? [
          ['08:00', 'Jun 20', 'Thread: AIMA in 5 posts', 'Threads', PLATFORM_BG.TH],
          ['12:30', 'Jun 20', 'Carousel: Personal branding', 'Instagram', PLATFORM_BG.IG],
          ['18:00', 'Jun 21', 'AI Marketing 2026 post', 'Facebook', PLATFORM_BG.FB],
          ['20:00', 'Jun 21', 'Reel: GRWM founder trend', 'Instagram', PLATFORM_BG.IG],
        ]
      : [
          ['08:00', '20/06', 'Thread: AIMA trong 5 bài', 'Threads', PLATFORM_BG.TH],
          ['12:30', '20/06', 'Carousel: Branding cá nhân', 'Instagram', PLATFORM_BG.IG],
          ['18:00', '21/06', 'Bài viết AI Marketing 2026', 'Facebook', PLATFORM_BG.FB],
          ['20:00', '21/06', 'Reel: Trend GRWM founder', 'Instagram', PLATFORM_BG.IG],
        ];
  return rows.map((u) => ({ time: u[0], date: u[1], title: u[2], platform: u[3], tag: tagOf(u[3]), bg: u[4] }));
}

// ===== Analytics =====
export function monthBars(lang: Lang) {
  const vals = [42, 58, 50, 71, 64, 80, 68, 88, 76, 92, 84, 96];
  const labels = lang === 'en' ? ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  return vals.map((v, i) => ({ h: v + '%', label: labels[i] }));
}
export const audience = [
  { label: '18–24', pct: '34%', color: '#22d3ee' },
  { label: '25–34', pct: '41%', color: '#8b5cf6' },
  { label: '35–44', pct: '17%', color: '#ec4899' },
  { label: '45+', pct: '8%', color: '#f59e0b' },
];

// ===== Trends =====
export function trends(lang: Lang) {
  const rows: [number, string, string, string, string][] =
    lang === 'en'
      ? [
          [1, 'AI-powered marketing automation', '128K', '+214%', 'Instagram'],
          [2, 'Founder personal branding', '96K', '+167%', 'Facebook'],
          [3, 'Short-form product storytelling', '88K', '+142%', 'Instagram'],
          [4, 'Small business behind-the-scenes', '74K', '+118%', 'Threads'],
          [5, 'Content optimization tips 2026', '61K', '+97%', 'Facebook'],
        ]
      : [
          [1, 'Marketing tự động bằng AI', '128K', '+214%', 'Instagram'],
          [2, 'Thương hiệu cá nhân cho founder', '96K', '+167%', 'Facebook'],
          [3, 'Video ngắn kể chuyện sản phẩm', '88K', '+142%', 'Instagram'],
          [4, 'Hậu trường doanh nghiệp nhỏ', '74K', '+118%', 'Threads'],
          [5, 'Mẹo tối ưu nội dung 2026', '61K', '+97%', 'Facebook'],
        ];
  return rows.map((x) => ({ rank: x[0], topic: x[1], vol: x[2], growth: x[3], platform: x[4], tag: tagOf(x[4]), bg: PLATFORM_BG[tagOf(x[4])] }));
}
export const trendTags = [
  ['#AIMarketing', '42K'], ['#ContentCreator', '38K'], ['#GRWM', '31K'], ['#SmallBiz', '27K'],
  ['#PersonalBrand', '24K'], ['#MarketingTips', '19K'], ['#Reels', '17K'], ['#Automation', '14K'],
].map((x) => ({ tag: x[0], vol: x[1] }));

// ===== Brand =====
export const brandToneLabels = (lang: Lang) =>
  lang === 'en'
    ? ['Inspiring', 'Creative', 'Trustworthy', 'Youthful', 'Minimal', 'Professional']
    : ['Truyền cảm hứng', 'Sáng tạo', 'Đáng tin', 'Trẻ trung', 'Tối giản', 'Chuyên nghiệp'];
export const brandColors = ['#22D3EE', '#8B5CF6', '#EC4899', '#6366F1', '#1877f2'];

/** Backend platform enum values, aligned with the FB/IG/Threads channel list below. */
export const CHANNEL_PLATFORMS = ['FACEBOOK', 'INSTAGRAM', 'THREADS'] as const;

export function channels(lang: Lang, connected: readonly string[] = ['FACEBOOK', 'INSTAGRAM']) {
  const d = getDict(lang);
  const rows: [string, string, string, (typeof CHANNEL_PLATFORMS)[number]][] = [
    ['Facebook', 'FB', PLATFORM_BG.FB, 'FACEBOOK'],
    ['Instagram', 'IG', PLATFORM_BG.IG, 'INSTAGRAM'],
    ['Threads', 'TH', PLATFORM_BG.TH, 'THREADS'],
  ];
  return rows.map((c) => {
    const on = connected.includes(c[3]);
    return { name: c[0], tag: c[1], bg: c[2], platform: c[3], on, pillText: on ? d.connected : d.notConnected, btnText: on ? d.connected : d.connect };
  });
}

// ===== Profile activity =====
export function activity(lang: Lang) {
  const rows: [string, string, string, string][] =
    lang === 'en'
      ? [
          ['Published a post to Facebook', '2h', PLATFORM_BG.FB, 'FB'],
          ['AI generated 3 new content ideas', '5h', '#8b5cf6', '✨'],
          ['Scheduled 4 posts for this week', 'Yesterday', '#10b981', '📅'],
          ['Updated brand profile', '2 days ago', '#f59e0b', '★'],
        ]
      : [
          ['Đã đăng bài lên Facebook', '2h', PLATFORM_BG.FB, 'FB'],
          ['AI tạo 3 ý tưởng nội dung mới', '5h', '#8b5cf6', '✨'],
          ['Lên lịch 4 bài cho tuần này', 'Hôm qua', '#10b981', '📅'],
          ['Cập nhật hồ sơ thương hiệu', '2 ngày trước', '#f59e0b', '★'],
        ];
  return rows.map((a) => ({ text: a[0], time: a[1], bg: a[2], tag: a[3] }));
}

// ===== Settings notifications =====
export const notifLabels = (lang: Lang) =>
  lang === 'en'
    ? ['Post published', 'New AI content ideas', 'Weekly performance report', 'New trend alerts']
    : ['Bài đăng đã xuất bản', 'Ý tưởng nội dung mới từ AI', 'Báo cáo hiệu quả hàng tuần', 'Cảnh báo xu hướng mới'];

export function themeOptions(lang: Lang) {
  return [
    { key: 'aurora' as const, label: 'Aurora', grad: 'linear-gradient(120deg,#46D6EC,#897CE3,#F083C0)' },
    { key: 'sunset' as const, label: P(lang, 'Hoàng hôn', 'Sunset'), grad: 'linear-gradient(120deg,#FB8DA0,#B47CEE,#7E86F1)' },
    { key: 'ocean' as const, label: P(lang, 'Đại dương', 'Ocean'), grad: 'linear-gradient(120deg,#5BD8EC,#6AA1F2,#7E86F1)' },
  ];
}

// ===== Settings — Connection tab mock data =====
export type ConnStatus = 'active' | 'expired' | 'disconnected' | 'error';
export interface ConnectedAccount {
  platform: string;
  tag: string;
  bg: string;
  subLabel: string;
  name: string;
  handle: string;
  status: ConnStatus;
  date: string;
  tokenValid: boolean | null;
  tokenLabel: string;
  tokenSub: string;
  actionType: 'refresh' | 'reconnect' | 'connect';
}

export function connectedAccounts(lang: Lang): ConnectedAccount[] {
  const p = (vi: string, en: string) => (lang === 'en' ? en : vi);
  return [
    { platform: 'Facebook', tag: 'FB', bg: PLATFORM_BG.FB, subLabel: p('Trang', 'Page'), name: 'AIMA Official', handle: '@aima.official', status: 'active', date: '12/05/2024 10:30', tokenValid: true, tokenLabel: p('Còn hiệu lực', 'Valid'), tokenSub: p('Còn 25 ngày', '25 days left'), actionType: 'refresh' },
    { platform: 'Instagram', tag: 'IG', bg: PLATFORM_BG.IG, subLabel: p('Tài khoản', 'Account'), name: 'aima.official', handle: '@aima.official', status: 'active', date: '10/05/2024 14:20', tokenValid: true, tokenLabel: p('Còn hiệu lực', 'Valid'), tokenSub: p('Còn 12 ngày', '12 days left'), actionType: 'refresh' },
    { platform: 'Threads', tag: 'TH', bg: PLATFORM_BG.TH, subLabel: p('Tài khoản', 'Account'), name: 'aima.official', handle: '@aima.official', status: 'active', date: '09/05/2024 09:15', tokenValid: true, tokenLabel: p('Còn hiệu lực', 'Valid'), tokenSub: p('Còn 8 ngày', '8 days left'), actionType: 'refresh' },
    { platform: 'Facebook', tag: 'FB', bg: PLATFORM_BG.FB, subLabel: p('Trang', 'Page'), name: 'AIMA Store', handle: '@aima.store', status: 'expired', date: '01/04/2024 16:45', tokenValid: false, tokenLabel: p('Hết hạn', 'Expired'), tokenSub: p('Hết hạn 2 ngày trước', 'Expired 2 days ago'), actionType: 'reconnect' },
    { platform: 'Instagram', tag: 'IG', bg: PLATFORM_BG.IG, subLabel: p('Tài khoản', 'Account'), name: 'aima.store', handle: '@aima.store', status: 'disconnected', date: '—', tokenValid: null, tokenLabel: '—', tokenSub: '', actionType: 'connect' },
  ];
}

export function connectionStats() {
  return { total: 5, active: 4, expired: 1, error: 0 };
}

// ===== Admin =====
// TODO: cần endpoint backend cho dữ liệu Admin (adminStats, adminUsers, planDist, health)
// — hiện là mock demo, phải thay bằng lời gọi API khi BE sẵn sàng.
export function adminStats(lang: Lang) {
  const rows: [string, string, string, string, string, string][] = [
    ['12,847', P(lang, 'Tổng người dùng', 'Total users'), '+8.2%', 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8', 'linear-gradient(135deg,#e9f0ff,#f1e9ff)', '#6366f1'],
    ['3,219', P(lang, 'Hoạt động hôm nay', 'Active today'), '+4.1%', 'M22 12h-4l-3 9L9 3l-3 9H2', 'linear-gradient(135deg,#e7fff4,#e9f7ff)', '#10b981'],
    ['1.2M', P(lang, 'Nội dung đã tạo', 'Content generated'), '+19%', ICON.create, 'linear-gradient(135deg,#f1e9ff,#fae9ff)', '#8b5cf6'],
    ['$48.6K', 'MRR', '+11%', 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6', 'linear-gradient(135deg,#fff3e0,#ffe9f3)', '#ec4899'],
  ];
  return rows.map((a) => ({ value: a[0], label: a[1], trend: a[2], icon: a[3], bg: a[4], color: a[5] }));
}

export function adminUsers(lang: Lang) {
  const PL: Record<string, [string, string, string]> = {
    pro: ['Pro', '#7c3aed', '#f1e9ff'],
    free: ['Free', '#64748b', '#eef2f7'],
    biz: ['Business', '#0e7490', '#e0f7fb'],
  };
  const STt: Record<string, [string, string, string]> = {
    act: [P(lang, 'Hoạt động', 'Active'), '#16a34a', '#e8f8ee'],
    idle: [P(lang, 'Tạm nghỉ', 'Idle'), '#d97706', '#fdf0dc'],
    new: [P(lang, 'Mới', 'New'), '#7c3aed', '#f1e9ff'],
  };
  const rows: [string, string, keyof typeof PL, keyof typeof STt, string, string][] = [
    ['Lan Phương', 'lan.phuong@gmail.com', 'pro', 'act', '342', '12/01/26'],
    ['Minh Tuấn', 'tuan.minh@aima.io', 'biz', 'act', '1,204', '03/11/25'],
    ['Thu Hà', 'ha.thu@brandco.vn', 'free', 'idle', '58', '28/02/26'],
    ['David Chen', 'david.chen@startup.co', 'pro', 'act', '489', '15/03/26'],
    ['Ngọc Anh', 'anh.ngoc@gmail.com', 'free', 'new', '3', '18/06/26'],
  ];
  return rows.map((u) => {
    const p = PL[u[2]];
    const st = STt[u[3]];
    return {
      name: u[0], email: u[1], plan: p[0], planColor: p[1], planBg: p[2],
      status: st[0], stColor: st[1], stBg: st[2], posts: u[4], joined: u[5],
      initials: u[0].split(' ').map((w) => w[0]).slice(-2).join(''),
    };
  });
}

export const planDist = [
  ['Pro', '5,128', '42%', '#8b5cf6'],
  ['Free', '6,402', '50%', '#94a3b8'],
  ['Business', '1,317', '8%', '#22d3ee'],
].map((p) => ({ plan: p[0], count: p[1], pct: p[2], color: p[3] }));

export function health(lang: Lang) {
  const rows: [string, string, 'ok' | 'warn'][] = [
    [P(lang, 'API', 'API'), '99.98%', 'ok'],
    [P(lang, 'Bộ máy AI', 'AI engine'), 'Operational', 'ok'],
    [P(lang, 'Bộ lập lịch', 'Scheduler'), 'Operational', 'ok'],
    [P(lang, 'Lưu trữ', 'Storage'), '72% used', 'warn'],
  ];
  return rows.map((h) => ({ label: h[0], value: h[1], color: h[2] === 'ok' ? '#16a34a' : '#d97706', bg: h[2] === 'ok' ? '#e8f8ee' : '#fdf0dc' }));
}

// ===== Brand/profile localized defaults =====
export const brandDefaults = (lang: Lang) => ({
  name: 'AIMA Studio',
  industry: P(lang, 'Marketing & Công nghệ', 'Marketing & Technology'),
  slogan: P(lang, 'Sáng tạo nội dung thông minh, tự động hoá tăng trưởng', 'Smart content, automated growth'),
  audience: P(lang, 'Content creator, doanh nghiệp nhỏ & SME 22–40 tuổi', 'Creators, small businesses & SMEs aged 22–40'),
});
export const bioDefault = (lang: Lang) =>
  P(lang, 'Mình dùng AIMA để tự động hoá toàn bộ quy trình content marketing đa nền tảng.', 'I use AIMA to automate my entire multi-platform content marketing workflow.');

// ===== Brand profile + Content strategy option lists =====
// Nguồn option mẫu (lấy từ thiết kế Brandprofile) — đa ngôn ngữ qua P(); không hardcode trong component.

export const industryOptions = (lang: Lang): string[] => [
  P(lang, 'Thực phẩm & Đồ uống', 'Food & Beverage'),
  P(lang, 'Thời trang', 'Fashion'),
  P(lang, 'Mỹ phẩm & Làm đẹp', 'Beauty & Cosmetics'),
  P(lang, 'Công nghệ', 'Technology'),
  P(lang, 'Giáo dục', 'Education'),
  P(lang, 'Sức khỏe', 'Health & Wellness'),
  P(lang, 'Du lịch', 'Travel'),
  P(lang, 'Bất động sản', 'Real estate'),
  P(lang, 'Tài chính', 'Finance'),
  P(lang, 'Marketing & Công nghệ', 'Marketing & Technology'),
  P(lang, 'Khác', 'Other'),
];

export const strategyGoalOptions = (lang: Lang): string[] => [
  P(lang, 'Tăng nhận diện thương hiệu', 'Increase brand awareness'),
  P(lang, 'Tăng doanh số', 'Increase sales'),
  P(lang, 'Tăng tương tác', 'Increase engagement'),
  P(lang, 'Tăng lượt chuyển đổi', 'Increase conversions'),
  P(lang, 'Thu hút khách hàng tiềm năng', 'Attract potential customers'),
  P(lang, 'Giới thiệu sản phẩm/dịch vụ', 'Introduce products/services'),
  P(lang, 'Chăm sóc khách hàng', 'Customer care'),
  P(lang, 'Xây dựng cộng đồng', 'Build community'),
  P(lang, 'Kéo traffic về website', 'Drive website traffic'),
  P(lang, 'Xây dựng uy tín', 'Build credibility'),
];

export const contentTypeOptions = (lang: Lang): string[] => [
  P(lang, 'Bài viết giáo dục', 'Educational post'),
  P(lang, 'Video ngắn', 'Short video'),
  P(lang, 'Hình ảnh', 'Image'),
  P(lang, 'Reels', 'Reels'),
  P(lang, 'Text/Status', 'Text/Status'),
  P(lang, 'Carousel', 'Carousel'),
  P(lang, 'Livestream', 'Livestream'),
  P(lang, 'Story', 'Story'),
];

export const contentStyleOptions = (lang: Lang): string[] => [
  P(lang, 'Trẻ trung', 'Youthful'),
  P(lang, 'Truyền cảm hứng', 'Inspiring'),
  P(lang, 'Chuyên nghiệp', 'Professional'),
  P(lang, 'Hài hước', 'Playful'),
  P(lang, 'Hiện đại', 'Modern'),
  P(lang, 'Sang trọng', 'Luxurious'),
  P(lang, 'Thân thiện', 'Friendly'),
  P(lang, 'Gần gũi', 'Approachable'),
];

export const ctaSampleOptions = (lang: Lang): string[] => [
  P(lang, 'Tìm hiểu ngay', 'Learn more'),
  P(lang, 'Theo dõi kênh', 'Follow us'),
  P(lang, 'Mua ngay', 'Shop now'),
  P(lang, 'Đăng ký nhận tin', 'Subscribe'),
  P(lang, 'Liên hệ tư vấn', 'Contact us'),
  P(lang, 'Để lại bình luận', 'Leave a comment'),
];

export const audienceSampleOptions = (lang: Lang): string[] => [
  P(lang, 'Gen Z', 'Gen Z'),
  P(lang, 'Sinh viên', 'Students'),
  P(lang, 'Chủ doanh nghiệp nhỏ', 'Small business owners'),
  P(lang, 'Nhân viên văn phòng', 'Office workers'),
  P(lang, 'Cha mẹ trẻ', 'Young parents'),
  P(lang, 'Tín đồ làm đẹp', 'Beauty enthusiasts'),
];

// Khung giờ không phụ thuộc ngôn ngữ.
export const TIME_SLOT_OPTIONS: string[] = [
  '06:00-09:00', '07:00-09:00', '09:00-11:00', '11:00-13:00',
  '13:00-15:00', '15:00-17:00', '17:00-19:00', '19:00-22:00', '22:00-24:00',
];

// Tần suất chiến lược = số bài/tuần (khác enum PostingFrequency của hồ sơ thương hiệu).
export const POSTS_PER_WEEK_OPTIONS: number[] = [2, 3, 4, 5];

// "Không nên viết" (Brand Do & Don't) — gợi ý mẫu ở panel "AI đã hiểu về thương hiệu".
export const brandDontSample = (lang: Lang): string[] => [
  P(lang, 'Quá lan man', 'Too rambling'),
  P(lang, 'Quá bán hàng', 'Too salesy'),
  P(lang, 'Tiêu cực', 'Negative'),
];
