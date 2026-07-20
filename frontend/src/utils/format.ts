/**
 * Helper định dạng dùng chung. Tiền VND vẫn dùng `formatVND` sẵn có ở `api/admin.ts`
 * (một nguồn duy nhất, không viết lại) — file này chỉ bổ sung những thứ chưa có.
 */

/** Ngày kiểu Việt Nam: DD/MM/YYYY. Nhận ISO string hoặc Date; rỗng/null → '—'. */
export function formatDateVN(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Ngày + giờ: DD/MM/YYYY HH:mm. */
export function formatDateTimeVN(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${formatDateVN(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Số tiền rút gọn cho trục Y của chart: 20M, 1.5B, 800K. Giữ tối đa 1 chữ số thập phân
 * và bỏ đuôi `.0` để nhãn trục không bị dài.
 */
export function formatCompactVND(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => String(+n.toFixed(1));
  if (abs >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(value / 1_000)}K`;
  return String(value);
}

/** % có dấu để hiển thị mũi tên tăng/giảm. null (kỳ trước = 0) → '—'. */
export function formatDeltaPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value >= 0 ? '+' : ''}${value}%`;
}
