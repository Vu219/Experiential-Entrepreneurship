import { AlertOctagon, Ban, Clock, ShieldAlert, Users, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import OverviewKpiCard from '../OverviewKpiCard';
import type { Tone } from '../../../statusTokens';
import type { PostProblemKind, PostProblemKpi, PostProblemSummary } from '../../../api/admin';
import type { ApDict } from './rejectionReasons';

// Khối C: 4 thẻ KPI. Tái dùng OverviewKpiCard của trang Tổng quan quản trị (icon trong khối bo
// tròn nhạt + số lớn + % thay đổi + sparkline) — không dựng lại thẻ mới.
//
// Mọi con số đến từ GET /admin/posts/failed/summary. Không có mốc so sánh thì hiện "—"/"Mới"
// thay vì bịa 0% hay -100%; chuỗi sparkline vô nghĩa (dưới 3 điểm hoặc toàn 0) thì không vẽ.

/** Trường của summary mà một thẻ đọc — nguồn duy nhất, không if/else rải rác trong JSX. */
type KpiField = 'total' | 'policyViolation' | 'technical' | 'temporary' | 'permanent' | 'affectedUsers';

interface KpiCard {
  field: KpiField;
  labelKey: keyof ApDict;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const CARD_TOTAL_REJECTED: KpiCard = {
  field: 'total', labelKey: 'apKpiTotal', icon: AlertOctagon,
  iconBg: 'linear-gradient(135deg,#ffe9ec,#fff1f3)', iconColor: '#dc2626',
};
const CARD_TOTAL_SYSTEM: KpiCard = {
  field: 'total', labelKey: 'apKpiTotalSystem', icon: AlertOctagon,
  iconBg: 'linear-gradient(135deg,#ffe9ec,#fff1f3)', iconColor: '#dc2626',
};
const CARD_USERS: KpiCard = {
  field: 'affectedUsers', labelKey: 'apKpiUsers', icon: Users,
  iconBg: 'linear-gradient(135deg,#f1e9ff,#faf0ff)', iconColor: '#7c3aed',
};

/**
 * HAI bộ thẻ, khai báo tập trung tại đây. Tab "Lỗi hệ thống" KHÔNG hiện "Vi phạm chính sách"
 * (luôn bằng 0 ở tab đó nên vô nghĩa) mà tách theo khả năng thử lại — đúng cái admin cần biết.
 */
const KPI_SETS: Record<PostProblemKind, KpiCard[]> = {
  rejected: [
    CARD_TOTAL_REJECTED,
    { field: 'policyViolation', labelKey: 'apKpiPolicy', icon: ShieldAlert, iconBg: 'linear-gradient(135deg,#fff1dc,#fff8ec)', iconColor: '#d97706' },
    { field: 'technical', labelKey: 'apKpiTechnical', icon: Wrench, iconBg: 'linear-gradient(135deg,#e0f2fe,#eff8ff)', iconColor: '#0e7490' },
    CARD_USERS,
  ],
  system: [
    CARD_TOTAL_SYSTEM,
    { field: 'temporary', labelKey: 'apKpiTemporary', icon: Clock, iconBg: 'linear-gradient(135deg,#fff1dc,#fff8ec)', iconColor: '#d97706' },
    { field: 'permanent', labelKey: 'apKpiPermanent', icon: Ban, iconBg: 'linear-gradient(135deg,#e0f2fe,#eff8ff)', iconColor: '#0e7490' },
    CARD_USERS,
  ],
};

/** '2026-07-06' + '2026-07-12' → '06/07 - 12/07' (đúng nhãn trong thiết kế). */
const shortRange = (from: string, to: string) => {
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return `${dm(from)} - ${dm(to)}`;
};

/** Ô delta khi phép chia không có nghĩa; null = dùng % bình thường. */
function deltaOverrideOf(kpi: PostProblemKpi, t: ApDict): { label: string; tone: Tone } | undefined {
  if (kpi.deltaState === 'NEW') {
    return { label: t.apDeltaNew, tone: 'danger' };
  }
  if (kpi.deltaState === 'NONE') {
    return { label: t.apDeltaNone, tone: 'neutral' };
  }
  return undefined;
}

export default function PostProblemKpis({ kind, summary }: { kind: PostProblemKind; summary: PostProblemSummary }) {
  const { t } = useApp();
  const comparison = t.apVsPeriod.replace('{range}', shortRange(summary.comparisonFrom, summary.comparisonTo));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {KPI_SETS[kind].map(({ field, labelKey, icon, iconBg, iconColor }) => {
        const kpi = summary[field];
        return (
          <OverviewKpiCard
            key={field}
            icon={icon}
            iconBg={iconBg}
            iconColor={iconColor}
            label={t[labelKey]}
            value={kpi.value.toLocaleString('vi-VN')}
            deltaPct={kpi.deltaPct}
            deltaOverride={deltaOverrideOf(kpi, t)}
            comparisonLabel={comparison}
            series={kpi.sparkline}
            emptyDeltaLabel={t.apNoComparison}
            higherIsBetter={false}
            hideEmptySparkline
          />
        );
      })}
    </div>
  );
}
