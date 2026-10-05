import { useEffect, useState } from 'react';
import { AlertTriangle, History } from 'lucide-react';
import Modal from '../Modal';
import Pagination from '../admin/Pagination';
import ActivityList from './ActivityList';
import { Icon, Loader } from '../ui';
import { useApp } from '../../context/AppContext';
import { listNotifications, type AppNotification } from '../../api/notifications';
import { C } from '../../styles/colors';

/**
 * Modal "Xem tất cả" hoạt động — phân trang SERVER-SIDE qua GET /notifications (page 0-based ở BE,
 * component Pagination dùng 1-based nên có quy đổi). Bấm một mục sẽ đóng modal rồi điều hướng.
 */
const PAGE_SIZE = 8;

type Status = 'loading' | 'error' | 'ready';

export default function ActivityAllModal({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const [page, setPage] = useState(0); // 0-based theo Spring Pageable
  const [reload, setReload] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    listNotifications({ page, size: PAGE_SIZE })
      .then((res) => {
        if (!alive) return;
        setItems(res.content);
        setPageCount(Math.max(1, res.totalPages));
        setStatus('ready');
      })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [page, reload]);

  return (
    <Modal title={t.dbActivityAll} onClose={onClose} maxWidth={520} animateScale>
      {status === 'loading' ? (
        <Loader />
      ) : status === 'error' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '28px 0' }}>
          <Icon icon={AlertTriangle} size={26} stroke={C.rose} />
          <div style={{ fontSize: 14, color: C.ink550 }}>{t.ntfErr}</div>
          <button
            onClick={() => setReload((r) => r + 1)}
            className="btn-soft"
            style={{
              border: `1px solid ${C.border}`, background: C.surfaceSubtle, color: C.primaryStrong, fontWeight: 700,
              fontSize: 13, borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
            }}
          >
            {t.ntfRetry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          height: 120, fontSize: 13.5, color: C.textMuted,
        }}>
          <Icon icon={History} size={18} stroke={C.ink350} />
          {t.dbActivityEmpty}
        </div>
      ) : (
        <>
          <ActivityList items={items} onNavigate={onClose} />
          {/* Pagination nhận/ trả 1-based; BE 0-based → +1 / -1. Tự ẩn khi chỉ 1 trang. */}
          <Pagination page={page + 1} pageCount={pageCount} onChange={(p) => setPage(p - 1)} />
        </>
      )}
    </Modal>
  );
}
