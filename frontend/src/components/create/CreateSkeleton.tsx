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

/** Khối shimmer đơn (class `.sk` dùng chung trong index.css — theo pattern BrandSkeleton). */
function Sk({ w, h = 12, r = 10, style }: { w?: number | string; h?: number; r?: number | string; style?: CSSProperties }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Số cột grid card nội dung — cùng mốc brandGridCols để layout đồng nhất giữa các tab. */
export const contentGridCols = (width: number): number => (width < 640 ? 1 : width < 1024 ? 2 : 3);

/** Skeleton 1 card nội dung — hình khối khớp ContentCard (tiêu đề + trích + badge + nút). */
function ContentCardSkeleton() {
  return (
    <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Sk w="75%" h={15} />
          <Sk w="95%" h={12} style={{ marginTop: 8 }} />
          <Sk w="60%" h={12} style={{ marginTop: 6 }} />
        </div>
        <Sk w={54} h={24} r={7} />
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        <Sk w={70} h={22} r={8} />
        <Sk w={70} h={22} r={8} />
        <Sk w={120} h={12} style={{ marginLeft: 'auto', alignSelf: 'center' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <Sk h={35} r={10} style={{ flex: 1 }} />
        <Sk w={42} h={35} r={10} />
      </div>
    </Card>
  );
}

/**
 * Skeleton một BƯỚC wizard — mô phỏng đúng khung 2 cột của StepLayout (trái 1.2fr nội
 * dung / phải .9fr panel tổng quan + brand voice) để dữ liệu tải xong đổ vào đúng chỗ,
 * không nhảy layout. Mobile/tablet xếp 1 cột như StepLayout.
 */
export function WizardStepSkeleton() {
  const { t } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;

  const field = (h = 40) => (
    <div>
      <Sk w={140} h={12} />
      <Sk h={h} r={12} style={{ marginTop: 8 }} />
    </div>
  );

  return (
    <div role="status" aria-busy="true">
      <span style={srOnly}>{t.listLoading}</span>
      <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.2fr .9fr', gap: 20, alignItems: 'start' }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Sk w={180} h={16} />
            <Sk w="70%" h={12} style={{ marginTop: 8 }} />
          </div>
          {field()}
          {field()}
          {field()}
          {field(84)}
          <div style={{ display: 'flex', gap: 8 }}>
            <Sk w={110} h={36} r={10} />
            <Sk w={110} h={36} r={10} />
            <Sk w={110} h={36} r={10} />
          </div>
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Sk w={170} h={15} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <Sk w={80} h={10} />
                  <Sk w="85%" h={12} style={{ marginTop: 6 }} />
                </div>
              ))}
            </div>
            <Sk h={38} r={11} style={{ marginTop: 4 }} />
          </Card>
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Sk w={150} h={15} />
            <Sk h={7} r={99} />
            <Sk w="90%" h={12} />
            <Sk w="75%" h={12} />
          </Card>
          <Sk h={46} r={12} />
        </div>
      </div>
    </div>
  );
}

/** Skeleton lớp danh sách nội dung: toolbar (search + 3 filter + nút tạo) + grid 6 card. */
export default function CreateSkeleton() {
  const { t } = useApp();
  const { width } = useBreakpoint();
  const cols = contentGridCols(width);

  return (
    <div role="status" aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <span style={srOnly}>{t.listLoading}</span>
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Sk w={width < 640 ? '100%' : 240} h={38} r={11} />
          <Sk w={150} h={38} r={11} />
          <Sk w={150} h={38} r={11} />
          <Sk w={132} h={40} r={11} style={{ marginLeft: 'auto' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => <ContentCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}
