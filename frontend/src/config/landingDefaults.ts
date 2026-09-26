import { getDict } from '../i18n';
import type { L10n, LandingContent } from '../api/landing';

// Nội dung Landing mặc định — CHỈ dùng khi đang tải hoặc API /landing/public lỗi, để landing
// không bao giờ trống. Trùng dữ liệu seed backend (LandingDataInitializer). Nguồn thật là DB.

export const CONTACT_EMAIL = 'aimarketing.aima@gmail.com';

const vi = getDict('vi');
const en = getDict('en');

/** Cùng khoá i18n cho cả hai ngôn ngữ. */
const k = (key: keyof typeof vi): L10n => ({ vi: String(vi[key]), en: String(en[key]) });
const l = (viText: string, enText: string): L10n => ({ vi: viText, en: enText });

export const DEFAULT_LANDING: LandingContent = {
  hero: {
    badge: k('heroBadge'),
    titleLine1: k('heroT1'),
    titleHighlight: k('heroT2'),
    subtitle: k('heroSub'),
    primaryCta: { label: k('bookDemo'), href: '/register' },
    secondaryCta: { label: k('tryAima'), href: '/login' },
    stats: [
      { value: 3, suffix: '+', label: k('statPlatforms') },
      { value: 24, suffix: '/7', label: k('statAuto') },
      { value: 10, suffix: '×', label: k('statSpeed') },
    ],
  },
  features: {
    title: k('flowTitle'),
    subtitle: k('flowSub'),
    items: [
      { icon: 'search', title: l('Nghiên cứu xu hướng', 'Trend research'), description: l('AI quét xu hướng theo ngành hàng và đối thủ theo thời gian thực.', 'AI scans industry trends and competitors in real time.') },
      { icon: 'lightbulb', title: l('Đề xuất ý tưởng', 'Idea suggestions'), description: l('Gợi ý chủ đề, góc nhìn và định dạng phù hợp với thương hiệu của bạn.', 'Topics, angles and formats tailored to your brand voice.') },
      { icon: 'pen-line', title: l('Tạo nội dung', 'Content creation'), description: l('Tạo script, caption, hashtag và media tối ưu cho từng nền tảng.', 'Generate scripts, captions, hashtags & media per platform.') },
      { icon: 'calendar-clock', title: l('Lên lịch & tự đăng', 'Schedule & auto-post'), description: l('Lập lịch thông minh và tự động đăng bài 24/7 đa nền tảng.', 'Smart scheduling and 24/7 auto publishing across platforms.') },
      { icon: 'bar-chart', title: l('Thu thập dữ liệu', 'Collect data'), description: l('Tự động đo lường hiệu quả thực tế của mỗi bài đăng.', 'Automatically measure the real performance of every post.') },
      { icon: 'sparkles', title: l('Phân tích & tối ưu', 'Analyze & optimize'), description: l('Phân tích kết quả và tối ưu chiến lược cho các bài sau.', 'Analyze results and optimize strategy for the next posts.') },
    ],
  },
  how_it_works: {
    title: k('hiwTitle'),
    subtitle: k('hiwSub'),
    steps: [
      { title: k('hiwS1T'), description: k('hiwS1D') },
      { title: k('hiwS2T'), description: k('hiwS2D') },
      { title: k('hiwS3T'), description: k('hiwS3D') },
    ],
  },
  integrations: {
    title: k('intTitle'),
    platforms: [
      { name: 'Facebook', icon: 'facebook', logoUrl: null },
      { name: 'Instagram', icon: 'instagram', logoUrl: null },
      { name: 'Threads', icon: 'threads', logoUrl: null },
    ],
  },
  cta: {
    badge: k('ctaEyebrow'),
    title: k('ctaTitle'),
    subtitle: k('ctaSub'),
    primaryCta: { label: k('ctaBtn'), href: '/register' },
    secondaryCta: { label: k('bookDemo'), href: `mailto:${CONTACT_EMAIL}` },
    checks: [k('ctaHint'), k('ctaCancelAnytime')],
  },
  faq: {
    title: k('faqTitle'),
    subtitle: k('faqSub'),
    items: [
      { question: k('faqQ1'), answer: k('faqA1') },
      { question: k('faqQ2'), answer: k('faqA2') },
      { question: k('faqQ3'), answer: k('faqA3') },
      { question: k('faqQ4'), answer: k('faqA4') },
    ],
  },
  footer: {
    description: k('ftTagline'),
    email: CONTACT_EMAIL,
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com' },
      { platform: 'instagram', url: 'https://www.instagram.com' },
      { platform: 'linkedin', url: 'https://www.linkedin.com' },
      { platform: 'youtube', url: 'https://www.youtube.com' },
    ],
    columns: [
      {
        title: k('ftProduct'),
        links: [
          { label: k('ftFeatures'), href: '/#features' },
          { label: k('ftPricing'), href: '/pricing' },
          { label: k('ftDemo'), href: '/login' },
          { label: k('ftTry'), href: '/register' },
        ],
      },
      {
        title: k('ftResources'),
        links: [
          { label: k('ftBlog'), href: '' },
          { label: k('ftGuide'), href: '' },
          { label: k('ftDocs'), href: '' },
        ],
      },
      {
        title: k('ftCompany'),
        links: [
          { label: k('ftAbout'), href: '' },
          { label: k('ftContact'), href: `mailto:${CONTACT_EMAIL}` },
          { label: k('ftCareers'), href: '' },
        ],
      },
    ],
    newsletterText: k('ftNewsSub'),
  },
};
