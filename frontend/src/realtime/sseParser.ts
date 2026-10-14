// Bộ đọc luồng Server-Sent Events (text/event-stream) — hàm thuần, nhận từng mẩu chữ bất kỳ (một dòng có thể bị cắt
// giữa hai mẩu, kể cả giữa "\r" và "\n"). Theo đặc tả WHATWG ở mức AIMA cần: data nhiều dòng, event, id, retry,
// comment (":hb" — heartbeat, chỉ báo "còn sống"). Test: tests/sseParser.test.ts.

export interface SseEvent {
  /** Tên sự kiện; không có dòng `event:` thì là "message". */
  event: string;
  data: string;
  /** Có khi server gửi `id:` (chỉ sự kiện bền — id thông báo). */
  id?: string;
  /** Thời gian chờ nối lại server gợi ý (ms). */
  retry?: number;
}

export interface SseParser {
  push(chunk: string): void;
  /** Bỏ phần dở dang (khi luồng đứt — sự kiện chưa trọn không được phát). */
  reset(): void;
}

export function createSseParser(onEvent: (event: SseEvent) => void, onComment?: (text: string) => void): SseParser {
  let buffer = '';
  let dataLines: string[] = [];
  let eventName = '';
  let lastId: string | undefined;
  let retry: number | undefined;
  let idSeen = false;

  const dispatch = () => {
    if (dataLines.length > 0) {
      const ev: SseEvent = { event: eventName || 'message', data: dataLines.join('\n') };
      if (idSeen) ev.id = lastId;
      if (retry !== undefined) ev.retry = retry;
      onEvent(ev);
    }
    dataLines = [];
    eventName = '';
    idSeen = false;
    retry = undefined;
  };

  const processLine = (line: string) => {
    if (line === '') {
      dispatch();
      return;
    }
    if (line.startsWith(':')) {
      onComment?.(line.slice(1).trimStart());
      return;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    switch (field) {
      case 'data':
        dataLines.push(value);
        break;
      case 'event':
        eventName = value;
        break;
      case 'id':
        if (!value.includes('\0')) {
          lastId = value;
          idSeen = true;
        }
        break;
      case 'retry':
        if (/^\d+$/.test(value)) retry = Number(value);
        break;
      default:
        break; // trường lạ: bỏ qua theo đặc tả
    }
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const ch = buffer[i];
        if (ch !== '\n' && ch !== '\r') continue;
        // "\r" ở cuối mẩu: có thể là nửa đầu của "\r\n" — chờ mẩu sau.
        if (ch === '\r' && i === buffer.length - 1) break;
        processLine(buffer.slice(start, i));
        if (ch === '\r' && buffer[i + 1] === '\n') i++;
        start = i + 1;
      }
      buffer = buffer.slice(start);
    },
    reset() {
      buffer = '';
      dataLines = [];
      eventName = '';
      idSeen = false;
      retry = undefined;
    },
  };
}

/** Thời gian chờ trước lần nối lại thứ `attempt` (0-based): 1→2→4…30 giây + jitter ±20% (tránh mọi tab nối cùng lúc). */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
  const jitter = base * 0.2 * (random() * 2 - 1);
  return Math.max(500, Math.round(base + jitter));
}
