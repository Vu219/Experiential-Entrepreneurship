import type { CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card } from '../ui';
import { C } from '../../styles/colors';

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

/** Một ô "nhãn + giá trị" của thẻ gói hiện tại. */
function FactSk() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
      <Sk w={92} h={11} />
      <Sk w={84} h={15} />
    </div>
  );
}

/**
 * Khung xương trang "Gói & thanh toán" — phản chiếu đúng bố cục thật (tiêu đề · thẻ gói hiện
 * tại · lưới chọn gói · bảng lịch sử) để chuyển sang nội dung không nhảy layout.
 */
export default function BillingSkeleton() {
  const { t } = useApp();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const planCols = isMobile ? 1 : isTablet ? 2 : 3;

  return (
    <>
      <span style={srOnly}>{t.blLoadingPage}</span>
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Tiêu đề trang */}
        <div>
          <Sk w={220} h={26} r={8} />
          <Sk w={isMobile ? '90%' : 420} h={14} style={{ marginTop: 10 }} />
        </div>

        {/* Thẻ gói hiện tại: desktop một hàng, nhỏ hơn thì xếp lưới 2 cột */}
        <Card>
          <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', alignItems: isDesktop ? 'center' : 'stretch', gap: isDesktop ? 28 : 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
              <Sk w={44} h={44} r={14} style={{ flex: 'none' }} />
              <div>
                <Sk w={90} h={11} />
                <Sk w={70} h={22} r={7} style={{ marginTop: 7 }} />
              </div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: 18 }}>
              <FactSk />
              <FactSk />
              <FactSk />
              <FactSk />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
              <Sk w={130} h={16} />
              <Sk w={70} h={24} r={999} />
            </div>
          </div>
        </Card>

        {/* Chọn gói */}
        <div>
          <Sk w={110} h={18} r={7} />
          <Sk w={isMobile ? '85%' : 360} h={13} style={{ margin: '8px 0 14px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${planCols}, minmax(0, 1fr))`, gap: 16 }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} style={{ padding: 20, borderRadius: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Sk w={70} h={17} r={7} />
                  {i === 0 && <Sk w={64} h={20} r={999} />}
                </div>
                <Sk w={160} h={28} r={8} style={{ marginTop: 2 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '6px 0 8px' }}>
                  <Sk w="80%" h={12} />
                  <Sk w="70%" h={12} />
                  <Sk w="60%" h={12} />
                </div>
                <Sk h={44} r={12} />
              </Card>
            ))}
          </div>
        </div>

        {/* Lịch sử thanh toán */}
        <Card>
          <Sk w={170} h={18} r={7} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, margin: '22px 12px 12px' }}>
            {[70, 44, 60, 56, 70].map((w, i) => <Sk key={i} w={w} h={11} />)}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 12px', borderTop: `1px solid ${C.surfaceMuted}` }}>
              <Sk w={isMobile ? 90 : 120} h={13} />
              <Sk w={44} h={13} />
              {!isMobile && <Sk w={130} h={13} />}
              <Sk w={80} h={13} />
              <Sk w={96} h={24} r={999} />
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
