import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card } from '../ui';
import PageContainer from '../PageContainer';
import type { TrendsTab } from '../../trendsData';
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

/** Khối shimmer đơn (class `.sk` dùng chung trong index.css). */
function Sk({ w, h = 12, r = 10, style }: { w?: number | string; h?: number; r?: number | string; style?: CSSProperties }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

const rowBetween: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 };

/**
 * Bề rộng thật của một phần tử (ResizeObserver) — card Ý tưởng / dòng Lịch sử thật cao thấp theo
 * số dòng chữ xuống dòng, mà số dòng phụ thuộc bề rộng cột chứ không chỉ breakpoint viewport.
 * useLayoutEffect nên có số đo trước lần vẽ đầu tiên.
 */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Skeleton toàn trang Xu hướng — theo pattern DashboardSkeleton (status state +
 * class `.sk`). Hình khối & breakpoint đồng bộ với pages/Trends.tsx
 * (sideBySide ≥900, sidebar 280/320, ý tưởng 1/2/3 cột, bảng→card <1024)
 * để chuyển sang nội dung thật không nhảy layout. Khung ngoài PHẢI là `PageContainer`
 * như trang thật (padding + max-width + gap dọc của .page-shell) — tự dựng khung riêng là
 * lý do skeleton từng dính sát mép trái/trên rồi "nhảy" khi nội dung về.
 */
export default function TrendsSkeleton({ tab }: { tab: TrendsTab }) {
  const { t } = useApp();
  const { width, isMobile } = useBreakpoint();
  const sideBySide = width >= 900;
  const sidebarW = width >= 1200 ? 320 : 280;
  const ideaCols = width >= 1440 ? 3 : isMobile ? 1 : 2;
  const ideaCount = ideaCols === 3 ? 9 : ideaCols === 2 ? 6 : 4;
  const asCards = width < 1024;
  // Cùng công thức số dòng/trang với TrendTable để khối skeleton cao đúng bằng bảng thật.
  const trendRows = width >= 1280 ? 10 : width >= 1024 ? 8 : width >= 760 ? 6 : 5;
  const historyBrief = width >= 1280 ? 5 : 3;
  // Bề rộng cột nội dung chính — chưa đo được (lần render đầu) thì lấy cỡ laptop phổ biến.
  const [mainRef, mainMeasured] = useElementWidth<HTMLDivElement>();
  const mainW = mainMeasured || 792;
  // Lưới thẻ thống kê rộng bằng cả hàng nội dung + sidebar; ≤760px (.grid-4) thành 2×2.
  const statCols = width <= 760 ? 2 : 4;
  const statInner = ((sideBySide ? mainW + 20 + sidebarW : mainW) - 16 * (statCols - 1)) / statCols - 36;
  const stat = statShape(statInner, statCols);

  return (
    <PageContainer role="status" aria-busy="true">
      <span style={srOnly}>{t.trLoading}</span>

      {/* Header trang: tiêu đề + subtitle | search + nút Research (khớp cỡ chữ 22/13 của trang thật) */}
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <Sk w={220} h={30} />
          <Sk w={isMobile ? 300 : 380} h={15} style={{ marginTop: 11 }} />
          {/* Mobile: subtitle thật xuống 2 dòng */}
          {isMobile && <Sk w={180} h={15} style={{ marginTop: 5 }} />}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: isMobile ? '1 1 100%' : 'none' }}>
          {/* Mobile: ô tìm kiếm chiếm trọn hàng, nút Research rơi xuống hàng dưới như bản thật */}
          <Sk w={isMobile ? '100%' : 260} h={40} r={12} />
          <Sk w={158} h={40} r={12} />
        </div>
      </div>

      {/* 4 stat card: icon + nhãn | số lớn + delta cùng dòng */}
      <div aria-hidden="true" className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sk w={38} h={38} r={11} style={{ flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, minHeight: stat.labelLines * 16 }}>
                {Array.from({ length: stat.labelLines }).map((_, j) => (
                  <Sk key={j} w={j === stat.labelLines - 1 && stat.labelLines > 1 ? '45%' : '80%'} h={11} />
                ))}
              </div>
            </div>
            {/* Hàng giá trị: grid kéo các thẻ cùng hàng cao bằng thẻ cao nhất — ở lưới 4 cột là thẻ
                "Phiên research gần nhất" (chữ + badge), ở 2×2 thì mỗi hàng một chiều cao riêng. */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', minHeight: stat.valueH(i), paddingTop: 2 }}>
              <Sk w={44} h={28} r={8} />
              <Sk w="45%" h={11} />
            </div>
          </Card>
        ))}
      </div>

      {/* Cột nội dung chính + sidebar phải */}
      <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: sideBySide ? `minmax(0,1fr) ${sidebarW}px` : '1fr', gap: 20, alignItems: 'start' }}>
        <div ref={mainRef} style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Thanh sub-tab: 3 pill — wrap được như bản thật khi cột hẹp */}
          <div style={{ display: 'inline-flex', alignSelf: 'flex-start', gap: 4, background: C.surfaceMuted, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4, flexWrap: 'wrap', maxWidth: '100%' }}>
            {[122, 128, 145].map((w, i) => (
              <Sk key={i} w={w} h={36} r={9} />
            ))}
          </div>
          {tab === 'hot' && <HotSkeleton isMobile={isMobile} asCards={asCards} rows={trendRows} />}
          {tab === 'ideas' && <IdeasSkeleton isMobile={isMobile} compact={width < 1024 && !isMobile} cols={ideaCols} count={ideaCount} mainW={mainW} />}
          {tab === 'history' && <HistorySkeleton mainW={mainW} />}
        </div>
        <SidebarSkeleton tab={tab} historyBrief={historyBrief} narrow={sideBySide && sidebarW < 320} stacked={!sideBySide} />
      </div>

      {/* Cách hoạt động — chỉ ở sub-tab Trend nổi bật */}
      {tab === 'hot' && <div aria-hidden="true"><HowSkeleton isMobile={isMobile} descLines={!isMobile && width < 1200 ? 5 : 3} /></div>}
    </PageContainer>
  );
}

/**
 * Thẻ thống kê theo bề rộng trong (inner) của thẻ — mô phỏng xuống dòng của TrendStatCards: nhãn
 * 12.5px (dài nhất ≈ 180px) cạnh icon 38; hàng giá trị: số + delta (≈ 168px) hoặc thẻ cuối
 * "Hôm nay, 02:00 AM" 16px (≈ 150px) + badge (≈ 85px). Hệ số hiệu chỉnh từ số đo DOM thật.
 */
function statShape(inner: number, cols: number) {
  const labelLines = Math.min(5, Math.max(1, Math.ceil(180 / Math.max(inner - 48, 20))));
  const deltaRow = inner >= 168 ? 31 : 56;
  const lastRow = inner >= 243 ? 31 : inner >= 150 ? 50 : Math.ceil(150 / Math.max(inner, 40)) * 19 + 30;
  return {
    labelLines,
    // 4 cột: cả hàng cao theo thẻ cao nhất; 2×2: hàng trên (0,1) theo delta, hàng dưới (2,3) theo thẻ cuối.
    valueH: (i: number) => (cols === 4 || i >= 2 ? Math.max(deltaRow, lastRow) : deltaRow),
  };
}

/** Hàng bộ lọc dropdown (mobile: xếp dọc full-width như FilterSelect fullWidth). */
function FilterRowSkeleton({ isMobile, blocks, height = 37.5 }: { isMobile: boolean; blocks: number[]; height?: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center' }}>
      {blocks.map((w, i) => (
        <Sk key={i} w={isMobile ? undefined : w} h={height} r={10} />
      ))}
    </div>
  );
}

/**
 * Footer danh sách: dòng "Hiển thị X–Y/Z" + cụm nút phân trang. `pagerW` ≈ bề rộng Pagination thật
 * (nhiều trang hơn = rộng hơn) để hàng tự xuống dòng đúng lúc bản thật xuống dòng.
 */
function ListFooterSkeleton({ padded = false, pagerW = 190 }: { padded?: boolean; pagerW?: number }) {
  return (
    <div style={{ ...rowBetween, alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, padding: padded ? '0 16px 14px' : 0 }}>
      <Sk w={140} h={19} style={{ marginTop: 16 }} />
      <Sk w={pagerW} h={34} r={9} style={{ marginTop: 16, maxWidth: '100%' }} />
    </div>
  );
}

/** Độ rộng thật của hàng bộ lọc tab Trend nổi bật: Ngành · Nền tảng · Độ phù hợp · Thời gian · Bộ lọc nâng cao · Xóa trend. */
const HOT_FILTERS = [275, 210, 189, 218, 148, 110];

/** Sub-tab Trend nổi bật: bộ lọc + bảng (≥1024) / card dọc (<1024). */
function HotSkeleton({ isMobile, asCards, rows }: { isMobile: boolean; asCards: boolean; rows: number }) {
  if (asCards) {
    return (
      <>
        <FilterRowSkeleton isMobile={isMobile} blocks={HOT_FILTERS} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: rows }).map((_, i) => (
            <Card key={i} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Tên trend (mobile xuống 2 dòng) + mô tả 2 dòng như card thật */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Sk w={40} h={40} r={11} style={{ flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Sk w="75%" h={14} />
                  {isMobile && <Sk w="45%" h={14} />}
                  <Sk w="90%" h={12} style={{ marginTop: 3 }} />
                  <Sk w="55%" h={12} />
                </div>
                <Sk w={56} h={22} r={99} style={{ flex: 'none' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minHeight: isMobile ? 36 : 32 }}>
                <Sk w={50} h={22} r={7} />
                <Sk w={96} h={22} />
                <Sk w={70} h={13} />
              </div>
              <div style={{ ...rowBetween, borderTop: `1px solid ${C.surfaceMuted}`, paddingTop: 9, minHeight: isMobile ? 38 : 35 }}>
                <Sk w={68} h={14} />
                <Sk w={90} h={14} />
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
      <FilterRowSkeleton isMobile={isMobile} blocks={HOT_FILTERS} />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, padding: '15px 8px 15px 16px', borderBottom: `1px solid ${C.surfaceMuted}` }}>
          {['32%', '10%', '11%', '17%', '14%', '16%'].map((w, i) => (
            <div key={i} style={{ flexBasis: w, minWidth: 0 }}>
              <Sk w="60%" h={11} />
            </div>
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 8px 12px 16px', borderTop: i > 0 ? `1px solid ${C.surfaceMuted}` : 'none' }}>
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
            {/* Cột Ý tưởng: "N ý tưởng" · "Xem ý tưởng" · nút ghim wrap thành 3 dòng như bảng thật */}
            <div style={{ flexBasis: '16%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Sk w="55%" h={19} />
              <Sk w="75%" h={21} />
              <Sk w={28} h={28} r={8} />
            </div>
          </div>
        ))}
        <ListFooterSkeleton padded />
      </Card>
    </>
  );
}

/** Độ rộng thật của hàng bộ lọc tab Ý tưởng: Trend · Nền tảng · Trạng thái. */
const IDEA_FILTERS = [235, 210, 225];

/**
 * Dựng khung 1 card Ý tưởng theo bề rộng card — mô phỏng đúng các chỗ xuống dòng của IdeaCard:
 * tiêu đề (14px, lh 1.45 ≈ 20px/dòng, cạnh pill trạng thái), dòng "Từ trend", cụm chip wrap tự nhiên
 * (nền tảng · định dạng · điểm phù hợp) và hàng 3 nút (nút "Tạo nội dung" gãy 1–3 dòng khi chật).
 * Hệ số hiệu chỉnh từ số đo DOM của card thật ở 390–1600px.
 */
function ideaCardShape(cardW: number, compact: boolean) {
  const pad = compact ? 14 : 18;
  const contentW = cardW - pad * 2;
  const titleAvail = Math.max(contentW - 60, 40); // trừ pill trạng thái + gap
  const titleLines = Math.min(7, Math.max(1, Math.ceil(380 / titleAvail)));
  const createAvail = contentW - 173; // còn lại cho nút "Tạo nội dung" sau nút Lưu + nút xem
  return {
    pad,
    gap: compact ? 10 : 12,
    titleLines,
    titleH: titleLines === 1 ? 26 : Math.round(titleLines * 20.3),
    fromLines: contentW < 170 ? 2 : 1,
    btnH: createAvail >= 124 ? 39 : createAvail >= 60 ? 58 : 76,
    saveW: Math.min(119, Math.round(contentW * 0.4)),
  };
}

/** Sub-tab Ý tưởng content: bộ lọc + lưới card theo số cột thật + footer phân trang. */
function IdeasSkeleton({ isMobile, compact, cols, count, mainW }: {
  isMobile: boolean;
  compact: boolean;
  cols: number;
  count: number;
  mainW: number;
}) {
  const cardW = (mainW - 14 * (cols - 1)) / cols;
  const c = ideaCardShape(cardW, compact);
  return (
    <>
      <FilterRowSkeleton isMobile={isMobile} blocks={IDEA_FILTERS} height={36} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 14 }}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} style={{ padding: c.pad, display: 'flex', flexDirection: 'column', gap: c.gap }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, height: c.titleH }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 3 }}>
                {Array.from({ length: c.titleLines }).map((_, j) => (
                  <Sk key={j} w={j === c.titleLines - 1 && c.titleLines > 1 ? '60%' : '95%'} h={14} />
                ))}
              </div>
              <Sk w={50} h={22} r={99} style={{ flex: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7, height: c.fromLines * 19 }}>
              <Sk w="80%" h={12} />
              {c.fromLines > 1 && <Sk w="50%" h={12} />}
            </div>
            {/* Chip wrap tự nhiên — cùng bề rộng xấp xỉ chip thật nên xuống dòng cùng lúc */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Sk w={90} h={28} r={8} style={{ maxWidth: '100%' }} />
              <Sk w={75} h={28} r={8} style={{ maxWidth: '100%' }} />
              <Sk w={110} h={28} r={8} style={{ maxWidth: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <Sk h={c.btnH} r={10} style={{ flex: 1, minWidth: 0 }} />
              <Sk w={c.saveW} h={c.btnH} r={10} style={{ flex: 'none' }} />
              <Sk w={38} h={c.btnH} r={10} style={{ flex: 'none' }} />
            </div>
          </Card>
        ))}
      </div>
      <ListFooterSkeleton pagerW={cols === 3 ? 302 : 350} />
    </>
  );
}

/**
 * Dòng Lịch sử research theo bề rộng nội dung card — ResearchHistoryItem là flex-wrap: cột hẹp thì
 * mô tả xuống 2–3 dòng và link "Chi tiết" rơi xuống hàng riêng. Ngưỡng hiệu chỉnh từ số đo DOM thật.
 */
function historyRowShape(contentW: number): { descLines: number; linkBelow: boolean } {
  if (contentW >= 520) return { descLines: 1, linkBelow: false };
  if (contentW >= 440) return { descLines: 2, linkBelow: false };
  if (contentW >= 300) return { descLines: 2, linkBelow: true };
  return { descLines: 3, linkBelow: true };
}

/** Sub-tab Lịch sử research: 7 dòng timeline (HISTORY_PAGE_SIZE) + footer phân trang. */
function HistorySkeleton({ mainW }: { mainW: number }) {
  const contentW = mainW - 48; // Card padding 24 × 2
  const row = historyRowShape(contentW);
  return (
    <Card style={{ paddingTop: 12, paddingBottom: 14 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', flexWrap: 'wrap', borderTop: i > 0 ? `1px solid ${C.surfaceMuted}` : 'none' }}>
          <Sk w={22} h={22} r="50%" style={{ flex: 'none' }} />
          <div style={{ flex: row.linkBelow ? '1 1 calc(100% - 36px)' : 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24 }}>
              <Sk w={140} h={13} />
              <Sk w={78} h={22} r={99} />
            </div>
            <div style={{ marginTop: 3 }}>
              {Array.from({ length: row.descLines }).map((_, j) => (
                <div key={j} style={{ height: 20, display: 'flex', alignItems: 'center' }}>
                  <Sk w={j === row.descLines - 1 && row.descLines > 1 ? '45%' : '85%'} h={12} />
                </div>
              ))}
            </div>
          </div>
          <Sk w={95} h={row.linkBelow ? 26 : 14} style={{ flex: 'none', ...(row.linkBelow ? { marginLeft: 36 } : null) }} />
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${C.surfaceMuted}` }}>
        <ListFooterSkeleton pagerW={280} />
      </div>
    </Card>
  );
}

/** Sidebar phải — CÙNG THỨ TỰ TrendsSidebar: lịch tự động → trạng thái research → khối theo tab. */
function SidebarSkeleton({ tab, historyBrief, narrow, stacked }: {
  tab: TrendsTab;
  historyBrief: number;
  /** Sidebar 280px cạnh nội dung: tiêu đề/giá trị thật xuống dòng nhiều hơn. */
  narrow: boolean;
  /** Sidebar xếp dưới nội dung (<900px): full-width, mô tả gọn 1 dòng. */
  stacked: boolean;
}) {
  // Dòng "Phiên gần nhất" và "Thời gian chạy" xuống 2 dòng khi sidebar hẹp.
  const statusRowH = narrow ? [38, 19, 22, 19, 19, 19, 22] : [19, 19, 22, 19, 19, 19, 22];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* 1. Lịch research tự động */}
      <Card style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Sk w={36} h={36} r={10} style={{ flex: 'none' }} />
          <Sk w="45%" h={15} style={{ flex: 1 }} />
          <Sk w={64} h={22} r={99} />
        </div>
        <Sk w="90%" h={12} />
        {!stacked && <Sk w="60%" h={12} style={{ marginTop: 6 }} />}
        {narrow && <Sk w="40%" h={12} style={{ marginTop: 6 }} />}
        <Sk h={40} r={10} style={{ marginTop: 14 }} />
      </Card>

      {/* 2. Trạng thái research: 7 dòng (phiên · ngành · nền tảng · trend · ý tưởng · thời gian · nguồn) */}
      <Card style={{ padding: 20 }}>
        <div style={{ ...rowBetween, marginBottom: 14, minHeight: narrow ? 40 : 22 }}>
          <Sk w={130} h={15} />
          <Sk w={80} h={22} r={99} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {Array.from({ length: 7 }).map((_, i) => {
            const tall = i === 2 || i === 6; // dòng icon nền tảng / nguồn dữ liệu cao 22px
            return (
              <div key={i} style={{ ...rowBetween, minHeight: statusRowH[i] }}>
                <Sk w={86} h={12} />
                <Sk w={tall ? 76 : 100} h={tall ? 22 : 12} r={tall ? 7 : 10} />
              </div>
            );
          })}
        </div>
        <Sk h={40} r={10} style={{ marginTop: 16 }} />
      </Card>

      {/* Khối giữa theo tab */}
      <Card style={{ padding: 20 }}>
        {tab === 'hot' && (
          <>
            <div style={{ ...rowBetween, marginBottom: 12, minHeight: 22 }}>
              <Sk w={118} h={15} />
              <Sk w={62} h={12} />
            </div>
            {Array.from({ length: historyBrief }).map((_, i) => (
              <div key={i} style={{ padding: '10px 0', borderTop: i > 0 ? `1px solid ${C.surfaceMuted}` : 'none' }}>
                <div style={rowBetween}>
                  <Sk w={82} h={12} />
                  <Sk w={68} h={20} r={99} />
                </div>
                <Sk w="95%" h={13} style={{ marginTop: 5 }} />
                {!stacked && <Sk w="40%" h={13} style={{ marginTop: 4 }} />}
              </div>
            ))}
          </>
        )}
        {tab === 'ideas' && (
          <>
            {/* Thống kê ý tưởng: tổng đã lưu · phân bổ theo định dạng (≈5 dòng) · top 3 trend */}
            <div style={{ height: 19, display: 'flex', alignItems: 'center', marginBottom: 12 }}><Sk w={128} h={15} /></div>
            <div style={{ ...rowBetween, marginBottom: 14, minHeight: 25 }}>
              <Sk w={96} h={12} />
              <Sk w={30} h={22} />
            </div>
            <div style={{ height: 14, display: 'flex', alignItems: 'center', marginBottom: 8 }}><Sk w={140} h={11} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i}>
                  <div style={{ ...rowBetween, marginBottom: 4, minHeight: 19 }}>
                    <Sk w={70} h={12} />
                    <Sk w={14} h={12} />
                  </div>
                  <Sk h={6} r={99} />
                </div>
              ))}
            </div>
            <div style={{ height: 14, display: 'flex', alignItems: 'center', marginBottom: 8 }}><Sk w={170} h={11} /></div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ ...rowBetween, padding: '8px 0', borderTop: i > 0 ? `1px solid ${C.surfaceMuted}` : 'none' }}>
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
            {/* Thống kê phiên: tổng (số lớn) · hoàn thành · đã huỷ · tỉ lệ thành công + thanh */}
            <div style={{ height: 19, display: 'flex', alignItems: 'center', marginBottom: 12 }}><Sk w={160} h={15} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {[25, 19, 19].map((h, i) => (
                <div key={i} style={{ ...rowBetween, minHeight: h }}>
                  <Sk w={96} h={12} />
                  <Sk w={i === 0 ? 30 : 18} h={i === 0 ? 22 : 12} />
                </div>
              ))}
              <div>
                <div style={{ ...rowBetween, marginBottom: 5, minHeight: 19 }}>
                  <Sk w={104} h={12} />
                  <Sk w={34} h={12} />
                </div>
                <Sk h={7} r={99} />
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/** Section "Cách hoạt động": 4 bước ngang (mobile xếp dọc). */
function HowSkeleton({ isMobile, descLines }: { isMobile: boolean; descLines: number }) {
  return (
    <Card>
      <Sk w={140} h={20} style={{ marginBottom: 22 }} />
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 20 : 38 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ flex: isMobile ? 'none' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sk w={40} h={40} r={12} />
              <Sk w={26} h={15} />
            </div>
            <Sk w="60%" h={18} />
            {/* Mô tả thật xuống 3 dòng (tablet 4 cột hẹp: 5 dòng) */}
            {Array.from({ length: descLines }).map((_, j) => (
              <Sk key={j} w={j === descLines - 1 ? '60%' : '95%'} h={13} />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
