// Cấu hình "Lịch research tự động" của trang Xu hướng — lưu ở BACKEND (V19, GET/PUT /trend-research/schedule).
// DailyTrendResearchJob quét mỗi giờ và chạy lịch đến giờ (phút bị bỏ qua); user chưa đặt lịch vẫn chạy 02:00.
// Trước đây cấu hình nằm ở localStorage và không ảnh hưởng job — bản cũ đó bị bỏ (xem clearLegacyTrendSchedule).
import {
  getTrendResearchSchedule,
  saveTrendResearchSchedule,
  type ResearchPlatform,
  type TrendResearchScheduleDto,
} from './api/trendResearch';

export interface TrendSchedule {
  enabled: boolean;
  brandId: string;
  brandName: string;
  strategyId: string;
  strategyName: string;
  /** Tag nền tảng trong scope: FB | IG | TH. */
  platforms: string[];
  frequency: 'daily' | 'weekly';
  /** Chỉ dùng khi weekly: 0=T2 .. 6=CN. */
  days: number[];
  /** Giờ chạy dạng "HH:mm". */
  time: string;
}

const LEGACY_KEY = 'aima_trend_schedule';
const TAG_TO_ENUM: Record<string, ResearchPlatform> = { FB: 'FACEBOOK', IG: 'INSTAGRAM', TH: 'THREADS' };
const ENUM_TO_TAG: Record<ResearchPlatform, string> = { FACEBOOK: 'FB', INSTAGRAM: 'IG', THREADS: 'TH' };

function fromDto(d: TrendResearchScheduleDto): TrendSchedule {
  return {
    enabled: d.enabled,
    brandId: d.brandProfileId ?? '',
    brandName: d.brandName ?? '',
    strategyId: d.strategyId ?? '',
    strategyName: d.strategyName ?? '',
    platforms: d.platforms.map((p) => ENUM_TO_TAG[p]),
    frequency: d.frequency === 'WEEKLY' ? 'weekly' : 'daily',
    days: d.days ?? [],
    time: d.time,
  };
}

/** null = chưa cấu hình (job mặc định 02:00 đang chạy). */
export async function loadTrendSchedule(): Promise<TrendSchedule | null> {
  const dto = await getTrendResearchSchedule();
  return dto ? fromDto(dto) : null;
}

export async function saveTrendSchedule(s: TrendSchedule): Promise<TrendSchedule> {
  const dto = await saveTrendResearchSchedule({
    enabled: s.enabled,
    brandProfileId: s.brandId || null,
    strategyId: s.strategyId || null,
    platforms: s.platforms.map((tag) => TAG_TO_ENUM[tag]).filter(Boolean),
    frequency: s.frequency === 'weekly' ? 'WEEKLY' : 'DAILY',
    days: s.frequency === 'weekly' ? s.days : [],
    time: s.time,
  });
  return fromDto(dto);
}

/** Bản localStorage cũ không bao giờ điều khiển job — xoá để khỏi hiển thị nhầm. */
export function clearLegacyTrendSchedule(): void {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // trình duyệt chặn storage — không sao
  }
}
