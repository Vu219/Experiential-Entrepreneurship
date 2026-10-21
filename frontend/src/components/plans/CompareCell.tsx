import { Check } from 'lucide-react';
import type { ComparisonValue } from '../../config/plans';
import { cellDisplay } from '../../utils/comparisonCell';
import { C } from '../../styles/colors';

/**
 * Ô giá trị DUY NHẤT của bảng so sánh gói (admin "Bảng so sánh", "Xem trước" và landing /pricing): chữ, số, ✓, —, "Không
 * giới hạn" đều căn giữa cả ngang lẫn dọc trong một khung flex — svg ✓ không còn bị Tailwind preflight (svg display:block)
 * đẩy lệch trái. `empty` = ô chưa điền (chỉ admin thấy, khác "—" là "không có").
 */
export default function CompareCell({ value, compact = false }: { value: ComparisonValue | null | undefined; compact?: boolean }) {
  const d = cellDisplay(value);
  return (
    <span style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 24, width: '100%', textAlign: 'center',
    }}>
      {d.kind === 'tick' && (
        <span aria-label="✓" style={{
          display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', background: C.primarySoft,
          alignItems: 'center', justifyContent: 'center', flex: 'none',
        }}>
          <Check size={13} strokeWidth={3} color={C.primary} aria-hidden style={{ display: 'block' }} />
        </span>
      )}
      {d.kind === 'none' && <span aria-label="—" style={{ color: C.ink200, fontWeight: 600 }}>—</span>}
      {d.kind === 'empty' && <span style={{ color: C.ink200 }}>·</span>}
      {d.kind === 'text' && (
        <span style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 600, color: C.ink650, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
          {d.text}
        </span>
      )}
    </span>
  );
}
