import type { Dict } from '../../i18n';
import type { BrandProfile, BrandProfileInput } from '../../api/brandProfile';

// "Độ hoàn thiện" (AI Brand Health): % các trường nhận diện đã điền + danh sách "Cần bổ sung".
// Dùng chung cho card (chỉ số) lẫn form/panel xem (chỉ số + gợi ý).

type BrandLike = Pick<BrandProfile | BrandProfileInput, 'brandName' | 'industry' | 'targetAudience' | 'description' | 'brandVoice' | 'platforms'>;

const FIELDS: [keyof BrandLike, keyof Dict][] = [
  ['brandName', 'bpfName'],
  ['industry', 'bpfIndustry'],
  ['targetAudience', 'bpfAudience'],
  ['description', 'bpfDesc'],
  ['brandVoice', 'bpfTone'],
  ['platforms', 'bpfPlatforms'],
];

const filled = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()));

export interface BrandHealth {
  percent: number;
  missing: (keyof Dict)[]; // i18n key của các trường còn trống
}

export function brandHealth(b: BrandLike): BrandHealth {
  const done = FIELDS.filter(([f]) => filled(b[f])).length;
  const missing = FIELDS.filter(([f]) => !filled(b[f])).map(([, key]) => key);
  return { percent: Math.round((done / FIELDS.length) * 100), missing };
}
