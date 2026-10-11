// Diff theo TỪ giữa caption cũ và caption AI gợi ý (LCS) — hàm thuần, test bằng node --test.
// Mỗi token = một từ kèm khoảng trắng phía sau (ghép lại đúng nguyên văn, không vụn ở dấu cách); nội dung quá dài
// → coi cả đoạn là thay thế (tránh bảng LCS quá lớn làm treo trình duyệt).

export type DiffKind = 'same' | 'added' | 'removed';

export interface DiffSegment {
  kind: DiffKind;
  text: string;
}

const MAX_TOKENS = 1500;

export function tokenize(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [];
}

/** Gộp các đoạn liền kề cùng loại để vẽ gọn. */
function push(out: DiffSegment[], kind: DiffKind, text: string) {
  const last = out[out.length - 1];
  if (last && last.kind === kind) last.text += text;
  else out.push({ kind, text });
}

export function diffWords(before: string, after: string): DiffSegment[] {
  const a = tokenize(before ?? '');
  const b = tokenize(after ?? '');
  const out: DiffSegment[] = [];
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    if (before) push(out, 'removed', before);
    if (after) push(out, 'added', after);
    return out;
  }
  // lcs[i][j] = độ dài LCS của a[i..] và b[j..]
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(out, 'same', a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(out, 'removed', a[i++]);
    } else {
      push(out, 'added', b[j++]);
    }
  }
  while (i < a.length) push(out, 'removed', a[i++]);
  while (j < b.length) push(out, 'added', b[j++]);
  return out;
}

/** Có thay đổi thật (bỏ qua khác biệt chỉ ở khoảng trắng đầu/cuối). */
export function hasChanges(before: string, after: string): boolean {
  return (before ?? '').trim() !== (after ?? '').trim();
}

/** "#a #b" / "a, b" → ["a","b"] (bỏ '#', trùng, rỗng). */
export function parseHashtags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[\s,]+/)) {
    const tag = raw.replace(/^#+/, '').trim();
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
  }
  return out;
}

export const formatHashtags = (tags: string[]) => tags.map((t) => `#${t}`).join(' ');
