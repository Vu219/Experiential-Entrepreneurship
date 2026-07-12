// Quy tắc mật khẩu dùng chung toàn FE — đồng bộ với @Pattern (WEAK_PASSWORD) ở backend:
// tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const passwordValid = (pw: string): boolean => PASSWORD_RULE.test(pw);

// Kiểm tra từng tiêu chí riêng — dùng cho password checklist UI.
export interface PasswordChecks {
  hasLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

export function passwordChecks(pw: string): PasswordChecks {
  return {
    hasLength: pw.length >= 8,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasDigit: /\d/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw),
  };
}

// Sinh mật khẩu random mạnh (đạt toàn bộ tiêu chí, 14 ký tự).
export function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const specials = '!@#$%&*?';

  // Đảm bảo ít nhất 1 ký tự mỗi loại.
  const mandatory = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    specials[Math.floor(Math.random() * specials.length)],
  ];

  const all = upper + lower + digits + specials;
  const rest = Array.from({ length: 10 }, () => all[Math.floor(Math.random() * all.length)]);

  // Trộn ngẫu nhiên (Fisher-Yates).
  const chars = [...mandatory, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

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
