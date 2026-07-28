import { memo, useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui';
import { formatGroupedNumber } from '../../utils/format';
import { typeColor } from '../dashboard/dashboardTokens';
import RangeBadge from './RangeBadge';
import type { AnalyticsContentType } from '../../api/analytics';

/**
 * Khối F — "Hiệu suất theo loại nội dung": donut BÊN TRÁI + legend BÊN PHẢI (kèm số bài và %).
 * Cùng cách gập của `PlatformBreakdown`: hai cụm tự xuống dòng bằng `flex-wrap` khi card hẹp.
 *
 * ⚠️ Card này KHÔNG chịu bộ lọc "loại nội dung" (ngoại lệ cố ý của backend — lọc còn một loại thì
 * donut chỉ còn một lát 100%), nên phải ghi chú rõ ngay trên card. Backend chỉ trả loại CÓ bài;
 * dữ liệu MVP không có nhóm "Reels" (AI chỉ sinh image/video/text) — không được bịa thêm lát.
 */
function ContentTypeBreakdown({ rows, from, to }: { rows: AnalyticsContentType[]; from: string; to: string }) {
  const { t, lang } = useApp();

  const labelOf = useMemo(() => {
    const dict: Record<string, string> = {
      TEXT: t.dbFmtText, IMAGE: t.dbFmtImage, VIDEO: t.dbFmtVideo,
      CAROUSEL: t.dbFmtCarousel, OTHER: t.dbFmtOther,
    };
    // Nhãn lạ (định dạng backend thêm sau) hiển thị nguyên văn thay vì rơi về "Khác".
    return (label: string) => dict[label] ?? label;
  }, [t]);

  const slices = useMemo(() => rows.filter((r) => r.engagement > 0), [rows]);
  const totalEngagement = useMemo(() => rows.reduce((s, r) => s + r.engagement, 0), [rows]);

  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.anaTypesTitle}</div>
          <div style={{ fontSize: 12.5, color: '#6b6680', marginTop: 2 }}>{t.anaTypesSub}</div>
          <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 4 }}>{t.anaAllTypesNote}</div>
        </div>
        <RangeBadge from={from} to={to} />
      </div>

      {totalEngagement === 0 ? (
        <div style={{
          flex: 1, minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', fontSize: 13.5, color: '#8a85a0', padding: '0 20px',
        }}>
          {t.anaTypesEmpty}
        </div>
      ) : (
        // flex:1 để cụm donut + legend hút phần chiều cao dôi — cột phải luôn cao bằng bảng bên trái.
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 14, flex: 1 }}>
          <div style={{ position: 'relative', width: 132, height: 132, flex: 'none' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="engagement" nameKey="label" innerRadius={42} outerRadius={60}
                  paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {slices.map((r, i) => (
                    <Cell key={r.label} fill={typeColor(i)} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Tâm donut ngoài SVG để chữ sắc nét — cùng kỹ thuật với donut nền tảng. */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: '0 8px',
            }}>
              <div style={{
                fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: '#211c38',
                maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {formatGroupedNumber(totalEngagement, lang)}
              </div>
              <div style={{ fontSize: 10.5, color: '#8a85a0' }}>{t.anaEngagement}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: '1 1 120px', minWidth: 0 }}>
            {slices.map((r, i) => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, flex: 'none', background: typeColor(i) }} />
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#3f3a55',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {labelOf(r.label)}
                </span>
                <span style={{ fontSize: 12.5, color: '#8a85a0', flex: 'none' }}>
                  {formatGroupedNumber(r.posts, lang)} · {r.sharePct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default memo(ContentTypeBreakdown);
