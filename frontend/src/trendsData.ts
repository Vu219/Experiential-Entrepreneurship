// Mock data cho trang "Nghiên cứu xu hướng" (Trends) — demo UI, thay bằng API khi BE sẵn sàng.
// Scope nền tảng: chỉ Facebook / Instagram / Threads (xem CLAUDE.md gốc & frontend/rule.md).
import type { Lang } from './types';
import { getDict } from './i18n';
import { Flame, Lightbulb, Target, Clock, type LucideIcon } from 'lucide-react';
import { STATUS_COLORS, STATUS_NEUTRAL, STATUS_PENDING } from './statusTokens';

// ===== Types =====

export type FitLevel = 'high' | 'medium' | 'low';
export type IdeaStatus = 'new' | 'used' | 'saved';
export type SessionStatus = 'done' | 'cancelled';
/** Sub-tab của trang Xu hướng — dùng chung giữa page và sidebar phải. */
export type TrendsTab = 'hot' | 'ideas' | 'history';

export interface TrendItem {
  id: string;
  name: string;
  hashtag: string;
  desc: string;
  /** Thumbnail placeholder: emoji trên nền gradient (MVP không sinh ảnh — FR-29). */
  emoji: string;
  tint: string;
  industry: string;
  /** Tag nền tảng trong scope: FB | IG | TH. */
  platforms: string[];
  fit: FitLevel;
  /** Điểm sparkline 0–100, vẽ mini chart cột "Xu hướng". */
  spark: number[];
  growth: string;
  up: boolean;
  engagement: string;
  engagementDelta: string;
  ideaCount: number;
}

export interface ContentIdea {
  id: string;
  trendId: string;
  title: string;
  platform: string; // tag FB | IG | TH
  format: string;
  score: number; // điểm phù hợp 0–100
  status: IdeaStatus;
}

export interface ResearchSession {
  id: string;
  date: string; // dd/MM/yyyy
  time: string; // hh:mm AM/PM
  status: SessionStatus;
  industry: string;
  platforms: number;
  trendsFound: number;
  ideasCreated: number;
  duration: string;
}

export interface TrendStat {
  value: string;
  label: string;
  delta?: string;
  deltaLabel?: string;
  deltaColor?: string;
  /** Badge trạng thái (thẻ "Phiên research gần nhất"). */
  badge?: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

// ===== Màu trạng thái (map về statusTokens — không hardcode hex rải rác) =====

export const FIT_COLORS: Record<FitLevel, { color: string; bg: string }> = {
  high: STATUS_COLORS.active,
  medium: STATUS_PENDING,
  low: STATUS_COLORS.error,
};

export const IDEA_STATUS_COLORS: Record<IdeaStatus, { color: string; bg: string }> = {
  new: STATUS_COLORS.info,
  saved: STATUS_COLORS.active,
  used: STATUS_NEUTRAL,
};

export const SESSION_STATUS_COLORS: Record<SessionStatus, { color: string; bg: string }> = {
  done: STATUS_COLORS.active,
  cancelled: STATUS_COLORS.error,
};

// ===== 4 thẻ thống kê đầu trang =====

export function trendStats(lang: Lang): TrendStat[] {
  const d = getDict(lang);
  const p = (vi: string, en: string) => (lang === 'en' ? en : vi);
  return [
    { value: '28', label: d.trStatNew, delta: '+12%', deltaLabel: d.trVsYesterday, deltaColor: '#16a34a', icon: Flame, iconBg: 'linear-gradient(135deg,#ffe9f3,#fff3e0)', iconColor: '#ec4899' },
    { value: '56', label: d.trStatIdeas, delta: '+18%', deltaLabel: d.trVsYesterday, deltaColor: '#16a34a', icon: Lightbulb, iconBg: 'linear-gradient(135deg,#f1e9ff,#e9f0ff)', iconColor: '#8b5cf6' },
    { value: '16', label: d.trStatHigh, delta: '57%', deltaLabel: d.trOfTotal, deltaColor: '#7c3aed', icon: Target, iconBg: 'linear-gradient(135deg,#e7fff4,#e9f7ff)', iconColor: '#10b981' },
    { value: p('Hôm nay, 02:00 AM', 'Today, 02:00 AM'), label: d.trStatLast, badge: d.trDone, icon: Clock, iconBg: 'linear-gradient(135deg,#e7f6ff,#eef2ff)', iconColor: '#3b82f6' },
  ];
}

// ===== Trend nổi bật (28 trend: 16 cao · 8 trung bình · 4 thấp) =====

const TINTS = [
  'linear-gradient(135deg,#ffe9f3,#fae9ff)',
  'linear-gradient(135deg,#fff3e0,#ffe9f3)',
  'linear-gradient(135deg,#f1e9ff,#e9f0ff)',
  'linear-gradient(135deg,#e7f6ff,#eef2ff)',
  'linear-gradient(135deg,#e7fff4,#e9f7ff)',
  'linear-gradient(135deg,#eef2ff,#f1e9ff)',
];

/** Sinh 8 điểm sparkline tuyến tính từ `from` → `to` kèm dao động nhẹ. */
const spark = (from: number, to: number): number[] =>
  Array.from({ length: 8 }, (_, i) => Math.round(from + ((to - from) * i) / 7 + (i % 2 ? 3 : -3)));

export function trendItems(lang: Lang): TrendItem[] {
  const p = (vi: string, en: string) => (lang === 'en' ? en : vi);
  const beauty = p('Mỹ phẩm & Làm đẹp', 'Beauty & Cosmetics');
  const fnb = p('Thực phẩm & Đồ uống', 'Food & Beverage');
  const fashion = p('Thời trang', 'Fashion');
  const tech = p('Marketing & Công nghệ', 'Marketing & Technology');
  const health = p('Sức khỏe', 'Health & Wellness');
  const travel = p('Du lịch', 'Travel');
  const edu = p('Giáo dục', 'Education');
  const fin = p('Tài chính', 'Finance');

  let n = 0;
  const T = (
    name: string, hashtag: string, desc: string, emoji: string, industry: string,
    platforms: string[], fit: FitLevel, growth: string, engagement: string,
    engagementDelta: string, ideaCount: number,
  ): TrendItem => {
    n += 1;
    const up = !growth.startsWith('-');
    return {
      id: `t${n}`, name, hashtag, desc, emoji, tint: TINTS[n % TINTS.length], industry,
      platforms, fit, spark: up ? spark(22, 96 - n) : spark(88 - n, 24), growth, up,
      engagement, engagementDelta, ideaCount,
    };
  };

  return [
    // Độ phù hợp CAO
    T(p('Skincare tối giản', 'Minimal skincare'), '#MinimalSkincare', p('Routine 3–5 bước, thành phần lành tính', '3–5 step routines, gentle ingredients'), '🧴', beauty, ['IG', 'TH'], 'high', '+214%', '128.4K', '+12%', 8),
    T(p('Cà phê muối đóng chai', 'Bottled salt coffee'), '#SaltCoffee', p('Đồ uống take-away lên ngôi ở thành phố lớn', 'Take-away drink taking over big cities'), '☕', fnb, ['FB', 'IG'], 'high', '+167%', '96.2K', '+9%', 6),
    T(p('Quiet luxury công sở', 'Quiet luxury office wear'), '#QuietLuxury', p('Tối giản, chất liệu tốt, không logo', 'Minimal cuts, premium fabric, no logo'), '👗', fashion, ['IG'], 'high', '+142%', '88.7K', '+15%', 5),
    T(p('AI cho doanh nghiệp nhỏ', 'AI for small business'), '#AIforSMB', p('Chủ shop chia sẻ workflow AI tiết kiệm thời gian', 'Shop owners share time-saving AI workflows'), '🤖', tech, ['FB', 'TH'], 'high', '+118%', '74.1K', '+7%', 7),
    T(p('Skincare tối giản cho nam', 'Skinimalism for men'), '#MenSkincare', p('Routine 2 bước cho nam giới bận rộn', 'Two-step routines for busy men'), '🧔', beauty, ['TH', 'IG'], 'high', '+102%', '63.5K', '+8%', 4),
    T(p('Soi bảng thành phần', 'Ingredient-first reviews'), '#IngredientCheck', p('Review mỹ phẩm đi từ bảng thành phần', 'Reviews that start from the INCI list'), '🔬', beauty, ['IG', 'FB'], 'high', '+96%', '58.9K', '+6%', 4),
    T(p('Matcha specialty', 'Specialty matcha'), '#MatchaLover', p('Matcha nguyên bản thay thế trà sữa', 'Single-origin matcha replacing milk tea'), '🍵', fnb, ['IG'], 'high', '+91%', '55.2K', '+10%', 4),
    T(p('Hậu trường thương hiệu', 'Behind-the-brand'), '#BehindTheBrand', p('Kể chuyện quy trình sản xuất, đội ngũ', 'Stories from production lines and teams'), '🎬', tech, ['TH', 'FB'], 'high', '+87%', '51.8K', '+5%', 3),
    T(p('Chống nắng trong nhà', 'Indoor sunscreen'), '#DailySPF', p('Thoa lại kem chống nắng cả khi ở nhà', 'Reapplying SPF even indoors'), '☀️', beauty, ['IG', 'TH'], 'high', '+82%', '49.6K', '+7%', 3),
    T(p('Bữa trưa văn phòng 50K', '50K office lunches'), '#LunchUnder50K', p('Gợi ý bữa trưa tiết kiệm cho dân văn phòng', 'Budget lunch ideas for office workers'), '🍱', fnb, ['FB'], 'high', '+76%', '46.3K', '+4%', 3),
    T(p('Thời trang bền vững', 'Slow fashion'), '#SlowFashion', p('Mua ít, mặc bền, phối lại đồ cũ', 'Buy less, wear longer, restyle old pieces'), '♻️', fashion, ['IG', 'TH'], 'high', '+71%', '44.8K', '+6%', 3),
    T(p('Micro-influencer địa phương', 'Local micro-influencers'), '#LocalCreator', p('Hợp tác KOC nhỏ, độ tin cậy cao', 'Small local KOCs with high trust'), '📍', tech, ['FB', 'IG'], 'high', '+68%', '42.1K', '+5%', 3),
    T(p('Sữa rửa mặt dịu nhẹ', 'Gentle cleansers'), '#GentleCleanse', p('Làm sạch không làm hại hàng rào da', 'Cleansing without hurting the skin barrier'), '🫧', beauty, ['IG'], 'high', '+64%', '40.7K', '+4%', 2),
    T(p('Trà chiều kiểu Việt', 'Viet afternoon tea'), '#VietTeaTime', p('Set bánh + trà nội địa cho giới trẻ thành thị', 'Local tea and pastry sets for urban youth'), '🍰', fnb, ['FB', 'IG'], 'high', '+61%', '38.4K', '+5%', 2),
    T(p('Linen mùa hè', 'Summer linen'), '#LinenSeason', p('Outfit linen thoáng mát đi làm, đi chơi', 'Breathable linen looks for work and play'), '👚', fashion, ['IG'], 'high', '+58%', '36.9K', '+6%', 2),
    T(p('Email marketing hồi sinh', 'Email comeback'), '#EmailRevival', p('Newsletter cá nhân hoá quay lại mạnh mẽ', 'Personalised newsletters are back'), '✉️', tech, ['FB', 'TH'], 'high', '+54%', '34.2K', '+3%', 2),
    // Độ phù hợp TRUNG BÌNH
    T(p('Workout 15 phút tại nhà', '15-minute home workout'), '#HomeWorkout15', p('Bài tập ngắn cho người bận rộn', 'Short routines for busy people'), '🏋️', health, ['IG', 'FB'], 'medium', '+48%', '32.6K', '+4%', 2),
    T(p('Du lịch chữa lành cuối tuần', 'Weekend healing trips'), '#WeekendHealing', p('Chuyến 2N1Đ gần thành phố', 'Short 2D1N getaways near the city'), '🏞️', travel, ['IG', 'TH'], 'medium', '+44%', '30.3K', '+6%', 2),
    T(p('Học từ vựng 5 phút mỗi ngày', '5-minute daily vocabulary'), '#5MinEnglish', p('Bài học tiếng Anh siêu ngắn mỗi ngày', 'Bite-size daily English lessons'), '📚', edu, ['FB'], 'medium', '+37%', '27.9K', '+3%', 2),
    T(p('Loud budgeting', 'Loud budgeting'), '#LoudBudgeting', p('Công khai chi tiêu để giữ kỷ luật', 'Sharing spending openly to stay disciplined'), '💰', fin, ['TH', 'FB'], 'medium', '+31%', '25.5K', '+2%', 1),
    T(p('Thử thách ngủ sớm', 'Early-sleep challenge'), '#SleepReset', p('21 ngày tắt đèn trước 23h', '21 days of lights-out before 11pm'), '😴', health, ['TH'], 'medium', '+27%', '23.8K', '+3%', 1),
    T(p('Sổ chi tiêu số', 'Digital budget journal'), '#BudgetJournal', p('Ghi chép chi tiêu bằng template đẹp', 'Tracking expenses with pretty templates'), '📒', fin, ['IG'], 'medium', '+24%', '21.4K', '+2%', 1),
    T(p('Podcast luyện tiếng Anh', 'English podcasts'), '#EnglishPodcast', p('Luyện nghe trên đường đi làm', 'Listening practice on the commute'), '🎧', edu, ['FB', 'TH'], 'medium', '+19%', '19.6K', '+2%', 1),
    T(p('Yoga bàn làm việc', 'Desk yoga'), '#DeskYoga', p('Giãn cơ 5 phút ngay tại bàn', 'Five-minute stretches at your desk'), '🧘', health, ['IG', 'FB'], 'medium', '+16%', '18.3K', '+1%', 1),
    // Độ phù hợp THẤP (đang hạ nhiệt)
    T(p('Góc làm việc tối giản', 'Minimal desk setup'), '#DeskSetup', p('Trào lưu khoe bàn làm việc hạ nhiệt', 'Desk tour wave is cooling down'), '🖥️', tech, ['IG'], 'low', '-12%', '16.8K', '-5%', 1),
    T(p('Trà sữa nướng', 'Roasted milk tea'), '#RoastedMilkTea', p('Hot cuối 2025, tương tác giảm rõ rệt', 'Peaked in late 2025, engagement dropping'), '🧋', fnb, ['FB', 'IG'], 'low', '-18%', '14.2K', '-8%', 1),
    T(p('Tour đại trà', 'Mass package tours'), '#PackageTour', p('Khách trẻ chuyển sang du lịch tự túc', 'Young travellers switching to DIY trips'), '🚌', travel, ['FB'], 'low', '-21%', '12.7K', '-6%', 0),
    T(p('Phong cách Y2K', 'Y2K style'), '#Y2KStyle', p('Nhường chỗ cho quiet luxury', 'Losing ground to quiet luxury'), '🕶️', fashion, ['IG', 'TH'], 'low', '-26%', '11.5K', '-9%', 0),
  ];
}

// ===== Ý tưởng content (24 ý tưởng, liên kết trendId với danh sách trend ở trên) =====

export function contentIdeas(lang: Lang): ContentIdea[] {
  const p = (vi: string, en: string) => (lang === 'en' ? en : vi);
  const post = p('Bài viết', 'Post');
  let m = 0;
  const I = (trendId: string, title: string, platform: string, format: string, score: number, status: IdeaStatus): ContentIdea => ({
    id: `i${++m}`, trendId, title, platform, format, score, status,
  });
  return [
    I('t1', p('Carousel: 5 bước skincare tối giản buổi sáng cho da dầu', 'Carousel: 5-step minimal morning routine for oily skin'), 'IG', 'Carousel', 92, 'new'),
    I('t1', p('Thread: Một tuần thử routine 3 bước — nhật ký chân thực', 'Thread: One week on a 3-step routine — honest diary'), 'TH', 'Thread', 88, 'saved'),
    I('t1', p('Reels: Tủ skincare chỉ còn 5 món', 'Reels: My skincare shelf is down to 5 items'), 'IG', 'Reels', 85, 'used'),
    I('t1', p('Story: Poll routine buổi sáng của bạn mấy bước?', 'Story: Poll — how many steps in your AM routine?'), 'IG', 'Story', 74, 'new'),
    I('t2', p('Công thức cà phê muối chuẩn vị pha tại nhà', 'The go-to salt coffee recipe you can make at home'), 'FB', post, 90, 'new'),
    I('t2', p('Story poll: Cà phê muối hay bạc xỉu?', 'Story poll: Salt coffee or bac xiu?'), 'IG', 'Story', 78, 'new'),
    I('t2', p('Reels: Một ngày bán 300 chai cà phê muối', 'Reels: Selling 300 bottles of salt coffee a day'), 'IG', 'Reels', 76, 'used'),
    I('t3', p('Carousel: 7 outfit công sở tối giản cho cả tuần', 'Carousel: 7 minimal office outfits for the week'), 'IG', 'Carousel', 86, 'saved'),
    I('t3', p('Bài viết: Vì sao quiet luxury chinh phục dân văn phòng', 'Post: Why quiet luxury wins over office workers'), 'FB', post, 71, 'new'),
    I('t4', p('3 công cụ AI giúp chủ shop tiết kiệm 10 giờ/tuần', '3 AI tools that save shop owners 10 hours a week'), 'FB', post, 89, 'new'),
    I('t4', p('Thread: Hành trình đưa AI vào quy trình bán hàng', 'Thread: Bringing AI into our sales workflow'), 'TH', 'Thread', 82, 'used'),
    I('t4', p('Carousel: Checklist bắt đầu với AI cho SME', 'Carousel: AI starter checklist for SMEs'), 'FB', 'Carousel', 79, 'saved'),
    I('t5', p('Reels: Routine 2 bước cho nam trước giờ đi làm', 'Reels: 2-step routine for men before work'), 'IG', 'Reels', 77, 'new'),
    I('t5', p('Thread: Da nam khác da nữ ở những điểm nào?', 'Thread: How men’s skin actually differs'), 'TH', 'Thread', 70, 'new'),
    I('t6', p('Carousel: Đọc bảng thành phần trong 60 giây', 'Carousel: Read an INCI list in 60 seconds'), 'IG', 'Carousel', 84, 'new'),
    I('t6', p('Bài viết: 5 thành phần nên tránh khi da nhạy cảm', 'Post: 5 ingredients to avoid on sensitive skin'), 'FB', post, 73, 'saved'),
    I('t7', p('Reels: Matcha latte 3 lớp đẹp như ngoài quán', 'Reels: 3-layer matcha latte, café-style'), 'IG', 'Reels', 80, 'new'),
    I('t7', p('Story: Hậu trường quầy matcha buổi sáng', 'Story: Morning matcha bar behind the scenes'), 'IG', 'Story', 69, 'used'),
    I('t8', p('Thread: Một ngày ở xưởng sản xuất của chúng tôi', 'Thread: A day at our workshop'), 'TH', 'Thread', 75, 'new'),
    I('t9', p('Carousel: Vì sao ngồi cạnh cửa sổ vẫn cần SPF', 'Carousel: Why you need SPF by the window'), 'IG', 'Carousel', 72, 'saved'),
    I('t11', p('Bài viết: Tủ đồ con nhộng 20 món mặc cả năm', 'Post: A 20-piece capsule wardrobe for the year'), 'FB', post, 70, 'new'),
    I('t17', p('Reels: Thử thách 15 phút workout giờ nghỉ trưa', 'Reels: 15-minute lunch-break workout challenge'), 'IG', 'Reels', 67, 'new'),
    I('t18', p('Album: 48 giờ chữa lành ở Đà Lạt với 2 triệu', 'Album: 48 healing hours in Da Lat under $80'), 'FB', post, 66, 'saved'),
    I('t19', p('Carousel: 30 từ vựng công sở dùng ngay hôm nay', 'Carousel: 30 office words you can use today'), 'FB', 'Carousel', 64, 'used'),
  ];
}

// ===== Lịch sử research (18 phiên: 15 hoàn thành · 3 hủy) =====

export function researchSessions(lang: Lang): ResearchSession[] {
  const p = (vi: string, en: string) => (lang === 'en' ? en : vi);
  const beauty = p('Mỹ phẩm & Làm đẹp', 'Beauty & Cosmetics');
  const fnb = p('Thực phẩm & Đồ uống', 'Food & Beverage');
  const fashion = p('Thời trang', 'Fashion');
  const tech = p('Marketing & Công nghệ', 'Marketing & Technology');
  const mins = (m: number, s: number) => p(`${m} phút ${s} giây`, `${m}m ${s}s`);
  let k = 0;
  const S = (date: string, status: SessionStatus, industry: string, platforms: number, trendsFound: number, ideasCreated: number, duration: string): ResearchSession => ({
    id: `s${++k}`, date, time: '02:00 AM', status, industry, platforms, trendsFound, ideasCreated, duration,
  });
  return [
    S('02/07/2026', 'done', beauty, 3, 28, 56, mins(12, 34)),
    S('01/07/2026', 'done', beauty, 3, 24, 48, mins(11, 2)),
    S('30/06/2026', 'done', fnb, 2, 19, 35, mins(9, 41)),
    S('29/06/2026', 'cancelled', beauty, 3, 0, 0, mins(2, 10)),
    S('28/06/2026', 'done', fashion, 3, 22, 40, mins(10, 18)),
    S('27/06/2026', 'done', tech, 2, 17, 29, mins(8, 52)),
    S('26/06/2026', 'done', beauty, 3, 21, 44, mins(11, 27)),
    S('25/06/2026', 'cancelled', p('Du lịch', 'Travel'), 1, 0, 0, mins(0, 45)),
    S('24/06/2026', 'done', p('Sức khỏe', 'Health & Wellness'), 3, 18, 31, mins(9, 5)),
    S('23/06/2026', 'done', beauty, 3, 23, 42, mins(10, 44)),
    S('22/06/2026', 'done', p('Tài chính', 'Finance'), 2, 14, 22, mins(7, 36)),
    S('21/06/2026', 'done', fnb, 3, 20, 38, mins(10, 3)),
    S('20/06/2026', 'cancelled', tech, 2, 0, 0, mins(1, 28)),
    S('19/06/2026', 'done', p('Giáo dục', 'Education'), 2, 15, 24, mins(8, 11)),
    S('18/06/2026', 'done', beauty, 3, 25, 47, mins(11, 58)),
    S('17/06/2026', 'done', fashion, 2, 16, 27, mins(8, 39)),
    S('16/06/2026', 'done', p('Du lịch', 'Travel'), 3, 19, 33, mins(9, 47)),
    S('15/06/2026', 'done', beauty, 3, 22, 41, mins(10, 29)),
  ];
}

/** Thông tin phiên gần nhất cho sidebar "Trạng thái research". */
export function latestResearch(lang: Lang) {
  const p = (vi: string, en: string) => (lang === 'en' ? en : vi);
  return {
    dateLabel: p('Hôm nay, 02:00 AM', 'Today, 02:00 AM'),
    industry: p('Mỹ phẩm & Làm đẹp', 'Beauty & Cosmetics'),
    platforms: ['FB', 'IG', 'TH'],
    duration: p('12 phút 34 giây', '12m 34s'),
    extraSources: 4,
  };
}
