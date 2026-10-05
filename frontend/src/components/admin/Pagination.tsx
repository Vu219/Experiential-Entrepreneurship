import { useApp } from '../../context/AppContext';
import { PAGE_SIZE_OPTIONS } from '../../hooks/usePageSize';
import { C } from '../../styles/colors';

/** Số nút trang hiển thị quanh trang hiện tại trước khi rút gọn bằng "…". */
const WINDOW = 1;

/**
 * Dựng dãy nút trang có rút gọn: luôn giữ trang đầu, trang cuối và cửa sổ quanh trang
 * hiện tại. `null` = dấu "…". Dưới 8 trang thì trả hết, không rút gọn (rút gọn sớm chỉ
 * làm khó bấm chứ không tiết kiệm được gì).
 */
function pageItems(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const items: (number | null)[] = [];
  const from = Math.max(2, page - WINDOW);
  const to = Math.min(pageCount - 1, page + WINDOW);

  items.push(1);
  if (from > 2) items.push(null);
  for (let p = from; p <= to; p++) items.push(p);
  if (to < pageCount - 1) items.push(null);
  items.push(pageCount);
  return items;
}

/**
 * Phân trang dùng chung cho các trang danh sách Quản trị. Active page tô bằng
 * brandGradient theo theme hiện tại.
 *
 * `pageSize` + `onPageSizeChange` là TUỲ CHỌN — không truyền thì component giữ nguyên
 * hành vi cũ (chỉ dãy nút trang, tự ẩn khi ≤ 1 trang) để các trang đang dùng không đổi gì.
 */
export default function Pagination({
  page,
  pageCount,
  onChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS as readonly number[],
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
}) {
  const { t, brandGradient } = useApp();
  const showSizePicker = pageSize != null && onPageSizeChange != null;
  // Vẫn phải hiện selector khi chỉ còn 1 trang — đó thường chính là lúc user muốn tăng
  // số dòng. Chỉ ẩn hoàn toàn ở chế độ cũ (không có selector).
  if (pageCount <= 1 && !showSizePicker) return null;

  const btn = (label: string, p: number, disabled = false, active = false) => (
    <button
      key={label + p}
      onClick={() => !disabled && !active && onChange(p)}
      disabled={disabled}
      style={{
        minWidth: 34,
        height: 34,
        padding: '0 10px',
        borderRadius: 9,
        border: `1px solid ${C.border}`,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled || active ? 'default' : 'pointer',
        background: active ? brandGradient : C.surface,
        color: active ? C.onBrand : disabled ? C.ink200 : C.ink550,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: showSizePicker ? 'space-between' : 'flex-end', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
      {showSizePicker && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.textMuted }}>
          {t.pgPerPage}
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{ height: 34, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: '0 8px', fontSize: 12.5, fontWeight: 700, color: C.ink550, cursor: 'pointer' }}
          >
            {/* Giá trị khởi tạo trên mobile (5) không nằm trong danh sách chuẩn — thêm vào để
                select không rơi về rỗng khi chưa ai bấm đổi. */}
            {(pageSizeOptions.includes(pageSize) ? pageSizeOptions : [pageSize, ...pageSizeOptions]).map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      )}

      {pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: C.textMuted, marginRight: 6 }}>{t.pgInfo} {page}/{pageCount}</span>
          {btn(t.pgPrev, page - 1, page <= 1)}
          {pageItems(page, pageCount).map((p, i) =>
            p === null ? (
              <span key={`gap${i}`} style={{ minWidth: 20, textAlign: 'center', fontSize: 13, color: C.ink200 }}>…</span>
            ) : (
              btn(String(p), p, false, p === page)
            ),
          )}
          {btn(t.pgNext, page + 1, page >= pageCount)}
        </div>
      )}
    </div>
  );
}
