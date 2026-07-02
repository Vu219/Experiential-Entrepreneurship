import type { CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card } from '../ui';
import type { TrendsTab } from '../../trendsData';

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

/** Khối shimmer đơn (class `.sk` dùng chung trong index.css). */
function Sk({ w, h = 12, r = 10, style }: { w?: number | string; h?: number; r?: number | string; style?: CSSProperties }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

const rowBetween: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 };

/**
 * Skeleton toàn trang Xu hướng — theo pattern DashboardSkeleton (status state +
 * class `.sk`). Hình khối & breakpoint đồng bộ với pages/Trends.tsx
 * (sideBySide ≥900, sidebar 280/320, ý tưởng 1/2/3 cột, bảng→card <1024)
 * để chuyển sang nội dung thật không nhảy layout.
 */
export default function TrendsSkeleton({ tab }: { tab: TrendsTab }) {
  const { t } = useApp();
  const { width, isMobile } = useBreakpoint();
  const sideBySide = width >= 900;
  const sidebarW = width >= 1200 ? 320 : 280;
  const ideaCols = width >= 1440 ? 3 : isMobile ? 1 : 2;
  const ideaCount = ideaCols === 3 ? 9 : ideaCols === 2 ? 6 : 4;
  const asCards = width < 1024;

  return (
    <div className="view-pop" role="status" aria-busy="true" style={{ maxWidth: width >= 1440 ? 1320 : 1180, margin: '0 auto' }}>
      <span style={srOnly}>{t.trLoading}</span>
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header trang: tiêu đề + subtitle | search + nút Research */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <Sk w={220} h={24} />
            <Sk w={isMobile ? 230 : 380} h={13} style={{ marginTop: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: isMobile ? '1 1 100%' : 'none' }}>
            <Sk w={isMobile ? undefined : 260} h={38} r={12} style={isMobile ? { flex: 1 } : undefined} />
            <Sk w={142} h={38} r={12} />
          </div>
        </div>

        {/* 4 stat card */}
        <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sk w={38} h={38} r={11} />
                <Sk w="55%" h={12} />
              </div>
              <Sk w="45%" h={24} />
            </Card>
          ))}
        </div>

        {/* Cột nội dung chính + sidebar phải */}
        <div style={{ display: 'grid', gridTemplateColumns: sideBySide ? `minmax(0,1fr) ${sidebarW}px` : '1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {/* Thanh sub-tab: 3 pill */}
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', gap: 4, background: '#f4f2fb', border: '1px solid #ece8f6', borderRadius: 12, padding: 4 }}>
              {[88, 106, 110].map((w, i) => (
                <Sk key={i} w={w} h={33} r={9} />
              ))}
            </div>
            {tab === 'hot' && <HotSkeleton isMobile={isMobile} asCards={asCards} />}
            {tab === 'ideas' && <IdeasSkeleton isMobile={isMobile} cols={ideaCols} count={ideaCount} />}
            {tab === 'history' && <HistorySkeleton />}
          </div>
          <SidebarSkeleton tab={tab} />
        </div>

        {/* Cách hoạt động — chỉ ở sub-tab Trend nổi bật */}
        {tab === 'hot' && <HowSkeleton isMobile={isMobile} />}
      </div>
    </div>
  );
}

/** Hàng bộ lọc dropdown (mobile: xếp dọc full-width như FilterSelect fullWidth). */
function FilterRowSkeleton({ isMobile, blocks }: { isMobile: boolean; blocks: number[] }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center' }}>
      {blocks.map((w, i) => (
        <Sk key={i} w={isMobile ? undefined : w} h={36} r={10} />
      ))}
    </div>
  );
}

/** Footer danh sách: dòng "Hiển thị X–Y/Z" + cụm nút phân trang. */
function ListFooterSkeleton({ padded = false }: { padded?: boolean }) {
  return (
    <div style={{ ...rowBetween, alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, padding: padded ? '0 16px 14px' : 0 }}>
      <Sk w={140} h={12} style={{ marginTop: 16 }} />
      <Sk w={190} h={34} r={9} style={{ marginTop: 16 }} />
    </div>
  );
}

/** Sub-tab Trend nổi bật: bộ lọc + bảng (≥1024) / card dọc (<1024). */
function HotSkeleton({ isMobile, asCards }: { isMobile: boolean; asCards: boolean }) {
  if (asCards) {
    return (
      <>
        <FilterRowSkeleton isMobile={isMobile} blocks={[150, 150, 140, 160, 132]} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Sk w={40} h={40} r={11} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Sk w="70%" h={13} />
                  <Sk w="50%" h={11} style={{ marginTop: 6 }} />
                </div>
                <Sk w={56} h={22} r={99} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Sk w={50} h={22} r={7} />
                <Sk w={96} h={22} />
                <Sk w={70} h={13} />
              </div>
              <div style={{ ...rowBetween, borderTop: '1px solid #f4f1fa', paddingTop: 9 }}>
                <Sk w={68} h={12} />
                <Sk w={90} h={12} />
              </div>
            </Card>
          ))}
          <ListFooterSkeleton />
        </div>
      </>
    );
  }
  // Dạng bảng: mỗi hàng chia theo đúng tỷ lệ cột của TrendTable (32/10/11/17/14/16%)
  return (
    <>
      <FilterRowSkeleton isMobile={isMobile} blocks={[150, 150, 140, 160, 132]} />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, padding: '15px 8px 15px 16px', borderBottom: '1px solid #f1eef8' }}>
          {['32%', '10%', '11%', '17%', '14%', '16%'].map((w, i) => (
            <div key={i} style={{ flexBasis: w, minWidth: 0 }}>
              <Sk w="60%" h={11} />
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 8px 12px 16px', borderTop: i > 0 ? '1px solid #f1eef8' : 'none' }}>
            <div style={{ flexBasis: '32%', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sk w={40} h={40} r={11} style={{ flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Sk w="80%" h={13} />
                <Sk w="60%" h={11} style={{ marginTop: 6 }} />
              </div>
            </div>
            <div style={{ flexBasis: '10%', minWidth: 0 }}><Sk w={48} h={22} r={7} /></div>
            <div style={{ flexBasis: '11%', minWidth: 0 }}><Sk w={56} h={22} r={99} /></div>
            <div style={{ flexBasis: '17%', minWidth: 0 }}><Sk w="75%" h={22} /></div>
            <div style={{ flexBasis: '14%', minWidth: 0 }}><Sk w="60%" h={14} /></div>
            <div style={{ flexBasis: '16%', minWidth: 0 }}><Sk w="80%" h={14} /></div>
          </div>
        ))}
        <ListFooterSkeleton padded />
      </Card>
    </>
  );
}

/** Sub-tab Ý tưởng content: bộ lọc + lưới card theo số cột thật. */
function IdeasSkeleton({ isMobile, cols, count }: { isMobile: boolean; cols: number; count: number }) {
  const compact = !isMobile && cols === 2;
  return (
    <>
      <FilterRowSkeleton isMobile={isMobile} blocks={[170, 150, 150]} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 14 }}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} style={{ padding: compact ? 14 : 18, display: 'flex', flexDirection: 'column', gap: compact ? 10 : 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Sk w="95%" h={14} />
                <Sk w="60%" h={14} style={{ marginTop: 7 }} />
              </div>
              <Sk w={52} h={22} r={99} style={{ flex: 'none' }} />
            </div>
            <Sk w="70%" h={12} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sk w={24} h={24} r={7} />
              <Sk w={64} h={24} r={8} />
              <Sk w={86} h={24} r={8} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Sk h={36} r={10} style={{ flex: 1 }} />
              <Sk w={100} h={36} r={10} />
            </div>
          </Card>
        ))}
      </div>
      <ListFooterSkeleton />
    </>
  );
}

/** Sub-tab Lịch sử research: list item icon tròn + ngày + badge + mô tả. */
function HistorySkeleton() {
  return (
    <Card style={{ paddingTop: 12, paddingBottom: 14 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: i > 0 ? '1px solid #f4f1fa' : 'none' }}>
          <Sk w={22} h={22} r="50%" style={{ flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sk w={140} h={13} />
              <Sk w={78} h={20} r={99} />
            </div>
            <Sk w="65%" h={11} style={{ marginTop: 6 }} />
          </div>
          <Sk w={110} h={12} style={{ flex: 'none' }} />
        </div>
      ))}
      <div style={{ borderTop: '1px solid #f4f1fa' }}>
        <ListFooterSkeleton />
      </div>
    </Card>
  );
}

/** Sidebar phải: trạng thái research + khối giữa theo tab + lịch tự động. */
function SidebarSkeleton({ tab }: { tab: TrendsTab }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Trạng thái research */}
      <Card style={{ padding: 20 }}>
        <div style={{ ...rowBetween, marginBottom: 16 }}>
          <Sk w={130} h={15} />
          <Sk w={80} h={22} r={99} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={rowBetween}>
              <Sk w={86} h={12} />
              <Sk w={i === 2 ? 76 : 100} h={i === 2 ? 22 : 12} r={i === 2 ? 7 : 10} />
            </div>
          ))}
        </div>
        <Sk h={38} r={10} style={{ marginTop: 16 }} />
      </Card>

      {/* Khối giữa theo tab */}
      <Card style={{ padding: 20 }}>
        {tab === 'hot' && (
          <>
            <div style={{ ...rowBetween, marginBottom: 12 }}>
              <Sk w={118} h={15} />
              <Sk w={62} h={12} />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid #f4f1fa' : 'none' }}>
                <div style={rowBetween}>
                  <Sk w={82} h={12} />
                  <Sk w={68} h={18} r={99} />
                </div>
                <Sk w="85%" h={11} style={{ marginTop: 6 }} />
              </div>
            ))}
          </>
        )}
        {tab === 'ideas' && (
          <>
            <Sk w={128} h={15} style={{ marginBottom: 14 }} />
            <div style={{ ...rowBetween, marginBottom: 14 }}>
              <Sk w={96} h={12} />
              <Sk w={30} h={20} />
            </div>
            <Sk w={140} h={11} style={{ marginBottom: 10 }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ ...rowBetween, marginBottom: 5 }}>
                  <Sk w={70} h={11} />
                  <Sk w={18} h={11} />
                </div>
                <Sk h={6} r={99} />
              </div>
            ))}
            <Sk w={170} h={11} style={{ margin: '8px 0 10px' }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ ...rowBetween, padding: '8px 0', borderTop: i > 0 ? '1px solid #f4f1fa' : 'none' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <Sk w={26} h={26} r={8} style={{ flex: 'none' }} />
                  <Sk w="70%" h={12} />
                </span>
                <Sk w={64} h={12} style={{ flex: 'none' }} />
              </div>
            ))}
          </>
        )}
        {tab === 'history' && (
          <>
            <Sk w={160} h={15} style={{ marginBottom: 14 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={rowBetween}>
                  <Sk w={96} h={12} />
                  <Sk w={i === 0 ? 34 : 22} h={i === 0 ? 20 : 13} />
                </div>
              ))}
              <div>
                <div style={{ ...rowBetween, marginBottom: 6 }}>
                  <Sk w={104} h={12} />
                  <Sk w={38} h={13} />
                </div>
                <Sk h={7} r={99} />
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Lịch research tự động */}
      <Card style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Sk w={36} h={36} r={10} style={{ flex: 'none' }} />
          <Sk w="45%" h={15} style={{ flex: 1 }} />
          <Sk w={64} h={22} r={99} />
        </div>
        <Sk w="90%" h={12} />
        <Sk w="60%" h={12} style={{ margin: '6px 0 14px' }} />
        <Sk h={38} r={10} />
      </Card>
    </div>
  );
}

/** Section "Cách hoạt động": 4 bước ngang (mobile xếp dọc). */
function HowSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <Card>
      <Sk w={140} h={16} style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 20 : 38 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ flex: isMobile ? 'none' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sk w={40} h={40} r={12} />
              <Sk w={26} h={15} />
            </div>
            <Sk w="60%" h={13} />
            <Sk w="95%" h={11} />
            <Sk w="75%" h={11} />
          </div>
        ))}
      </div>
    </Card>
  );
}
