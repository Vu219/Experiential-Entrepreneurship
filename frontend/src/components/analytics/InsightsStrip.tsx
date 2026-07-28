import { memo, type CSSProperties } from 'react';
import { Activity, AlertTriangle, ArrowRight, Clock, FileText, Info, TrendingUp, type LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, Icon } from '../ui';
import { formatDeltaPct, formatGroupedNumber } from '../../utils/format';
import { STAT_TONES, type StatTone } from '../dashboard/dashboardTokens';
import type { AnalyticsInsights } from '../../api/analytics';

/**
 * Khối H — dải "Thông tin chi tiết" (full width, CUỐI trang): 5 mục tổng kết kỳ nằm liền mạch trong
 * MỘT card, ngăn nhau bằng vạch dọc mảnh (không bọc mỗi mục thành một card con — 5 khung lồng trong
 * một khung đọc rối và ăn thêm 2 lớp viền).
 *
 * Ba điểm dễ hiểu sai, đã xử lý ngay trên giao diện:
 * - "Bài hoạt động tốt" là bài trên mức TB CỦA CHÍNH KỲ ĐÓ (ngưỡng động) → ghi rõ ngưỡng ở dòng phụ.
 * - "Bài lỗi & cần xử lý" là bài ĐĂNG THẤT BẠI — khác thang với ô trên, nên để tone cảnh báo riêng và
 *   là ô DUY NHẤT bấm được (điều hướng sang trang cùng tên, mang theo khoảng ngày đang lọc).
 *   Cố ý KHÔNG gộp hai số vào một thanh chia đôi hay một dấu "/" — chúng không cùng mẫu số.
 * - "Tỷ lệ tương tác TB" chỉ tính trên bài CÓ lượt xem (Facebook thường không trả lượt xem) → luôn
 *   chú thích số bài được tính / bị loại.
 */
function InsightsStrip({ data, onOpenFailed }: { data: AnalyticsInsights; onOpenFailed: () => void }) {
  const { t, lang } = useApp();
  const { width } = useBreakpoint();
  // 5 ô thẳng hàng ở màn rộng; hẹp dần thì gập xuống 3 → 2 cột. Mobile giữ 2 cột (không xuống 1)
  // để strip vẫn là một dải gọn thay vì cột số liệu dài lê thê.
  const cols = width >= 1280 ? 5 : width > 1024 ? 3 : 2;

  const dowLabel = [t.anaDow1, t.anaDow2, t.anaDow3, t.anaDow4, t.anaDow5, t.anaDow6, t.anaDow7];
  const slotLabel = [t.anaSlot0, t.anaSlot1, t.anaSlot2, t.anaSlot3, t.anaSlot4, t.anaSlot5, t.anaSlot6, t.anaSlot7];
  const num = (v: number) => formatGroupedNumber(v, lang);

  const golden = data.goldenHour;

  return (
    <Card>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.anaInsightsTitle}</div>
      <div style={{ fontSize: 12.5, color: '#6b6680', marginTop: 2 }}>{t.anaInsightsSub}</div>

      {/* Vạch ngăn = borderLeft của mục không đứng đầu hàng, nên khi strip gập xuống 3 hoặc 2 cột
          mục đầu mỗi hàng vẫn không dính vạch thừa ở mép trái. */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, marginTop: 14 }}>
        <Tile index={0} cols={cols} icon={FileText} tone="violet" label={t.anaTotalPostsStat}
          value={num(data.totalPosts)} deltaPct={data.totalPostsDeltaPct} />

        <Tile index={1} cols={cols} icon={TrendingUp} tone="emerald" label={t.anaGoodPosts}
          value={num(data.goodPosts)} deltaPct={data.goodPostsDeltaPct}
          note={t.anaGoodPostsHint.replace('{v}', num(Math.round(data.avgEngagementPerPost)))} />

        <Tile index={2} cols={cols} icon={AlertTriangle} tone="rose" label={t.anaNeedsAttention}
          value={num(data.needsAttentionPosts)} deltaPct={data.needsAttentionDeltaPct}
          note={t.anaNeedsAttentionHint} onClick={onOpenFailed} />

        <Tile index={3} cols={cols} icon={Clock} tone="amber" label={t.anaGoldenHour}
          value={golden ? `${dowLabel[golden.dow - 1]} ${slotLabel[golden.slot]}` : t.anaNotEnoughData}
          muted={!golden}
          note={golden
            ? t.anaGoldenHourHint.replace('{n}', String(golden.posts)).replace('{v}', num(Math.round(golden.avgEngagement)))
            : undefined} />

        <Tile index={4} cols={cols} icon={Activity} tone="violet" label={t.anaAvgEngRate}
          value={data.engagementRatePct === null ? '—' : `${data.engagementRatePct}%`}
          muted={data.engagementRatePct === null}
          deltaPct={data.engagementRatePct === null ? null : data.engagementRateDeltaPct}
          note={data.engagementRatePct === null
            ? t.anaAvgEngRateNone
            : t.anaAvgEngRateNote.replace('{n}', String(data.ratedPosts)).replace('{x}', String(data.excludedPosts))} />
      </div>
    </Card>
  );
}

/**
 * Một mục của strip: icon vuông bo tròn bên trái · bên phải là (con số + badge delta CÙNG MỘT DÒNG,
 * nhãn mô tả ở dòng dưới). Chú thích dài nằm trong tooltip của ⓘ chứ KHÔNG in thành dòng thứ ba: mục
 * có chú thích 2 dòng, mục không có, thì chân các mục lệch nhau và strip cao lêu nghêu.
 */
function Tile({
  index, cols, icon, tone, label, value, deltaPct, note, muted = false, onClick,
}: {
  /** Vị trí trong strip — dùng để bỏ vạch ngăn ở mục đầu mỗi hàng. */
  index: number;
  cols: number;
  icon: LucideIcon;
  tone: StatTone;
  label: string;
  value: string;
  deltaPct?: number | null;
  /** Chú thích dài — hiện qua tooltip ⓘ, không chiếm thêm một dòng của mục. */
  note?: string;
  /** Giá trị không tính được ("Chưa đủ dữ liệu") → chữ nhạt, không nhấn như một con số thật. */
  muted?: boolean;
  onClick?: () => void;
}) {
  const { bg, color } = STAT_TONES[tone];
  const flat = deltaPct === null || deltaPct === undefined || deltaPct === 0;
  const up = !flat && (deltaPct as number) > 0;
  const badge = flat
    ? { color: '#64748b', bg: '#f1f5f9' }
    : up ? { color: '#16a34a', bg: '#eafbf1' } : { color: '#e23d6e', bg: '#fdecf1' };
  const style: CSSProperties = {
    ...tileStyle,
    borderLeft: index % cols === 0 ? 'none' : '1px solid #f1eef8',
  };

  const body = (
    <>
      <span style={{
        width: 34, height: 34, borderRadius: 10, background: bg, flex: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon icon={icon} size={17} stroke={color} />
      </span>

      <span style={{ minWidth: 0, flex: 1 }}>
        {/* Dòng 1 — con số + delta */}
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
          <span style={{
            fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, lineHeight: 1.15,
            fontSize: muted ? 15 : 21, color: muted ? '#8a85a0' : '#211c38',
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {value}
          </span>
          {deltaPct !== undefined && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, borderRadius: 999, padding: '1px 7px',
              fontSize: 11, fontWeight: 700, color: badge.color, background: badge.bg, flex: 'none',
            }}>
              {!flat && <span aria-hidden>{up ? '↑' : '↓'}</span>}
              {formatDeltaPct(deltaPct ?? null)}
            </span>
          )}
        </span>

        {/* Dòng 2 — nhãn mô tả (+ ⓘ khi có chú thích dài) */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, minWidth: 0 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#8a85a0', lineHeight: 1.3,
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {label}
          </span>
          {note && (
            <span title={note} aria-label={note} tabIndex={0}
              style={{ display: 'inline-flex', color: '#c3bcd8', flex: 'none', cursor: 'help' }}>
              <Info size={13} strokeWidth={2} />
            </span>
          )}
        </span>
      </span>

      {onClick && <ArrowRight size={15} color="#a39bbf" style={{ flex: 'none', alignSelf: 'center' }} />}
    </>
  );

  if (!onClick) return <div style={style}>{body}</div>;
  return (
    <button type="button" onClick={onClick} style={{ ...style, cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#fdf7f9'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {body}
    </button>
  );
}

const tileStyle: CSSProperties = {
  background: 'transparent', border: 'none', borderRadius: 0, padding: '4px 14px',
  display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, transition: 'background .15s',
};

export default memo(InsightsStrip);
