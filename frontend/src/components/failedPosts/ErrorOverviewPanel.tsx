import { ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { Card, Icon } from '../ui.tsx';
import { TONE_COLORS } from '../../statusTokens.ts';
import type { FailedPost } from '../../api/failedPosts.ts';
import { codeLabel, isPolicy } from './shared.ts';
import { C } from '../../styles/colors';

// Panel "Tổng quan lỗi" (cột phải, sticky trên desktop): donut tổng lỗi (% vi phạm CS vs
// % lỗi kỹ thuật), giải thích "Vi phạm chính sách là gì?" và "Mã lỗi vi phạm phổ biến".
// TỔNG HỢP trên danh sách đã lọc theo tab/bộ lọc (props items) — KHÔNG đổi theo bài đang chọn.
// `collapsible` bật ở mobile/tablet: header bấm để thu gọn/mở.

const DANGER = TONE_COLORS.danger;
const WARNING = TONE_COLORS.warning;

function Donut({ total, policy }: { total: number; policy: number }) {
  const size = 148;
  const r = 56;
  const c = 2 * Math.PI * r;
  const policyFrac = total > 0 ? policy / total : 0;
  const common = { cx: size / 2, cy: size / 2, r, fill: 'none', strokeWidth: 16 } as const;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false" style={{ transform: 'rotate(-90deg)' }}>
      <circle {...common} stroke={total > 0 ? WARNING.color : C.chartGrid} />
      {policy > 0 && (
        <circle {...common} stroke={DANGER.color} strokeDasharray={`${policyFrac * c} ${c}`} strokeLinecap={policyFrac < 1 ? 'round' : 'butt'} />
      )}
    </svg>
  );
}

function LegendRow({ color, label, count, pct, postsLabel }: { color: string; label: string; count: number; pct: number; postsLabel: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, background: C.surfaceMuted, borderRadius: 10, padding: '10px 12px' }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: color, flex: 'none' }} aria-hidden />
      <span style={{ color: C.ink600, fontWeight: 600, flex: 1, minWidth: 0 }}>{label}</span>
      <span style={{ color: C.textMuted, fontSize: 11.5, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{count} {postsLabel}</span>
      <span style={{ fontWeight: 800, color, minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
    </div>
  );
}

export default function ErrorOverviewPanel({
  items,
  collapsible = false,
  open = true,
  onToggle,
}: {
  /** Danh sách sau khi áp tab + bộ lọc (KHÔNG cắt trang) — nguồn tổng hợp của panel. */
  items: FailedPost[];
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const { t } = useApp();
  const total = items.length;
  const policy = items.filter(isPolicy).length;
  const technical = total - policy;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Mã lỗi phổ biến trong phạm vi đang lọc, ưu tiên vi phạm CS trước, nhiều bài trước.
  const codeCounts = new Map<string, { count: number; policy: boolean }>();
  for (const p of items) {
    if (!p.errorCode) continue;
    const cur = codeCounts.get(p.errorCode) ?? { count: 0, policy: isPolicy(p) };
    codeCounts.set(p.errorCode, { count: cur.count + 1, policy: cur.policy || isPolicy(p) });
  }
  const topCodes = [...codeCounts.entries()]
    .sort((a, b) => Number(b[1].policy) - Number(a[1].policy) || b[1].count - a[1].count)
    .slice(0, 5);

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Donut tổng lỗi */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 148, height: 148 }}>
          <Donut total={total} policy={policy} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 34, color: C.textStrong, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{total}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginTop: 4 }}>{t.fpTotal}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 12 }}>
          <LegendRow color={DANGER.color} label={t.fpPolicy} count={policy} pct={pct(policy)} postsLabel={t.fpPosts} />
          <LegendRow color={WARNING.color} label={t.fpTechnical} count={technical} pct={pct(technical)} postsLabel={t.fpPosts} />
        </div>
      </div>

      {/* Vi phạm chính sách là gì? */}
      <div style={{ background: C.legacyBgfdf1f1, borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10 }}>
        <Icon icon={ShieldAlert} size={16} stroke={DANGER.color} />
        <div style={{ fontSize: 12, color: C.ink600, lineHeight: 1.55, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: C.legacyTextb91c1c, marginBottom: 3 }}>{t.fpPolicyWhat}</div>
          {t.fpPolicyExplain}
        </div>
      </div>

      {/* Mã lỗi vi phạm phổ biến */}
      {topCodes.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 9 }}>{t.fpCommonCodes}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {topCodes.map(([code, info]) => {
              const tone = info.policy ? DANGER : WARNING;
              return (
                <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 11px' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'ui-monospace, monospace', color: tone.color, background: tone.bg, borderRadius: 6, padding: '3px 8px', flex: 'none' }}>
                    #{code}
                  </span>
                  <span style={{ fontSize: 12, color: C.ink600, fontWeight: 600, flex: 1, minWidth: 0 }}>{codeLabel(code, t)}</span>
                  <span style={{ fontSize: 11, color: C.textFaint, flex: 'none' }}>{info.count} {t.fpPosts}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card style={{ padding: 18 }}>
      {collapsible ? (
        <button
          onClick={onToggle}
          aria-expanded={open}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left' }}
        >
          <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15.5, color: C.textStrong, flex: 1 }}>{t.fpOverview}</span>
          <Icon icon={open ? ChevronUp : ChevronDown} size={16} stroke={C.textMuted} />
        </button>
      ) : (
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15.5, color: C.textStrong }}>{t.fpOverview}</div>
      )}
      {(!collapsible || open) && <div style={{ marginTop: 14 }}>{body}</div>}
    </Card>
  );
}
