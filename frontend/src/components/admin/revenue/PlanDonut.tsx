import { memo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useApp } from '../../../context/AppContext';
import { formatVND } from '../../../api/admin';
import type { PlanRevenue } from '../../../api/revenue';
import { planColor } from './chartTokens';

/**
 * Donut "Cơ cấu gói dịch vụ": tâm hiển thị TỔNG SỐ GIAO DỊCH, legend liệt kê từng gói kèm %
 * và số lượng. Danh sách gói do BE trả về ĐỘNG từ bảng `plans` (gói mới admin thêm tự xuất
 * hiện) — màu gán theo thứ tự, không hardcode theo tên gói.
 */
function PlanDonut({ rows }: { rows: PlanRevenue[] }) {
  const { t, lang } = useApp();
  const total = rows.reduce((sum, r) => sum + r.transactions, 0);
  // Gói chưa bán được vẫn hiện ở legend (số 0) nhưng không vẽ lát donut.
  const slices = rows.filter((r) => r.transactions > 0);

  return (
    <div>
      <div style={{ position: 'relative', height: 190 }}>
        {slices.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: '#a59fbb',
          }}>
            {t.revNoData}
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="transactions" nameKey="planCode" innerRadius={58}
                  outerRadius={84} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {slices.map((r) => (
                    <Cell key={r.planId} fill={planColor(r.displayOrder)} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Tâm donut nằm ngoài SVG để chữ luôn sắc nét và tự xuống dòng theo container. */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, color: '#211c38' }}>
                {total.toLocaleString('vi-VN')}
              </div>
              <div style={{ fontSize: 11.5, color: '#8a85a0' }}>{t.revTxnUnit}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
        {rows.map((r) => (
          <div key={r.planId} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span aria-hidden style={{
              width: 9, height: 9, borderRadius: 3, flex: 'none',
              background: planColor(r.displayOrder), opacity: r.transactions > 0 ? 1 : 0.35,
            }} />
            <span style={{
              flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#3f3a55',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {lang === 'en' ? r.nameEn : r.nameVi}
            </span>
            <span style={{ fontSize: 12.5, color: '#8a85a0', flex: 'none' }}>
              {r.transactions} · {r.sharePct}%
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5b5670', flex: 'none', minWidth: 78, textAlign: 'right' }}>
              {formatVND(r.revenue)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(PlanDonut);
