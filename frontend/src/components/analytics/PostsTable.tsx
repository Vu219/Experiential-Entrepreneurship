import { memo } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { formatGroupedNumber, formatDateTimeVN } from '../../utils/format';
import { PLATFORM_BG } from '../../theme';
import { PLATFORM_TO_TAG } from '../../api/connections';
import type { AnalyticsTopPost, TopPostSort, TopPostSortField } from '../../api/analytics';

/**
 * Bảng bài viết SẮP XẾP THEO CỘT (thuần trình bày) — dùng trong `TopPostsTable` và `AllPostsModal`.
 *
 * Cải tiến mật độ hiển thị & khoảng cách theo chuẩn SaaS Analytics Dashboard:
 * - Chiều cao mỗi dòng ~56-60px với padding dọc 14px, căn giữa chiều cao cho các cột số.
 * - Phân cấp chữ rõ ràng giữa Tiêu đề (semi-bold 13.5px) và Ngày đăng / Tài khoản (muted 12px, margin-top 4px).
 * - Hiệu ứng hover mượt mà với transition cubic-bezier.
 */
function PostsTable({
  rows,
  sort,
  onSortChange,
  onRowClick,
  minWidth = 560,
  startIndex = 0,
}: {
  rows: AnalyticsTopPost[];
  sort: TopPostSort;
  onSortChange: (sort: TopPostSort) => void;
  onRowClick: (row: AnalyticsTopPost) => void;
  minWidth?: number;
  /** Hạng của dòng đầu tiên (modal phân trang truyền offset để # không lặp lại 1 ở mỗi trang). */
  startIndex?: number;
}) {
  const { t, lang } = useApp();

  // Bấm cột đang sort → đảo chiều; cột mới → mặc định giảm dần (giá trị/ngày mới nhất lên đầu).
  const clickSort = (field: TopPostSortField) =>
    onSortChange(sort.field === field ? { field, asc: !sort.asc } : { field, asc: false });

  type NumericColKey = 'views' | 'likes' | 'comments' | 'shares';

  const numCols: { key: NumericColKey; label: string }[] = [
    { key: 'views', label: t.anaViews },
    { key: 'likes', label: t.anaLikes },
    { key: 'comments', label: t.anaComments },
    { key: 'shares', label: t.anaShares },
  ];

  /** Cột chưa sort vẫn hiện mũi tên đôi mờ — người dùng thấy ngay cột nào bấm được. */
  const SortArrow = ({ field }: { field: TopPostSortField }) =>
    sort.field !== field ? <ChevronsUpDown size={13} style={{ verticalAlign: 'middle', opacity: 0.55 }} />
      : sort.asc ? <ChevronUp size={13} style={{ verticalAlign: 'middle' }} />
        : <ChevronDown size={13} style={{ verticalAlign: 'middle' }} />;

  const sortButton = (field: TopPostSortField, label: string) => (
    <button type="button" onClick={() => clickSort(field)} aria-label={label}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0,
        display: 'inline-flex', alignItems: 'center', gap: 3,
        color: sort.field === field ? '#7c3aed' : '#8a85a0', fontWeight: sort.field === field ? 800 : 600,
      }}>
      {label}<SortArrow field={field} />
    </button>
  );

  const sortableHead = (field: TopPostSortField, label: string, align: 'left' | 'right') => (
    <th key={field} style={{ ...headCell, textAlign: align }}>{sortButton(field, label)}</th>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth }}>
        <thead>
          <tr>
            <th style={{ ...headCell, textAlign: 'right', width: 36 }} aria-label={t.colRank}>#</th>
            <th style={{ ...headCell, textAlign: 'left' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {t.colPost}
                {sortButton('date', t.colDate)}
              </span>
            </th>
            <th style={{ ...headCell, textAlign: 'left', width: 52 }}>{t.colPlatform}</th>
            {numCols.map((c) => sortableHead(c.key, c.label, 'right'))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const tag = PLATFORM_TO_TAG[r.platform] ?? 'FB';
            return (
              <tr key={r.postId} onClick={() => onRowClick(r)}
                style={{
                  borderTop: '1px solid #f1eef8',
                  cursor: 'pointer',
                  transition: 'background-color 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#faf8fe'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <td style={{ ...cell, fontSize: 13, fontWeight: 700, color: '#a59fbb', textAlign: 'right' }}>
                  {startIndex + i + 1}
                </td>
                <td style={{ ...cell, maxWidth: 320 }}>
                  <span title={r.caption ?? undefined} style={{
                    display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontSize: 13.5, fontWeight: 600, color: '#1e1b2e', lineHeight: 1.4,
                  }}>
                    {r.caption || t.schNoCaption}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: '#8a85a0', marginTop: 4, fontWeight: 500 }}>
                    {formatDateTimeVN(r.publishedAt)}
                    {r.accountName && ` · ${r.accountName}`}
                  </span>
                </td>
                <td style={cell}>
                  <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={25} radius={7} fontSize={11} />
                </td>
                {numCols.map((c) => (
                  <td key={c.key} style={numCell}>
                    {formatGroupedNumber(r[c.key], lang)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const headCell = {
  fontSize: 12,
  fontWeight: 600,
  color: '#8a85a0',
  padding: '12px 10px',
  whiteSpace: 'nowrap',
} as const;

const cell = {
  padding: '14px 10px',
  verticalAlign: 'middle',
} as const;

const numCell = {
  padding: '14px 10px',
  fontSize: 13.5,
  fontWeight: 700,
  color: '#1e1b2e',
  textAlign: 'right',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
} as const;

export default memo(PostsTable);
