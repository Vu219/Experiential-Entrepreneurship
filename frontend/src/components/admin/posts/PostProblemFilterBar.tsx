import { useApp } from '../../../context/AppContext';
import { FilterSelect, SearchInput } from '../AdminListPage';
import { PlatformTag } from '../../ui';
import { PLATFORM_BG } from '../../../theme';
import { AP_PLATFORMS } from './platforms';
import type { AdminPostPlatform, PostProblemSort, PublishErrorType } from '../../../api/admin';

// Khối D: dropdown nền tảng + chip nền tảng có logo + dropdown loại lỗi + dropdown sắp xếp.
// Chip và dropdown nền tảng đọc CÙNG một danh sách (AP_PLATFORMS) nên không thể lệch nhau.

const ERROR_TYPES: { value: PublishErrorType; labelKey: 'apErrPolicy' | 'apErrTemporary' | 'apErrPermanent' }[] = [
  { value: 'POLICY_VIOLATION', labelKey: 'apErrPolicy' },
  { value: 'TEMPORARY', labelKey: 'apErrTemporary' },
  { value: 'PERMANENT', labelKey: 'apErrPermanent' },
];

export default function PostProblemFilterBar({
  platform,
  errorType,
  query,
  sort,
  searchOpen,
  activeFilters,
  onPlatformChange,
  onErrorTypeChange,
  onQueryChange,
  onSortChange,
  onReset,
}: {
  platform?: AdminPostPlatform;
  errorType?: PublishErrorType;
  query: string;
  sort: PostProblemSort;
  /** Hàng phụ (tìm kiếm + đặt lại) do nút "Bộ lọc" trên thanh công cụ bật/tắt. */
  searchOpen: boolean;
  activeFilters: number;
  onPlatformChange: (platform?: AdminPostPlatform) => void;
  onErrorTypeChange: (errorType?: PublishErrorType) => void;
  onQueryChange: (q: string) => void;
  onSortChange: (sort: PostProblemSort) => void;
  onReset: () => void;
}) {
  const { t } = useApp();

  return (
    <>
      <FilterSelect
        value={platform ?? ''}
        onChange={(v) => onPlatformChange((v || undefined) as AdminPostPlatform | undefined)}
        options={[['', t.apAllPlatforms], ...AP_PLATFORMS.map((p) => [p.tag, p.name] as [string, string])]}
      />

      {/* Chip nhanh: bấm lần nữa vào chip đang chọn để bỏ lọc. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {AP_PLATFORMS.map((p) => {
          const active = platform === p.tag;
          return (
            <button
              key={p.tag}
              onClick={() => onPlatformChange(active ? undefined : p.tag)}
              aria-pressed={active}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px 0 8px',
                border: `1px solid ${active ? '#c4b5fd' : '#ece8f6'}`, borderRadius: 999,
                background: active ? '#f1e9ff' : '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, color: active ? '#7c3aed' : '#5b5670',
              }}
            >
              <PlatformTag tag={p.tag} bg={PLATFORM_BG[p.tag]} size={22} radius={999} />
              {p.name}
            </button>
          );
        })}
      </div>

      <FilterSelect
        value={errorType ?? ''}
        onChange={(v) => onErrorTypeChange((v || undefined) as PublishErrorType | undefined)}
        options={[['', t.apAllStatuses], ...ERROR_TYPES.map((e) => [e.value, t[e.labelKey]] as [string, string])]}
      />

      <div style={{ marginLeft: 'auto' }}>
        <FilterSelect
          value={sort}
          onChange={(v) => onSortChange(v as PostProblemSort)}
          options={[['newest', t.apSortNewest], ['oldest', t.apSortOldest]]}
        />
      </div>

      {/* Hàng phụ: ô tìm kiếm không có trong thiết kế hàng D nên để sau nút "Bộ lọc",
          giữ hàng D đúng bố cục gốc. flexBasis 100% để xuống dòng riêng. */}
      {searchOpen && (
        <div style={{ flexBasis: '100%', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchInput value={query} onChange={onQueryChange} placeholder={t.apSearchPh} />
          <button
            onClick={onReset}
            disabled={activeFilters === 0}
            className="btn-soft"
            style={{
              height: 38, padding: '0 14px', border: '1px solid #ece8f6', borderRadius: 10, background: '#fff',
              fontSize: 13, fontWeight: 700,
              color: activeFilters > 0 ? '#7c3aed' : '#c4bdd6',
              cursor: activeFilters > 0 ? 'pointer' : 'default',
            }}
          >
            {t.clearFilters}
          </button>
        </div>
      )}
    </>
  );
}
