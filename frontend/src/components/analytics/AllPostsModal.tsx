import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import Modal from '../Modal';
import PostsTable from './PostsTable';
import PostsCardList from './PostsCardList';
import type { AnalyticsTopPost, TopPostSort } from '../../api/analytics';

/** Số bài mỗi trang trong modal. */
const PAGE_SIZE = 8;

/**
 * Modal "Tất cả bài viết" — hiển thị TOÀN BỘ danh sách top bài (đã lấy sẵn ở trang) với **phân trang
 * client-side**: endpoint `/analytics/top-posts` không phân trang server-side (chỉ `limit` ≤ 50), nên
 * trang tải một mẻ rồi modal chia trang tại chỗ. Vẫn sắp xếp theo cột như bảng chính (đổi sort gọi lại
 * API → danh sách đổi → tự về trang 1).
 */
export default function AllPostsModal({
  rows,
  sort,
  onSortChange,
  onRowClick,
  onClose,
}: {
  rows: AnalyticsTopPost[];
  sort: TopPostSort;
  onSortChange: (sort: TopPostSort) => void;
  onRowClick: (row: AnalyticsTopPost) => void;
  onClose: () => void;
}) {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // Đổi sort (danh sách sắp lại) hoặc số lượng đổi → về trang đầu để không lạc trang trống.
  useEffect(() => { setPage(0); }, [sort.field, sort.asc, rows.length]);

  const pageRows = useMemo(() => rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [rows, page]);

  return (
    <Modal
      title={t.anaAllPostsTitle}
      subtitle={t.anaTotalPosts.replace('{n}', String(rows.length))}
      onClose={onClose}
      maxWidth={920}
      animateScale
    >
      {isMobile
        ? <PostsCardList rows={pageRows} sort={sort} onSortChange={onSortChange} onRowClick={onRowClick} />
        : <PostsTable rows={pageRows} sort={sort} onSortChange={onSortChange} onRowClick={onRowClick}
            minWidth={640} startIndex={page * PAGE_SIZE} />}

      {pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}
            style={pageBtn(page === 0)} aria-label={t.anaPrevPage}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 12.5, color: '#6b6680', fontWeight: 600 }}>{page + 1} / {pageCount}</span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}
            style={pageBtn(page >= pageCount - 1)} aria-label={t.anaNextPage}>
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </Modal>
  );
}

const pageBtn = (disabled: boolean) => ({
  width: 32, height: 32, borderRadius: 9, border: '1px solid #ece8f6', background: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: disabled ? '#d5cfe8' : '#6b6680', cursor: disabled ? 'default' : 'pointer',
}) as const;
