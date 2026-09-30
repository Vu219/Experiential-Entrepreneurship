// Validation giờ đăng dạng 24h (HH:mm) — dùng cho ô giờ của SchedulePlanner. Không dùng <input type="time">
// vì trình duyệt hiển thị theo locale máy (12h "06:34 PM" bị cắt chữ, lệch với gợi ý "08:00–09:00").

const TIME_24H = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Chuỗi đúng dạng HH:mm 24h (00:00–23:59). */
export const isTime24 = (v: string): boolean => TIME_24H.test(v);

/** Chuẩn hoá chữ người dùng gõ về dạng HH:mm đang gõ dở: chỉ giữ số, tự chèn ":" ("1834" → "18:34"). */
export function maskTime24(raw: string): string {
  if (raw.includes(':')) {
    const [h, m = ''] = raw.split(':');
    return `${h.replace(/\D/g, '').slice(0, 2)}:${m.replace(/\D/g, '').slice(0, 2)}`;
  }
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** Hoàn tất khi rời ô: "8:30" → "08:30", "8" → "08:00". Không hợp lệ thì trả nguyên chuỗi. */
export function completeTime24(v: string): string {
  const [h = '', m = ''] = v.split(':');
  if (!h) return v;
  const done = `${h.padStart(2, '0')}:${(m || '00').padEnd(2, '0')}`;
  return isTime24(done) ? done : v;
}
