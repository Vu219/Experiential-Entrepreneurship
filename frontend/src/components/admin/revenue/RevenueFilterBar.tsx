import { useApp } from '../../../context/AppContext';
import { FilterSelect } from '../AdminListPage';
import DatePicker from '../../DatePicker';
import type { RevenueFilter, RevenueGranularity } from '../../../api/revenue';

const MODES: RevenueGranularity[] = ['DAY', 'MONTH', 'HALF_YEAR', 'YEAR', 'CUSTOM'];

/** Danh sách năm chọn được: 5 năm gần nhất + năm hiện tại (mới nhất lên đầu). */
function yearOptions(): [string, string][] {
  const now = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => {
    const y = String(now - i);
    return [y, y] as [string, string];
  });
}

/**
 * Thanh lọc thời gian của trang Doanh thu (mục B): chọn CHẾ ĐỘ rồi hiện bộ chọn phạm vi
 * tương ứng. Component thuần điều khiển — trang giữ state và đồng bộ lên URL.
 *
 * Khi đổi chế độ phải nạp lại tham số mặc định của chế độ đó, vì mỗi chế độ cần bộ tham số
 * khác nhau (BE trả lỗi 2038 nếu thiếu).
 */
export default function RevenueFilterBar({
  value,
  onChange,
}: {
  value: RevenueFilter;
  onChange: (next: RevenueFilter) => void;
}) {
  const { t, brandGradient } = useApp();
  const now = new Date();
  const years = yearOptions();

  const modeLabel: Record<RevenueGranularity, string> = {
    DAY: t.revModeDay,
    MONTH: t.revModeMonth,
    HALF_YEAR: t.revModeHalf,
    YEAR: t.revModeYear,
    CUSTOM: t.revModeCustom,
  };

  const switchMode = (granularity: RevenueGranularity) => {
    const year = now.getFullYear();
    switch (granularity) {
      case 'DAY':
        return onChange({ granularity, year, month: now.getMonth() + 1 });
      case 'MONTH':
        return onChange({ granularity, year });
      case 'HALF_YEAR':
        return onChange({ granularity, year, half: now.getMonth() < 6 ? 1 : 2 });
      case 'YEAR':
        return onChange({ granularity, fromYear: year - 4, toYear: year });
      case 'CUSTOM': {
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return onChange({ granularity, from: iso(start), to: iso(now) });
      }
    }
  };

  const modeBtn = (granularity: RevenueGranularity) => {
    const active = value.granularity === granularity;
    return (
      <button
        key={granularity}
        onClick={() => !active && switchMode(granularity)}
        style={{
          border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6',
          background: active ? brandGradient : '#fff', color: active ? '#fff' : '#5b5670',
          borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {modeLabel[granularity]}
      </button>
    );
  };

  const monthOptions: [string, string][] = Array.from({ length: 12 }, (_, i) => [
    String(i + 1),
    `${t.revMonthPrefix} ${i + 1}`,
  ]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{MODES.map(modeBtn)}</div>

      {/* Bộ chọn phạm vi ĐỘNG theo chế độ đang chọn. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {value.granularity === 'DAY' && (
          <>
            <FilterSelect value={String(value.month ?? 1)} options={monthOptions}
              onChange={(v) => onChange({ ...value, month: Number(v) })} />
            <FilterSelect value={String(value.year ?? now.getFullYear())} options={years}
              onChange={(v) => onChange({ ...value, year: Number(v) })} />
          </>
        )}

        {value.granularity === 'MONTH' && (
          <FilterSelect value={String(value.year ?? now.getFullYear())} options={years}
            onChange={(v) => onChange({ ...value, year: Number(v) })} />
        )}

        {value.granularity === 'HALF_YEAR' && (
          <>
            <FilterSelect value={String(value.half ?? 1)}
              options={[['1', t.revHalf1], ['2', t.revHalf2]]}
              onChange={(v) => onChange({ ...value, half: Number(v) as 1 | 2 })} />
            <FilterSelect value={String(value.year ?? now.getFullYear())} options={years}
              onChange={(v) => onChange({ ...value, year: Number(v) })} />
          </>
        )}

        {value.granularity === 'YEAR' && (
          <>
            <FilterSelect value={String(value.fromYear ?? now.getFullYear() - 4)} options={years}
              onChange={(v) => onChange({ ...value, fromYear: Number(v) })} />
            <span style={{ fontSize: 13, color: '#8a85a0' }}>—</span>
            <FilterSelect value={String(value.toYear ?? now.getFullYear())} options={years}
              onChange={(v) => onChange({ ...value, toYear: Number(v) })} />
          </>
        )}

        {value.granularity === 'CUSTOM' && (
          <>
            {/* DatePicker của dự án là chọn MỘT ngày — ghép hai cái thành khoảng, không thêm lib. */}
            <DatePicker value={value.from ?? ''} max={value.to} ariaLabel={t.revFrom}
              onChange={(v) => onChange({ ...value, from: v })} />
            <span style={{ fontSize: 13, color: '#8a85a0' }}>—</span>
            <DatePicker value={value.to ?? ''} min={value.from} ariaLabel={t.revTo}
              onChange={(v) => onChange({ ...value, to: v })} />
          </>
        )}
      </div>
    </div>
  );
}
