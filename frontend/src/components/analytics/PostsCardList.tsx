import { memo, type CSSProperties } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { formatDateTimeVN, formatGroupedNumber } from '../../utils/format';
import { PLATFORM_BG } from '../../theme';
import { PLATFORM_TO_TAG } from '../../api/connections';
import type { AnalyticsTopPost, TopPostSort, TopPostSortField } from '../../api/analytics';

/**
 * Bản MOBILE của bảng bài viết: mỗi bài một card (tiêu đề + nền tảng + ngày, 4 chỉ số xếp lưới 2×2)
 * thay cho bảng cuộn ngang — bảng 7 cột trên màn 375px không đọc được.
 *
 * Sort vẫn giữ được (bảng desktop sort bằng header): một hàng chip metric, bấm lại để đảo chiều —
 * cùng hành vi `clickSort` của `PostsTable` nên hai giao diện không lệch nhau.
 */
function PostsCardList({
  rows,
  sort,
  onSortChange,
  onRowClick,
}: {
  rows: AnalyticsTopPost[];
  sort: TopPostSort;
  onSortChange: (sort: TopPostSort) => void;
  onRowClick: (row: AnalyticsTopPost) => void;
}) {
  const { t, lang } = useApp();

  const metrics: { key: Exclude<TopPostSortField, 'engagement' | 'date'>; label: string }[] = [
    { key: 'views', label: t.anaViews },
    { key: 'likes', label: t.anaLikes },
    { key: 'comments', label: t.anaComments },
    { key: 'shares', label: t.anaShares },
  ];

  const clickSort = (field: TopPostSortField) =>
    onSortChange(sort.field === field ? { field, asc: !sort.asc } : { field, asc: false });

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[...metrics, { key: 'date' as const, label: t.colDate }].map((m) => {
          const active = sort.field === m.key;
          return (
            <button key={m.key} type="button" onClick={() => clickSort(m.key)} aria-pressed={active}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, padding: '0 12px',
                border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6',
                background: active ? 'linear-gradient(135deg,#8b5cf6,#d946ef)' : '#fff',
                color: active ? '#fff' : '#5b5670',
                borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}>
              {m.label}
              {active && (sort.asc ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => {
          const tag = PLATFORM_TO_TAG[r.platform] ?? 'FB';
          return (
            <button key={r.postId} type="button" onClick={() => onRowClick(r)} style={cardBtn}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={26} radius={7} fontSize={11} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    fontSize: 13.5, fontWeight: 700, color: '#2b2543', lineHeight: 1.4,
                  }}>
                    {r.caption || t.schNoCaption}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 3 }}>{formatDateTimeVN(r.publishedAt)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 12 }}>
                {metrics.map((m) => (
                  <div key={m.key} style={{ background: '#faf9fe', borderRadius: 10, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, color: '#8a85a0' }}>{m.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#211c38' }}>
                      {formatGroupedNumber(r[m.key], lang)}
                    </div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const cardBtn: CSSProperties = {
  width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
  border: '1px solid #f1eef8', borderRadius: 14, background: '#fff', padding: 14,
};

export default memo(PostsCardList);
