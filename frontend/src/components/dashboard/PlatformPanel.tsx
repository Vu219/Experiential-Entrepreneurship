import { memo } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon, PlatformTag } from '../ui';
import { PLATFORM_BG, PLATFORMS } from '../../theme';
import { PLATFORM_TO_TAG } from '../../api/connections';
import { STATUS_COLORS, STATUS_NEUTRAL, STATUS_PENDING } from '../../statusTokens';
import type { DashboardPlatform } from '../../api/dashboard';
import { C } from '../../styles/colors';

/**
 * Panel "Nền tảng đã kết nối" — trạng thái THẬT từ tài khoản MXH của user (không hardcode).
 * Backend luôn trả đủ 3 nền tảng trong scope MVP nên panel không bao giờ trống.
 * Mọi thao tác kết nối/quản lý đều dẫn về Cài đặt → tab Kết nối (nơi duy nhất chạy OAuth).
 */
function PlatformPanel({ rows }: { rows: DashboardPlatform[] }) {
  const { t, go } = useApp();

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.textStrong }}>{t.dbPlatformsTitle}</div>
          <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2 }}>{t.dbPlatformsSub}</div>
        </div>
        <button
          type="button"
          onClick={() => go('settings')}
          className="link-underline"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent',
            padding: '4px 2px', fontSize: 13, fontWeight: 600, color: C.primary, cursor: 'pointer',
          }}
        >
          <Icon icon={Settings2} size={15} stroke={C.primary} />
          {t.dbManageCta}
        </button>
      </div>

      {/* auto-fit: 3 ô trên desktop, tự xuống 2 rồi 1 cột khi hẹp — không cần media query riêng. */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginTop: 16,
      }}>
        {rows.map((row) => (
          <PlatformTile key={row.platform} row={row} onConnect={() => go('settings')} />
        ))}
      </div>
    </Card>
  );
}

function PlatformTile({ row, onConnect }: { row: DashboardPlatform; onConnect: () => void }) {
  const { t } = useApp();
  const tag = PLATFORM_TO_TAG[row.platform] ?? 'FB';
  const name = PLATFORMS.find((p) => p.tag === tag)?.name ?? row.platform;

  // Kết nối tồn tại nhưng KHÔNG active (token hết hạn / bị thu hồi) phải nhìn khác "chưa kết nối"
  // — đó là việc cần user xử lý, không phải trạng thái trống.
  const badge = row.connected
    ? { ...STATUS_COLORS.active, text: t.dbConnected }
    : row.status === 'EXPIRED' || row.status === 'ON_HOLD'
      ? { ...STATUS_PENDING, text: t.dbNeedsReconnect }
      : row.status === 'REVOKED' || row.status === 'ERROR'
        ? { ...STATUS_COLORS.error, text: t.dbNeedsReconnect }
        : { ...STATUS_NEUTRAL, text: t.dbNotConnected };

  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, background: C.surfaceSubtle,
      display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={34} radius={10} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink750 }}>{name}</div>
          <div style={{
            fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {row.accountName ?? '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: '3px 10px',
          color: badge.color, background: badge.bg,
        }}>
          {badge.text}
        </span>
        {!row.connected && (
          <button
            type="button"
            onClick={onConnect}
            className="btn-soft"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${C.border}`,
              background: C.surface, color: C.primaryStrong, fontWeight: 700, fontSize: 12,
              borderRadius: 9, padding: '5px 10px', cursor: 'pointer', flex: 'none',
            }}
          >
            <Icon icon={Plus} size={13} stroke={C.primaryStrong} />
            {t.dbConnectCta}
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(PlatformPanel);
