import type { CSSProperties } from 'react';
import { Inbox } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { Card, Icon } from '../ui.tsx';
import Pagination from '../admin/Pagination.tsx';
import type { FailedPost } from '../../api/failedPosts.ts';
import FailedPostRow from './FailedPostRow.tsx';
import { C } from '../../styles/colors';

// Danh sách master của layout master–detail: bảng (desktop) hoặc card list (mobile/tablet).
// `selectable` bật ô chọn cho thao tác hàng loạt (tab "Cần xử lý" / "Đã bỏ qua").

function SkeletonBlock({ w, h = 12 }: { w: number | string; h?: number }) {
  return <span className="skeleton" style={{ display: 'block', width: w, height: h }} />;
}

function TableSkeleton() {
  return (
    <div style={{ padding: '6px 16px 16px' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: i > 0 ? `1px solid ${C.surfaceMuted}` : 'none' }}>
          <span className="skeleton" style={{ width: 38, height: 38, borderRadius: 9, flex: 'none' }} />
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <SkeletonBlock w="70%" />
            <SkeletonBlock w="40%" h={9} />
          </div>
          <div style={{ flex: 1.4 }}><SkeletonBlock w="90%" /></div>
          <div style={{ flex: 0.6 }}><SkeletonBlock w={52} h={20} /></div>
          <div style={{ flex: 0.8 }}><SkeletonBlock w={70} /></div>
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 13, background: C.surface, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="skeleton" style={{ width: 38, height: 38, borderRadius: 9, flex: 'none' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <SkeletonBlock w="75%" />
              <SkeletonBlock w="45%" h={9} />
            </div>
          </div>
          <SkeletonBlock w="95%" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '54px 16px', color: C.textMuted }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: C.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Icon icon={Inbox} stroke={C.ink350} />
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export default function FailedPostList({
  items,
  loading,
  emptyLabel,
  selectedId,
  checkedIds,
  selectable,
  onSelect,
  onToggle,
  onToggleAll,
  page,
  pageCount,
  onPageChange,
  variant,
}: {
  /** Item của trang hiện tại (đã cắt theo trang ở page). */
  items: FailedPost[];
  loading: boolean;
  emptyLabel: string;
  selectedId: string | null;
  checkedIds: ReadonlySet<string>;
  selectable: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  /** Chọn / bỏ chọn mọi bài của trang hiện tại. */
  onToggleAll: () => void;
  /** Trang hiện tại, đánh số từ 1. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  variant: 'table' | 'cards';
}) {
  const { t } = useApp();
  const allChecked = items.length > 0 && items.every((p) => checkedIds.has(p.id));

  if (variant === 'cards') {
    if (loading) return <CardSkeleton />;
    if (items.length === 0) return <Card style={{ padding: 0 }}><EmptyState label={emptyLabel} /></Card>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((p) => (
          <FailedPostRow key={p.id} post={p} variant="card" selected={p.id === selectedId}
            checked={checkedIds.has(p.id)} selectable={selectable} onSelect={onSelect} onToggle={onToggle} />
        ))}
        <Pagination page={page} pageCount={pageCount} onChange={onPageChange} />
      </div>
    );
  }

  const th: CSSProperties = {
    fontSize: 12, fontWeight: 600, color: C.textFaint, padding: '12px 14px', whiteSpace: 'nowrap',
    textAlign: 'left', background: C.surfaceSubtle, borderBottom: `1px solid ${C.surfaceMuted}`,
  };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {loading ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <EmptyState label={emptyLabel} />
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 760 }}>
              <colgroup>
                <col style={{ width: selectable ? 44 : 4 }} />
                <col />{/* Bài viết — cột co giãn */}
                <col style={{ width: 80 }} />
                <col style={{ width: '34%' }} />
                <col style={{ width: 104 }} />
                <col style={{ width: 150 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...th, borderLeft: '4px solid transparent', paddingRight: 0 }}>
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={onToggleAll}
                        aria-label={t.fpSelectAll}
                        title={t.fpSelectAll}
                        style={{ width: 16, height: 16, accentColor: C.primary, cursor: 'pointer' }}
                      />
                    )}
                  </th>
                  <th style={th}>{t.fpColPost}</th>
                  <th style={th}>{t.fpColPlatform}</th>
                  <th style={th}>{t.fpColReason}</th>
                  <th style={th}>{t.fpColTime}</th>
                  <th style={th}>{t.fpColStatus}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <FailedPostRow key={p.id} post={p} variant="row" selected={p.id === selectedId}
                    checked={checkedIds.has(p.id)} selectable={selectable} onSelect={onSelect} onToggle={onToggle} />
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            <Pagination page={page} pageCount={pageCount} onChange={onPageChange} />
          </div>
        </>
      )}
    </Card>
  );
}
