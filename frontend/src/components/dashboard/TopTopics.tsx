import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon } from '../ui';
import DemoBadge from './DemoBadge';
import { formatCompactNumber } from '../../utils/format';
import type { DashboardTopic } from '../../api/dashboard';
import { C } from '../../styles/colors';

/**
 * Khối "Top chủ đề hiệu quả": chủ đề = trend gắn với bài. Thanh tỉ lệ so với chủ đề tương tác cao
 * nhất; chủ đề chưa đăng bài (engagement = 0) vẫn hiện để user thấy chủ đề đã dùng.
 */
function TopTopics({ rows, demo = false }: { rows: DashboardTopic[]; demo?: boolean }) {
  const { t, brandGradient, go } = useApp();
  const max = Math.max(1, ...rows.map((r) => r.engagement));

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: C.textStrong }}>{t.dbTopicsTitle}</span>
        {demo && <DemoBadge label={t.dbDemoData} />}
      </div>
      <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2 }}>{t.dbTopicsSub}</div>

      {rows.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, height: 200, textAlign: 'center', padding: '0 16px',
        }}>
          <span style={{
            width: 44, height: 44, borderRadius: 13, background: C.accentSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon icon={Sparkles} size={21} stroke={C.primary} />
          </span>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: C.textMuted }}>{t.dbTopicsEmpty}</div>
          <button
            type="button"
            onClick={() => go('trends')}
            className="btn-soft"
            style={{
              border: `1px solid ${C.border}`, background: C.surfaceMuted, color: C.primaryStrong, fontWeight: 700,
              fontSize: 13, borderRadius: 10, padding: '9px 16px', cursor: 'pointer',
            }}
          >
            {t.navTrends}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          {rows.map((row) => (
            <div key={row.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: C.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {row.name}
                </span>
                <span style={{ flex: 'none', fontSize: 12, color: C.textMuted }}>
                  {t.dbTopicPosts.replace('{n}', String(row.posts))}
                </span>
                <span style={{ flex: 'none', fontSize: 13, fontWeight: 700, color: C.textStrong, minWidth: 44, textAlign: 'right' }}>
                  {formatCompactNumber(row.engagement)}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: C.surfaceMuted, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99, background: brandGradient,
                  width: `${Math.max(2, Math.round((row.engagement / max) * 100))}%`,
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default memo(TopTopics);
