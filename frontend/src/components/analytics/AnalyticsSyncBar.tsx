import { memo } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui';
import { C } from '../../styles/colors';
import { formatDateTimeVN } from '../../utils/format';
import type { AnalyticsSyncStatus } from '../../api/analytics';

/**
 * Dải trạng thái đồng bộ số liệu thật (chỉ hiện ở chế độ dữ liệu THẬT): lần cập nhật gần nhất, số bài đang
 * chờ đồng bộ lần đầu, cảnh báo thiếu quyền đọc lượt xem (Facebook read_insights) / kênh cần kết nối lại,
 * và nút "Làm mới" (xếp lịch đồng bộ — job nền chạy trong vài phút, không chặn UI).
 */
function AnalyticsSyncBar({ status, lastSyncedAt, refreshing, onRefresh, waiting = false }: {
  status: AnalyticsSyncStatus;
  /** Lần đồng bộ thành công gần nhất trên mọi kênh (trang tính sẵn). */
  lastSyncedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  /** Vừa bấm "Làm mới" và đang chờ số liệu mới — trang tự tải lại khi có. */
  waiting?: boolean;
}) {
  const { t, go } = useApp();

  const pending = status.accounts.reduce((sum, a) => sum + a.pendingPosts, 0);
  const missingInsights = status.accounts.filter((a) => a.status === 'ACTIVE' && a.insightsPermission === false);
  const reconnect = status.accounts.filter((a) => a.status !== 'ACTIVE');

  const warnings = [
    ...missingInsights.map((a) => t.anaSyncMissingInsights.replace('{name}', a.accountName)),
    ...reconnect.map((a) => t.anaSyncReconnect.replace('{name}', a.accountName)),
  ];

  return (
    <Card style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: C.textSecondary, lineHeight: 1.6 }}>
          {pending > 0 || waiting ? (
            <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.primaryStrong, fontWeight: 600 }}>
              <Loader2 size={14} strokeWidth={2.2} aria-hidden style={{ animation: 'spinslow 1s linear infinite' }} />
              {waiting ? t.anaSyncWaiting : t.anaSyncPending.replace('{n}', String(pending))}
            </span>
          ) : (
            <span>
              {lastSyncedAt ? t.anaSyncLast.replace('{time}', formatDateTimeVN(lastSyncedAt)) : t.anaSyncNever}
            </span>
          )}
          <span style={{ color: C.textFaint }}> · {t.anaSyncNote}</span>
        </div>
        <button type="button" onClick={onRefresh} disabled={refreshing || waiting} aria-label={t.anaSyncRefresh} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 12px',
          border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10,
          fontSize: 12.5, fontWeight: 700, color: C.primary, cursor: refreshing || waiting ? 'default' : 'pointer',
          opacity: refreshing || waiting ? 0.6 : 1,
        }}>
          <RefreshCw size={14} strokeWidth={2} />
          {t.anaSyncRefresh}
        </button>
      </div>

      {warnings.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {warnings.map((w) => (
            <div key={w} role="status" style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, lineHeight: 1.5,
              color: C.text, background: C.warningSoft, borderRadius: 9, padding: '7px 10px',
            }}>
              <AlertTriangle size={14} strokeWidth={2} color={C.warning} aria-hidden style={{ flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 200 }}>{w}</span>
              <button type="button" onClick={() => go('settings')} style={{
                border: 'none', background: 'transparent', color: C.primaryStrong, fontWeight: 700,
                fontSize: 12.5, cursor: 'pointer', padding: 0,
              }}>
                {t.anaSyncReconnectCta}
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default memo(AnalyticsSyncBar);
