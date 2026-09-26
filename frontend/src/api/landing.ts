import type { Lang } from '../types';
import client, { type ApiResponse } from './apiClient';

// Nội dung Landing Page từ DB (bảng landing_sections) — admin sửa ở /admin/landing, lưu nháp
// rồi xuất bản. Landing công khai đọc GET /landing/public (chỉ bản ĐÃ XUẤT BẢN).
// Schema khớp backend dto/landing/LandingContent.java. Chữ hiển thị song ngữ {vi, en}.

export interface L10n {
  vi: string;
  en: string;
}

/** href: đường dẫn nội bộ ("/pricing", "/#features"), http(s):// hoặc mailto:. */
export interface LandingLink {
  label: L10n;
  href: string;
}

export interface HeroContent {
  badge: L10n;
  titleLine1: L10n;
  titleHighlight: L10n;
  subtitle: L10n;
  primaryCta: LandingLink;
  secondaryCta: LandingLink;
  stats: { value: number; suffix: string; label: L10n }[];
}

export interface FeaturesContent {
  title: L10n;
  subtitle: L10n;
  items: { icon: string; title: L10n; description: L10n }[];
}

/** Số thứ tự bước = vị trí trong danh sách (01, 02…). */
export interface HowItWorksContent {
  title: L10n;
  subtitle: L10n;
  steps: { title: L10n; description: L10n }[];
}

/** Mỗi nền tảng dùng icon có sẵn HOẶC ảnh logo (logoUrl ưu tiên nếu có). */
export interface IntegrationsContent {
  title: L10n;
  platforms: { name: string; icon: string | null; logoUrl: string | null }[];
}

export interface CtaContent {
  badge: L10n;
  title: L10n;
  subtitle: L10n;
  primaryCta: LandingLink;
  secondaryCta: LandingLink;
  checks: L10n[];
}

export interface FaqContent {
  title: L10n;
  subtitle: L10n;
  items: { question: L10n; answer: L10n }[];
}

export interface FooterContent {
  description: L10n;
  email: string;
  socials: { platform: string; url: string }[];
  /** href trống = chỉ hiện chữ (mục chưa có trang). */
  columns: { title: L10n; links: LandingLink[] }[];
  newsletterText: L10n;
}

export interface LandingContent {
  hero: HeroContent;
  features: FeaturesContent;
  how_it_works: HowItWorksContent;
  integrations: IntegrationsContent;
  cta: CtaContent;
  faq: FaqContent;
  footer: FooterContent;
}

export type LandingSectionKey = keyof LandingContent;

export interface LandingSectionDto<K extends LandingSectionKey = LandingSectionKey> {
  key: K;
  draft: LandingContent[K];
  published: LandingContent[K];
  hasUnpublishedChanges: boolean;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
}

/** Mã lỗi backend (ErrorCode 2100–2102). */
export const ERR_LANDING_CONTENT_INVALID = 2101;
export const ERR_LANDING_VERSION_CONFLICT = 2102;

/** Chữ theo ngôn ngữ đang bật; thiếu bản dịch thì lùi về tiếng Việt. */
export const tr = (text: L10n | null | undefined, lang: Lang): string =>
  (lang === 'en' ? text?.en || text?.vi : text?.vi || text?.en) ?? '';

export async function getPublicLanding(): Promise<Partial<LandingContent>> {
  const { data } = await client.get<ApiResponse<Partial<LandingContent>>>('/landing/public');
  return data.result;
}

export async function getAdminLanding(): Promise<LandingSectionDto[]> {
  const { data } = await client.get<ApiResponse<LandingSectionDto[]>>('/admin/landing');
  return data.result;
}

export async function saveLandingDraft<K extends LandingSectionKey>(
  key: K, content: LandingContent[K], version: number,
): Promise<LandingSectionDto<K>> {
  const { data } = await client.put<ApiResponse<LandingSectionDto<K>>>(`/admin/landing/${key}`, { content, version });
  return data.result;
}

export async function publishLandingSection<K extends LandingSectionKey>(key: K): Promise<LandingSectionDto<K>> {
  const { data } = await client.post<ApiResponse<LandingSectionDto<K>>>(`/admin/landing/${key}/publish`);
  return data.result;
}

export async function publishAllLanding(): Promise<LandingSectionDto[]> {
  const { data } = await client.post<ApiResponse<LandingSectionDto[]>>('/admin/landing/publish');
  return data.result;
}

export async function discardLandingDraft<K extends LandingSectionKey>(key: K): Promise<LandingSectionDto<K>> {
  const { data } = await client.post<ApiResponse<LandingSectionDto<K>>>(`/admin/landing/${key}/discard`);
  return data.result;
}
