import { useApp } from '../../context/AppContext.tsx';
import type { FailureState } from '../../api/failedPosts.ts';
import { C } from '../../styles/colors';

// Hàng tab theo VÒNG ĐỜI lỗi, kèm badge số lượng: [Cần xử lý (n)] [Đang tự thử lại (n)] [Đã bỏ qua (n)].
// Nhóm lỗi (chính sách / tài khoản / nội dung…) chuyển thành bộ lọc ở FilterBar.
// Đổi tab → trang FailedPosts reset selection + về trang 1 (xử lý ở page, không ở đây).

export type FpTab = Exclude<FailureState, 'RESOLVED'>;

const TABS: { key: FpTab; labelKey: 'fpTabNeedsAction' | 'fpTabAutoRetrying' | 'fpTabDismissed' }[] = [
  { key: 'NEEDS_ACTION', labelKey: 'fpTabNeedsAction' },
  { key: 'AUTO_RETRYING', labelKey: 'fpTabAutoRetrying' },
  { key: 'DISMISSED', labelKey: 'fpTabDismissed' },
];

export default function TabBar({
  tab,
  counts,
  onChange,
}: {
  tab: FpTab;
  counts: Record<FpTab, number>;
  onChange: (tab: FpTab) => void;
}) {
  const { t } = useApp();
  return (
    <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {TABS.map(({ key, labelKey }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
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
                background: active ? C.primary : C.surfaceMuted, color: active ? C.onBrand : C.textMuted,
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
