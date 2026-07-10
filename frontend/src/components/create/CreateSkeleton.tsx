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

/**
 * Skeleton BẢNG danh sách nội dung (rows trong Card, khớp ContentTable) — dùng khi
 * lọc/chuyển tab/chuyển trang: toolbar + tabs thật giữ nguyên, chỉ vùng bảng đổi
 * thành skeleton rows thay vì trang trắng hay reload.
 */
export function ContentTableSkeleton({ rows = 6 }: { rows?: number }) {
  const { t } = useApp();
  return (
    <div role="status" aria-busy="true">
      <span style={srOnly}>{t.listLoading}</span>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div aria-hidden="true">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '13px 16px', background: '#faf9fe' }}>
            <Sk w={15} h={15} r={4} />
            {[90, 160, 70, 90, 70, 80, 70].map((w, i) => (
              <Sk key={i} w={w} h={10} />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '13px 16px', borderTop: '1px solid #f1eef8' }}>
              <Sk w={15} h={15} r={4} />
              <Sk w={36} h={36} r={10} />
              <div style={{ flex: 1, minWidth: 120 }}>
                <Sk w="70%" h={13} />
                <Sk w={72} h={9} style={{ marginTop: 6 }} />
              </div>
              <Sk w={52} h={22} r={6} />
              <Sk w={86} h={12} />
              <Sk w={72} h={12} />
              <Sk w={96} h={14} />
              <Sk w={82} h={22} r={99} />
              <Sk w={104} h={30} r={9} />
            </div>
          ))}
        </div>
      </Card>
    </div>
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

/**
 * Skeleton màn XEM CHI TIẾT — mô phỏng đúng bố cục thật bên dưới header (header thật render
 * ngay): trái = card với hàng tab nền tảng, hàng 3 sub-tab, các khối script (hook/bước/CTA
 * có viền trái); phải = panel brand voice + preview bài đăng, khớp ContentViewPanel.
 */
export function ContentViewSkeleton() {
  const { t } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;

  // Khối một phần kịch bản (khớp ScriptBlock 2 cột): badge + timing, trái nội dung / phải gợi ý cảnh quay.
  const scriptBlock = (
    <div style={{ border: '1px solid #ece7f6', borderRadius: 14, background: '#faf8fe', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 7 }}>
        <Sk w={64} h={18} r={7} />
        <Sk w={46} h={18} r={7} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : 'minmax(0,1.15fr) minmax(0,1fr)', gap: stacked ? 10 : 14 }}>
        <div>
          <Sk w="92%" h={12} />
          <Sk w="70%" h={12} style={{ marginTop: 7 }} />
        </div>
        <div>
          <Sk w={90} h={10} />
          <Sk h={34} r={10} style={{ marginTop: 7 }} />
        </div>
      </div>
    </div>
  );

  return (
    <div role="status" aria-busy="true">
      <span style={srOnly}>{t.listLoading}</span>
      <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.2fr .9fr', gap: 20, alignItems: 'start' }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* hàng tab nền tảng (FB/IG/TH) */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Sk w={104} h={34} r={10} />
            <Sk w={104} h={34} r={10} />
            <Sk w={104} h={34} r={10} />
          </div>
          {/* hàng 3 sub-tab + nút Sửa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sk w={248} h={36} r={11} />
            <Sk w={64} h={32} r={10} style={{ marginLeft: 'auto' }} />
          </div>
          {/* các khối script: hook + 2 bước + CTA */}
          {scriptBlock}
          {scriptBlock}
          {scriptBlock}
          {scriptBlock}
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* panel brand voice */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Sk w={150} h={15} />
            <Sk h={7} r={99} />
            <Sk w="90%" h={12} />
            <Sk w="75%" h={12} />
          </Card>
          {/* preview bài đăng */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Sk w={130} h={15} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sk w={36} h={36} r="50%" />
              <div style={{ flex: 1 }}>
                <Sk w={110} h={12} />
                <Sk w={70} h={10} style={{ marginTop: 5 }} />
              </div>
            </div>
            <Sk w="95%" h={12} />
            <Sk w="80%" h={12} />
            <Sk h={180} r={14} />
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Skeleton lớp danh sách nội dung (lần tải ĐẦU): toolbar (search + Bộ lọc + nút tạo) + tabs + bảng. */
export default function CreateSkeleton() {
  const { t } = useApp();
  const { width } = useBreakpoint();

  return (
    <div role="status" aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <span style={srOnly}>{t.listLoading}</span>
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Sk w={width < 640 ? '100%' : 240} h={38} r={11} />
          <Sk w={100} h={38} r={10} />
          <Sk w={132} h={40} r={11} style={{ marginLeft: 'auto' }} />
        </div>
        <Sk w={Math.min(480, width - 48)} h={40} r={12} />
      </div>
      <ContentTableSkeleton rows={6} />
    </div>
  );
}
