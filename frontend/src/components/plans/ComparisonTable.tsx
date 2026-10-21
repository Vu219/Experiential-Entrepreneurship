import { Fragment } from 'react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { ComparisonGroup, PricingPlan } from '../../config/plans';
import CompareCell from './CompareCell';
import { C } from '../../styles/colors';

/**
 * Bảng so sánh gói dùng chung cho landing (/pricing) và tab "Xem trước" của admin — CÙNG một cách render.
 * `table-layout: fixed` + colgroup: cột tên tính năng rộng cố định, các cột gói chia đều, header căn giữa đúng trên cột.
 * Màn hẹp: bảng cuộn ngang trong khung riêng, cột tên tính năng dính bên trái.
 */
export default function ComparisonTable({ plans, groups }: { plans: PricingPlan[]; groups: ComparisonGroup[] }) {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();
  const featureCol = isMobile ? 150 : 260;
  const planCol = isMobile ? 120 : 150;
  const cellPad = isMobile ? '12px 10px' : '14px 16px';
  const stickyCell = {
    position: 'sticky' as const, left: 0, zIndex: 1, background: C.surface,
    boxShadow: `1px 0 0 ${C.surfaceMuted}`,
  };

  return (
    <div style={{
      overflowX: 'auto', WebkitOverflowScrolling: 'touch', background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 20, boxShadow: `0 22px 44px -34px ${C.legacyShadowrgba8040140_5_}`,
    }}>
      <table style={{
        width: '100%', minWidth: featureCol + planCol * plans.length, borderCollapse: 'separate', borderSpacing: 0,
        tableLayout: 'fixed',
      }}>
        <colgroup>
          <col style={{ width: featureCol }} />
          {plans.map((p) => <col key={p.id} />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" style={{ ...stickyCell, padding: cellPad, textAlign: 'left', fontSize: 13, fontWeight: 700, color: C.textMuted, borderBottom: `1px solid ${C.surfaceMuted}` }}>
              {t.ppColFeature}
            </th>
            {plans.map((p) => (
              <th key={p.id} scope="col" style={{ padding: cellPad, textAlign: 'center', verticalAlign: 'middle', borderBottom: `1px solid ${C.surfaceMuted}` }}>
                <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 14 : 15, color: p.featured ? C.primaryStrong : C.textStrong }}>
                  {p.name}
                  {p.featured && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: C.primaryStrong, background: C.primarySoft, border: `1px solid ${C.accentLine}`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                      ★ {t.prPopular}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => (
            <Fragment key={`${g.title}-${gi}`}>
              {g.title && (
                <tr>
                  <td colSpan={plans.length + 1} style={{ padding: `${isMobile ? 14 : 18}px ${isMobile ? 10 : 16}px 8px`, fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 13.5, color: C.primary }}>
                    <span style={{ position: 'sticky', left: isMobile ? 10 : 16 }}>{g.title}</span>
                  </td>
                </tr>
              )}
              {g.rows.map((row, ri) => (
                <tr key={`${row.label}-${ri}`}>
                  <th scope="row" style={{ ...stickyCell, padding: cellPad, textAlign: 'left', fontWeight: 400, fontSize: 13.5, color: C.ink650, borderBottom: `1px solid ${C.bg}`, overflowWrap: 'anywhere' }}>
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={i} style={{ padding: cellPad, textAlign: 'center', verticalAlign: 'middle', borderBottom: `1px solid ${C.bg}`, background: plans[i]?.featured ? C.legacyBgrgba12458237_035_ : undefined }}>
                      <CompareCell value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
