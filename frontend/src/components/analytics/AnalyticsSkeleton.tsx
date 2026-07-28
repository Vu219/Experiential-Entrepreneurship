import type { CSSProperties, ReactNode } from 'react';

/**
 * Khung xương trang Phân tích — phản chiếu đúng bố cục v2 (hàng công cụ + 4 KPI ngang + chart 8/nền
 * tảng 4 + bảng 8/cột phải 4 + dải thông tin chi tiết cuối trang) để lúc tải không "nhảy" layout;
 * hiệu ứng shimmer `.sk` dùng chung với Bảng điều khiển.
 *
 * Tách nhỏ theo khối vì mỗi khối tải/thử lại độc lập: đổi bộ lọc chỉ thay phần dữ liệu bằng khung
 * xương tương ứng, KHÔNG remount cả trang (hàng công cụ thật vẫn thao tác được).
 *
 * HAI QUY TẮC bắt buộc để khung xương không lệch card thật:
 * 1. **Không đặt `height` cứng.** Card thật cao đầy ô lưới (`.ana-cell`); khung xương cũng chỉ đặt
 *    `minHeight` = chiều cao TỰ NHIÊN của card thật rồi để lưới kéo giãn. Đặt `height` thì hai card
 *    cùng hàng lệch chân nhau ngay lúc đang tải.
 * 2. **Dùng đúng công thức breakpoint của trang** (xem {@link AnalyticsSkeleton}) — lệch một ngưỡng
 *    là tải xong cả trang đổi số cột.
 */

/** Hằng số khoảng cách lưới — khớp với GRID_GAP của trang Analytics. */
const GAP = 18;

/** Chiều cao tự nhiên của từng card thật (px) — đo theo padding/typography hiện tại của mỗi khối. */
const MIN_H = {
  kpi: 98,
  chart: 424,
  platform: 409,
  topPosts: 580,
  contentType: 255,
  heatmap: 279,
  insights: 155,
} as const;

export default function AnalyticsSkeleton({
  width,
  withToolbar = false,
}: {
  /** Bề rộng viewport — khung xương phải chia cột y hệt trang thật. */
  width: number;
  /** true = kèm khung xương thanh lọc (dùng ở lần tải ĐẦU để cả trang đồng bộ, không "dở dang"). */
  withToolbar?: boolean;
}) {
  // ⚠️ CÙNG công thức với Analytics.tsx — sửa ở một chỗ thì phải sửa cả hai.
  const wide = width >= 1280;
  const kpiSpan = wide ? 3 : width < 760 ? 12 : 6;
  const mainSpan = wide ? 8 : 12;
  const sideSpan = wide ? 4 : 12;
  const insightsCols = wide ? 5 : width > 1024 ? 3 : 2;

  return (
    // Fragment (KHÔNG bọc div): thanh lọc và lưới là con TRỰC TIẾP của `.page-shell` nên hưởng đúng
    // khoảng cách 24px giữa hai khối. Bọc thêm div sẽ dùng gap 18 → tải xong cả lưới nhích 6px.
    <>
      {withToolbar && <FilterBarSkeleton isMobile={width < 760} />}

      {/* Cùng lưới 12 cột với trang thật — mọi khối là ô của lưới, bằng chiều cao theo hàng. */}
      <div aria-hidden="true" style={{
        display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gap: GAP, alignItems: 'stretch',
      }}>
        {/* B — 4 KPI */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ana-cell" style={{ gridColumn: `span ${kpiSpan}` }}>
            <KpiCardSkeleton />
          </div>
        ))}

        {/* C — chart 8 + nền tảng 4 */}
        <div className="ana-cell" style={{ gridColumn: `span ${mainSpan}` }}>
          <BlockSkeleton minHeight={MIN_H.chart} />
        </div>
        <div className="ana-cell" style={{ gridColumn: `span ${sideSpan}` }}>
          <PlatformSkeleton />
        </div>

        {/* D — top bài viết 8 + cột phải 4 (loại nội dung + heatmap) */}
        <div className="ana-cell" style={{ gridColumn: `span ${mainSpan}` }}>
          <TopPostsSkeleton />
        </div>
        <div className="ana-cell" style={{ gridColumn: `span ${sideSpan}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, minWidth: 0 }}>
            <div className="ana-cell" style={{ flex: 1, minHeight: 0 }}><ContentTypeSkeleton /></div>
            <div className="ana-cell" style={{ flex: 'none' }}><HeatmapSkeleton /></div>
          </div>
        </div>

        {/* E — dải thông tin chi tiết cuối trang */}
        <div className="ana-cell" style={{ gridColumn: 'span 12' }}>
          <InsightsSkeleton cols={insightsCols} />
        </div>
      </div>
    </>
  );
}

/** Hàng công cụ không còn là card (bỏ sticky/nền) → khung xương cũng chỉ là ba nút căn phải. */
export function FilterBarSkeleton({ isMobile = false }: { isMobile?: boolean }) {
  // Mobile hai nút cuối chỉ còn icon (nhãn bị ẩn) → khung xương phải hẹp theo, không thì thanh lọc
  // co lại thấy rõ ngay khi tải xong.
  const widths = isMobile ? [128, 42, 42] : [212, 100, 136];
  return (
    <div aria-hidden="true" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', minHeight: 44 }}>
      {widths.map((w, i) => (
        <div key={i} className="sk" style={{ width: w, height: 44, borderRadius: 12, flex: 'none' }} />
      ))}
    </div>
  );
}

/** Một thẻ KPI (icon | nhãn/số/delta | sparkline) — khớp `KpiCard`. */
export function KpiCardSkeleton() {
  return (
    <div aria-hidden="true" style={{
      ...skCard, padding: 16, borderRadius: 18, minHeight: MIN_H.kpi,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div className="sk" style={{ width: 38, height: 38, borderRadius: 12, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sk" style={{ width: '60%', height: 14 }} />
        <div className="sk" style={{ width: '45%', height: 25, marginTop: 3 }} />
        <div className="sk" style={{ width: '80%', height: 16, marginTop: 4 }} />
      </div>
      <div className="sk" style={{ width: 62, height: 36, borderRadius: 8, flex: 'none' }} />
    </div>
  );
}

/** Card thường: tiêu đề + phụ đề + thân chiếm hết chỗ còn lại (chart, heatmap khi chưa có dữ liệu). */
export function BlockSkeleton({ minHeight = 300 }: { minHeight?: number }) {
  return (
    <SkCard minHeight={minHeight}>
      <SkHeader withLegend />
      <div className="sk" style={{ flex: 1, minHeight: 120, marginTop: 16, borderRadius: 12 }} />
    </SkCard>
  );
}

/** "Hiệu suất theo nền tảng": donut TRÊN (căn giữa) + 3 dòng nền tảng ở DƯỚI — khớp bố cục thật. */
export function PlatformSkeleton() {
  return (
    <SkCard minHeight={MIN_H.platform}>
      <SkHeader withNote />
      <div className="sk" style={{ width: DONUT, height: DONUT, borderRadius: 999, margin: '14px auto 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div className="sk" style={{ width: 28, height: 28, borderRadius: 9, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sk" style={{ width: '54%', height: 13 }} />
              <div className="sk" style={{ width: '38%', height: 11, marginTop: 5 }} />
            </div>
            <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div className="sk" style={{ width: 42, height: 13 }} />
              <div className="sk" style={{ width: 28, height: 11, marginTop: 5 }} />
            </div>
          </div>
        ))}
      </div>
    </SkCard>
  );
}

/** "Hiệu suất theo loại nội dung": donut BÊN TRÁI + legend một dòng bên phải. */
export function ContentTypeSkeleton() {
  return (
    <SkCard minHeight={MIN_H.contentType}>
      <SkHeader withNote />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flex: 1 }}>
        <div className="sk" style={{ width: 132, height: 132, borderRadius: 999, flex: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 0 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div className="sk" style={{ width: 9, height: 9, borderRadius: 3, flex: 'none' }} />
              <div className="sk" style={{ flex: 1, height: 13 }} />
              <div className="sk" style={{ width: 46, height: 12, flex: 'none' }} />
            </div>
          ))}
        </div>
      </div>
    </SkCard>
  );
}

/** Heatmap: lưới 7 thứ × 8 khung giờ + dải chú giải — vẽ đúng số ô để không co lại khi có dữ liệu. */
export function HeatmapSkeleton() {
  return (
    <SkCard minHeight={MIN_H.heatmap}>
      <SkHeader />
      <div style={{
        display: 'grid', gridTemplateColumns: '24px repeat(8, minmax(20px, 1fr))', gap: 3, marginTop: 12,
      }}>
        <span />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`h${i}`} className="sk" style={{ height: 10, borderRadius: 4 }} />
        ))}
        {Array.from({ length: 7 }).map((_, row) => [
          <div key={`d${row}`} className="sk" style={{ height: 11, borderRadius: 4, alignSelf: 'center' }} />,
          ...Array.from({ length: 8 }).map((_, col) => (
            <div key={`${row}-${col}`} className="sk" style={{ height: 16, borderRadius: 5 }} />
          )),
        ])}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <div className="sk" style={{ width: 96, height: 12 }} />
        <div className="sk" style={{ width: 72, height: 12 }} />
      </div>
    </SkCard>
  );
}

/** Bảng "Top bài viết": hàng tiêu đề + 6 dòng cao như dòng thật + thanh "Xem tất cả" dính đáy. */
export function TopPostsSkeleton() {
  return (
    <SkCard minHeight={MIN_H.topPosts} overflowHidden>
      <div style={{ marginBottom: 6 }}>
        <div className="sk" style={{ width: 176, maxWidth: '70%', height: 16 }} />
        <div className="sk" style={{ width: 230, maxWidth: '84%', height: 13, marginTop: 5 }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Hàng tiêu đề cột (padding dọc 12 ở bảng thật). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
          <div className="sk" style={{ width: 16, height: 12, flex: 'none' }} />
          <div className="sk" style={{ flex: 2, height: 12 }} />
          <div className="sk" style={{ width: 44, height: 12, flex: 'none' }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="sk" style={{ width: 40, height: 12, flex: 'none' }} />
          ))}
        </div>
        {/* 6 dòng — cao 66px như dòng thật (padding 14 + hai dòng chữ). */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, height: 66, borderTop: '1px solid #f1eef8',
          }}>
            <div className="sk" style={{ width: 16, height: 12, flex: 'none' }} />
            <div style={{ flex: 2, minWidth: 0 }}>
              <div className="sk" style={{ width: '82%', height: 14 }} />
              <div className="sk" style={{ width: '46%', height: 12, marginTop: 5 }} />
            </div>
            <div className="sk" style={{ width: 25, height: 25, borderRadius: 7, flex: 'none' }} />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="sk" style={{ width: 40, height: 13, flex: 'none' }} />
            ))}
          </div>
        ))}
      </div>

      {/* Thanh "Xem tất cả" tràn ra mép card bằng margin âm — y hệt card thật. */}
      <div className="sk" style={{ height: 45, margin: '16px -24px -24px', borderRadius: 0 }} />
    </SkCard>
  );
}

/** Dải "Thông tin chi tiết": 5 mục liền mạch trong một card (không viền từng mục). */
export function InsightsSkeleton({ cols }: { cols: number }) {
  return (
    <SkCard minHeight={MIN_H.insights}>
      <SkHeader withBadge={false} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, marginTop: 14 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 14px',
            borderLeft: i % cols === 0 ? 'none' : '1px solid #f1eef8',
          }}>
            <div className="sk" style={{ width: 34, height: 34, borderRadius: 10, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sk" style={{ width: '62%', height: 24 }} />
              <div className="sk" style={{ width: '85%', height: 16, marginTop: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </SkCard>
  );
}

/** Đường kính donut khung xương — bằng donut thật của `PlatformBreakdown`. */
const DONUT = 150;

/**
 * Vỏ card khung xương: cùng padding/bo/viền với `Card` và LUÔN cao đầy ô lưới. `minHeight` (không
 * phải `height`) = chiều cao tự nhiên của card thật → lưới vẫn kéo giãn được như hàng card thật.
 */
function SkCard({
  minHeight, overflowHidden = false, children,
}: {
  minHeight: number;
  overflowHidden?: boolean;
  children: ReactNode;
}) {
  return (
    <div aria-hidden="true" style={{
      ...skCard, minHeight, display: 'flex', flexDirection: 'column',
      overflow: overflowHidden ? 'hidden' : undefined,
    }}>
      {children}
    </div>
  );
}

/** Cụm mở đầu chung của mọi card lớn: tiêu đề + phụ đề (+ dòng ghi chú, + badge khoảng ngày). */
function SkHeader({
  withNote = false, withBadge = true, withLegend = false,
}: {
  /** Card có dòng "áp dụng cho mọi nền tảng/loại nội dung" ở dưới phụ đề. */
  withNote?: boolean;
  withBadge?: boolean;
  /** Card biểu đồ có hàng chip legend bật/tắt series dưới phụ đề. */
  withLegend?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sk" style={{ width: 176, maxWidth: '70%', height: 16 }} />
        <div className="sk" style={{ width: 138, maxWidth: '58%', height: 13, marginTop: 5 }} />
        {withNote && <div className="sk" style={{ width: 108, maxWidth: '48%', height: 12, marginTop: 6 }} />}
        {withLegend && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {[74, 78, 84, 72].map((w, i) => (
              <div key={i} className="sk" style={{ width: w, height: 30, borderRadius: 8 }} />
            ))}
          </div>
        )}
      </div>
      {withBadge && <div className="sk" style={{ width: 96, height: 25, borderRadius: 999, flex: 'none' }} />}
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
