// Logic thuần của modal Thêm/Sửa gói (admin) — test ở tests/planForm.test.ts. Không phụ thuộc React.
import {
  ALL_PLATFORMS, PLAN_LIMIT_FIELDS, type PlanFeatureLimits, type PlanLimitField, type PlanLimitKey,
} from '../api/planLimitCatalog.ts';
import type { PlatformEnum } from '../api/connections.ts';

export const PLAN_LIMIT_NUMBER_MAX = 100_000;
const UNLIMITED = -1;

/**
 * Bản nháp một giới hạn:
 * - number: [Giới hạn | Không giới hạn | Tắt | Mặc định (chỉ gói lõi)] + ô số khi "Giới hạn";
 * - flag: Bật / Tắt / Mặc định (chỉ gói lõi);
 * - set: danh sách nền tảng / Mặc định (chỉ gói lõi).
 */
export type NumberMode = 'limit' | 'unlimited' | 'off' | 'default';
export type LimitDraft =
  | { kind: 'number'; mode: NumberMode; n: string }
  | { kind: 'flag'; mode: 'on' | 'off' | 'default' }
  | { kind: 'set'; mode: 'list' | 'default'; platforms: PlatformEnum[] };

export type LimitDrafts = Record<PlanLimitKey, LimitDraft>;

function rawOf(limits: PlanFeatureLimits | null | undefined, f: PlanLimitField): unknown {
  return limits ? (limits as unknown as Record<string, unknown>)[f.field] ?? null : null;
}

export function toLimitDraft(f: PlanLimitField, raw: unknown): LimitDraft {
  if (f.type === 'FLAG') return { kind: 'flag', mode: raw == null ? 'default' : raw ? 'on' : 'off' };
  if (f.type === 'SET') {
    return raw == null ? { kind: 'set', mode: 'default', platforms: [] }
      : { kind: 'set', mode: 'list', platforms: (raw as PlatformEnum[]).filter((p) => ALL_PLATFORMS.includes(p)) };
  }
  const n = raw as number | null;
  if (n == null) return { kind: 'number', mode: 'default', n: '' };
  if (n === UNLIMITED) return { kind: 'number', mode: 'unlimited', n: '' };
  if (n === 0) return { kind: 'number', mode: 'off', n: '' };
  return { kind: 'number', mode: 'limit', n: String(n) };
}

export function toLimitDrafts(limits: PlanFeatureLimits | null | undefined): LimitDrafts {
  return Object.fromEntries(PLAN_LIMIT_FIELDS.map((f) => [f.key, toLimitDraft(f, rawOf(limits, f))])) as LimitDrafts;
}

/** Giá trị THÔ gửi backend; "Mặc định" → null (backend giữ nguyên — reset đi qua `resetToDefault`). */
export function fromLimitDraft(d: LimitDraft): unknown {
  if (d.kind === 'flag') return d.mode === 'default' ? null : d.mode === 'on';
  if (d.kind === 'set') return d.mode === 'default' ? null : [...d.platforms];
  if (d.mode === 'default') return null;
  if (d.mode === 'unlimited') return UNLIMITED;
  if (d.mode === 'off') return 0;
  return Number(d.n);
}

export function fromLimitDrafts(drafts: LimitDrafts): PlanFeatureLimits {
  return Object.fromEntries(PLAN_LIMIT_FIELDS.map((f) => [f.field, fromLimitDraft(drafts[f.key])])) as unknown as PlanFeatureLimits;
}

/** Khoá đang để "Mặc định" mà trên gói đang có giá trị → gửi `resetToDefault` (chỉ gói lõi dùng được). */
export function resetKeys(drafts: LimitDrafts, original: PlanFeatureLimits | null | undefined): PlanLimitKey[] {
  return PLAN_LIMIT_FIELDS
    .filter((f) => drafts[f.key].mode === 'default' && rawOf(original, f) != null)
    .map((f) => f.key);
}

export type LimitError = 'required' | 'invalid';

/** Lỗi từng giới hạn: gói tự tạo không được để "Mặc định" (backend 2211); "Giới hạn" phải là số 1..100000. */
export function limitErrors(drafts: LimitDrafts, isCore: boolean): Partial<Record<PlanLimitKey, LimitError>> {
  const errors: Partial<Record<PlanLimitKey, LimitError>> = {};
  for (const f of PLAN_LIMIT_FIELDS) {
    const d = drafts[f.key];
    if (d.mode === 'default') {
      if (!isCore) errors[f.key] = 'required';
      continue;
    }
    if (d.kind === 'number' && d.mode === 'limit') {
      const n = Number(d.n);
      if (!/^\d+$/.test(d.n) || n < 1 || n > PLAN_LIMIT_NUMBER_MAX) errors[f.key] = 'invalid';
    }
  }
  return errors;
}

/**
 * Giới hạn HIỆU LỰC của bản nháp (dùng cho gợi ý + cảnh báo lệch): "Mặc định" lấy mặc định hệ thống.
 * number: null = không giới hạn, 0 = tắt; flag: true/false; set: danh sách nền tảng.
 */
export interface EffectiveLimits {
  numbers: Partial<Record<PlanLimitKey, number | null>>;
  flags: Partial<Record<PlanLimitKey, boolean>>;
  platforms: PlatformEnum[];
}

export function effectiveLimits(drafts: LimitDrafts, defaults: PlanFeatureLimits | null | undefined): EffectiveLimits {
  const out: EffectiveLimits = { numbers: {}, flags: {}, platforms: [] };
  for (const f of PLAN_LIMIT_FIELDS) {
    const d = drafts[f.key];
    const raw = d.mode === 'default' ? rawOf(defaults, f) : fromLimitDraft(d);
    if (f.type === 'FLAG') out.flags[f.key] = raw == null ? true : Boolean(raw);
    else if (f.type === 'SET') out.platforms = raw == null ? ['FACEBOOK'] : (raw as PlatformEnum[]);
    else {
      const n = raw as number | null;
      out.numbers[f.key] = n == null || n === UNLIMITED ? null : Math.max(0, n);
    }
  }
  return out;
}

type Dict = Record<string, string>;
const PLATFORM_NAMES: Record<PlatformEnum, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

/**
 * "Tạo gợi ý từ giới hạn": dòng tính năng sinh từ giá trị giới hạn THẬT (đúng ngôn ngữ `t`). Nền tảng đang khoá toàn
 * hệ thống ghi "(Sắp ra mắt)" thay vì liệt kê như đang dùng được.
 */
export function suggestFeatureLines(e: EffectiveLimits, t: Dict, lockedPlatforms: PlatformEnum[]): string[] {
  const lines: string[] = [];
  const count = (key: PlanLimitKey, unlimitedTpl: string, tpl: string) => {
    const n = e.numbers[key];
    if (n === undefined || n === 0) return;
    lines.push(n == null ? unlimitedTpl : tpl.replace('{n}', n.toLocaleString('vi-VN')));
  };
  count('BRAND_PROFILES', t.plSugBrandsUnlimited, t.plSugBrands);
  if (e.platforms.length > 0) {
    const names = e.platforms.map((p) => lockedPlatforms.includes(p)
      ? `${PLATFORM_NAMES[p]} (${t.paComingSoon})` : PLATFORM_NAMES[p]);
    lines.push(t.plSugPlatforms.replace('{list}', names.join(' · ')));
  }
  count('CONNECTED_CHANNELS', t.plSugChannelsUnlimited, t.plSugChannels);
  count('TREND_RESEARCH_PER_PERIOD', t.plSugResearchUnlimited, t.plSugResearch);
  if (e.flags.AUTO_TREND_RESEARCH) lines.push(t.plSugAutoResearch);
  if (e.flags.SCHEDULING) {
    const days = e.numbers.SCHEDULE_HORIZON_DAYS;
    lines.push(days == null ? t.plSugSchedulingUnlimited : t.plSugScheduling.replace('{n}', days.toLocaleString('vi-VN')));
  }
  if (e.flags.GOLDEN_HOURS) lines.push(t.plSugGoldenHours);
  const history = e.numbers.ANALYTICS_HISTORY_DAYS;
  lines.push(history == null ? t.plSugHistoryUnlimited : t.plSugHistory.replace('{n}', Math.max(1, history).toLocaleString('vi-VN')));
  if (e.flags.ANALYTICS_ADVANCED) lines.push(t.plSugAdvanced);
  if (e.flags.ANALYTICS_EXPORT) lines.push(t.plSugExport);
  count('STRATEGY_OPTIMIZATION_PER_PERIOD', t.plSugOptimizeUnlimited, t.plSugOptimize);
  return lines.filter(Boolean);
}

export interface FeatureWarning {
  line: number;
  kind: 'platformExcluded' | 'platformLocked' | 'brandCount' | 'channelCount';
  platform?: PlatformEnum;
  expected?: string;
}

const PLATFORM_PATTERNS: [PlatformEnum, RegExp][] = [
  ['FACEBOOK', /\bfacebook\b|\bfb\b/i],
  ['INSTAGRAM', /\binstagram\b|\big\b/i],
  ['THREADS', /\bthreads\b/i],
];

const BRAND_RE = /(\d[\d.,]*)\s*(?:hồ sơ|brand)/i;
const CHANNEL_RE = /(\d[\d.,]*)\s*(?:kênh|channel)/i;
const UNLIMITED_BRAND_RE = /(?:không giới hạn|unlimited)[^.\n]{0,24}(?:hồ sơ|thương hiệu|brand)/i;

/**
 * Cảnh báo dòng tính năng (card/teaser) nói KHÁC giới hạn thật: nhắc nền tảng gói không gồm / đang khoá toàn hệ thống,
 * con số hồ sơ / kênh không khớp. Chỉ cảnh báo — admin vẫn lưu được.
 */
export function featureWarnings(lines: string[], e: EffectiveLimits, lockedPlatforms: PlatformEnum[]): FeatureWarning[] {
  const warnings: FeatureWarning[] = [];
  const num = (s: string) => Number(s.replace(/[.,]/g, ''));
  lines.forEach((text, line) => {
    // Nền tảng kèm ngoặc ngay sau (vd "Threads (Sắp ra mắt)") là đúng sự thật → bỏ cả cụm; ngoặc khác chỉ bỏ ngoặc.
    const plain = text.replace(/\b(?:facebook|instagram|threads|fb|ig)\b\s*\([^)]*\)/gi, '').replace(/\([^)]*\)/g, '');
    for (const [platform, re] of PLATFORM_PATTERNS) {
      if (!re.test(plain)) continue;
      if (!e.platforms.includes(platform)) warnings.push({ line, kind: 'platformExcluded', platform });
      else if (lockedPlatforms.includes(platform)) warnings.push({ line, kind: 'platformLocked', platform });
    }
    const brands = e.numbers.BRAND_PROFILES;
    const brandMatch = BRAND_RE.exec(plain);
    if (brandMatch && brands !== undefined && (brands == null || num(brandMatch[1]) !== brands)) {
      warnings.push({ line, kind: 'brandCount', expected: brands == null ? '∞' : String(brands) });
    } else if (!brandMatch && UNLIMITED_BRAND_RE.test(plain) && brands != null) {
      warnings.push({ line, kind: 'brandCount', expected: String(brands) });
    }
    const channels = e.numbers.CONNECTED_CHANNELS;
    const channelMatch = CHANNEL_RE.exec(plain);
    if (channelMatch && channels !== undefined && (channels == null || num(channelMatch[1]) !== channels)) {
      warnings.push({ line, kind: 'channelCount', expected: channels == null ? '∞' : String(channels) });
    }
  });
  return warnings;
}

/** Danh sách dòng: bỏ ô trống, cắt khoảng trắng (gửi backend). */
export function cleanLines(lines: string[]): string[] {
  return lines.map((x) => x.trim()).filter(Boolean);
}

/** Đổi chỗ phần tử `from` → `to` (kéo thả / nút ↑↓). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
