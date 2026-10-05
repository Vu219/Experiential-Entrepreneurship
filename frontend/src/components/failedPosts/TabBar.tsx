import { useApp } from '../../context/AppContext.tsx';
import type { FailedPostFilter } from '../../api/failedPosts.ts';
import { C } from '../../styles/colors';

// Hàng tab lọc theo loại lỗi, kèm badge số lượng: [Tất cả] [Vi phạm chính sách (n)] [Lỗi kỹ thuật (n)].
// Đổi tab → trang FailedPosts reset selection + về trang 1 (xử lý ở page, không ở đây).

const TABS: { key: FailedPostFilter; labelKey: 'fpTabAll' | 'fpTabPolicy' | 'fpTabTechnical' }[] = [
  { key: 'ALL', labelKey: 'fpTabAll' },
  { key: 'POLICY', labelKey: 'fpTabPolicy' },
  { key: 'TECHNICAL', labelKey: 'fpTabTechnical' },
];

export default function TabBar({
  tab,
  counts,
  onChange,
}: {
  tab: FailedPostFilter;
  counts: Record<FailedPostFilter, number>;
  onChange: (tab: FailedPostFilter) => void;
}) {
  const { t } = useApp();
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {TABS.map(({ key, labelKey }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              border: `1px solid ${active ? C.legacyBorderc4b5fd : C.border}`, borderRadius: 999, padding: '7px 15px',
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: active ? C.purpleSoft : C.surface, color: active ? C.primary : C.textSecondary,
            }}
          >
            {t[labelKey]}
            <span
              style={{
                fontSize: 10.5, fontWeight: 800, minWidth: 20, padding: '1px 6px', borderRadius: 999,
                background: active ? '#7c3aed' : C.surfaceMuted, color: active ? '#fff' : C.textMuted,
              }}
            >
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
