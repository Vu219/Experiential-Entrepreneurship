import { DURATION_MAX, type DurationUnit } from '../api/admin';

/** Thời lượng gia hạn / đổi gói hợp lệ — đồng bộ trần `DurationUnit` backend (mã 2090). */
export const durationOk = (amount: number, unit: DurationUnit): boolean =>
  Number.isInteger(amount) && amount >= 1 && amount <= DURATION_MAX[unit];

/** Lý do thao tác gói: bắt buộc, tối đa 500 ký tự (mã 2095). */
export const REASON_MAX = 500;
export const reasonOk = (reason: string): boolean => {
  const r = reason.trim();
  return r.length > 0 && r.length <= REASON_MAX;
};
