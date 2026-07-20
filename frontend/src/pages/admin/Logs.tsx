import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import PageContainer from '../../components/PageContainer';
import ErrorLogTab from '../../components/admin/logs/ErrorLogTab';
import ActivityLogTab from '../../components/admin/logs/ActivityLogTab';

// Trang "Log hệ thống" = khung 2 tab. Tab đang chọn nằm trên URL (?tab=error|activity)
// để chia sẻ link được. Mỗi tab tự lo dữ liệu + bộ lọc + phân trang của nó; khung này
// cố tình mỏng, không giữ state nào của tab.

type LogTab = 'error' | 'activity';

export default function Logs() {
  const { t, brandGradient } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: LogTab = searchParams.get('tab') === 'activity' ? 'activity' : 'error';

  // Đổi tab thì bỏ hết tham số của tab cũ — filter của hai tab khác nhau hoàn toàn,
  // giữ lại chỉ tạo ra trạng thái vô nghĩa (vd ?action=... ở tab lỗi).
  const selectTab = (next: LogTab) => {
    setSearchParams(next === 'error' ? {} : { tab: next }, { replace: true });
  };

  const tabBtn = (key: LogTab, label: string) => {
    const active = tab === key;
    return (
      <button
        key={key}
        onClick={() => selectTab(key)}
        aria-pressed={active}
        style={{
          border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6',
          background: active ? brandGradient : '#fff', color: active ? '#fff' : '#5b5670',
          borderRadius: 9, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <PageContainer>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabBtn('error', t.logTabError)}
        {tabBtn('activity', t.logTabActivity)}
      </div>

      {/* key ép remount khi đổi tab: state/bộ lọc của tab cũ không rò sang tab mới. */}
      {tab === 'error' ? <ErrorLogTab key="error" /> : <ActivityLogTab key="activity" />}
    </PageContainer>
  );
}
