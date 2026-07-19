import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { SearchInput } from '../../components/admin/AdminListPage.tsx';
import { useToast } from '../../components/toast/ToastProvider.tsx';
import { cancelSchedule } from '../../api/schedules.ts';
import { listFailedPosts, type FailedPost, type FailedPostFilter } from '../../api/failedPosts.ts';
import { mockFailedPosts } from '../../failedPostsMock.ts';
import TabBar from '../../components/failedPosts/TabBar.tsx';
import FilterBar from '../../components/failedPosts/FilterBar.tsx';
import FailedPostList from '../../components/failedPosts/FailedPostList.tsx';
import ErrorDetailModal from '../../components/failedPosts/ErrorDetailModal.tsx';
import ErrorOverviewPanel from '../../components/failedPosts/ErrorOverviewPanel.tsx';
import { EMPTY_FILTERS, isPolicy, type FpFilters } from '../../components/failedPosts/shared.ts';
import PageContainer from '../../components/PageContainer';


// Trang "Bài lỗi & cần xử lý" (FR-35..FR-39) — dashboard master–detail:
// header full-width, dưới là grid 2 cột (desktop): TRÁI = tab + bộ lọc + bảng bài lỗi;
// PHẢI = panel "Tổng quan lỗi" sticky NGANG HÀNG với hàng tab, tổng hợp theo tab/bộ lọc.
// Bấm 1 dòng → modal "Chi tiết lỗi" căn giữa (bottom sheet ở mobile) có Trước/Sau để lướt bài.
// Số dòng/trang theo breakpoint: ≤1440px = 5, PC lớn = 8. Dữ liệu nạp 1 lần rồi lọc/tìm/
// phân trang client-side; backend chưa chạy / chưa có bài lỗi → mock demo (failedPostsMock.ts).

const matchesTab = (p: FailedPost, tab: FailedPostFilter) =>
  tab === 'ALL' || (tab === 'POLICY' ? isPolicy(p) : !isPolicy(p));

const isMock = (p: FailedPost) => p.id.startsWith('mock-');

export default function FailedPosts() {
  const { t, go, brandGradient } = useApp();
  const { width, isDesktop } = useBreakpoint();
  const toast = useToast();

  // Mobile / tablet / laptop: 5 dòng/trang; PC lớn (>1440px): 8.
  const pageSize = width > 1440 ? 8 : 5;

  const [posts, setPosts] = useState<FailedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);

  const [tab, setTab] = useState<FailedPostFilter>('ALL');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FpFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Nạp TOÀN BỘ bài lỗi 1 lần (gộp các trang server) để lọc/tìm/phân trang client-side.
  const loadAll = useCallback(async () => {
    setLoading(true);
    let all: FailedPost[] = [];
    let isDemo = false;
    try {
      for (let pageNo = 0; pageNo < 20; pageNo++) {
        const res = await listFailedPosts({ filter: 'ALL', page: pageNo, size: 100 });
        all = all.concat(res.content);
        if (res.last) break;
      }
      if (all.length === 0) {
        all = mockFailedPosts();
        isDemo = true;
      }
    } catch {
      all = mockFailedPosts();
      isDemo = true;
    }
    all.sort((a, b) => (b.failedAt ?? '').localeCompare(a.failedAt ?? ''));
    setPosts(all);
    setDemo(isDemo);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ===== Lọc client-side: search + bộ lọc (chưa tính tab) → badge số lượng trên tab =====
  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (filters.platform !== 'ALL' && p.platformName !== filters.platform) return false;
      const day = p.failedAt?.slice(0, 10) ?? '';
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
      // filters.status: mọi bài ở trang này đều đang FAILED nên 'FAILED' không loại bài nào.
      if (q) {
        const hay = [p.caption, p.accountName, p.errorCode, p.errorMessage].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, search, filters]);

  const counts = useMemo<Record<FailedPostFilter, number>>(() => {
    const policy = baseFiltered.filter(isPolicy).length;
    return { ALL: baseFiltered.length, POLICY: policy, TECHNICAL: baseFiltered.length - policy };
  }, [baseFiltered]);

  const filtered = useMemo(() => baseFiltered.filter((p) => matchesTab(p, tab)), [baseFiltered, tab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(() => filtered.slice((safePage - 1) * pageSize, safePage * pageSize), [filtered, safePage, pageSize]);

  const selectedIndex = useMemo(() => filtered.findIndex((p) => p.id === selectedId), [filtered, selectedId]);
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  // Đổi tab / bộ lọc / tìm kiếm → về trang 1 + bỏ chọn bài đang mở.
  const resetView = () => { setPage(1); setSelectedId(null); setDetailOpen(false); };
  const changeTab = (next: FailedPostFilter) => { setTab(next); resetView(); };
  const changeFilters = (f: FpFilters) => { setFilters(f); resetView(); };
  const changeSearch = (q: string) => { setSearch(q); resetView(); };

  // Bấm 1 dòng → highlight + mở modal chi tiết.
  const selectPost = (p: FailedPost) => {
    setSelectedId(p.id);
    setDetailOpen(true);
  };

  // Trước/Sau trong modal: lướt trong danh sách đã lọc, đồng bộ trang chứa bài đang xem.
  const navigateDetail = (dir: -1 | 1) => {
    const next = filtered[selectedIndex + dir];
    if (!next) return;
    setSelectedId(next.id);
    setPage(Math.floor((selectedIndex + dir) / pageSize) + 1);
  };

  // ===== Hành động hồi phục (tái dùng /schedules + wizard — không viết lại logic) =====
  const editPost = () => go('create');
  const regenPost = () => go('create');

  // Bỏ bài lỗi khỏi danh sách: hủy lịch (không xóa nội dung — đăng lại sau được).
  const deletePost = async (p: FailedPost) => {
    if (busy) return;
    if (isMock(p)) {
      setPosts((prev) => prev.filter((x) => x.id !== p.id));
      setDetailOpen(false);
      toast.success(t.fpDeleted);
      return;
    }
    setBusy(true);
    try {
      await cancelSchedule(p.scheduleId);
      setDetailOpen(false);
      toast.success(t.fpDeleted);
      await loadAll();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  // Xuất báo cáo CSV theo danh sách đang lọc (BOM UTF-8 để mở đúng tiếng Việt trong Excel).
  const exportReport = () => {
    const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      [t.fpColPost, t.fpColPlatform, t.fpColStatus, t.fpErrorCode, t.fpColReason, t.fpColTime].map((h) => esc(h)).join(','),
      ...filtered.map((p) =>
        [esc(p.caption), esc(p.platformName), esc(p.errorType), esc(p.errorCode), esc(p.errorMessage), esc(p.failedAt)].join(','),
      ),
    ];
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `failed-posts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Cột trái của grid: tab → bộ lọc → banner demo → bảng + phân trang.
  const leftColumn = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <TabBar tab={tab} counts={counts} onChange={changeTab} />
      <FilterBar filters={filters} onChange={changeFilters} />
      {demo && !loading && (
        <div style={{ fontSize: 12, color: '#7c6f4f', background: '#fdf6e7', border: '1px solid #f3e6c4', borderRadius: 9, padding: '8px 11px' }}>
          {t.fpDemo}
        </div>
      )}
      {/* Dưới lg (tablet/mobile): danh sách card thay vì bảng cuộn ngang (mục 8). */}
      <FailedPostList
        items={pageItems}
        loading={loading}
        selectedId={selectedId}
        onSelect={selectPost}
        page={safePage}
        pageCount={pageCount}
        onPageChange={setPage}
        variant={isDesktop ? 'table' : 'cards'}
      />
    </div>
  );

  return (
    <PageContainer>
      {/* Thanh công cụ: tìm kiếm + xuất báo cáo. Tiêu đề + mô tả trang giờ do header
          dùng chung ở Topbar lo (PAGE_KEYS.failedPosts) — không lặp lại trong trang. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <SearchInput value={search} onChange={changeSearch} placeholder={t.fpSearchPh} />
        <button
          onClick={exportReport}
          className="btn-grad"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          <Download size={14} strokeWidth={2} />
          {t.fpExport}
        </button>
      </div>

      {isDesktop ? (
        /* Laptop/PC: 2 cột cùng bắt đầu ngay dưới header — đỉnh "Tổng quan lỗi" TRÙNG hàng tab.
           alignItems start để cột phải không bị kéo giãn; sticky để bám khi cuộn danh sách. */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 62fr) minmax(0, 38fr)', gap: 16, alignItems: 'start' }}>
          {leftColumn}
          <div style={{ position: 'sticky', top: 16, minWidth: 0 }}>
            <ErrorOverviewPanel items={filtered} />
          </div>
        </div>
      ) : (
        /* Mobile/Tablet: 1 cột — tổng quan collapse được lên đầu, rồi tab + bộ lọc + danh sách */
        <>
          <ErrorOverviewPanel items={filtered} collapsible open={overviewOpen} onToggle={() => setOverviewOpen((v) => !v)} />
          {leftColumn}
        </>
      )}

      {detailOpen && selected && (
        <ErrorDetailModal
          post={selected}
          index={selectedIndex}
          total={filtered.length}
          busy={busy}
          onClose={() => setDetailOpen(false)}
          onNavigate={navigateDetail}
          onEdit={editPost}
          onRegen={regenPost}
          onDelete={deletePost}
        />
      )}
    </PageContainer>
  );
}
