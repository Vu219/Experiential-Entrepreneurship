// Helper ngày giờ dùng chung cho trang Lịch đăng bài (UI-07) — tách từ pages/app/Calendar.tsx.

export const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmtTime = (iso: string) => iso.slice(11, 16);
export const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Giá trị datetime-local "YYYY-MM-DDTHH:mm" của thời điểm hiện tại (giờ máy user). */
export const nowLocal = () => {
  const d = new Date();
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
