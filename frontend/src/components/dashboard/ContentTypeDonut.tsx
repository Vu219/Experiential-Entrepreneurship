import { memo, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useApp } from '../../context/AppContext';
import { Card, Icon } from '../ui';
import { formatGroupedNumber } from '../../utils/format';
import { typeColor } from './dashboardTokens';
import RangeBadge from '../analytics/RangeBadge';
import type { AnalyticsContentType } from '../../api/analytics';
import { C } from '../../styles/colors';

/**
 * Donut "Loại nội dung": bài ĐĂNG trong khoảng đang lọc ở biểu đồ, theo loại bài nền tảng báo — CÙNG số với khối
 * "Hiệu suất theo loại nội dung" trang Phân tích (cùng truy vấn backend): lát theo tỷ trọng tương tác, tâm là tổng
 * tương tác, mỗi dòng "số bài · %". Nhãn định dạng lạ (backend thêm về sau) hiển thị nguyên văn.
 */
function ContentTypeDonut({ rows, from, to, id }: { rows: AnalyticsContentType[]; from: string; to: string; id?: string }) {
  const { t, lang, go } = useApp();

  const labelOf = useMemo(() => {
    const dict: Record<string, string> = {
      TEXT: t.dbFmtText,
      IMAGE: t.dbFmtImage,
      VIDEO: t.dbFmtVideo,
      CAROUSEL: t.dbFmtCarousel,
      OTHER: t.dbFmtOther,
    };
    return (label: string) => dict[label] ?? label;
  }, [t]);

  const totalEngagement = rows.reduce((sum, r) => sum + r.engagement, 0);
  const totalPosts = rows.reduce((sum, r) => sum + r.posts, 0);
  // Có bài nhưng chưa có tương tác: vẫn liệt kê số bài thật, vòng donut xám thay vì ẩn cả khối.
  const slices = rows.filter((r) => r.engagement > 0);

  return (
    <Card id={id}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.textStrong }}>{t.dbTypesTitle}</div>
          <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2 }}>{t.dbTypesSub}</div>
        </div>
        <button
          type="button"
          onClick={() => go('analytics', `?from=${from}&to=${to}`)}
          className="link-underline"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent',
            padding: '4px 2px', fontSize: 13, fontWeight: 600, color: C.primary, cursor: 'pointer',
          }}
        >
          {t.navAnalytics}
          <Icon icon={ChevronRight} size={15} stroke={C.primary} />
        </button>
      </div>
      {/* Khoảng ngày của số liệu (theo bộ lọc biểu đồ) — nằm dưới tiêu đề để nút "Phân tích" giữ góc phải. */}
      <div style={{ marginTop: 8 }}><RangeBadge from={from} to={to} /></div>

      {totalPosts === 0 ? (
        <div style={{
          height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', fontSize: 13.5, color: C.textMuted,
        }}>
          {t.dbTypesEmpty}
        </div>
      ) : (
        <>
          <div style={{ position: 'relative', height: 190, marginTop: 14 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {slices.length > 0 ? (
                  <Pie data={slices} dataKey="engagement" nameKey="label" innerRadius={58} outerRadius={84}
                    paddingAngle={2} stroke="none" isAnimationActive={false}>
                    {slices.map((row, i) => (
                      <Cell key={row.label} fill={typeColor(i)} />
                    ))}
                  </Pie>
                ) : (
                  <Pie data={[{ value: 1 }]} dataKey="value" innerRadius={58} outerRadius={84}
                    stroke="none" fill={C.surfaceMuted} isAnimationActive={false} />
                )}
              </PieChart>
            </ResponsiveContainer>
            {/* Tâm donut nằm ngoài SVG để chữ luôn sắc nét và tự xuống dòng theo container. */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, color: C.textStrong }}>
                {formatGroupedNumber(totalEngagement, lang)}
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted }}>{t.anaEngagement}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
            {rows.map((row) => {
              const slice = slices.indexOf(row);
              return (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span aria-hidden style={{
                    width: 9, height: 9, borderRadius: 3, flex: 'none',
                    background: slice >= 0 ? typeColor(slice) : C.surfaceMuted,
                  }} />
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: C.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {labelOf(row.label)}
                  </span>
                  <span style={{ fontSize: 12.5, color: C.textMuted, flex: 'none' }}>
                    {t.dbTopicPosts.replace('{n}', formatGroupedNumber(row.posts, lang))} · {row.sharePct}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

export default memo(ContentTypeDonut);
