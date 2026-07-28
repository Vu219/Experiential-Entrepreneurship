import { useCallback, useEffect, useState } from 'react';
import { CreditCard, FileText, LogIn, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon } from '../ui';
import { getMyActivity, type MyActivity } from '../../api/activity';
import { timeAgo } from '../../api/admin';
import type { ActivityActionGroup } from '../../api/admin';
import { actionGroupTone, actionLabel } from '../admin/logs/activityLabels';
import { TONE_COLORS } from '../../statusTokens';
import Pagination from '../admin/Pagination';

/**
 * "Hoạt động gần đây" trên trang Hồ sơ — dữ liệu THẬT từ GET /users/me/activity (bảng
 * `activity_logs`, cùng nguồn với tab log của admin nhưng đã lọc theo user đang đăng nhập).
 *
 * Mỗi hành động một dòng (chip nhóm + nhãn + thời gian tương đối), phân trang SERVER-SIDE
 * `PAGE_SIZE` dòng/trang để card không dài ra theo lịch sử. `targetId` dạng UUID bị bỏ qua
 * (không đọc được); chỉ hiện khi là mã nghiệp vụ (FACEBOOK, PRO…). Hành động thất bại tô tone
 * `danger` để "Đăng nhập thất bại"/"Đăng bài thất bại" nổi lên ngay.
 */
const PAGE_SIZE = 6;

const GROUP_ICON = {
  AUTH: LogIn, ACCOUNT: UserRound, CONTENT: FileText, BILLING: CreditCard, ADMIN: ShieldCheck,
} as const satisfies Record<ActivityActionGroup, typeof LogIn>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i;

export default function RecentActivityCard() {
  const { t, lang } = useApp();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [rows, setRows] = useState<MyActivity[]>([]);
  const [pageCount, setPageCount] = useState(1);
  // 1-based cho khớp component Pagination dùng chung; API nhận 0-based.
  const [page, setPage] = useState(1);

  const load = useCallback((target: number) => {
    setStatus('loading');
    getMyActivity(target - 1, PAGE_SIZE)
      .then((res) => {
        setRows(res.content);
        setPageCount(Math.max(1, res.totalPages));
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, []);
  useEffect(() => { load(page); }, [load, page]);

  return (
    <Card style={{ padding: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.prActivity}</div>
        <button
          onClick={() => load(page)}
          disabled={status === 'loading'}
          title={t.retry}
          aria-label={t.retry}
          className="btn-soft"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', width: 30, height: 30, border: '1px solid #ece8f6', borderRadius: 9, background: '#fff', color: '#a59fbb', cursor: status === 'loading' ? 'wait' : 'pointer' }}
        >
          <span style={{ display: 'inline-flex', animation: status === 'loading' ? 'spinslow 0.8s linear infinite' : undefined }}>
            <Icon icon={RefreshCw} size={15} stroke="#a59fbb" />
          </span>
        </button>
      </div>

      {status === 'loading' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <span className="sk" style={{ width: 34, height: 34, flex: 'none', borderRadius: 9 }} />
              <span className="sk" style={{ flex: 1, height: 12, borderRadius: 6 }} />
              <span className="sk" style={{ width: 58, height: 11, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : status === 'error' ? (
        <div style={{ fontSize: 13.5, color: '#8a85a0' }}>
          {t.listError}{' '}
          <button onClick={() => load(page)} className="link-underline" style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 13.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}>
            {t.retry}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13.5, color: '#8a85a0', lineHeight: 1.6 }}>{t.prActivityEmpty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map((a) => {
            const tone = TONE_COLORS[a.result === 'FAILURE' ? 'danger' : actionGroupTone(a.actionGroup)];
            const GroupIcon = GROUP_ICON[a.actionGroup];
            const target = a.targetId && !UUID_RE.test(a.targetId) ? a.targetId : null;
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span aria-hidden style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: tone.bg, color: tone.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon icon={GroupIcon} size={16} stroke={tone.color} />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: '#3f3a55', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {actionLabel(lang, a.action)}
                  {target && <span style={{ color: '#a59fbb' }}> · {target}</span>}
                </span>
                <span style={{ flex: 'none', fontSize: 12, color: '#a59fbb' }}>{timeAgo(lang, a.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Ẩn khi chỉ có một trang (Pagination tự lo) — card không mọc thêm hàng thừa. */}
      {status !== 'error' && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
    </Card>
  );
}
