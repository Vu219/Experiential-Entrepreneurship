import { memo, useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui';
import { formatGroupedNumber } from '../../utils/format';
import { typeColor } from './dashboardTokens';
import type { DashboardDistribution } from '../../api/dashboard';
import { C } from '../../styles/colors';

/**
 * Donut "Loại nội dung": phân bổ bản nền tảng theo định dạng media, tâm hiển thị tổng số bản.
 * Nhãn định dạng lạ (backend thêm về sau) hiển thị nguyên văn thay vì rơi về "khác" — không
 * cần sửa code khi có định dạng mới.
 */
function ContentTypeDonut({ rows }: { rows: DashboardDistribution[] }) {
  const { t, lang } = useApp();

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

  const total = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <Card>
      <div style={{ fontWeight: 700, fontSize: 16, color: C.textStrong }}>{t.dbTypesTitle}</div>
      <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2 }}>{t.dbTypesSub}</div>

      {total === 0 ? (
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
                <Pie data={rows} dataKey="value" nameKey="label" innerRadius={58} outerRadius={84}
                  paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {rows.map((row, i) => (
                    <Cell key={row.label} fill={typeColor(i)} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Tâm donut nằm ngoài SVG để chữ luôn sắc nét và tự xuống dòng theo container. */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, color: C.textStrong }}>
                {formatGroupedNumber(total, lang)}
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted }}>{t.colPost}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
            {rows.map((row, i) => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span aria-hidden style={{
                  width: 9, height: 9, borderRadius: 3, flex: 'none', background: typeColor(i),
                }} />
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: C.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {labelOf(row.label)}
                </span>
                <span style={{ fontSize: 12.5, color: C.textMuted, flex: 'none' }}>
                  {row.value} · {row.sharePct}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

export default memo(ContentTypeDonut);
