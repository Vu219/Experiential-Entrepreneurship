import { normalize, normalizeWithMap, tokens } from './normalize.ts';

// Chấm điểm một mục của ô tìm kiếm toàn cục với từ khóa (không dấu, không phân biệt hoa/thường) và trả về
// vùng cần tô sáng trên NHÃN GỐC. Module thuần — test ở tests/globalSearch.test.ts.
//
// Thứ hạng (cao → thấp): nhãn chứa nguyên cụm (ưu tiên đầu nhãn / đầu từ) > nhãn chứa đủ các từ > từ khóa
// đồng nghĩa > đủ các từ trên nhãn + từ khóa + mô tả > chữ cái đầu/tiền tố ("cd" → "Cài đặt").

export interface Searchable {
  label: string;
  /** Từ đồng nghĩa (vi + en) — chỉ để khớp, không hiển thị. */
  keywords?: readonly string[];
  /** Dòng phụ (vd tên trang cha) — khớp yếu hơn nhãn. */
  desc?: string;
}

/** [đầu, cuối) theo chỉ số của nhãn gốc. */
export type Range = [number, number];

export interface Match {
  score: number;
  ranges: Range[];
}

const isWordStart = (text: string, i: number) => i === 0 || text[i - 1] === ' ';

/** Độ dài (đơn vị UTF-16) của ký tự gốc bắt đầu ở `at`. */
const charLen = (original: string, at: number) => ((original.codePointAt(at) ?? 0) > 0xffff ? 2 : 1);

function rangeOf(original: string, map: number[], start: number, length: number): Range {
  const last = map[start + length - 1];
  return [map[start], last + charLen(original, last)];
}

export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Range[] = [];
  for (const r of sorted) {
    const prev = out[out.length - 1];
    if (prev && r[0] <= prev[1]) prev[1] = Math.max(prev[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** Vị trí xuất hiện của `token`, ưu tiên ở đầu một từ. */
function findToken(text: string, token: string): number {
  let fallback = -1;
  let from = 0;
  for (;;) {
    const i = text.indexOf(token, from);
    if (i < 0) return fallback;
    if (isWordStart(text, i)) return i;
    if (fallback < 0) fallback = i;
    from = i + 1;
  }
}

/** Chữ cái đầu / tiền tố: mỗi ký tự của từ khóa phải nằm ở đầu một từ hoặc nối liền ký tự khớp trước. */
function initialsMatch(text: string, query: string): number[] | null {
  const positions: number[] = [];
  let ti = 0;
  for (const qc of query) {
    const prev = positions[positions.length - 1];
    if (prev !== undefined && text[prev + 1] === qc) {
      positions.push(prev + 1);
      ti = prev + 2;
      continue;
    }
    let found = -1;
    for (let i = ti; i < text.length; i++) {
      if (text[i] === qc && isWordStart(text, i)) {
        found = i;
        break;
      }
    }
    if (found < 0) return null;
    positions.push(found);
    ti = found + 1;
  }
  return positions;
}

export function matchItem(query: string, item: Searchable): Match | null {
  const q = normalize(query);
  if (!q) return null;
  const qTokens = tokens(query);
  const label = normalizeWithMap(item.label);
  const lt = label.text;

  // 1. Nhãn chứa nguyên cụm.
  const at = findToken(lt, q);
  if (at >= 0) {
    const bonus = at === 0 ? 40 : isWordStart(lt, at) ? 20 : 0;
    return { score: 100 + bonus - Math.min(lt.length - q.length, 30) * 0.2, ranges: [rangeOf(item.label, label.map, at, q.length)] };
  }

  // 2. Nhãn chứa đủ các từ (thứ tự bất kỳ).
  const positions = qTokens.map((tk) => findToken(lt, tk));
  if (qTokens.length > 1 && positions.every((p) => p >= 0)) {
    const starts = positions.filter((p) => isWordStart(lt, p)).length;
    return {
      score: 70 + (10 * starts) / qTokens.length,
      ranges: mergeRanges(positions.map((p, i) => rangeOf(item.label, label.map, p, qTokens[i].length))),
    };
  }

  // 3. Từ khóa đồng nghĩa.
  let kwScore = 0;
  for (const raw of item.keywords ?? []) {
    const kw = normalize(raw);
    const s = kw === q ? 60 : kw.startsWith(q) ? 55 : kw.includes(q) ? 45 : qTokens.every((tk) => kw.includes(tk)) ? 40 : 0;
    kwScore = Math.max(kwScore, s);
  }
  if (kwScore > 0) return { score: kwScore, ranges: [] };

  // 4. Đủ các từ trên nhãn + từ khóa + mô tả gộp lại (vd "cai dat ket noi" → "Kết nối" của trang Cài đặt). Mỗi từ
  //    phải là ĐẦU một từ — tránh khớp rác kiểu "bo" nằm giữa "dashboard".
  const words = tokens([item.label, ...(item.keywords ?? []), item.desc ?? ''].join(' '));
  if (qTokens.every((tk) => words.some((w) => w.startsWith(tk)))) {
    const inLabel = qTokens.map((tk) => ({ tk, p: findToken(lt, tk) })).filter((x) => x.p >= 0);
    return { score: 30, ranges: mergeRanges(inLabel.map((x) => rangeOf(item.label, label.map, x.p, x.tk.length))) };
  }

  // 5. Chữ cái đầu / tiền tố ("cd" → "Cài đặt", "lichdang" → "Lịch đăng bài").
  const compact = q.replace(/ /g, '');
  if (compact.length >= 2) {
    const hit = initialsMatch(lt, compact);
    if (hit) return { score: 15, ranges: mergeRanges(hit.map((p) => rangeOf(item.label, label.map, p, 1))) };
  }
  return null;
}
