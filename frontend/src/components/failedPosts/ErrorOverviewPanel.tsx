import { ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { Card, Icon } from '../ui.tsx';
import { TONE_COLORS } from '../../statusTokens.ts';
import type { FailedPost } from '../../api/failedPosts.ts';
import { publishErrorCopy, type PublishErrorCode } from '../../api/publishErrorCatalog.ts';
import {
  OVERVIEW_GROUP_OF, OVERVIEW_GROUP_TONE, overviewGroupLabel, toneOf, type OverviewGroup,
} from './shared.ts';
import { C } from '../../styles/colors';

// Panel "Tổng quan lỗi" (cột phải, sticky trên desktop): donut tổng lỗi chia theo NHÓM CÁCH XỬ LÝ
// (chính sách / tài khoản & quyền / nội dung & media / nền tảng & mạng / hệ thống) và "Lỗi gặp nhiều nhất"
// theo mã chuẩn (tiêu đề thân thiện của catalog). TỔNG HỢP trên danh sách đã lọc theo tab/bộ lọc (props items).
// `collapsible` bật ở mobile/tablet: header bấm để thu gọn/mở.

const GROUP_ORDER: OverviewGroup[] = ['POLICY', 'ACCOUNT', 'CONTENT', 'PLATFORM', 'SYSTEM'];

function Donut({ total, segments }: { total: number; segments: { color: string; value: number }[] }) {
  const size = 148;
  const r = 56;
  const c = 2 * Math.PI * r;
  const common = { cx: size / 2, cy: size / 2, r, fill: 'none', strokeWidth: 16 } as const;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false" style={{ transform: 'rotate(-90deg)' }}>
      <circle {...common} stroke={C.chartGrid} />
      {total > 0 && segments.filter((s) => s.value > 0).map((s, i) => {
        const len = (s.value / total) * c;
        const el = (
          <circle key={i} {...common} stroke={s.color} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

function LegendRow({ color, label, count, pct, postsLabel }: { color: string; label: string; count: number; pct: number; postsLabel: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, background: C.surfaceMuted, borderRadius: 10, padding: '9px 12px' }}>
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
  const { t, lang } = useApp();
  const total = items.length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const byGroup = new Map<OverviewGroup, number>();
  const byCode = new Map<PublishErrorCode, { count: number; sample: FailedPost }>();
  for (const p of items) {
    const group = OVERVIEW_GROUP_OF[p.category] ?? 'SYSTEM';
    byGroup.set(group, (byGroup.get(group) ?? 0) + 1);
    const cur = byCode.get(p.code);
    byCode.set(p.code, { count: (cur?.count ?? 0) + 1, sample: cur?.sample ?? p });
  }
  const groups = GROUP_ORDER.filter((g) => (byGroup.get(g) ?? 0) > 0);
  const topCodes = [...byCode.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 148, height: 148 }}>
          <Donut total={total} segments={GROUP_ORDER.map((g) => ({ color: TONE_COLORS[OVERVIEW_GROUP_TONE[g]].color, value: byGroup.get(g) ?? 0 }))} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 34, color: C.textStrong, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{total}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginTop: 4 }}>{t.fpTotal}</span>
          </div>
        </div>
        {groups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', marginTop: 12 }}>
            {groups.map((g) => (
              <LegendRow key={g} color={TONE_COLORS[OVERVIEW_GROUP_TONE[g]].color} label={overviewGroupLabel(g, t)}
                count={byGroup.get(g) ?? 0} pct={pct(byGroup.get(g) ?? 0)} postsLabel={t.fpPosts} />
            ))}
          </div>
        )}
      </div>

      {topCodes.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 9 }}>{t.fpCommonCodes}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {topCodes.map(([code, info]) => {
              const tone = toneOf(info.sample);
              return (
                <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 11px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: tone.color, flex: 'none' }} aria-hidden />
                  <span style={{ fontSize: 12, color: C.ink600, fontWeight: 600, flex: 1, minWidth: 0 }}>
                    {publishErrorCopy(lang, code).title}
                  </span>
                  <span style={{ fontSize: 11, color: C.textFaint, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{info.count} {t.fpPosts}</span>
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
