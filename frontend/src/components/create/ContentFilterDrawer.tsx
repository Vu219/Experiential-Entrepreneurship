import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import Modal from '../Modal';
import type { ContentSort } from '../../api/contentCreationService';
import { C } from '../../styles/colors';

export interface ContentFilters {
  platform: string; // 'all' | Platform
  brandId: string; // 'all' | id
  sort: ContentSort;
}

export const DEFAULT_FILTERS: ContentFilters = { platform: 'all', brandId: 'all', sort: 'newest' };

/** Số filter đang lệch mặc định — hiện trên nút "Bộ lọc · n" và chip dưới thanh search. */
export const activeFilterCount = (f: ContentFilters): number =>
  (f.platform !== 'all' ? 1 : 0) + (f.brandId !== 'all' ? 1 : 0) + (f.sort !== 'newest' ? 1 : 0);

const label = { display: 'block', fontSize: 12.5, fontWeight: 700, color: C.ink600, marginBottom: 8 } as const;
const select = {
  width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '10px 14px',
  fontSize: 14, color: C.textStrong, background: C.surfaceSubtle, outline: 'none', cursor: 'pointer',
} as const;

/**
 * "Bộ lọc" dạng modal căn giữa (tái dùng Modal dùng chung): gom nền tảng / thương hiệu / sắp xếp.
 * Chỉnh trong modal là BẢN NHÁP cục bộ — chỉ query khi bấm "Áp dụng" (không reload mỗi
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
    <Modal title={t.clFilterTitle} subtitle={t.clFilterSub} maxWidth={520} onClose={onClose} animateScale>
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

      {/* Nút hành động: Đặt lại (trái) + Áp dụng (phải) — chỉ lọc khi bấm Áp dụng */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          onClick={() => setDraft(DEFAULT_FILTERS)}
          className="btn-soft"
          style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 11, padding: '11px 18px', fontSize: 13.5, fontWeight: 700, color: C.ink600, cursor: 'pointer' }}
        >
          {t.clFilterReset}
        </button>
        <button
          onClick={() => onApply(draft)}
          className="btn-grad"
          style={{ flex: 1, border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 13.5, fontWeight: 700, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}
        >
          {t.clFilterApply}
        </button>
      </div>
    </Modal>
  );
}
