import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { useToast } from '../../components/toast/ToastProvider.tsx';
import { Card } from '../../components/ui.tsx';
import PageContainer from '../../components/PageContainer.tsx';
import KpiCard from '../../components/analytics/KpiCard.tsx';
import AnalyticsFilterBar from '../../components/analytics/AnalyticsFilterBar.tsx';
import AnalyticsTrendChart from '../../components/analytics/AnalyticsTrendChart.tsx';
import PlatformBreakdown from '../../components/analytics/PlatformBreakdown.tsx';
import ContentTypeBreakdown from '../../components/analytics/ContentTypeBreakdown.tsx';
import ActivityHeatmap from '../../components/analytics/ActivityHeatmap.tsx';
import InsightsStrip from '../../components/analytics/InsightsStrip.tsx';
import TopPostsTable from '../../components/analytics/TopPostsTable.tsx';
import AllPostsModal from '../../components/analytics/AllPostsModal.tsx';
import PostDetailModal from '../../components/analytics/PostDetailModal.tsx';
import BlockError from '../../components/analytics/BlockError.tsx';
import AnalyticsSkeleton, {
  BlockSkeleton, ContentTypeSkeleton, HeatmapSkeleton, InsightsSkeleton, KpiCardSkeleton,
  PlatformSkeleton, TopPostsSkeleton,
} from '../../components/analytics/AnalyticsSkeleton.tsx';
import { METRIC_TONE } from '../../components/analytics/analyticsTokens.ts';
import { defaultRange } from '../../components/analytics/dateRange.ts';
import type { Platform } from '../../api/brandProfile.ts';
import {
  CONTENT_TYPES, exportAnalyticsCsv, getAnalyticsByContentType, getAnalyticsByPlatform, getAnalyticsHeatmap,
  getAnalyticsInsights, getAnalyticsSummary, getAnalyticsTimeseries, getAnalyticsTopPosts,
  type AnalyticsFilter, type AnalyticsSummary, type AnalyticsTimeseries, type AnalyticsTopPost,
  type ContentTypeLabel, type TopPostSort, type TopPostSortField,
} from '../../api/analytics.ts';
import {
  mockByContentType, mockByPlatform, mockHeatmap, mockInsights, mockSummary, mockTimeseries, mockTopPosts,
} from '../../api/analyticsMock.ts';

// UI-08 v2 — Trang Phân tích tổng hợp. Số liệu từ slice /analytics/* (AnalyticsController), GỘP theo
// kỳ/ngày. MỘT nguồn bộ lọc duy nhất (khoảng ngày + nền tảng + loại nội dung + cột sort) đồng bộ lên
// URL query — không card nào có bộ chọn thời gian riêng, các card chỉ hiện `RangeBadge` tĩnh nhắc
// khoảng đang áp dụng (dropdown riêng từng card sẽ khiến bấm ở card này làm ba card kia nhảy theo).
//
// Bố cục: hàng công cụ (KHÔNG sticky) → 4 KPI ngang → chart 8 + nền tảng 4 → Top bài viết 8 + cột
// phải 4 (loại nội dung / heatmap xếp dọc) → dải "Thông tin chi tiết" cuối trang. Mỗi khối
// tải/skeleton/thử lại ĐỘC LẬP: đổi bộ lọc chỉ thay phần dữ liệu, hàng công cụ vẫn thao tác được,
// không remount cả trang.
//
// DỮ LIỆU MẪU: chỉ bật khi tài khoản CHƯA từng có số liệu thật (hoặc API lỗi ngay lần đầu). Khi đã
// thấy dữ liệu thật một lần, mọi lần lọc sau LUÔN hiển thị dữ liệu thật — lọc không ra kết quả thì
// hiện empty state, tuyệt đối không âm thầm đổi sang số liệu demo. Cờ VITE_USE_MOCK=true ép mock.

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const ALL_PLATFORMS: Platform[] = ['FACEBOOK', 'INSTAGRAM', 'THREADS'];
const SORT_FIELDS: TopPostSortField[] = ['views', 'likes', 'comments', 'shares', 'engagement', 'date'];
/** Trần export của backend — vượt thì trả mã 2053 kèm hướng dẫn thu hẹp bộ lọc. */
const EXPORT_TOO_LARGE_CODE = 2053;
/** Một khoảng cách duy nhất cho cả hàng lẫn cột của lưới 12 cột. */
const GRID_GAP = 18;

/**
 * Một ô của lưới 12 cột. Class `.ana-cell` (index.css) cho card con cao đầy ô → hai card cùng hàng
 * bằng nhau mà không cần biết chiều cao trước.
 *
 * `ready` = khối đã có dữ liệu thật → thêm `.ana-in` để nội dung hiện lên bằng fade + trượt nhẹ thay
 * vì "nhảy" thẳng từ khung xương sang. Cờ này chỉ bật khi khối đổi từ khung xương sang dữ liệu (mỗi
 * khối tải xong một lúc khác nhau nên hiệu ứng tự so le, không cần delay thủ công).
 */
function Cell({ span, ready = false, children }: { span: number; ready?: boolean; children: ReactNode }) {
  return (
    <div className={cellClass(ready)} style={{ gridColumn: `span ${span}` }}>
      {children}
    </div>
  );
}

/** Dùng chung cho ô lưới và hai tầng của cột phải (heatmap/loại nội dung không phải ô lưới). */
const cellClass = (ready: boolean) => (ready ? 'ana-cell ana-in' : 'ana-cell');

function parseCsvParam<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return [];
  return raw.split(',').filter((v): v is T => (allowed as readonly string[]).includes(v));
}

/** Có ít nhất một metric > 0 → coi là có số liệu thật; toàn 0 → chưa có gì để hiển thị. */
const summaryHasData = (s: AnalyticsSummary) =>
  s.views.total > 0 || s.likes.total > 0 || s.comments.total > 0 || s.shares.total > 0;

const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default function Analytics() {
  const { t } = useApp();
  const { isMobile, width } = useBreakpoint();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // ---- Bộ lọc (nguồn sự thật = URL) ----
  const filter: AnalyticsFilter = useMemo(() => {
    const def = defaultRange();
    return {
      from: params.get('from') || def.from,
      to: params.get('to') || def.to,
      platforms: parseCsvParam(params.get('platforms'), ALL_PLATFORMS),
      contentTypes: parseCsvParam<ContentTypeLabel>(params.get('types'), CONTENT_TYPES),
    };
  }, [params]);

  const sort: TopPostSort = useMemo(() => ({
    field: SORT_FIELDS.includes(params.get('sortField') as TopPostSortField) ? (params.get('sortField') as TopPostSortField) : 'views',
    asc: params.get('sortDir') === 'asc',
  }), [params]);

  const patchParams = useCallback((patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    });
    setParams(next, { replace: true });
  }, [params, setParams]);

  const onFilterChange = useCallback((patch: Partial<AnalyticsFilter>) => {
    patchParams({
      from: patch.from, to: patch.to,
      platforms: patch.platforms ? patch.platforms.join(',') || undefined : undefined,
      types: patch.contentTypes ? patch.contentTypes.join(',') || undefined : undefined,
    });
  }, [patchParams]);
  const setSort = (next: TopPostSort) => patchParams({ sortField: next.field, sortDir: next.asc ? 'asc' : 'desc' });

  // Khoá ổn định để các useCallback bên dưới chỉ đổi khi bộ lọc thực sự đổi.
  const filterKey = `${filter.from}|${filter.to}|${filter.platforms.join(',')}|${filter.contentTypes.join(',')}`;
  const stableFilter = useMemo(() => filter, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Khối lõi: KPI (B) + chart (C). Quyết định luôn trang đang ở chế độ thật hay dữ liệu mẫu ----
  const [coreLoad, setCoreLoad] = useState<'loading' | 'ok' | 'error'>('loading');
  const [booted, setBooted] = useState(false);
  // null = chưa quyết định → các khối khác chờ, tránh nửa thật nửa mẫu.
  const [demo, setDemo] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [series, setSeries] = useState<AnalyticsTimeseries | null>(null);
  // Đã từng thấy số liệu thật → không bao giờ rơi lại về dữ liệu mẫu khi lọc hẹp ra 0 kết quả.
  const everReal = useRef(false);

  const fetchCore = useCallback(() => {
    setCoreLoad('loading');
    const useMockData = () => {
      setSummary(mockSummary(stableFilter));
      setSeries(mockTimeseries(stableFilter));
      setDemo(true);
      setCoreLoad('ok');
    };
    if (USE_MOCK) { useMockData(); return; }
    Promise.all([getAnalyticsSummary(stableFilter), getAnalyticsTimeseries(stableFilter)])
      .then(([s, ts]) => {
        if (summaryHasData(s)) everReal.current = true;
        if (summaryHasData(s) || everReal.current) {
          setSummary(s); setSeries(ts); setDemo(false); setCoreLoad('ok');
        } else useMockData();
      })
      // Đã từng có dữ liệu thật thì lỗi là lỗi thật → hiện nút "Thử lại", KHÔNG lặng lẽ đổi sang
      // dữ liệu mẫu (người dùng sẽ tưởng số liệu của mình tụt).
      .catch(() => { if (everReal.current) setCoreLoad('error'); else useMockData(); });
  }, [stableFilter]);
  useEffect(() => { fetchCore(); }, [fetchCore]);
  useEffect(() => { if (coreLoad !== 'loading') setBooted(true); }, [coreLoad]);

  // ---- Các khối còn lại: tải độc lập, mỗi khối tự skeleton/thử lại ----
  const byPlatform = useBlock(
    useCallback(() => getAnalyticsByPlatform(stableFilter), [stableFilter]),
    useCallback(() => mockByPlatform(stableFilter), [stableFilter]), demo);
  const byContentType = useBlock(
    useCallback(() => getAnalyticsByContentType(stableFilter), [stableFilter]),
    useCallback(() => mockByContentType(stableFilter), [stableFilter]), demo);
  const heatmap = useBlock(
    useCallback(() => getAnalyticsHeatmap(stableFilter), [stableFilter]),
    useCallback(() => mockHeatmap(stableFilter), [stableFilter]), demo);
  const insights = useBlock(
    useCallback(() => getAnalyticsInsights(stableFilter), [stableFilter]),
    useCallback(() => mockInsights(stableFilter), [stableFilter]), demo);
  // Top bài viết lấy tối đa 50 (trần backend) để modal "Xem tất cả" phân trang tại chỗ.
  const topPosts = useBlock<AnalyticsTopPost[]>(
    useCallback(() => getAnalyticsTopPosts(stableFilter, sort, 50), [stableFilter, sort.field, sort.asc]), // eslint-disable-line react-hooks/exhaustive-deps
    useCallback(() => mockTopPosts(stableFilter, sort, 50), [stableFilter, sort.field, sort.asc]), // eslint-disable-line react-hooks/exhaustive-deps
    demo);

  // ---- Xuất báo cáo ----
  const [exporting, setExporting] = useState(false);
  const onExportCsv = async () => {
    setExporting(true);
    try {
      // Chế độ dữ liệu mẫu chưa có gì thật để xuất → dựng CSV ngay từ bảng đang hiển thị.
      const csv = demo ? mockCsv(topPosts.data ?? []) : await exportAnalyticsCsv(stableFilter, sort);
      download(csv, `aima-phan-tich-${filter.from}-${filter.to}.csv`);
      toast.success(t.anaExportDone);
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code === EXPORT_TOO_LARGE_CODE) toast.warning(t.anaExportTooLarge);
      else toast.error(t.anaExportFailed);
    } finally {
      setExporting(false);
    }
  };

  // ---- Điều hướng ----
  const [allPostsOpen, setAllPostsOpen] = useState(false);
  const [detailPost, setDetailPost] = useState<AnalyticsTopPost | null>(null);
  // Ô "Bài lỗi & cần xử lý" mang theo ĐÚNG khoảng ngày đang lọc để hai màn hình cùng một con số.
  // `go()` chỉ nhận key route (không kèm query) nên điều hướng thẳng bằng navigate.
  const openFailedPosts = () => navigate(`/failed-posts?from=${filter.from}&to=${filter.to}`);

  // ---- Bố cục: MỘT lưới 12 cột cho cả trang ----
  // Mọi khối là ô của cùng một lưới: hai card cùng hàng luôn bằng chiều cao (grid stretch +
  // `.ana-cell > * { flex: 1 }`), không có khoảng trống dọc bất thường và không hardcode height.
  //
  // ≥1280: KPI 4×3 · chart 8 + nền tảng 4 · Top bài viết 8 + [loại nội dung / heatmap] 4 · Thông tin
  //        chi tiết 12.  768–1279: mọi cặp 8/4 xuống một cột, KPI 2 cột.  <768: tất cả một cột.
  const wide = width >= 1280;
  const kpiSpan = wide ? 3 : isMobile ? 12 : 6;
  const mainSpan = wide ? 8 : 12;   // chart / bảng Top bài viết
  const sideSpan = wide ? 4 : 12;   // donut nền tảng / donut loại nội dung
  const insightsCols = wide ? 5 : width > 1024 ? 3 : 2; // <768 vẫn 2 cột để strip không cao lêu nghêu

  const kpi = [
    { key: 'views' as const, icon: Eye, label: t.anaViews },
    { key: 'likes' as const, icon: Heart, label: t.anaLikes },
    { key: 'comments' as const, icon: MessageCircle, label: t.anaComments },
    { key: 'shares' as const, icon: Share2, label: t.anaShares },
  ];
  // Delta ghi rõ KHOẢNG kỳ trước đã tính (backend trả compareFrom/compareTo), không nói chung chung.
  const compareLabel = summary
    ? t.anaVsRange.replace('{from}', ddmmyyyy(summary.compareFrom)).replace('{to}', ddmmyyyy(summary.compareTo))
    : '';

  // Empty state (chỉ ở chế độ dữ liệu THẬT): phân biệt chưa kết nối / chưa có bài / lọc không ra.
  const emptyNote = useMemo(() => {
    if (demo !== false || !summary || summaryHasData(summary)) return null;
    const rows = byPlatform.data;
    if (rows && rows.length > 0 && rows.every((r) => !r.connected)) return t.anaEmptyNoConnection;
    if (filter.platforms.length > 0 || filter.contentTypes.length > 0) return t.anaEmptyNoResult;
    return t.anaEmptyNoPosts;
  }, [demo, summary, byPlatform.data, filter.platforms.length, filter.contentTypes.length, t]);

  // Lần tải ĐẦU: skeleton cả trang (kèm thanh lọc) dùng CÙNG lưới 12 cột và bao gồm tất cả
  // các khối (KPI, chart, nền tảng, top bài viết, loại nội dung, heatmap, thông tin chi tiết)
  // để chuyển tiếp sang dữ liệu thật không nhảy layout.
  if (!booted) {
    return (
      <PageContainer>
        <AnalyticsSkeleton width={width} withToolbar />
      </PageContainer>
    );
  }

  // Mỗi khối: lỗi → nút thử lại · đang tải → ĐÚNG khung xương của chính khối đó (cùng bố cục, cùng
  // chiều cao tự nhiên) · xong → dữ liệu thật kèm fade-in qua `ready` của `Cell`.
  const coreReady = coreLoad === 'ok' && !!summary;

  const chartBlock = coreLoad === 'error' ? <BlockError onRetry={fetchCore} minHeight={280} />
    : coreLoad === 'loading' || !series ? <BlockSkeleton minHeight={424} />
      : <AnalyticsTrendChart points={series.points} from={filter.from} to={filter.to} />;

  const topPostsBlock = topPosts.status === 'loading' ? <TopPostsSkeleton />
    : topPosts.status === 'error' ? <BlockError onRetry={topPosts.reload} minHeight={240} />
      : (
        <TopPostsTable
          rows={topPosts.data ?? []} sort={sort} onSortChange={setSort}
          onRowClick={setDetailPost} onViewAll={() => setAllPostsOpen(true)}
        />
      );

  const platformBlock = byPlatform.status === 'loading' ? <PlatformSkeleton />
    : byPlatform.status === 'error' ? <BlockError onRetry={byPlatform.reload} />
      : <PlatformBreakdown rows={byPlatform.data ?? []} from={filter.from} to={filter.to} />;

  const contentTypeBlock = byContentType.status === 'loading' ? <ContentTypeSkeleton />
    : byContentType.status === 'error' ? <BlockError onRetry={byContentType.reload} />
      : <ContentTypeBreakdown rows={byContentType.data ?? []} from={filter.from} to={filter.to} />;

  const heatmapBlock = heatmap.status === 'loading' ? <HeatmapSkeleton />
    : heatmap.status === 'error' ? <BlockError onRetry={heatmap.reload} />
      : heatmap.data ? <ActivityHeatmap data={heatmap.data} from={filter.from} to={filter.to} /> : null;

  const insightsBlock = insights.status === 'loading' ? <InsightsSkeleton cols={insightsCols} />
    : insights.status === 'error' ? <BlockError onRetry={insights.reload} minHeight={140} />
      : insights.data ? <InsightsStrip data={insights.data} onOpenFailed={openFailedPosts} /> : null;

  return (
    <PageContainer>
      {/* A — Hàng công cụ: chip "Dữ liệu mẫu" bên trái, các control căn phải, KHÔNG sticky. */}
      <AnalyticsFilterBar
        filter={filter} onChange={onFilterChange}
        onExportCsv={onExportCsv} exporting={exporting} demo={demo === true}
      />

      {emptyNote && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13.5, color: '#6b6680', lineHeight: 1.6 }}>{emptyNote}</div>
        </Card>
      )}

      {/* Lưới 12 cột dùng chung cho MỌI khối — một gap duy nhất cho cả hàng lẫn cột. */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gap: GRID_GAP, alignItems: 'stretch',
      }}>
        {/* B — 4 KPI. Lúc tải vẫn là 4 ô ĐÚNG span của trang (không phải một ô 12 chứa lưới con) →
            đổi bộ lọc không làm hàng KPI đổi số cột trong nháy mắt. */}
        {coreLoad === 'error' ? (
          <Cell span={12}><BlockError onRetry={fetchCore} minHeight={120} /></Cell>
        ) : !coreReady ? (
          kpi.map((k) => <Cell key={k.key} span={kpiSpan}><KpiCardSkeleton /></Cell>)
        ) : (
          kpi.map((k) => (
            <Cell key={k.key} span={kpiSpan} ready>
              <KpiCard icon={k.icon} tone={METRIC_TONE[k.key]} label={k.label}
                stat={summary[k.key]} comparisonLabel={compareLabel} />
            </Cell>
          ))
        )}

        {/* C — chart 8 + hiệu suất nền tảng 4 (cùng hàng ⇒ tự bằng chiều cao) */}
        <Cell span={mainSpan} ready={coreLoad === 'ok' && !!series}>{chartBlock}</Cell>
        <Cell span={sideSpan} ready={byPlatform.status === 'ok'}>{platformBlock}</Cell>

        {/* D — Top bài viết 8 + cột phải 4 chẻ đôi: loại nội dung (hút chiều cao dôi) trên, heatmap
            dưới. Cột phải là flex column nên TỔNG chiều cao hai card = chiều cao bảng bên trái. */}
        <Cell span={mainSpan} ready={topPosts.status === 'ok'}>{topPostsBlock}</Cell>
        <Cell span={sideSpan}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: GRID_GAP, minWidth: 0 }}>
            {/* `.ana-cell` cho card con lấp đầy bề ngang; card trên nhận flex:1 để hút phần dôi,
                card heatmap giữ chiều cao tự nhiên → không cần px cứng cho card nào. */}
            <div className={cellClass(byContentType.status === 'ok')} style={{ flex: 1, minHeight: 0 }}>
              {contentTypeBlock}
            </div>
            {heatmapBlock && (
              <div className={cellClass(heatmap.status === 'ok')} style={{ flex: 'none' }}>{heatmapBlock}</div>
            )}
          </div>
        </Cell>

        {/* E — dải "Thông tin chi tiết" cuối trang, full width */}
        {insightsBlock && <Cell span={12} ready={insights.status === 'ok'}>{insightsBlock}</Cell>}
      </div>

      {allPostsOpen && (
        <AllPostsModal
          rows={topPosts.data ?? []} sort={sort} onSortChange={setSort}
          onRowClick={setDetailPost} onClose={() => setAllPostsOpen(false)}
        />
      )}

      {detailPost && (
        <PostDetailModal
          postId={detailPost.postId}
          fallback={{
            caption: detailPost.caption, platform: detailPost.platform, publishedAt: detailPost.publishedAt,
            views: detailPost.views, likes: detailPost.likes, comments: detailPost.comments, shares: detailPost.shares,
          }}
          allPosts={topPosts.data ?? []}
          onClose={() => setDetailPost(null)}
        />
      )}
    </PageContainer>
  );
}

/**
 * Một khối dữ liệu độc lập: chờ trang quyết định thật/mẫu (`demo === null` = chưa quyết định), sau đó
 * gọi API thật hoặc lấy dữ liệu mẫu. Lỗi ở chế độ THẬT không nuốt im lặng — trả `status = 'error'` để
 * khối hiện nút "Thử lại" mà không ảnh hưởng các khối khác.
 */
function useBlock<T>(fetcher: () => Promise<T>, mocker: () => T, demo: boolean | null) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [data, setData] = useState<T | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (demo === null) return;
    if (demo) { setData(mocker()); setStatus('ok'); return; }
    let alive = true;
    setStatus('loading');
    fetcher()
      .then((d) => { if (alive) { setData(d); setStatus('ok'); } })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [fetcher, mocker, demo, nonce]);

  return { status, data, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/** Tải chuỗi CSV về máy. BOM để Excel đọc đúng UTF-8 (tiếng Việt không lỗi font). */
function download(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV cho chế độ dữ liệu mẫu — cùng cột với export thật của backend. */
function mockCsv(rows: AnalyticsTopPost[]): string {
  const head = 'publishedAt,platform,caption,views,likes,comments,shares,engagement';
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [head, ...rows.map((r) => [
    r.publishedAt, r.platform, esc(r.caption ?? ''), r.views, r.likes, r.comments, r.shares, r.engagement,
  ].join(','))].join('\n');
}
