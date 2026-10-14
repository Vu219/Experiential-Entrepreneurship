// Lịch sử ô tìm kiếm toàn cục: các mục ĐÃ CHỌN gần nhất (tối đa 8), lưu localStorage THEO userId — đăng xuất rồi
// đăng nhập tài khoản khác không thấy lịch sử của người trước. Module thuần (storage truyền vào) —
// tests/globalSearch.test.ts.

export const HISTORY_LIMIT = 8;

export type DataKind = 'content' | 'strategy' | 'schedule';

/** Snapshot của mục DỮ LIỆU (không có labelKey để dịch lại) — đủ để hiển thị và điều hướng lại. */
export interface DataSnapshot {
  kind: DataKind;
  /** id bài / chiến lược / lịch phía backend. */
  refId: string;
  title: string;
  platform?: string | null;
}

export interface HistoryEntry {
  /** Mục tĩnh: id trong registry (dịch lại theo ngôn ngữ khi hiển thị). Mục dữ liệu: `${kind}:${refId}`. */
  id: string;
  selectedAt: number;
  snapshot?: DataSnapshot;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const historyKey = (userId: string) => `aima.search.history.${userId}`;

const DATA_KINDS: readonly DataKind[] = ['content', 'strategy', 'schedule'];

function isEntry(v: unknown): v is HistoryEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  if (typeof e.id !== 'string' || typeof e.selectedAt !== 'number') return false;
  if (e.snapshot === undefined) return true;
  const s = e.snapshot as Record<string, unknown> | null;
  return !!s && DATA_KINDS.includes(s.kind as DataKind) && typeof s.refId === 'string' && typeof s.title === 'string';
}

/** Đọc lịch sử; dữ liệu hỏng/không đọc được → rỗng (không bao giờ ném). */
export function readHistory(storage: KeyValueStorage, userId: string): HistoryEntry[] {
  try {
    const raw = storage.getItem(historyKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function write(storage: KeyValueStorage, userId: string, entries: HistoryEntry[]): HistoryEntry[] {
  try {
    storage.setItem(historyKey(userId), JSON.stringify(entries));
  } catch {
    /* storage bị chặn (chế độ riêng tư) — chỉ mất phần ghi nhớ */
  }
  return entries;
}

/** Đưa mục lên đầu (bỏ bản cũ cùng id), giữ tối đa HISTORY_LIMIT. */
export function addHistory(storage: KeyValueStorage, userId: string, entry: HistoryEntry): HistoryEntry[] {
  const rest = readHistory(storage, userId).filter((e) => e.id !== entry.id);
  return write(storage, userId, [entry, ...rest].slice(0, HISTORY_LIMIT));
}

export function removeHistory(storage: KeyValueStorage, userId: string, id: string): HistoryEntry[] {
  return write(storage, userId, readHistory(storage, userId).filter((e) => e.id !== id));
}

export function clearHistory(storage: KeyValueStorage, userId: string): void {
  try {
    storage.removeItem(historyKey(userId));
  } catch {
    /* như trên */
  }
}
