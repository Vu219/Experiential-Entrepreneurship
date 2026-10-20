import { Check, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card } from '../ui';
import { formatDateVN } from '../../utils/format';
import { PLAN_LIMIT_FIELDS, planLimitLabel, type PlanUsage, type PlanUsageItem } from '../../api/planLimits';
import { C } from '../../styles/colors';

/**
 * "Mức sử dụng trong kỳ" ở trang Gói & thanh toán: từng giới hạn tính năng của gói hiện tại (V18).
 * Số liệu và quyết định chặn đều từ backend (`GET /users/me/plan-usage`) — thẻ chỉ hiển thị.
 */
export default function PlanUsageCard({ usage }: { usage: PlanUsage }) {
  const { t, lang } = useApp();
  const { isMobile } = useBreakpoint();
  const dict = t as unknown as Record<string, string>;
  const fmt = (n: number) => n.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const items = PLAN_LIMIT_FIELDS
    .map((f) => usage.items.find((i) => i.key === f.key))
    .filter((i): i is PlanUsageItem => !!i);

  return (
    <Card style={{ padding: isMobile ? 16 : 20 }}>
      <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: C.textStrong }}>
        {t.blUsageTitle}
      </h2>
      <p style={{ margin: '4px 0 16px', fontSize: 13, color: C.textMuted }}>
        {t.blUsageSub.replace('{date}', formatDateVN(usage.periodEnd))}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '12px 24px' }}>
        {items.map((item) => (
          <UsageRow key={item.key} item={item} label={planLimitLabel(dict, item.key)} fmt={fmt} />
        ))}
      </div>
    </Card>
  );
}

function UsageRow({ item, label, fmt }: { item: PlanUsageItem; label: string; fmt: (n: number) => string }) {
  const { t } = useApp();
  const counted = item.type === 'QUOTA' && item.used != null && item.limit != null && item.limit > 0;
  const pct = counted ? Math.min(100, Math.round((item.used! / item.limit!) * 100)) : 0;
  const full = counted && item.used! >= item.limit!;

  let value: string;
  if (!item.included) value = t.blUsageOff;
  else if (item.type === 'FLAG') value = t.blUsageOn;
  else if (item.limit == null) value = item.used != null ? `${fmt(item.used)} · ${t.blUsageUnlimited}` : t.blUsageUnlimited;
  else if (item.type === 'CAP') value = t.blUsageCap.replace('{n}', fmt(item.limit));
  else value = item.used != null ? `${fmt(item.used)} / ${fmt(item.limit)}` : t.blUsageCap.replace('{n}', fmt(item.limit));

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.text, minWidth: 0 }}>
          {item.included
            ? <Check size={14} strokeWidth={2.4} color={C.primary} aria-hidden />
            : <Lock size={13} strokeWidth={2.2} color={C.textMuted} aria-hidden />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: full ? C.danger : item.included ? C.textStrong : C.textMuted, whiteSpace: 'nowrap' }}>
          {value}
        </span>
      </div>
      {counted && (
        <div style={{ height: 6, borderRadius: 999, background: C.surfaceMuted, marginTop: 6, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: full ? C.danger : pct >= 80 ? C.warning : C.primary }} />
        </div>
      )}
    </div>
  );
}
