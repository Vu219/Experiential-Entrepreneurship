import { C } from '../../styles/colors';

/**
 * Nhãn "Dữ liệu mẫu" — đánh dấu rõ những khối đang hiển thị dữ liệu demo fallback (khi tài khoản
 * chưa có số liệu thật), để không nhầm là số liệu thật. Dùng ở PerformanceChart và TopTopics.
 */
export default function DemoBadge({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700,
      color: C.amberText, background: C.warningSoft, borderRadius: 999, padding: '2px 9px',
    }}>
      {label}
    </span>
  );
}
