import type { ScheduleStatus } from '../../api/schedules.ts';
import type { Tone } from '../../statusTokens.ts';

// Map trạng thái lịch đăng → tone màu (statusTokens) — tách từ pages/app/Calendar.tsx.
export const STATUS_TONE: Record<ScheduleStatus, Tone> = {
  SCHEDULED: 'purple', ON_HOLD: 'warning', POSTING: 'warning',
  POSTED: 'success', FAILED: 'danger', CANCELLED: 'neutral',
};

// Thứ tự chip lọc trạng thái ở hàng đợi.
export const FILTERS: (ScheduleStatus | 'ALL')[] = ['ALL', 'SCHEDULED', 'ON_HOLD', 'POSTED', 'FAILED', 'CANCELLED'];
