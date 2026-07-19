import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search, Play, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { Card, Icon } from '../../components/ui.tsx';
import PageContainer from '../../components/PageContainer.tsx';
import Pagination from '../../components/admin/Pagination.tsx';
import { PLATFORMS } from '../../theme.ts';
import { trendStats, trendItems, contentIdeas, researchSessions, type ContentIdea, type FitLevel, type ResearchSession, type TrendsTab } from '../../trendsData.ts';
import { mergedLiveData, liveResearchSessions, liveTrendStats } from '../../trendsLive.ts';
import {
  deleteTrends as apiDeleteTrends,
  getTrendResearchSession,
  listTrendResearchSessions,
  startTrendResearch,
  type ResearchSessionDetail,
  type ResearchSessionSummary,
} from '../../api/trendResearch.ts';
import { useToast } from '../../components/toast/ToastProvider';
import TrendStatCards from '../../components/trends/TrendStatCards.tsx';
import TrendTable from '../../components/trends/TrendTable.tsx';
import IdeaCard from '../../components/trends/IdeaCard.tsx';
import IdeaDetailModal from '../../components/trends/IdeaDetailModal.tsx';
import SessionDetailModal from '../../components/trends/SessionDetailModal.tsx';
import ResearchHistoryItem from '../../components/trends/ResearchHistoryItem.tsx';
import TrendsSidebar from '../../components/trends/TrendsSidebar.tsx';
import TrendsSkeleton from '../../components/trends/TrendsSkeleton.tsx';
import HowItWorks from '../../components/trends/HowItWorks.tsx';
import ResearchStartModal, { type ResearchStartConfig } from '../../components/trends/ResearchStartModal.tsx';
import ScheduleModal from '../../components/trends/ScheduleModal.tsx';
import { loadTrendSchedule, saveTrendSchedule, type TrendSchedule } from '../../trendsSchedule.ts';
import { FilterSelect } from '../../components/trends/filters.tsx';

const HISTORY_PAGE_SIZE = 7;
// Poll phiên research nền (NFR-04): 4s/lần, tối đa 5 phút MỖI nền tảng.
const POLL_INTERVAL_MS = 4000;
const POLL_MAX_TRIES = 75;

const SAVED_IDS_KEY = 'aima_saved_ideas';
const PINNED_KEY = 'aima_pinned_trends';
const DELETED_KEY = 'aima_deleted_trends';

// Gộp tối đa N phiên COMPLETED gần nhất MỖI nền tảng — research lại bổ sung thay vì
// ghi đè kết quả đang hiển thị (trend trùng tên được khử trùng lặp trong mergedLiveData).
const MERGE_SESSIONS_PER_PLATFORM = 3;

/** Xếp hạng độ phù hợp cho bộ lọc "tối thiểu" (advanced). */
const FIT_RANK: Record<FitLevel, number> = { low: 0, medium: 1, high: 2 };

const PLATFORM_NAME: Record<string, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

/** Dữ liệu thật từ backend; null = backend chưa chạy → dùng mock demo (trendsData.ts). */
interface LiveData {
  /** Phiên COMPLETED mới nhất của MỖI nền tảng (kèm trends + ideas) — gộp hiển thị chung. */
  sessions: ResearchSessionDetail[];
  summaries: ResearchSessionSummary[];
}

const loadIdSet = (key: string): Set<string> => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
};

const saveIdSet = (key: string, ids: Set<string>) => localStorage.setItem(key, JSON.stringify([...ids]));

export default function Trends() {
  const { t, lang, go } = useApp();
  const toast = useToast();
  const { width, isMobile } = useBreakpoint();

  // Breakpoint trang: <760 mobile · 760–899 sidebar xuống dưới · ≥900 hai cột (sticky) · ≥1440 nới rộng
  const sideBySide = width >= 900;
  const sidebarW = width >= 1200 ? 320 : 280;
  const ideaCols = width >= 1440 ? 3 : isMobile ? 1 : 2;
  const ideaPageSize = ideaCols === 3 ? 9 : ideaCols === 2 ? 6 : 4;

  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [tab, setTab] = useState<TrendsTab>('hot');
  const [q, setQ] = useState('');
  // Bộ lọc sub-tab "Trend nổi bật"
  const [industryF, setIndustryF] = useState('all');
  const [platformF, setPlatformF] = useState('all');
  const [fitF, setFitF] = useState('all');
  const [timeF, setTimeF] = useState('7d');
  // Bộ lọc nâng cao sub-tab "Trend nổi bật" (đồng bộ với bộ lọc trong modal Research)
  const [advOpen, setAdvOpen] = useState(false);
  const [minFitF, setMinFitF] = useState<'all' | 'high' | 'medium'>('all');
  const [sortBy, setSortBy] = useState<'none' | 'growth' | 'engagement' | 'ideas'>('none');
  const [onlyWithIdeas, setOnlyWithIdeas] = useState(false);
  // Bộ lọc sub-tab "Ý tưởng content"
  const [ideaTrendF, setIdeaTrendF] = useState('all');
  const [ideaPlatformF, setIdeaPlatformF] = useState('all');
  const [ideaStatusF, setIdeaStatusF] = useState('all');
  // Phân trang + trạng thái cục bộ khác
  const [ideaPage, setIdeaPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  // "Lưu ý tưởng" bền vững qua localStorage (mất backend endpoint riêng cho saved-idea)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => loadIdSet(SAVED_IDS_KEY));
  // Ghim trend (nổi lên đầu bảng) + trend đã xóa (ẩn ngay; dữ liệu thật còn soft delete backend)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => loadIdSet(PINNED_KEY));
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => loadIdSet(DELETED_KEY));
  // Chế độ chọn nhiều trend để xóa
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  // Dữ liệu thật + trạng thái "Research ngay"
  const [live, setLive] = useState<LiveData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [researching, setResearching] = useState(false);
  const [researchProgress, setResearchProgress] = useState('');
  const [startOpen, setStartOpen] = useState(false);
  // Modal chi tiết ý tưởng / phiên + lịch tự động
  const [detailIdea, setDetailIdea] = useState<ContentIdea | null>(null);
  const [detailSession, setDetailSession] = useState<ResearchSession | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedule, setSchedule] = useState<TrendSchedule | null>(loadTrendSchedule);

  // Tải dữ liệu thật từ backend (/trend-research); backend chưa chạy / lỗi → giữ mock demo.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const summaries = await listTrendResearchSessions();
        // Gộp tối đa MERGE_SESSIONS_PER_PLATFORM phiên COMPLETED gần nhất của MỖI nền tảng
        // (summaries đã sắp mới nhất trước) → research lại KHÔNG ghi đè kết quả cũ trên màn
        // hình, và research nhiều nền tảng lần lượt thấy đủ FB + IG + TH.
        const perPlatform = new Map<string, ResearchSessionSummary[]>();
        for (const s of summaries) {
          if (s.status !== 'COMPLETED') continue;
          const list = perPlatform.get(s.platform) ?? [];
          if (list.length < MERGE_SESSIONS_PER_PLATFORM) {
            list.push(s);
            perPlatform.set(s.platform, list);
          }
        }
        const picked = [...perPlatform.values()]
          .flat()
          .sort((a, b) => new Date(b.researchTime).getTime() - new Date(a.researchTime).getTime());
        const sessions = await Promise.all(picked.map((s) => getTrendResearchSession(s.id)));
        if (!cancelled) setLive({ sessions, summaries });
      } catch {
        if (!cancelled) setLive(null);
      }
      if (!cancelled) setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, reloadKey]);

  // FR-19 "Research ngay": chọn hồ sơ + chiến lược + N nền tảng trong ResearchStartModal.
  // Backend chặn phiên song song (mã 1912) → research LẦN LƯỢT từng nền tảng rồi tải lại dữ liệu.
  const runResearch = async (config: ResearchStartConfig) => {
    if (researching) return;
    setResearching(true);
    const failed: string[] = [];
    try {
      for (let pi = 0; pi < config.platforms.length; pi++) {
        const platform = config.platforms[pi];
        setResearchProgress(`${PLATFORM_NAME[platform] ?? platform} (${pi + 1}/${config.platforms.length})`);
        try {
          const started = await startTrendResearch({
            brandProfileId: config.brandProfileId,
            strategyId: config.strategyId,
            platform,
            articleCount: config.articleCount,
          });
          let ok = false;
          for (let i = 0; i < POLL_MAX_TRIES; i++) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            const s = await getTrendResearchSession(started.id);
            if (s.status === 'COMPLETED') {
              ok = true;
              break;
            }
            if (s.status === 'FAILED') throw new Error(s.errorMessage || t.trResearchFailed);
          }
          if (!ok) throw new Error(t.trResearchFailed);
        } catch {
          failed.push(PLATFORM_NAME[platform] ?? platform);
        }
      }
      if (failed.length === config.platforms.length) {
        toast.error(t.trResearchFailed);
      } else {
        setReloadKey((k) => k + 1);
        // KHÔNG tự đặt bộ lọc nền tảng sau research — kết quả mới được GỘP THÊM vào danh
        // sách chung; tự lọc từng làm người dùng tưởng dữ liệu cũ bị mất/ghi đè.
        // Áp bộ lọc nâng cao đã chọn cho kết quả (client-side)
        if (config.advanced) {
          setTimeF(config.advanced.time);
          setMinFitF(config.advanced.minFit);
          if (config.advanced.minFit !== 'all') setAdvOpen(true);
          if (config.advanced.keyword) setQ(config.advanced.keyword);
        }
        if (failed.length > 0) toast.warning(`${t.trResearchPartlyFailed} ${failed.join(', ')}`);
        else toast.success(t.trResearchDone);
      }
    } finally {
      setResearching(false);
      setResearchProgress('');
    }
  };

  const liveSessions = useMemo(() => live?.sessions ?? [], [live]);
  const hasLiveResults = liveSessions.length > 0;
  const isLiveData = !!(live && live.summaries.length > 0);
  // Gộp phiên + khử trùng lặp; sau đó ẨN các trend user đã xóa (deletedIds) khỏi mọi nơi
  // (bảng, ý tưởng, thẻ thống kê, sidebar) — dữ liệu thật còn được soft delete ở backend.
  const merged = useMemo(() => (hasLiveResults ? mergedLiveData(liveSessions, lang) : null), [hasLiveResults, liveSessions, lang]);
  const allTrends = useMemo(() => {
    const base = merged ? merged.trends : trendItems(lang);
    return deletedIds.size > 0 ? base.filter((tr) => !deletedIds.has(tr.id)) : base;
  }, [merged, lang, deletedIds]);
  const allIdeas = useMemo(() => {
    const base = merged ? merged.ideas : contentIdeas(lang);
    return deletedIds.size > 0 ? base.filter((idea) => !deletedIds.has(idea.trendId)) : base;
  }, [merged, lang, deletedIds]);
  const sessions = useMemo(
    () => (live && live.summaries.length > 0 ? liveResearchSessions(live.summaries, lang) : researchSessions(lang)),
    [live, lang],
  );
  const stats = useMemo(
    () => (hasLiveResults ? liveTrendStats(liveSessions, allTrends, allIdeas, lang) : trendStats(lang)),
    [hasLiveResults, liveSessions, allTrends, allIdeas, lang],
  );
  const trendNameById = useMemo(() => new Map(allTrends.map((tr) => [tr.id, tr.name])), [allTrends]);

  const industries = useMemo(() => [...new Set(allTrends.map((tr) => tr.industry))], [allTrends]);

  // Gõ tìm kiếm: input phản hồi ngay, phần lọc/render danh sách chạy ở độ ưu tiên thấp
  // (useDeferredValue) — bảng trend không còn giật theo từng phím.
  const deferredQ = useDeferredValue(q);
  const query = deferredQ.trim().toLowerCase();
  const filteredTrends = useMemo(() => {
    const minRank = minFitF === 'all' ? 0 : FIT_RANK[minFitF];
    const rows = allTrends.filter(
      (tr) =>
        (industryF === 'all' || tr.industry === industryF) &&
        (platformF === 'all' || tr.platforms.includes(platformF)) &&
        (fitF === 'all' || tr.fit === fitF) &&
        FIT_RANK[tr.fit] >= minRank &&
        (!onlyWithIdeas || tr.ideaCount > 0) &&
        (!query || `${tr.name} ${tr.hashtag} ${tr.desc}`.toLowerCase().includes(query)),
    );
    const num = (s: string) => parseFloat(s.replace(/[^\d.-]/g, '')) || 0;
    const sorted =
      sortBy === 'none'
        ? rows
        : [...rows].sort((a, b) =>
            sortBy === 'growth' ? num(b.growth) - num(a.growth)
              : sortBy === 'engagement' ? num(b.engagement) - num(a.engagement)
              : b.ideaCount - a.ideaCount,
          );
    // Trend đã ghim luôn nổi lên đầu (sort ổn định — giữ nguyên thứ tự trong từng nhóm)
    if (pinnedIds.size === 0) return sorted;
    return [...sorted].sort((a, b) => Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id)));
  }, [allTrends, industryF, platformF, fitF, minFitF, onlyWithIdeas, sortBy, query, pinnedIds]);

  const filteredIdeas = useMemo(
    () =>
      allIdeas.filter(
        (idea) =>
          (ideaTrendF === 'all' || idea.trendId === ideaTrendF) &&
          (ideaPlatformF === 'all' || idea.platform === ideaPlatformF) &&
          (ideaStatusF === 'all' || (savedIds.has(idea.id) && idea.status === 'new' ? 'saved' : idea.status) === ideaStatusF) &&
          (!query || `${idea.title} ${trendNameById.get(idea.trendId) ?? ''}`.toLowerCase().includes(query)),
      ),
    [allIdeas, ideaTrendF, ideaPlatformF, ideaStatusF, savedIds, query, trendNameById],
  );

  // Phân trang ý tưởng / lịch sử — kẹp trang khi bộ lọc làm giảm tổng số
  const ideaPageCount = Math.max(1, Math.ceil(filteredIdeas.length / ideaPageSize));
  const safeIdeaPage = Math.min(ideaPage, ideaPageCount);
  const ideaStart = (safeIdeaPage - 1) * ideaPageSize;
  const pagedIdeas = filteredIdeas.slice(ideaStart, ideaStart + ideaPageSize);

  const historyPageCount = Math.max(1, Math.ceil(sessions.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyPageCount);
  const historyStart = (safeHistoryPage - 1) * HISTORY_PAGE_SIZE;
  const pagedSessions = sessions.slice(historyStart, historyStart + HISTORY_PAGE_SIZE);

  // Callback ổn định (useCallback) để các component con memo hóa không render lại vô ích.
  const viewIdeasOf = useCallback((trendId: string) => {
    setIdeaTrendF(trendId);
    setIdeaPage(1);
    setTab('ideas');
  }, []);

  const toggleSave = useCallback(
    (id: string) =>
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          toast.info(t.trUnsavedToast);
        } else {
          next.add(id);
          toast.success(t.trSavedToast);
        }
        localStorage.setItem(SAVED_IDS_KEY, JSON.stringify([...next]));
        return next;
      }),
    [toast, t],
  );

  const togglePin = useCallback(
    (id: string) =>
      setPinnedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        saveIdSet(PINNED_KEY, next);
        return next;
      }),
    [],
  );

  const toggleSelect = useCallback(
    (id: string) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  const cancelSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // Xóa các trend đã chọn: dữ liệu thật → soft delete backend rồi ẩn; mock → chỉ ẩn (localStorage).
  const deleteSelected = async () => {
    if (selectedIds.size === 0 || deleting) return;
    setDeleting(true);
    try {
      if (isLiveData) await apiDeleteTrends([...selectedIds]);
      setDeletedIds((prev) => {
        const next = new Set(prev);
        selectedIds.forEach((id) => next.add(id));
        saveIdSet(DELETED_KEY, next);
        return next;
      });
      toast.success(`${t.trDeletedToast} ${selectedIds.size} ${t.trTrendUnit}`);
      cancelSelect();
    } catch (e) {
      toast.error((e as Error).message || t.trDeleteFailed);
    } finally {
      setDeleting(false);
    }
  };

  const goCreate = useCallback(() => go('create'), [go]);
  const openIdeaDetail = useCallback((idea: ContentIdea) => setDetailIdea(idea), []);
  const openSessionDetail = useCallback((s: ResearchSession) => setDetailSession(s), []);
  const viewHistory = useCallback(() => {
    setHistoryPage(1);
    setTab('history');
  }, []);
  const editSchedule = useCallback(() => setScheduleOpen(true), []);

  const clearIdeaFilters = () => {
    setIdeaTrendF('all');
    setIdeaPlatformF('all');
    setIdeaStatusF('all');
    setQ('');
    setIdeaPage(1);
  };

  // Trend demo cho modal chi tiết phiên MOCK: xoay danh sách theo vị trí phiên để mỗi phiên
  // hiển thị một tập trend khác nhau (dữ liệu demo — phiên thật fetch theo id trong modal).
  const demoTrendsFor = (s: ResearchSession) => {
    if (s.trendsFound === 0) return [];
    const idx = Math.max(0, sessions.findIndex((x) => x.id === s.id));
    const rot = (idx * 5) % allTrends.length;
    return [...allTrends.slice(rot), ...allTrends.slice(0, rot)].slice(0, Math.min(s.trendsFound, 8));
  };

  // Ngày ghi nhận trend cho modal chi tiết ý tưởng = ngày phiên gần nhất (nguồn của ý tưởng).
  const trendDateLabel = sessions[0] ? `${sessions[0].date} · ${sessions[0].time}` : '—';

  const saveSchedule = (s: TrendSchedule) => {
    saveTrendSchedule(s);
    setSchedule(s);
    setScheduleOpen(false);
    toast.success(t.trScheduleSaved);
  };

  const platformOptions = [{ value: 'all', label: t.trAllPlatforms }, ...PLATFORMS.map((p) => ({ value: p.tag, label: p.name }))];

  const tabs: [TrendsTab, string][] = [
    ['hot', t.trTabHot],
    ['ideas', t.trTabIdeas],
    ['history', t.trTabHistory],
  ];

  // Hàng bộ lọc: mobile xếp dọc full-width, còn lại nằm ngang wrap
  const filterRowStyle = {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
    flexDirection: isMobile ? ('column' as const) : ('row' as const),
    alignItems: isMobile ? ('stretch' as const) : ('center' as const),
  };

  if (status === 'loading') return <TrendsSkeleton tab={tab} />;

  return (
    <PageContainer>
      {/* Header trang */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 22, color: '#211c38' }}>{t.trTitle}</div>
          <div style={{ fontSize: 13, color: '#8a85a0', marginTop: 3 }}>{t.trSubtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: isMobile ? '1 1 100%' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #ece8f6', borderRadius: 12, padding: '9px 14px', flex: isMobile ? 1 : 'none', width: isMobile ? 'auto' : 260 }}>
            <Search size={16} color="#a39bbf" strokeWidth={1.8} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.trSearchPh}
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: '#241f3a' }}
            />
          </div>
          <button
            type="button"
            className="btn-grad"
            onClick={() => setStartOpen(true)}
            disabled={researching}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 12, padding: '10px 18px', fontWeight: 700, fontSize: 13.5, color: '#fff', background: 'var(--brand)', cursor: researching ? 'wait' : 'pointer', opacity: researching ? 0.7 : 1, boxShadow: '0 14px 26px -12px rgba(139,92,246,.6)' }}
          >
            <Icon icon={Play} size={15} stroke="#fff" />
            {researching ? (researchProgress ? `${t.trResearchStep} ${researchProgress}` : t.trResearching) : t.trResearchNow}
          </button>
        </div>
      </div>

      {/* 4 thẻ thống kê */}
      <TrendStatCards stats={stats} />

      {/* Nội dung chính + sidebar phải (≥900px hai cột + sticky, dưới 900px sidebar xuống dưới) */}
      <div style={{ display: 'grid', gridTemplateColumns: sideBySide ? `minmax(0,1fr) ${sidebarW}px` : '1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Thanh sub-tab */}
          <div style={{ display: 'inline-flex', alignSelf: 'flex-start', gap: 4, background: '#f4f2fb', border: '1px solid #ece8f6', borderRadius: 12, padding: 4, flexWrap: 'wrap', maxWidth: '100%' }}>
            {tabs.map(([key, label]) => {
              const on = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-pressed={on}
                  style={{ border: 'none', borderRadius: 9, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: on ? '#6d28d9' : '#6b6680', background: on ? '#fff' : 'transparent', boxShadow: on ? '0 4px 10px -6px rgba(80,40,140,.4)' : 'none', transition: 'background .15s, color .15s' }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Sub-tab: Trend nổi bật */}
          {tab === 'hot' && (
            <>
              <div style={filterRowStyle}>
                <FilterSelect fullWidth={isMobile} label={t.trIndustry} value={industryF} onChange={setIndustryF} options={[{ value: 'all', label: t.trAll }, ...industries.map((ind) => ({ value: ind, label: ind }))]} />
                <FilterSelect fullWidth={isMobile} label={t.trPlatform} value={platformF} onChange={setPlatformF} options={platformOptions} />
                <FilterSelect fullWidth={isMobile} label={t.trFit} value={fitF} onChange={setFitF} options={[{ value: 'all', label: t.trAll }, { value: 'high', label: t.trFitHigh }, { value: 'medium', label: t.trFitMed }, { value: 'low', label: t.trFitLow }]} />
                <FilterSelect fullWidth={isMobile} label={t.trTime} value={timeF} onChange={setTimeF} options={[{ value: '7d', label: t.trLast7d }, { value: '30d', label: t.trLast30d }]} />
                <button
                  type="button"
                  onClick={() => setAdvOpen((o) => !o)}
                  aria-expanded={advOpen}
                  className="btn-outline"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: advOpen ? '1.5px solid #8b5cf6' : '1px solid #ece8f6', background: advOpen ? '#f6f1ff' : '#fff', color: advOpen ? '#6d28d9' : '#4b4660', fontWeight: 600, fontSize: 12.5, borderRadius: 10, padding: '9px 13px', cursor: 'pointer' }}
                >
                  <Icon icon={SlidersHorizontal} size={14} stroke="#7c3aed" />
                  {t.trAdvFilter}
                </button>
                {/* Xóa nhiều trend không phù hợp: bật chế độ chọn → tick → Xóa (n) */}
                {!selectMode ? (
                  <button
                    type="button"
                    onClick={() => setSelectMode(true)}
                    className="btn-outline"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid #f6d9d9', background: '#fff', color: '#dc2626', fontWeight: 600, fontSize: 12.5, borderRadius: 10, padding: '9px 13px', cursor: 'pointer' }}
                  >
                    <Icon icon={Trash2} size={14} stroke="#dc2626" />
                    {t.trDeleteTrends}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void deleteSelected()}
                      disabled={selectedIds.size === 0 || deleting}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '9px 14px', cursor: selectedIds.size === 0 || deleting ? 'not-allowed' : 'pointer', opacity: selectedIds.size === 0 || deleting ? 0.55 : 1 }}
                    >
                      <Icon icon={Trash2} size={14} stroke="#fff" />
                      {t.trDeleteTrends} ({selectedIds.size})
                    </button>
                    <button
                      type="button"
                      onClick={cancelSelect}
                      className="btn-outline"
                      style={{ border: '1px solid #ece8f6', background: '#fff', color: '#4b4660', fontWeight: 600, fontSize: 12.5, borderRadius: 10, padding: '9px 13px', cursor: 'pointer' }}
                    >
                      {t.cancel}
                    </button>
                    {!isMobile && <span style={{ fontSize: 12, color: '#a39bbf' }}>{t.trSelectHint}</span>}
                  </>
                )}
              </div>
              {advOpen && (
                <div style={filterRowStyle}>
                  <FilterSelect fullWidth={isMobile} label={t.trMinFit} value={minFitF} onChange={(v) => setMinFitF(v as 'all' | 'high' | 'medium')} options={[{ value: 'all', label: t.trAll }, { value: 'medium', label: t.trFitMed }, { value: 'high', label: t.trFitHigh }]} />
                  <FilterSelect fullWidth={isMobile} label={t.trSortBy} value={sortBy} onChange={(v) => setSortBy(v as typeof sortBy)} options={[{ value: 'none', label: t.trAll }, { value: 'growth', label: t.trSortGrowth }, { value: 'engagement', label: t.trColEngage }, { value: 'ideas', label: t.trColIdeas }]} />
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #ece8f6', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#4b4660' }}>
                    <input type="checkbox" checked={onlyWithIdeas} onChange={(e) => setOnlyWithIdeas(e.target.checked)} style={{ accentColor: '#8b5cf6', cursor: 'pointer' }} />
                    {t.trOnlyWithIdeas}
                  </label>
                </div>
              )}
              <TrendTable
                rows={filteredTrends}
                pinnedIds={pinnedIds}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onViewIdeas={viewIdeasOf}
                onTogglePin={togglePin}
                onToggleSelect={toggleSelect}
              />
            </>
          )}

          {/* Sub-tab: Ý tưởng content */}
          {tab === 'ideas' && (
            <>
              <div style={filterRowStyle}>
                <FilterSelect fullWidth={isMobile} label={t.trTrendFilter} value={ideaTrendF} onChange={(v) => { setIdeaTrendF(v); setIdeaPage(1); }} options={[{ value: 'all', label: t.trAllTrends }, ...allTrends.filter((tr) => tr.ideaCount > 0).map((tr) => ({ value: tr.id, label: tr.name }))]} />
                <FilterSelect fullWidth={isMobile} label={t.trPlatform} value={ideaPlatformF} onChange={(v) => { setIdeaPlatformF(v); setIdeaPage(1); }} options={platformOptions} />
                <FilterSelect fullWidth={isMobile} label={t.trStatus} value={ideaStatusF} onChange={(v) => { setIdeaStatusF(v); setIdeaPage(1); }} options={[{ value: 'all', label: t.trAllStatus }, { value: 'new', label: t.trStatusNew }, { value: 'saved', label: t.trStatusSaved }, { value: 'used', label: t.trStatusUsed }]} />
              </div>
              {filteredIdeas.length === 0 ? (
                <Card>
                  <div style={{ padding: '18px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 13.5, color: '#8a85a0' }}>{t.trNoResult}</div>
                    <button
                      type="button"
                      onClick={clearIdeaFilters}
                      className="btn-outline"
                      style={{ border: '1px solid #ece8f6', background: '#fff', color: '#6d28d9', fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}
                    >
                      {t.trClearFilters}
                    </button>
                  </div>
                </Card>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ideaCols},minmax(0,1fr))`, gap: 14 }}>
                    {pagedIdeas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        trendName={trendNameById.get(idea.trendId) ?? ''}
                        saved={savedIds.has(idea.id)}
                        compact={width < 1024 && !isMobile}
                        onCreate={goCreate}
                        onToggleSave={toggleSave}
                        onDetail={openIdeaDetail}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 16 }}>
                      {t.trShowing} {ideaStart + 1}–{ideaStart + pagedIdeas.length}/{filteredIdeas.length} {t.trIdeaUnit}
                    </span>
                    <Pagination page={safeIdeaPage} pageCount={ideaPageCount} onChange={setIdeaPage} />
                  </div>
                </>
              )}
            </>
          )}

          {/* Sub-tab: Lịch sử research */}
          {tab === 'history' && (
            <Card style={{ paddingTop: 12, paddingBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {pagedSessions.map((s, i) => (
                  <div key={s.id} style={{ borderTop: i > 0 ? '1px solid #f4f1fa' : 'none' }}>
                    <ResearchHistoryItem session={s} onDetail={() => setDetailSession(s)} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #f4f1fa' }}>
                <span style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 16 }}>
                  {t.trShowing} {historyStart + 1}–{historyStart + pagedSessions.length}/{sessions.length} {t.trSessionUnit}
                </span>
                <Pagination page={safeHistoryPage} pageCount={historyPageCount} onChange={setHistoryPage} />
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar phải — sticky khi 2 cột; để cao tự nhiên (không giới hạn/cuộn nội bộ) nên 3 card
            (gồm Lịch sử research) hiển thị đủ ngay từ đầu trên laptop, không bị cắt */}
        <div style={sideBySide ? { position: 'sticky', top: 8 } : undefined}>
          <TrendsSidebar
            tab={tab}
            sessions={sessions}
            ideas={allIdeas}
            trends={allTrends}
            savedIds={savedIds}
            schedule={schedule}
            onViewHistory={viewHistory}
            onViewSession={openSessionDetail}
            onEditSchedule={editSchedule}
          />
        </div>
      </div>

      {/* Cách hoạt động — chỉ ở sub-tab Trend nổi bật */}
      {tab === 'hot' && <HowItWorks />}

      {/* Chọn hồ sơ + chiến lược + nền tảng + số ý tưởng trước khi research (FR-19) */}
      {startOpen && (
        <ResearchStartModal
          onClose={() => setStartOpen(false)}
          onStart={(config) => {
            setStartOpen(false);
            void runResearch(config);
          }}
        />
      )}

      {/* Chi tiết ý tưởng content (kèm ngày ghi nhận trend) */}
      {detailIdea && (
        <IdeaDetailModal
          idea={detailIdea}
          trend={allTrends.find((tr) => tr.id === detailIdea.trendId) ?? null}
          trendDate={trendDateLabel}
          saved={savedIds.has(detailIdea.id)}
          onClose={() => setDetailIdea(null)}
          onCreate={() => go('create')}
          onToggleSave={() => toggleSave(detailIdea.id)}
        />
      )}

      {/* Chi tiết phiên research (FR-23) — phiên thật fetch theo id, phiên mock hiện trend demo */}
      {detailSession && (
        <SessionDetailModal
          session={detailSession}
          live={isLiveData}
          demoTrends={demoTrendsFor(detailSession)}
          onClose={() => setDetailSession(null)}
        />
      )}

      {/* Cài đặt lịch research tự động */}
      {scheduleOpen && (
        <ScheduleModal initial={schedule} onClose={() => setScheduleOpen(false)} onSave={saveSchedule} />
      )}
    </PageContainer>
  );
}
