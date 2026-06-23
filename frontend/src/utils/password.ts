// Quy tắc mật khẩu dùng chung toàn FE — đồng bộ với @Pattern (WEAK_PASSWORD) ở backend:
// tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const passwordValid = (pw: string): boolean => PASSWORD_RULE.test(pw);

// Điểm 0..5 cho thanh đo trực quan (5 = đạt toàn bộ tiêu chí).
export function scorePassword(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export type StrengthLevel = 'weak' | 'fair' | 'strong';

export function strengthLevel(pw: string): { level: StrengthLevel; color: string; pct: number } {
  const s = scorePassword(pw);
  if (s <= 2) return { level: 'weak', color: '#e23d6e', pct: 34 };
  if (s < 5) return { level: 'fair', color: '#f59e0b', pct: 67 };
  return { level: 'strong', color: '#16a34a', pct: 100 };
}
