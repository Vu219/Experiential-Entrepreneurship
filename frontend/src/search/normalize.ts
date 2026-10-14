// Chuẩn hoá chuỗi cho ô tìm kiếm toàn cục: chữ thường + bỏ dấu tiếng Việt (đ → d) để "cai dat" khớp
// "Cài đặt". Module THUẦN (không import runtime) để test bằng `node --test` — tests/globalSearch.test.ts.

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Một ký tự gốc → phần chuẩn hoá của nó (thường 1 ký tự; dấu tổ hợp rời → chuỗi rỗng). */
function foldChar(ch: string): string {
  if (ch === 'đ' || ch === 'Đ') return 'd';
  return ch.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/** Chữ thường, bỏ dấu, gộp khoảng trắng. */
export function normalize(text: string): string {
  let out = '';
  for (const ch of text) out += foldChar(ch);
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Như {@link normalize} nhưng giữ bản đồ vị trí: `map[i]` = vị trí trong chuỗi GỐC của ký tự thứ i ở chuỗi
 * chuẩn hoá — để tô sáng đúng phần chữ có dấu khi khớp trên chuỗi không dấu. Không gộp/cắt khoảng trắng
 * (giữ 1-1 với chuỗi gốc).
 */
export function normalizeWithMap(text: string): { text: string; map: number[] } {
  let out = '';
  const map: number[] = [];
  let index = 0;
  for (const ch of text) {
    const folded = foldChar(ch);
    for (let k = 0; k < folded.length; k++) map.push(index);
    out += folded;
    index += ch.length;
  }
  return { text: out, map };
}

/** Tách từ khóa thành các từ (đã chuẩn hoá), bỏ từ rỗng. */
export function tokens(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}
