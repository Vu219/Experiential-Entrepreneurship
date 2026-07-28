import { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card } from '../ui';
import PostsTable from './PostsTable';
import PostsCardList from './PostsCardList';
import type { AnalyticsTopPost, TopPostSort } from '../../api/analytics';

/** Số bài xem nhanh trong bảng chính; phần còn lại xem trong modal "Tất cả bài viết". */
const PREVIEW_COUNT = 6;

/**
 * Khối E — "Top bài viết hiệu quả": bảng xem nhanh {@link PREVIEW_COUNT} bài đầu (sắp theo cột), đáy
 * card là thanh "Xem tất cả bài viết" full-width mở modal phân trang toàn bộ danh sách. Không
 * thumbnail (dữ liệu chưa có) → hạng # + tiêu đề + icon nền tảng, xem `PostsTable`.
 */
function TopPostsTable({
  rows,
  sort,
  onSortChange,
  onRowClick,
  onViewAll,
}: {
  rows: AnalyticsTopPost[];
  sort: TopPostSort;
  onSortChange: (sort: TopPostSort) => void;
  onRowClick: (row: AnalyticsTopPost) => void;
  onViewAll: () => void;
}) {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();

  return (
    // `overflow: hidden` bắt buộc: thanh "Xem tất cả" tràn ra mép card bằng margin âm, không cắt thì
    // hai góc dưới của thanh đè ra ngoài viền bo của card.
    <Card style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.anaTopTitle}</div>
        <div style={{ fontSize: 12.5, color: '#6b6680', marginTop: 2 }}>{t.anaTopSub}</div>
      </div>

      {rows.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 12px', textAlign: 'center', fontSize: 13.5, color: '#8a85a0' }}>
          {t.anaTopEmpty}
        </div>
      ) : (
        <>
          {/* Vùng bảng hút hết chiều cao dôi (flex:1) → nút "Xem tất cả" luôn nằm sát đáy card,
              chân hai card cùng hàng thẳng nhau. */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Mobile: danh sách card (không bảng cuộn ngang) — cùng dữ liệu, cùng hành vi sort. */}
            {isMobile
              ? <PostsCardList rows={rows.slice(0, PREVIEW_COUNT)} sort={sort} onSortChange={onSortChange} onRowClick={onRowClick} />
              : <PostsTable rows={rows.slice(0, PREVIEW_COUNT)} sort={sort} onSortChange={onSortChange} onRowClick={onRowClick} />}
          </div>

          {/* Thanh "Xem tất cả bài viết" full-width dính đáy card (margin âm ăn hết padding 24 của
              Card) → mở modal phân trang. */}
          <button type="button" onClick={onViewAll} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: 'auto',
            margin: '16px -24px -24px', padding: '13px 18px',
            border: 'none', borderTop: '1px solid #f1eef8', background: '#fff',
            fontSize: 13, fontWeight: 700, color: '#7c3aed', cursor: 'pointer',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f6f3fc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}>
            {t.anaViewAll}<ArrowRight size={15} />
          </button>
        </>
      )}
    </Card>
  );
}

export default memo(TopPostsTable);
