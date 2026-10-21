// Ô bảng so sánh gói — hàm thuần (test tests/comparisonCell.test.ts). Một nguồn cho admin (Bảng so sánh, Xem trước)
// và landing: dòng LIÊN KẾT giới hạn lấy giá trị thật của gói, nền tảng khoá toàn hệ thống hiện "Sắp ra mắt".
import type { ComparisonValue } from '../config/plans';
import type { PlanLimitKey, PlanLimitUnit } from '../api/planLimits';

type Dict = Record<string, string>;

export interface AutoCell {
  kind: 'NUMBER' | 'UNLIMITED' | 'OFF' | 'ON' | 'PLATFORMS';
  value: number | null;
  platforms: { platform: string; comingSoon: boolean }[] | null;
}

const PLATFORM_NAMES: Record<string, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

/** Đơn vị hiển thị sau con số của ô tự động (khoá i18n `cmpUnit_<unit>`; không có khoá = chỉ con số). */
const UNIT_OF: Partial<Record<PlanLimitKey, PlanLimitUnit>> = {
  TREND_RESEARCH_PER_PERIOD: 'perPeriod',
  IDEAS_PER_RESEARCH: 'ideas',
  SCHEDULED_POSTS_PER_PERIOD: 'perPeriod',
  SCHEDULE_HORIZON_DAYS: 'days',
  ANALYTICS_HISTORY_DAYS: 'days',
  STRATEGY_OPTIMIZATION_PER_PERIOD: 'perPeriod',
  POLICY_CHECK_AI_PER_PERIOD: 'perPeriod',
  AI_FIX_PER_VERSION: 'times',
};

/** Giá trị hiển thị của một ô tự động: true = ✓, false = —, chuỗi = hiển thị nguyên văn. */
export function autoCellValue(cell: AutoCell, key: PlanLimitKey, t: Dict): ComparisonValue {
  switch (cell.kind) {
    case 'ON':
      return true;
    case 'OFF':
      return false;
    case 'UNLIMITED':
      return t.cmpUnlimited ?? 'Unlimited';
    case 'PLATFORMS':
      return (cell.platforms ?? [])
        .map((p) => {
          const name = PLATFORM_NAMES[p.platform] ?? p.platform;
          return p.comingSoon ? `${name} (${t.paComingSoon ?? 'Coming soon'})` : name;
        })
        .join(' · ');
    case 'NUMBER': {
      const n = (cell.value ?? 0).toLocaleString('vi-VN');
      const unit = UNIT_OF[key];
      const suffix = unit ? t[`cmpUnit_${unit}`] : '';
      return suffix ? `${n} ${suffix}` : n;
    }
    default:
      return false;
  }
}

/** Ô "trống" (chưa điền) trong bảng nhập tay hiển thị khác "—" (không có) — admin phân biệt được. */
export type CellDisplay = { kind: 'tick' } | { kind: 'none' } | { kind: 'text'; text: string } | { kind: 'empty' };

export function cellDisplay(value: ComparisonValue | null | undefined): CellDisplay {
  if (value === true) return { kind: 'tick' };
  if (value === false) return { kind: 'none' };
  if (value == null || value === '') return { kind: 'empty' };
  return { kind: 'text', text: value };
}
