import { AlertTriangle } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card, PlatformTag } from '../../ui';
import { PLATFORM_BG } from '../../../theme';
import { TONE_COLORS } from '../../../statusTokens';
import { formatDateTimeVN } from '../../../utils/format';
import { PLATFORM_TO_TAG } from '../../../api/connections';
import type { PostProblemSummary } from '../../../api/admin';
import { platformDisplayName, publishErrorCopy } from '../../../api/publishErrorCatalog';
import { CATEGORY_TONE } from './rejectionReasons';
import { alpha, C } from '../../../styles/colors';

// Khối "Xu hướng lỗi" dưới 4 thẻ KPI: mã lỗi chuẩn hàng đầu (thanh tỷ lệ), phân bố theo nền tảng, tỷ lệ lỗi
// (lỗi / (lỗi + đã đăng)) và banner sự cố nền tảng đang mở. Mọi con số từ /admin/posts/failed/summary.

export function IncidentBanner({ incidents }: { incidents: PostProblemSummary['incidents'] }) {
  const { t } = useApp();
  if (incidents.length === 0) return null;
  const warn = TONE_COLORS.warning;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {incidents.map((i) => (
        <div key={i.platform} role="status" style={{
          display: 'flex', gap: 10, alignItems: 'center', background: warn.bg, border: `1px solid ${alpha(warn.color, 0.25)}`,
          borderRadius: 12, padding: '10px 14px', fontSize: 13, color: C.ink750,
        }}>
          <AlertTriangle size={17} color={warn.color} strokeWidth={2} aria-hidden style={{ flex: 'none' }} />
          <span>
            {t.apIncidentBanner
              .replace('{platform}', platformDisplayName(i.platform))
              .replace('{time}', formatDateTimeVN(i.since))
              .replace('{n}', String(i.failures))
              .replace('{m}', String(i.accounts))}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PostProblemInsights({ summary }: { summary: PostProblemSummary }) {
  const { t, lang } = useApp();
  const failed = summary.total.value;
  const attempted = failed + summary.postedTotal;
  const failureRate = attempted > 0 ? Math.round((failed / attempted) * 1000) / 10 : null;
  const maxCount = Math.max(1, ...summary.topCodes.map((c) => c.count));
  const platformTotal = summary.byPlatform.reduce((sum, p) => sum + p.count, 0);

  if (summary.topCodes.length === 0 && failureRate === null) return null;

  return (
    <Card style={{ borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 22 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.textStrong, marginBottom: 10 }}>{t.apTopCodes}</div>
          {summary.topCodes.length === 0 ? (
            <div style={{ fontSize: 12.5, color: C.textMuted }}>—</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {summary.topCodes.map((c) => {
                const tone = TONE_COLORS[CATEGORY_TONE[c.category] ?? 'neutral'];
                return (
                  <div key={c.code}>
                    <div style={{ display: 'flex', gap: 8, fontSize: 12.5, marginBottom: 3 }}>
                      <span style={{ flex: 1, minWidth: 0, color: C.ink650, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={c.code}>
                        {publishErrorCopy(lang, c.code).title}
                      </span>
                      <span style={{ color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>{c.count}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: C.surfaceMuted, overflow: 'hidden' }}>
                      <div style={{ width: `${(c.count / maxCount) * 100}%`, height: '100%', background: tone.color, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.textStrong, marginBottom: 10 }}>{t.apByPlatform}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {summary.byPlatform.length === 0 && <div style={{ fontSize: 12.5, color: C.textMuted }}>—</div>}
            {summary.byPlatform.map((p) => {
              const tag = PLATFORM_TO_TAG[p.platform];
              const pct = platformTotal > 0 ? Math.round((p.count / platformTotal) * 100) : 0;
              return (
                <div key={p.platform} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                  <PlatformTag tag={tag} bg={PLATFORM_BG[tag]} size={22} radius={7} />
                  <span style={{ flex: 1, color: C.ink650, fontWeight: 600 }}>{platformDisplayName(p.platform)}</span>
                  <span style={{ color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>{p.count} · {pct}%</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.textMuted }}>{t.apFailureRate}</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans'", fontSize: 22, fontWeight: 800, color: C.textStrong, fontVariantNumeric: 'tabular-nums' }}>
              {failureRate === null ? '—' : `${failureRate}%`}
            </span>
            <span style={{ fontSize: 11.5, color: C.textFaint }}>
              {t.apFailureRateHint.replace('{failed}', String(failed)).replace('{posted}', String(summary.postedTotal))}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
