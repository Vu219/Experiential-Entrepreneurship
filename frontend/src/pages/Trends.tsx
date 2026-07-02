import { useEffect, useMemo, useState } from 'react';
import { Search, Play, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Card, Icon } from '../components/ui';
import Pagination from '../components/admin/Pagination';
import { PLATFORMS } from '../theme';
import { trendStats, trendItems, contentIdeas, researchSessions, type TrendsTab } from '../trendsData';
import { liveTrendItems, liveContentIdeas, liveResearchSessions, liveTrendStats } from '../trendsLive';
import {
  getTrendResearchSession,
  listTrendResearchSessions,
  startTrendResearch,
  type ResearchSessionDetail,
  type ResearchSessionSummary,
} from '../api/trendResearch';
import TrendStatCards from '../components/trends/TrendStatCards';
import TrendTable from '../components/trends/TrendTable';
import IdeaCard from '../components/trends/IdeaCard';
import ResearchHistoryItem from '../components/trends/ResearchHistoryItem';
import TrendsSidebar from '../components/trends/TrendsSidebar';
import TrendsSkeleton from '../components/trends/TrendsSkeleton';
import HowItWorks from '../components/trends/HowItWorks';
import ResearchStartModal from '../components/trends/ResearchStartModal';
import { FilterSelect } from '../components/trends/filters';
import type { Platform } from '../api/brandProfile';

const HISTORY_PAGE_SIZE = 7;
// Poll phiên research nền (NFR-04): 4s/lần, tối đa 5 phút.
const POLL_INTERVAL_MS = 4000;
const POLL_MAX_TRIES = 75;

/** Dữ liệu thật từ backend; null = backend chưa chạy → dùng mock demo (trendsData.ts). */
interface LiveData {
  session: ResearchSessionDetail | null; // phiên COMPLETED gần nhất (kèm trends + ideas)
  summaries: ResearchSessionSummary[];
}

export default function Trends() {
  const { t, lang, go } = useApp();
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
  // Bộ lọc sub-tab "Ý tưởng content"
  const [ideaTrendF, setIdeaTrendF] = useState('all');
  const [ideaPlatformF, setIdeaPlatformF] = useState('all');
  const [ideaStatusF, setIdeaStatusF] = useState('all');
  // Phân trang + trạng thái cục bộ khác
  const [ideaPage, setIdeaPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // Dữ liệu thật + trạng thái "Research ngay"
  const [live, setLive] = useState<LiveData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);

  // Tải dữ liệu thật từ backend (/trend-research); backend chưa chạy / lỗi → giữ mock demo.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const summaries = await listTrendResearchSessions();
        const latest = summaries.find((s) => s.status === 'COMPLETED');
        const session = latest ? await getTrendResearchSession(latest.id) : null;
        if (!cancelled) setLive({ session, summaries });
      } catch {
        if (!cancelled) setLive(null);
      }
      if (!cancelled) setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, reloadKey]);

  // FR-19 "Research ngay": người dùng chọn hồ sơ + nền tảng trong ResearchStartModal,
  // sau đó tạo phiên → poll tới khi COMPLETED/FAILED → tải lại dữ liệu.
  const runResearch = async (brandProfileId: string, platform: Platform) => {
    if (researching) return;
    setResearching(true);
    setResearchError(null);
    try {
      const started = await startTrendResearch({ brandProfileId, platform });
      for (let i = 0; i < POLL_MAX_TRIES; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const s = await getTrendResearchSession(started.id);
        if (s.status === 'COMPLETED') {
          setReloadKey((k) => k + 1);
          return;
        }
        if (s.status === 'FAILED') throw new Error(s.errorMessage || t.trResearchFailed);
      }
      throw new Error(t.trResearchFailed);
    } catch (e) {
      setResearchError((e as Error).message || t.trResearchFailed);
    } finally {
      setResearching(false);
    }
  };

  const liveSession = live?.session ?? null;
  const allTrends = useMemo(() => (liveSession ? liveTrendItems(liveSession, lang) : trendItems(lang)), [liveSession, lang]);
  const allIdeas = useMemo(() => (liveSession ? liveContentIdeas(liveSession, lang) : contentIdeas(lang)), [liveSession, lang]);
  const sessions = useMemo(
    () => (live && live.summaries.length > 0 ? liveResearchSessions(live.summaries, lang) : researchSessions(lang)),
    [live, lang],
  );
  const stats = useMemo(() => (liveSession ? liveTrendStats(liveSession, lang) : trendStats(lang)), [liveSession, lang]);
  const trendNameById = useMemo(() => new Map(allTrends.map((tr) => [tr.id, tr.name])), [allTrends]);

  const industries = useMemo(() => [...new Set(allTrends.map((tr) => tr.industry))], [allTrends]);

  const query = q.trim().toLowerCase();
  const filteredTrends = allTrends.filter(
    (tr) =>
      (industryF === 'all' || tr.industry === industryF) &&
      (platformF === 'all' || tr.platforms.includes(platformF)) &&
      (fitF === 'all' || tr.fit === fitF) &&
      (!query || `${tr.name} ${tr.hashtag} ${tr.desc}`.toLowerCase().includes(query)),
  );

  const filteredIdeas = allIdeas.filter(
    (idea) =>
      (ideaTrendF === 'all' || idea.trendId === ideaTrendF) &&
      (ideaPlatformF === 'all' || idea.platform === ideaPlatformF) &&
      (ideaStatusF === 'all' || (savedIds.has(idea.id) && idea.status === 'new' ? 'saved' : idea.status) === ideaStatusF) &&
      (!query || `${idea.title} ${trendNameById.get(idea.trendId) ?? ''}`.toLowerCase().includes(query)),
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

  const viewIdeasOf = (trendId: string) => {
    setIdeaTrendF(trendId);
    setIdeaPage(1);
    setTab('ideas');
  };

  const toggleSave = (id: string) =>
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
    <div className="view-pop" style={{ maxWidth: width >= 1440 ? 1320 : 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
            onClick={() => { setResearchError(null); setStartOpen(true); }}
            disabled={researching}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 12, padding: '10px 18px', fontWeight: 700, fontSize: 13.5, color: '#fff', background: 'var(--brand)', cursor: researching ? 'wait' : 'pointer', opacity: researching ? 0.7 : 1, boxShadow: '0 14px 26px -12px rgba(139,92,246,.6)' }}
          >
            <Icon icon={Play} size={15} stroke="#fff" />
            {researching ? t.trResearching : t.trResearchNow}
          </button>
        </div>
        {researchError && (
          <div role="alert" style={{ flexBasis: '100%', fontSize: 12.5, color: '#dc2626' }}>{researchError}</div>
        )}
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
                  className="btn-outline"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', color: '#4b4660', fontWeight: 600, fontSize: 12.5, borderRadius: 10, padding: '9px 13px', cursor: 'pointer' }}
                >
                  <Icon icon={SlidersHorizontal} size={14} stroke="#7c3aed" />
                  {t.trAdvFilter}
                </button>
              </div>
              <TrendTable rows={filteredTrends} onViewIdeas={viewIdeasOf} />
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
                  <div style={{ padding: '18px 0', fontSize: 13.5, color: '#8a85a0', textAlign: 'center' }}>{t.trNoResult}</div>
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
                        onCreate={() => go('create')}
                        onToggleSave={() => toggleSave(idea.id)}
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
                    <ResearchHistoryItem session={s} />
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
          <TrendsSidebar tab={tab} sessions={sessions} ideas={allIdeas} trends={allTrends} savedIds={savedIds} onViewHistory={() => { setHistoryPage(1); setTab('history'); }} />
        </div>
      </div>

      {/* Cách hoạt động — chỉ ở sub-tab Trend nổi bật */}
      {tab === 'hot' && <HowItWorks />}

      {/* Chọn hồ sơ thương hiệu + nền tảng trước khi research (FR-19) */}
      {startOpen && (
        <ResearchStartModal
          onClose={() => setStartOpen(false)}
          onStart={(brandProfileId, platform) => {
            setStartOpen(false);
            void runResearch(brandProfileId, platform);
          }}
        />
      )}
    </div>
  );
}
