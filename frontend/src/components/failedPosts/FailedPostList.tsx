import type { CSSProperties } from 'react';
import { Inbox } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { Card, Icon } from '../ui.tsx';
import Pagination from '../admin/Pagination.tsx';
import type { FailedPost } from '../../api/failedPosts.ts';
import FailedPostRow from './FailedPostRow.tsx';

// Danh sách master của layout master–detail: bảng (desktop/tablet) hoặc card list (mobile).

function SkeletonBlock({ w, h = 12 }: { w: number | string; h?: number }) {
  return <span className="skeleton" style={{ display: 'block', width: w, height: h }} />;
}

function TableSkeleton() {
  return (
    <div style={{ padding: '6px 16px 16px' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderTop: i > 0 ? '1px solid #f6f3fc' : 'none' }}>
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
        <div key={i} style={{ border: '1px solid #efeaf8', borderRadius: 14, padding: 13, background: '#fff', display: 'flex', flexDirection: 'column', gap: 9 }}>
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

function EmptyState() {
  const { t } = useApp();
  return (
    <div style={{ textAlign: 'center', padding: '54px 16px', color: '#8a85a0' }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f4f1fb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Icon icon={Inbox} stroke="#a39bbf" />
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{t.fpEmpty}</div>
    </div>
  );
}

export default function FailedPostList({
  items,
  loading,
  selectedId,
  onSelect,
  page,
  pageCount,
  onPageChange,
  variant,
}: {
  /** Item của trang hiện tại (đã cắt 10/trang ở page). */
  items: FailedPost[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (post: FailedPost) => void;
  /** Trang hiện tại, đánh số từ 1. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  variant: 'table' | 'cards';
}) {
  const { t } = useApp();

  if (variant === 'cards') {
    if (loading) return <CardSkeleton />;
    if (items.length === 0) return <Card style={{ padding: 0 }}><EmptyState /></Card>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((p) => (
          <FailedPostRow key={p.id} post={p} variant="card" selected={p.id === selectedId} onSelect={() => onSelect(p)} />
        ))}
        <Pagination page={page} pageCount={pageCount} onChange={onPageChange} />
      </div>
    );
  }

  const th: CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#a59fbb', padding: '12px 16px', whiteSpace: 'nowrap',
    textAlign: 'left', background: '#faf9fe', borderBottom: '1px solid #f1eef8',
  };
  const heads = [t.fpColPost, t.fpColPlatform, t.fpColReason, t.fpErrorCode, t.fpColTime];

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {loading ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 760 }}>
              <colgroup>
                <col />{/* Bài viết — cột co giãn */}
                <col style={{ width: 80 }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 170 }} />
              </colgroup>
              <thead>
                <tr>
                  {heads.map((h, i) => (
                    <th key={h} style={{ ...th, borderLeft: i === 0 ? '4px solid transparent' : undefined }}>{h}</th>
                  ))}
                  <th style={th}>{t.fpColStatus}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <FailedPostRow key={p.id} post={p} variant="row" selected={p.id === selectedId} onSelect={() => onSelect(p)} />
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
