// Logic thuần của ScheduleCalendar (không JSX) — test bằng node --test (tests/schedulePlanner.test.ts).
// Ngày là chuỗi yyyy-MM-dd theo giờ tường của múi giờ đăng; tháng là yyyy-MM. Tính bằng Date.UTC nên không
// phụ thuộc múi giờ của máy.

const pad = (n: number) => String(n).padStart(2, '0');
const fromUtc = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** Tháng (yyyy-MM) chứa ngày {@code day}. */
export const monthOfDay = (day: string) => day.slice(0, 7);

/** Ngày {@code day} cộng {@code delta} ngày (qua tháng/năm đúng). */
export const shiftDay = (day: string, delta: number) => fromUtc(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + delta));

/** Tháng {@code month} cộng {@code delta} tháng. */
export const shiftMonth = (month: string, delta: number) => fromUtc(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + delta, 1)).slice(0, 7);

/** Cùng ngày-trong-tháng ở tháng lệch {@code delta} (kẹp về ngày cuối nếu tháng đích ngắn hơn) — PageUp/PageDown. */
export function shiftDayByMonth(day: string, delta: number): string {
  const month = shiftMonth(monthOfDay(day), delta);
  const last = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  return `${month}-${pad(Math.min(+day.slice(8, 10), last))}`;
}

/** Thứ trong tuần, Thứ Hai = 0 … Chủ Nhật = 6. */
export const weekdayIndex = (day: string) => (new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))).getUTCDay() + 6) % 7;

/** Lưới 6 hàng × 7 cột (Thứ Hai đầu tuần) của tháng {@code month}: 42 ngày, kể cả ngày tháng trước/sau. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const start = shiftDay(first, -weekdayIndex(first));
  return Array.from({ length: 42 }, (_, i) => shiftDay(start, i));
}
