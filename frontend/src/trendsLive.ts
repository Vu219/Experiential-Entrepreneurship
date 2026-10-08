// Map kết quả Trend Research THẬT (backend /trend-research) → shape UI của trang Trends.
// Trang giữ nguyên các component hiện có; khi có phiên COMPLETED thì dữ liệu thật thay mock
// (trendsData.ts chỉ còn là fallback demo khi backend chưa chạy / chưa có phiên nào).
//
// Bảng trend của dữ liệu thật hiển thị ĐÀ (momentum so với các phiên trước) và BẰNG CHỨNG (số nguồn
// thật + độ tin cậy) — không bịa số tăng trưởng/tương tác. `growth` giữ điểm phù hợp để sắp xếp.
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
  ResearchSuitability,
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

const LEVEL_FIT: Record<ResearchSuitability, FitLevel> = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

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

export function liveTrendItems(session: ResearchSessionDetail, _lang: Lang, startIndex = 0): TrendItem[] {
  return session.trends.map((tr, i) => {
    const score = tr.relevanceScore ?? 0;
    const pct = Math.round(score * 100);
    const up = tr.momentum ? tr.momentum !== 'FADING' : score >= 0.4;
    const evidence = tr.evidence ?? [];
    return {
      id: tr.id,
      name: tr.trendName,
      hashtag: tr.hashtags?.[0] ?? hashtagOf(tr.trendName),
      desc: tr.description ?? '',
      emoji: EMOJIS[(startIndex + i) % EMOJIS.length],
      tint: TINTS[(startIndex + i) % TINTS.length],
      industry: session.industry,
      platforms: [PLATFORM_TAG[tr.platform] ?? 'FB'],
      fit: tr.relevance ? LEVEL_FIT[tr.relevance] : fitOf(tr.relevanceScore),
      spark: up ? spark(24, 40 + pct / 2) : spark(40 + pct / 2, 24),
      growth: `${pct}%`,
      up,
      engagement: `${evidence.length}`,
      engagementDelta: '',
      ideaCount: tr.contentIdeas.length,
      momentum: tr.momentum ?? undefined,
      actBy: tr.actBy ?? undefined,
      confidence: tr.confidence ? LEVEL_FIT[tr.confidence] : undefined,
      evidence: tr.momentum || evidence.length ? evidence : undefined,
    };
  });
}

/**
 * Gộp trend + idea của N phiên COMPLETED gần nhất (nhiều phiên MỖI nền tảng — research lại
 * KHÔNG ghi đè kết quả cũ trên màn hình). Trend trùng tên trong cùng nền tảng được khử trùng
 * lặp: giữ bản của phiên MỚI NHẤT (sessions truyền vào đã sắp mới nhất trước), idea của bản
 * cũ được nối lại vào trend giữ lại (remap trendId) nên không mất ý tưởng nào.
 */
export function mergedLiveData(sessions: ResearchSessionDetail[], lang: Lang): { trends: TrendItem[]; ideas: ContentIdea[] } {
  const keptByKey = new Map<string, TrendItem>();
  const idRemap = new Map<string, string>(); // id trend trùng (cũ) → id trend giữ lại
  const trends: TrendItem[] = [];
  let offset = 0;
  for (const s of sessions) {
    for (const item of liveTrendItems(s, lang, offset)) {
      const key = `${item.platforms[0]}|${item.name.trim().toLowerCase()}`;
      const kept = keptByKey.get(key);
      if (kept) idRemap.set(item.id, kept.id);
      else {
        keptByKey.set(key, item);
        trends.push(item);
      }
    }
    offset += s.trends.length;
  }

  const ideas: ContentIdea[] = sessions.flatMap((s) =>
    liveContentIdeas(s, lang).map((idea) => {
      const target = idRemap.get(idea.trendId);
      return target ? { ...idea, trendId: target } : idea;
    }),
  );

  // ideaCount tính lại theo idea đã gộp/remap (trend giữ lại nhận cả idea của bản trùng).
  const countByTrend = new Map<string, number>();
  ideas.forEach((i) => countByTrend.set(i.trendId, (countByTrend.get(i.trendId) ?? 0) + 1));
  trends.forEach((t) => {
    t.ideaCount = countByTrend.get(t.id) ?? 0;
  });
  return { trends, ideas };
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
      desc: idea.ideaDescription ?? undefined,
      suggestions: idea.executionSuggestions?.length ? idea.executionSuggestions : undefined,
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
        platformTags: [PLATFORM_TAG[s.platform] ?? 'FB'],
        trendsFound: s.trendsFound,
        ideasCreated: s.ideasCreated,
        duration: p('—', '—'),
      };
    });
}

/** 4 thẻ thống kê — tính trên trends/ideas ĐANG HIỂN THỊ (đã gộp phiên, khử trùng lặp,
 *  lọc trend user đã xóa) để số liệu luôn khớp với bảng. */
export function liveTrendStats(sessions: ResearchSessionDetail[], trends: TrendItem[], ideas: ContentIdea[], lang: Lang): TrendStat[] {
  const d = getDict(lang);
  const p = (vi: string, en: string) => (lang === 'en' ? en : vi);

  const trendCount = trends.length;
  const ideaCount = ideas.length;
  const highCount = trends.filter((tr) => tr.fit === 'high').length;
  const highPct = trendCount > 0 ? Math.round((highCount / trendCount) * 100) : 0;

  const latestTime = Math.max(...sessions.map((s) => new Date(s.researchTime).getTime()));
  const when = new Date(latestTime);
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

/** Tên miền của nguồn (link Gemini là redirect — tiêu đề đã là tên miền), lỗi URL → tiêu đề. */
export function sourceLabel(url: string, title: string): string {
  if (!url || url.includes('grounding-api-redirect')) return title;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return title;
  }
}
