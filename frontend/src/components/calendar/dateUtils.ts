import type { PostSchedule } from '../../api/schedules.ts';

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

export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Tên thứ đầy đủ, Thứ Hai-đầu-tuần (index = (getDay()+6)%7) — dòng tóm tắt xác nhận lịch đăng. */
export const WEEKDAYS_FULL: Record<'vi' | 'en', string[]> = {
  vi: ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

/** Ngày này là hôm nay / ngày mai (theo giờ máy user)? Dùng cho nhãn nhóm tương đối. */
export const dayRel = (key: string): 'today' | 'tomorrow' | null => {
  const now = new Date();
  if (key === dateKey(now)) return 'today';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return key === dateKey(tomorrow) ? 'tomorrow' : null;
};

/** Nhãn ngày tuyệt đối: "17 Tháng 7" / "July 17" (kèm năm nếu khác năm hiện tại). */
export const absDayLabel = (key: string, lang: 'vi' | 'en'): string => {
  const [y, m, d] = key.split('-').map(Number);
  const yearSuffix = y === new Date().getFullYear() ? '' : `, ${y}`;
  return lang === 'en' ? `${MONTHS_EN[m - 1]} ${d}${yearSuffix}` : `${d} Tháng ${m}${yearSuffix}`;
};

/** Gom lịch đăng theo ngày, giữ thứ tự đầu vào (API đã sort scheduledTime tăng dần). */
export function groupByDay(rows: PostSchedule[]): { key: string; items: PostSchedule[] }[] {
  const map = new Map<string, PostSchedule[]>();
  for (const s of rows) {
    const k = s.scheduledTime.slice(0, 10);
    const list = map.get(k);
    if (list) list.push(s);
    else map.set(k, [s]);
  }
  return [...map.entries()].map(([key, items]) => ({ key, items }));
}
