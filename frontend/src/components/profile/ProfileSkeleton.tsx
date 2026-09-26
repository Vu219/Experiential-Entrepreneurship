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

/** Thẻ hành động nhỏ (Đổi mật khẩu / Xoá tài khoản): icon + 2 dòng + nút. */
function ActionCardSk({ order }: { order?: number }) {
  return (
    <Card style={{ padding: 22, order }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Sk w={40} h={40} r={11} style={{ flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Sk w="55%" h={14} />
          <Sk w="80%" h={11} style={{ marginTop: 7 }} />
        </div>
      </div>
      <Sk h={42} r={11} style={{ marginTop: 14 }} />
    </Card>
  );
}

/**
 * Khung xương trang "Hồ sơ" — cùng lưới với trang thật (desktop 2 cột `1fr 1.4fr`, mobile/tablet
 * xếp dọc theo đúng `order` của trang: danh tính → chỉnh sửa → hoạt động → mật khẩu → xoá).
 *
 * @param contentMax bề rộng tối đa khối nội dung — truyền đúng hằng số của trang để không lệch.
 */
export default function ProfileSkeleton({ contentMax }: { contentMax: number }) {
  const { t } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;

  return (
    <>
      <span style={srOnly}>{t.prLoading}</span>
      <div aria-hidden="true" style={{ width: '100%', maxWidth: contentMax, margin: '0 auto' }}>
        <div style={{ display: stacked ? 'flex' : 'grid', gridTemplateColumns: stacked ? undefined : '1fr 1.4fr', flexDirection: stacked ? 'column' : undefined, gap: 20, alignItems: stacked ? 'stretch' : 'start' }}>
          {/* Cột trái */}
          <div style={{ display: stacked ? 'contents' : 'flex', flexDirection: 'column', gap: 20 }}>
            <Card style={{ padding: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', order: stacked ? 1 : undefined }}>
              <Sk w={90} h={90} r="50%" style={{ marginBottom: 14 }} />
              <Sk w={160} h={22} r={7} style={{ marginTop: 2 }} />
              <Sk w={190} h={13} style={{ marginTop: 8 }} />
              <Sk w={96} h={26} r={999} style={{ marginTop: 12 }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 20, width: '100%' }}>
                {[0, 1].map((i) => (
                  <div key={i} style={{ flex: 1, border: '1px solid #efeaf8', borderRadius: 13, padding: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <Sk w={52} h={24} r={6} />
                    <Sk w={70} h={12} />
                  </div>
                ))}
              </div>
              {/* Nút Đăng xuất chỉ có ở mobile/tablet — cùng điều kiện với trang thật. */}
              {stacked && <Sk w="100%" h={44} r={12} style={{ marginTop: 18 }} />}
            </Card>
            <ActionCardSk order={stacked ? 4 : undefined} />
            <ActionCardSk order={stacked ? 5 : undefined} />
          </div>

          {/* Cột phải */}
          <div style={{ display: stacked ? 'contents' : 'flex', flexDirection: 'column', gap: 20 }}>
            <Card style={{ padding: 26, order: stacked ? 2 : undefined }}>
              <Sk w={170} h={18} r={7} style={{ marginBottom: 22 }} />
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <Sk w={90} h={12} style={{ marginBottom: 11 }} />
                    <Sk h={46} r={11} />
                  </div>
                ))}
              </div>
              <Sk w={110} h={44} r={12} style={{ marginTop: 18 }} />
            </Card>

            <Card style={{ padding: 24, order: stacked ? 3 : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Sk w={150} h={16} r={7} />
                <Sk w={30} h={30} r={9} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Sk w={34} h={34} r={9} style={{ flex: 'none' }} />
                    <Sk h={12} r={6} style={{ flex: 1 }} />
                    <Sk w={58} h={11} r={6} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
