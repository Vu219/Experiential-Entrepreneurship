import type { CSSProperties } from 'react';

/**
 * Khung xương trang Phân tích — phản chiếu đúng bố cục v2 (hàng công cụ + 4 KPI ngang + chart 8/nền
 * tảng 4 + bảng 8/cột phải 4 + dải thông tin chi tiết cuối trang) để lúc tải không "nhảy" layout;
 * hiệu ứng shimmer `.sk` dùng chung với Bảng điều khiển.
 *
 * Tách nhỏ theo khối vì mỗi khối tải/thử lại độc lập: đổi bộ lọc chỉ thay phần dữ liệu bằng khung
 * xương tương ứng, KHÔNG remount cả trang (hàng công cụ thật vẫn thao tác được).
 *
 * Lần tải ĐẦU (withToolbar) dùng CÙNG lưới 12 cột và hằng số GRID_GAP = 18 với trang thật, bao gồm
 * đầy đủ tất cả các khối (KPI, chart, nền tảng, top bài viết, loại nội dung, heatmap, thông tin chi
 * tiết) để chuyển tiếp từ skeleton sang dữ liệu thật KHÔNG nhảy layout.
 */

/** Hằng số khoảng cách lưới — khớp với GRID_GAP của trang Analytics. */
const GAP = 18;

export default function AnalyticsSkeleton({
  isMobile,
  isTablet,
  withToolbar = false,
}: {
  isMobile: boolean;
  isTablet: boolean;
  /** true = kèm khung xương thanh lọc (dùng ở lần tải ĐẦU để cả trang đồng bộ, không "dở dang"). */
  withToolbar?: boolean;
}) {
  const wide = !isMobile && !isTablet;
  const kpiSpan = wide ? 3 : isMobile ? 12 : 6;
  const mainSpan = wide ? 8 : 12;
  const sideSpan = wide ? 4 : 12;
  const insightsCols = wide ? 5 : 2;

  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
      {withToolbar && <FilterBarSkeleton />}

      {/* Cùng lưới 12 cột với trang thật — mọi khối là ô của lưới, bằng chiều cao theo hàng. */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gap: GAP, alignItems: 'stretch',
      }}>
        {/* B — 4 KPI */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ana-cell" style={{ gridColumn: `span ${kpiSpan}` }}>
            <div style={{ ...skCard, padding: 16, borderRadius: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sk" style={{ width: 38, height: 38, borderRadius: 12, flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sk" style={{ width: '60%', height: 11 }} />
                <div className="sk" style={{ width: '45%', height: 21, marginTop: 6 }} />
                <div className="sk" style={{ width: '80%', height: 11, marginTop: 6 }} />
              </div>
              <div className="sk" style={{ width: 62, height: 36, borderRadius: 8, flex: 'none' }} />
            </div>
          </div>
        ))}

        {/* C — chart 8 + nền tảng 4 */}
        <div className="ana-cell" style={{ gridColumn: `span ${mainSpan}` }}>
          <BlockSkeleton height={360} />
        </div>
        <div className="ana-cell" style={{ gridColumn: `span ${sideSpan}` }}>
          <BlockSkeleton height={360} withDonut />
        </div>

        {/* D — top bài viết 8 + cột phải 4 (loại nội dung + heatmap) */}
        <div className="ana-cell" style={{ gridColumn: `span ${mainSpan}` }}>
          <TopPostsSkeleton />
        </div>
        <div className="ana-cell" style={{ gridColumn: `span ${sideSpan}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, minWidth: 0 }}>
            <div className="ana-cell" style={{ flex: 1, minHeight: 0 }}>
              <BlockSkeleton height={260} withDonut />
            </div>
            <div className="ana-cell" style={{ flex: 'none' }}>
              <BlockSkeleton height={260} />
            </div>
          </div>
        </div>

        {/* E — dải thông tin chi tiết cuối trang */}
        <div className="ana-cell" style={{ gridColumn: 'span 12' }}>
          <InsightsSkeleton cols={insightsCols} />
        </div>
      </div>
    </div>
  );
}

/** Hàng công cụ không còn là card (bỏ sticky/nền) → khung xương cũng chỉ là ba nút căn phải. */
export function FilterBarSkeleton() {
  return (
    <div aria-hidden="true" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      {[168, 104, 128].map((w, i) => (
        <div key={i} className="sk" style={{ width: w, height: 44, borderRadius: 12 }} />
      ))}
    </div>
  );
}

/** `cols` = số thẻ mỗi hàng, do trang truyền vào để khung xương khớp ĐÚNG lưới 12 cột đang dùng. */
export function KpiSkeleton({ cols }: { cols: number }) {
  return (
    <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP }}>
      {/* Thẻ KPI ngang: icon | (nhãn/số/delta) | sparkline — thấp hơn bản dọc cũ ~40%. */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ ...skCard, padding: 16, borderRadius: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sk" style={{ width: 38, height: 38, borderRadius: 12, flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sk" style={{ width: '60%', height: 11 }} />
            <div className="sk" style={{ width: '45%', height: 21, marginTop: 6 }} />
            <div className="sk" style={{ width: '80%', height: 11, marginTop: 6 }} />
          </div>
          <div className="sk" style={{ width: 62, height: 36, borderRadius: 8, flex: 'none' }} />
        </div>
      ))}
    </div>
  );
}

/** Khung xương một card bất kỳ: tiêu đề + phụ đề + thân (donut hoặc khối chữ nhật). */
export function BlockSkeleton({ height = 300, withDonut = false }: { height?: number; withDonut?: boolean }) {
  return (
    <div aria-hidden="true" style={{ ...skCard, height }}>
      <div className="sk" style={{ width: 190, height: 16 }} />
      <div className="sk" style={{ width: 150, height: 12, marginTop: 8 }} />
      {withDonut ? (
        <>
          <div className="sk" style={{ width: 160, height: 160, borderRadius: 999, margin: '18px auto' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="sk" style={{ width: 26, height: 26, borderRadius: 8 }} />
                <div className="sk" style={{ flex: 1, height: 12 }} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="sk" style={{ width: '100%', height: height - 92, marginTop: 20, borderRadius: 12 }} />
      )}
    </div>
  );
}

export function TopPostsSkeleton() {
  return (
    <div aria-hidden="true" style={{ ...skCard, overflow: 'hidden' }}>
      <div className="sk" style={{ width: 190, height: 16 }} />
      <div className="sk" style={{ width: 240, height: 12, marginTop: 8 }} />
      {/* 6 dòng + thanh "Xem tất cả" full-width dính đáy — khớp bảng thật. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 22 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="sk" style={{ width: 16, height: 12 }} />
            <div className="sk" style={{ flex: 2, height: 14 }} />
            <div className="sk" style={{ width: 24, height: 24, borderRadius: 7 }} />
            <div className="sk" style={{ width: 44, height: 12 }} />
            <div className="sk" style={{ width: 44, height: 12 }} />
          </div>
        ))}
      </div>
      <div className="sk" style={{ height: 46, margin: '20px -24px -24px', borderRadius: 0 }} />
    </div>
  );
}

/** Dải "Thông tin chi tiết": 5 mục liền mạch trong một card (không viền từng mục). */
export function InsightsSkeleton({ cols }: { cols: number }) {
  return (
    <div aria-hidden="true" style={skCard}>
      <div className="sk" style={{ width: 170, height: 16 }} />
      <div className="sk" style={{ width: 130, height: 12, marginTop: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, marginTop: 14 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 14px',
            borderLeft: i % cols === 0 ? 'none' : '1px solid #f1eef8',
          }}>
            <div className="sk" style={{ width: 34, height: 34, borderRadius: 10, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sk" style={{ width: '60%', height: 18 }} />
              <div className="sk" style={{ width: '85%', height: 11, marginTop: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const skCard: CSSProperties = {
  background: '#fff',
  border: '1px solid #efeaf8',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 18px 38px -34px rgba(80,40,140,.5)',
};
