import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import SlideOver from '../brand/SlideOver';
import type { ContentSort } from '../../api/contentCreationService';

export interface ContentFilters {
  platform: string; // 'all' | Platform
  brandId: string; // 'all' | id
  sort: ContentSort;
}

export const DEFAULT_FILTERS: ContentFilters = { platform: 'all', brandId: 'all', sort: 'newest' };

/** Số filter đang lệch mặc định — hiện trên nút "Bộ lọc · n" và chip dưới thanh search. */
export const activeFilterCount = (f: ContentFilters): number =>
  (f.platform !== 'all' ? 1 : 0) + (f.brandId !== 'all' ? 1 : 0) + (f.sort !== 'newest' ? 1 : 0);

const label = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', marginBottom: 8 } as const;
const select = {
  width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '10px 14px',
  fontSize: 14, color: '#241f3a', background: '#fbfaff', outline: 'none', cursor: 'pointer',
} as const;

/**
 * Drawer "Bộ lọc" (trượt phải, tái dùng SlideOver): gom nền tảng / thương hiệu / sắp xếp.
 * Chỉnh trong drawer là BẢN NHÁP cục bộ — chỉ query khi bấm "Áp dụng" (không reload mỗi
 * lần đổi một dropdown). Trạng thái KHÔNG nằm ở đây — đã có tabs nhanh trên bảng.
 */
export default function ContentFilterDrawer({
  value,
  brands,
  onApply,
  onClose,
}: {
  value: ContentFilters;
  /** [id, tên] các thương hiệu có nội dung. */
  brands: [string, string][];
  onApply: (next: ContentFilters) => void;
  onClose: () => void;
}) {
  const { t, brandGradient } = useApp();
  const [draft, setDraft] = useState<ContentFilters>(value);

  const field = (title: string, node: React.ReactNode) => (
    <div style={{ marginBottom: 20 }}>
      <label style={label}>{title}</label>
      {node}
    </div>
  );

  return (
    <SlideOver
      title={t.clFilterTitle}
      subtitle={t.clFilterSub}
      width={400}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={() => setDraft(DEFAULT_FILTERS)}
            className="btn-soft"
            style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 11, padding: '11px 18px', fontSize: 13.5, fontWeight: 700, color: '#574f6e', cursor: 'pointer' }}
          >
            {t.clFilterReset}
          </button>
          <button
            onClick={() => onApply(draft)}
            className="btn-grad"
            style={{ flex: 1, border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 13.5, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}
          >
            {t.clFilterApply}
          </button>
        </>
      }
    >
      {field(
        t.clFilterPlatform,
        <select value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value })} style={select}>
          {[['all', t.clAllPlatforms], ['FACEBOOK', 'Facebook'], ['INSTAGRAM', 'Instagram'], ['THREADS', 'Threads']].map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>,
      )}
      {field(
        t.clFilterBrand,
        <select value={draft.brandId} onChange={(e) => setDraft({ ...draft, brandId: e.target.value })} style={select}>
          <option value="all">{t.clAllBrands}</option>
          {brands.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>,
      )}
      {field(
        t.clSortLabel,
        <select value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value as ContentSort })} style={select}>
          {[['newest', t.clSortNewest], ['voice', t.clSortVoice], ['status', t.clSortStatus]].map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>,
      )}
    </SlideOver>
  );
}
