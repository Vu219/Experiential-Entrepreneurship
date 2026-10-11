import type { CSSProperties } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { FilterSelect } from '../admin/AdminListPage.tsx';
import {
  publishErrorCategoryLabel, publishErrorCopy, type PublishErrorCategory, type PublishErrorCode,
} from '../../api/publishErrorCatalog.ts';
import { countActiveFilters, EMPTY_FILTERS, type FpFilters } from './shared.ts';
import { C } from '../../styles/colors';

// Thanh bộ lọc dưới hàng tab: nền tảng / tài khoản / nhóm lỗi / loại lỗi / khoảng ngày. Danh sách tài khoản,
// nhóm và loại lỗi lấy từ CHÍNH dữ liệu đang có (không liệt kê lựa chọn rỗng). Control áp dụng ngay khi đổi;
// nút "Bộ lọc" hiển thị số bộ lọc đang bật và bấm để đặt lại.

const dateStyle: CSSProperties = {
  height: 38, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10,
  padding: '0 10px', fontSize: 13, fontWeight: 600, color: C.ink650, fontFamily: 'inherit',
};

export interface FpFilterOptions {
  accounts: { id: string; name: string }[];
  categories: PublishErrorCategory[];
  codes: PublishErrorCode[];
}

export default function FilterBar({
  filters,
  options,
  onChange,
}: {
  filters: FpFilters;
  options: FpFilterOptions;
  onChange: (f: FpFilters) => void;
}) {
  const { t, lang } = useApp();
  const active = countActiveFilters(filters);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <FilterSelect
        value={filters.platform}
        onChange={(v) => onChange({ ...filters, platform: v as FpFilters['platform'] })}
        options={[
          ['ALL', t.fpAllPlatforms],
          ['FACEBOOK', 'Facebook'],
          ['INSTAGRAM', 'Instagram'],
          ['THREADS', 'Threads'],
        ]}
      />
      {options.accounts.length > 1 && (
        <FilterSelect
          value={filters.account}
          onChange={(v) => onChange({ ...filters, account: v })}
          options={[['ALL', t.fpAllAccounts], ...options.accounts.map((a): [string, string] => [a.id, a.name])]}
        />
      )}
      <FilterSelect
        value={filters.category}
        onChange={(v) => onChange({ ...filters, category: v as FpFilters['category'] })}
        options={[
          ['ALL', t.fpAllCategories],
          ...options.categories.map((c): [string, string] => [c, publishErrorCategoryLabel(lang, c)]),
        ]}
      />
      <FilterSelect
        value={filters.code}
        onChange={(v) => onChange({ ...filters, code: v as FpFilters['code'] })}
        options={[
          ['ALL', t.fpAllCodes],
          // Nhãn = tiêu đề thân thiện của catalog (không hiện tên mã kỹ thuật).
          ...options.codes.map((c): [string, string] => [c, publishErrorCopy(lang, c).title]),
        ]}
      />
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => onChange({ ...filters, from: e.target.value })}
          style={dateStyle}
          aria-label={t.fpColTime}
        />
        <span style={{ fontSize: 12, color: C.textFaint }}>–</span>
        <input
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => onChange({ ...filters, to: e.target.value })}
          style={dateStyle}
          aria-label={t.fpColTime}
        />
      </div>
      <button
        onClick={() => active > 0 && onChange(EMPTY_FILTERS)}
        disabled={active === 0}
        title={t.fpFilterReset}
        className="btn-soft"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px',
          border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface, fontSize: 13, fontWeight: 700,
          color: active > 0 ? C.primary : C.textFaint, cursor: active > 0 ? 'pointer' : 'default',
        }}
      >
        <SlidersHorizontal size={14} strokeWidth={1.8} />
        {t.fpFilterBtn}
        {active > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 800, minWidth: 18, padding: '1px 5px', borderRadius: 999, background: C.purpleSoft, color: C.primary }}>
            {active}
          </span>
        )}
      </button>
    </div>
  );
}
