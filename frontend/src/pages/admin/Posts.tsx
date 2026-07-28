import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import PageContainer from '../../components/PageContainer';
import AdminListPage, { type ListState } from '../../components/admin/AdminListPage';
import Pagination from '../../components/admin/Pagination';
import BlockError from '../../components/admin/BlockError';
import { KpiRowSkeleton } from '../../components/admin/BlockSkeleton';
import { Card } from '../../components/ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useToast } from '../../components/toast/ToastProvider';
import { usePostProblems } from '../../components/admin/posts/usePostProblems';
import PostProblemToolbar from '../../components/admin/posts/PostProblemToolbar';
import PostProblemKpis from '../../components/admin/posts/PostProblemKpis';
import PostProblemFilterBar from '../../components/admin/posts/PostProblemFilterBar';
import PostProblemTable from '../../components/admin/posts/PostProblemTable';
import PostProblemDetail from '../../components/admin/posts/PostProblemDetail';
import type { AdminPostProblem } from '../../api/admin';

// Trang admin "Bài đăng lỗi & bị từ chối" (FR-82 + FR-83).
//
// Tiêu đề + mô tả phụ + search/ngôn ngữ/chuông/avatar là của Topbar dùng chung (AppShell,
// PAGE_KEYS.adminPosts) — trang chỉ dựng phần thân. Toàn bộ dữ liệu và bộ lọc nằm trong
// usePostProblems; ở đây chỉ còn bố cục + điều phối trạng thái UI cục bộ.

/** Từ 1280px trở lên mới đủ chỗ đặt panel chi tiết cạnh bảng; hẹp hơn thì panel phủ lên trên. */
const DOCK_MIN_WIDTH = 1280;
/** Panel rộng cố định; bảng là `flex: 1` nên nới panel ra là bảng tự thu vào đúng bấy nhiêu. */
const DETAIL_WIDTH = 430;
/**
 * Panel bám theo khi cuộn danh sách dài. Vùng cuộn là `<main>` của AppShell (đã nằm dưới topbar),
 * nên offset chỉ là khoảng thở 16px — cùng quy ước với cột phải sticky của trang "Bài lỗi &
 * cần xử lý" và trang Trends, không phải trừ chiều cao topbar lần nữa.
 */
const DETAIL_STICKY_TOP = 16;
/** Chiều cao khả dụng = viewport − topbar 70px − offset trên 16px − 24px chừa đáy. */
const DETAIL_STICKY_MAX_HEIGHT = 'calc(100vh - 110px)';

export default function Posts() {
  const { t } = useApp();
  const toast = useToast();
  const { width, isMobile, isTablet } = useBreakpoint();
  const s = usePostProblems();

  // Cùng công thức cột với trang Tổng quan quản trị để hai trang cùng nhịp khi đổi breakpoint.
  const kpiColumns = isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const [filtersOpen, setFiltersOpen] = useState(false);

  const docked = width >= DOCK_MIN_WIDTH;
  const detailOpen = s.selected !== null;

  const listState: ListState = s.listLoad === 'loading' ? 'loading'
    : s.listLoad === 'error' ? 'error'
      : s.rows.length === 0 ? 'empty' : 'ready';

  const copyContent = (post: AdminPostProblem) => {
    const text = post.content.trim();
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => toast.success(t.apCopied));
  };

  const doExport = async () => {
    try {
      const csv = await s.runExport();
      if (!csv.trim() || csv.trim().split('\n').length <= 1) {
        toast.warning(t.apExportEmpty);
        return;
      }
      // BOM để Excel đọc đúng UTF-8 (tiếng Việt không lỗi font) — cùng cách trang Doanh thu làm.
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aima-bai-dang-loi-${s.range.from}_${s.range.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message || t.apExportFailed);
    }
  };

  const listCard = (
    <AdminListPage
      state={listState}
      emptyLabel={t.apEmpty}
      onRetry={s.reloadList}
      toolbar={(
        <PostProblemFilterBar
          platform={s.filter.platform}
          errorType={s.filter.errorType}
          query={s.filter.q ?? ''}
          sort={s.sort}
          searchOpen={filtersOpen}
          activeFilters={s.activeFilters}
          onPlatformChange={s.setPlatform}
          onErrorTypeChange={s.setErrorType}
          onQueryChange={s.setQuery}
          onSortChange={s.setSort}
          onReset={s.resetFilters}
        />
      )}
    >
      <PostProblemTable
        kind={s.kind}
        rows={s.rows}
        selectedId={s.selectedId}
        onToggleDetail={(post) => s.setSelectedId(s.selectedId === post.id ? null : post.id)}
        onCopyContent={copyContent}
      />
      <div style={{ padding: '0 16px 16px' }}>
        <Pagination
          page={s.page}
          pageCount={s.pageCount}
          onChange={s.setPage}
          pageSize={s.pageSize}
          onPageSizeChange={s.setPageSize}
        />
      </div>
    </AdminListPage>
  );

  const detailPanel = s.selected && (
    <PostProblemDetail
      post={s.selected}
      variant={docked ? 'docked' : 'overlay'}
      width={docked ? DETAIL_WIDTH : undefined}
      stickyTop={docked ? DETAIL_STICKY_TOP : undefined}
      stickyMaxHeight={docked ? DETAIL_STICKY_MAX_HEIGHT : undefined}
      onClose={() => s.setSelectedId(null)}
      onCopyContent={copyContent}
    />
  );

  return (
    <PageContainer>
      {/* B — tab + khoảng ngày + bộ lọc + xuất báo cáo */}
      <PostProblemToolbar
        kind={s.kind}
        summary={s.summary}
        range={s.range}
        activeFilters={s.activeFilters}
        filtersOpen={filtersOpen}
        exporting={s.exporting}
        onKindChange={s.setKind}
        onRangeChange={s.setRange}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        onExport={doExport}
      />

      {/* C — 4 thẻ KPI, đổi bộ theo tab (ẩn hoàn toàn khi chưa có số thật) */}
      {s.summaryLoad === 'loading' && <KpiRowSkeleton columns={kpiColumns} />}
      {s.summaryLoad === 'error' && (
        <Card style={{ borderRadius: 18 }}><BlockError onRetry={s.reloadSummary} /></Card>
      )}
      {s.summaryLoad === 'ok' && s.summary && <PostProblemKpis kind={s.kind} summary={s.summary} />}

      {/*
        D + E + F — bảng và panel chi tiết nằm CÙNG MỘT HÀNG khi màn đủ rộng: bảng co lại,
        panel thành cột phải cao bằng card bảng (align-items: stretch) và tự cuộn bên trong.
        Không có nền mờ nên vẫn bấm được sang hàng khác để đổi bài — panel cập nhật tại chỗ.
        Màn hẹp hơn: panel chuyển sang chế độ overlay và tự render qua portal.
      */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{listCard}</div>
        {docked && detailOpen && detailPanel}
      </div>

      {!docked && detailPanel}
    </PageContainer>
  );
}
