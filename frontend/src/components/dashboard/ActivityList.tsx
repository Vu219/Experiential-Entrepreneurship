import { History } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon } from '../ui';
import { ROUTE_BY_TYPE, TYPE_META } from '../notificationMeta';
import { formatRelativeTime } from '../../utils/format';
import type { AppNotification } from '../../api/notifications';
import { C } from '../../styles/colors';

/**
 * Danh sách timeline hoạt động (icon + tiêu đề + thời gian tương đối) — DÙNG CHUNG cho khối
 * "Hoạt động gần đây" trên Dashboard và modal "Xem tất cả", để hai nơi luôn cùng giao diện.
 * Bấm một mục → điều hướng theo loại thông báo (notificationMeta); `onNavigate` để nơi gọi
 * đóng modal trước khi chuyển trang.
 */
export default function ActivityList({
  items,
  onNavigate,
}: {
  items: AppNotification[];
  onNavigate?: () => void;
}) {
  const { t, go } = useApp();

  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
      {items.map((item, i) => {
        // Fallback phòng khi backend thêm loại thông báo mới mà FE chưa cập nhật —
        // không có ErrorBoundary nên một type lạ mà thiếu fallback sẽ làm trắng cả trang.
        const meta = TYPE_META[item.type] ?? { icon: History, color: C.textMuted, bg: C.slateTint };
        const isLast = i === items.length - 1;
        return (
          <li key={item.id} style={{ display: 'flex', gap: 12 }}>
            {/* Cột mốc: icon + đường nối kéo dài tới mục sau (mục cuối không vẽ đường). */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
              <span style={{
                width: 32, height: 32, borderRadius: 10, background: meta.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon icon={meta.icon} size={16} stroke={meta.color} />
              </span>
              {!isLast && <span aria-hidden style={{ width: 2, flex: 1, minHeight: 14, background: C.surfaceMuted }} />}
            </div>

            <button
              type="button"
              onClick={() => { onNavigate?.(); go(ROUTE_BY_TYPE[item.type] ?? 'dashboard'); }}
              style={{
                flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent',
                padding: '0 0 16px', cursor: 'pointer',
              }}
            >
              <span style={{
                display: 'block', fontSize: 13.5, fontWeight: 600, color: C.ink750,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {item.title}
              </span>
              {item.message && (
                <span style={{
                  display: 'block', fontSize: 12.5, color: C.textSecondary, marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.message}
                </span>
              )}
              <span style={{ display: 'block', fontSize: 11, color: C.ink350, marginTop: 4 }}>
                {formatRelativeTime(item.createdAt, t)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
