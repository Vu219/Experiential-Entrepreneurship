// Map kết quả Trend Research THẬT (backend /trend-research) → shape UI của trang Trends.
// Trang giữ nguyên các component hiện có; khi có phiên COMPLETED thì dữ liệu thật thay mock
// (trendsData.ts chỉ còn là fallback demo khi backend chưa chạy / chưa có phiên nào).
//
// Lưu ý: growth/engagement của bảng trend hiển thị ĐIỂM PHÙ HỢP (relevance score) do AI chấm —
// chưa có analytics tương tác thật ở giai đoạn này (FR-58+ chưa build).
import { Flame, Lightbulb, Target, Clock } from 'lucide-react';
import type { Lang } from './types';
import { getDict } from './i18n';
import {
  TINTS,
  spark,
  type ContentIdea,
  type FitLevel,
  type ResearchSession,
  type TrendItem,
  type TrendStat,
} from './trendsData';
import type {
  ResearchPlatform,
  ResearchSessionDetail,
  ResearchSessionSummary,
} from './api/trendResearch';

const EMOJIS = ['🔥', '✨', '💡', '📈', '🎯', '🌟', '🚀', '💬'];

const PLATFORM_TAG: Record<ResearchPlatform, string> = { FACEBOOK: 'FB', INSTAGRAM: 'IG', THREADS: 'TH' };

const IDEA_SCORE: Record<string, number> = { HIGH: 90, MEDIUM: 75, LOW: 60 };

/** Từ khóa format trong tiêu đề ý tưởng → nhãn format của IdeaCard. */
const FORMAT_KEYWORDS: [RegExp, string][] = [
  [/reels?/i, 'Reels'],
  [/carousel/i, 'Carousel'],
  [/thread/i, 'Thread'],
  [/story/i, 'Story'],
  [/video/i, 'Video'],
];

const fitOf = (score: number | null): FitLevel =>
  (score ?? 0) >= 0.7 ? 'high' : (score ?? 0) >= 0.4 ? 'medium' : 'low';

/** '#TenTrend' từ tên trend (tối đa 3 từ đầu, bỏ ký tự đặc biệt). */
const hashtagOf = (name: string): string =>
  '#' +
  name
    .split(/\s+/)
    .slice(0, 3)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');

const two = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtTime = (d: Date) => {
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  const h = d.getHours() % 12 || 12;
  return `${two(h)}:${two(d.getMinutes())} ${ampm}`;
};

export function liveTrendItems(session: ResearchSessionDetail, _lang: Lang): TrendItem[] {
  return session.trends.map((tr, i) => {
    const score = tr.relevanceScore ?? 0;
    const pct = Math.round(score * 100);
    const up = score >= 0.4;
    return {
      id: tr.id,
      name: tr.trendName,
      hashtag: hashtagOf(tr.trendName),
      desc: tr.description ?? '',
      emoji: EMOJIS[i % EMOJIS.length],
      tint: TINTS[i % TINTS.length],
      industry: session.industry,
      platforms: [PLATFORM_TAG[tr.platform] ?? 'FB'],
      fit: fitOf(tr.relevanceScore),
      spark: up ? spark(24, 40 + pct / 2) : spark(40 + pct / 2, 24),
      growth: `${pct}%`,
      up,
      engagement: `${pct}/100`,
      engagementDelta: '',
      ideaCount: tr.contentIdeas.length,
    };
  });
}

export function liveContentIdeas(session: ResearchSessionDetail, lang: Lang): ContentIdea[] {
  const p = (vi: string, en: string) => (lang === 'en' ? en : vi);
  return session.trends.flatMap((tr) =>
    tr.contentIdeas.map((idea) => ({
      id: idea.id,
      trendId: tr.id,
      title: idea.ideaTitle,
      platform: PLATFORM_TAG[idea.platform] ?? 'FB',
      format: FORMAT_KEYWORDS.find(([re]) => re.test(idea.ideaTitle))?.[1] ?? p('Bài viết', 'Post'),
      score: IDEA_SCORE[idea.suitabilityLevel ?? 'MEDIUM'] ?? 75,
      status: 'new' as const,
    })),
  );
}

export function liveResearchSessions(summaries: ResearchSessionSummary[], lang: Lang): ResearchSession[] {
  const p = (vi: string, en: string) => (lang === 'en' ? en : vi);
  return summaries
    .filter((s) => s.status === 'COMPLETED' || s.status === 'FAILED')
    .map((s) => {
      const d = new Date(s.researchTime);
      return {
        id: s.id,
        date: fmtDate(d),
        time: fmtTime(d),
        status: s.status === 'COMPLETED' ? ('done' as const) : ('cancelled' as const),
        industry: s.industry,
        platforms: 1, // mỗi phiên gắn 1 nền tảng chính
        trendsFound: s.trendsFound,
        ideasCreated: s.ideasCreated,
        duration: p('—', '—'),
      };
    });
}

export function liveTrendStats(session: ResearchSessionDetail, lang: Lang): TrendStat[] {
  const d = getDict(lang);
  const p = (vi: string, en: string) => (lang === 'en' ? en : vi);

  const trendCount = session.trends.length;
  const ideaCount = session.trends.reduce((sum, tr) => sum + tr.contentIdeas.length, 0);
  const highCount = session.trends.filter((tr) => fitOf(tr.relevanceScore) === 'high').length;
  const highPct = trendCount > 0 ? Math.round((highCount / trendCount) * 100) : 0;

  const when = new Date(session.researchTime);
  const today = new Date();
  const sameDay = when.toDateString() === today.toDateString();
  const whenLabel = `${sameDay ? p('Hôm nay', 'Today') : fmtDate(when)}, ${fmtTime(when)}`;

  return [
    { value: `${trendCount}`, label: d.trStatNew, icon: Flame, iconBg: 'linear-gradient(135deg,#ffe9f3,#fff3e0)', iconColor: '#ec4899' },
    { value: `${ideaCount}`, label: d.trStatIdeas, icon: Lightbulb, iconBg: 'linear-gradient(135deg,#f1e9ff,#e9f0ff)', iconColor: '#8b5cf6' },
    { value: `${highCount}`, label: d.trStatHigh, delta: `${highPct}%`, deltaLabel: d.trOfTotal, deltaColor: '#7c3aed', icon: Target, iconBg: 'linear-gradient(135deg,#e7fff4,#e9f7ff)', iconColor: '#10b981' },
    { value: whenLabel, label: d.trStatLast, badge: d.trDone, icon: Clock, iconBg: 'linear-gradient(135deg,#e7f6ff,#eef2ff)', iconColor: '#3b82f6' },
  ];
}
