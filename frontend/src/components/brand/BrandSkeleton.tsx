import type { CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card } from '../ui';

const srOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** Khối shimmer đơn (class `.sk` dùng chung trong index.css — theo pattern TrendsSkeleton). */
function Sk({ w, h = 12, r = 10, style }: { w?: number | string; h?: number; r?: number | string; style?: CSSProperties }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/**
 * Số cột grid card thương hiệu theo 4 mốc màn hình (dùng chung cho skeleton + list thật
 * để chuyển sang nội dung không nhảy layout): mobile <640 → 1, tablet <1024 → 2,
 * laptop/PC ≥1024 → 3 (6 card/trang = 2 hàng cân đối).
 */
export const brandGridCols = (width: number): number => (width < 640 ? 1 : width < 1024 ? 2 : 3);

/** Skeleton 1 card thương hiệu — hình khối khớp BrandProfileCard (logo + tag + health bar + nút). */
function BrandCardSkeleton() {
  return (
    <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <Sk w={50} h={50} r={18} style={{ flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Sk w="70%" h={15} />
          <Sk w="45%" h={12} style={{ marginTop: 7 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Sk w={72} h={24} r={8} />
        <Sk w={92} h={24} r={8} />
      </div>
      <Sk h={7} r={99} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Sk w={92} h={12} />
        <Sk w={110} h={12} />
      </div>
      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <Sk h={35} r={10} style={{ flex: 1 }} />
        <Sk w={38} h={35} r={10} />
        <Sk w={38} h={35} r={10} />
      </div>
    </Card>
  );
}

/** Skeleton tab "Thương hiệu": toolbar (search + filter + nút tạo) + grid 6 card + phân trang. */
export function BrandListSkeleton() {
  const { t } = useApp();
  const { width } = useBreakpoint();
  const cols = brandGridCols(width);

  return (
    <div role="status" aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <span style={srOnly}>{t.listLoading}</span>
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Sk w={width < 640 ? '100%' : 240} h={38} r={11} />
          <Sk w={170} h={38} r={11} />
          <Sk w={122} h={40} r={11} style={{ marginLeft: 'auto' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => <BrandCardSkeleton key={i} />)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Sk w={210} h={34} r={9} />
        </div>
      </div>
    </div>
  );
}

/** Skeleton 1 card chiến lược trong list trái — khớp StrategyCard (tên + badge + meta). */
function StrategyCardSkeleton() {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 15, display: 'flex', flexDirection: 'column', gap: 9, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Sk w="55%" h={14} style={{ flex: 1 }} />
        <Sk w={78} h={22} r={99} />
        <Sk w={28} h={28} r={8} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sk w={86} h={22} r={7} />
        <Sk w={110} h={12} />
      </div>
    </div>
  );
}

/** Cột card chiến lược đang tải — thay Loader trong list khi đổi thương hiệu/refresh. */
export function StrategyCardsSkeleton({ count = 4 }: { count?: number }) {
  const { t } = useApp();
  return (
    <div role="status" aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={srOnly}>{t.listLoading}</span>
      {Array.from({ length: count }).map((_, i) => <StrategyCardSkeleton key={i} />)}
    </div>
  );
}

/** Skeleton phần danh sách chiến lược (search + filter + 4 card + phân trang) — dùng trong sidebar/drawer. */
export function StrategyListSkeleton() {
  return (
    <>
      <Sk h={38} r={11} />
      <Sk w={150} h={38} r={11} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => <StrategyCardSkeleton key={i} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Sk w={180} h={30} r={9} />
      </div>
    </>
  );
}

/**
 * Skeleton tab "Chiến lược content" khi đang tải danh sách thương hiệu — khớp layout
 * StrategyManager: <1024 nút mở drawer + panel detail; ≥1024 sidebar 340px + panel detail.
 */
export function StrategyManagerSkeleton() {
  const { t } = useApp();
  const { width } = useBreakpoint();
  const drawerMode = width < 1024;

  const detail = (
    <Card style={{ width: '100%', maxWidth: 1400, minWidth: 0, padding: 22, alignSelf: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', gap: 18 }}>
        <Sk w={110} h={110} r={32} />
        <Sk w={230} h={18} />
        <Sk w={width < 640 ? '85%' : 380} h={13} />
      </div>
    </Card>
  );

  return (
    <div role="status" aria-busy="true">
      <span style={srOnly}>{t.listLoading}</span>
      {drawerMode ? (
        <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Sk w={168} h={38} r={12} />
          {detail}
        </div>
      ) : (
        <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>
          <div style={{ width: 340, minWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sk w={150} h={26} r={99} />
              <Sk w={34} h={34} r={10} style={{ marginLeft: 'auto' }} />
            </div>
            <StrategyListSkeleton />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>{detail}</div>
        </div>
      )}
    </div>
  );
}
