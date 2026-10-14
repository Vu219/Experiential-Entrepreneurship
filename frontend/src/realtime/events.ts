// Hợp đồng sự kiện của luồng realtime GET /realtime/stream — khớp enum backend `RealtimeEventType`
// (đổi tên/thêm sự kiện phải sửa cả hai nơi). Payload luôn có `v` (phiên bản) + `ts` (ISO, UTC).
import { useEffect, useRef } from 'react';
import type { AppNotification } from '../api/notifications';

interface Base {
  v: number;
  ts: string;
}

export interface ReadyEvent extends Base {
  unreadCount: number;
  /** true = không phát bù được → tải lại danh sách thông báo từ đầu. */
  resync: boolean;
  serverTime: string;
}

export interface NotificationCreatedEvent extends Base {
  notification: AppNotification;
  unreadCount: number;
  /** Cài đặt của user cho nhóm này có bật toast không (phát bù luôn false). */
  toast: boolean;
}

export interface NotificationReadEvent extends Base {
  ids?: string[];
  all?: boolean;
  unreadCount: number;
}

export interface NotificationDeletedEvent extends Base {
  ids?: string[];
  /** true = đã xoá mọi thông báo ĐÃ ĐỌC. */
  read?: boolean;
  unreadCount: number;
}

export type JobKind = 'GENERATION' | 'FORMATTING' | 'REGEN' | 'TREND' | 'AI_ASSIST' | 'OPTIMIZE';

export interface JobUpdatedEvent extends Base {
  kind: JobKind;
  jobId: string;
  itemId?: string | null;
  platform?: string | null;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'COMPLETED';
  stage?: string | null;
  progress?: { done: number; total: number; platform?: string | null } | null;
  errorCode?: string | null;
  resultId?: string | null;
}

export interface AiDeltaEvent extends Base {
  jobId: string;
  seq: number;
  /** Đường dẫn field, vd "caption", "script.steps[1].content". */
  path: string;
  append: string;
  /** true = thay toàn bộ giá trị field. */
  replace?: boolean;
}

export interface AiResetEvent extends Base {
  jobId: string;
  reason: string;
}

export interface PostUpdatedEvent extends Base {
  scheduleId: string;
  postId?: string | null;
  itemId?: string | null;
  platform?: string | null;
  status: string;
  attempt?: number | null;
  nextRetryAt?: string | null;
  holdReason?: string | null;
  errorCode?: string | null;
}

export interface ReconnectEvent extends Base {
  reason?: 'token' | 'max-age';
}

export interface RealtimeEventMap {
  ready: ReadyEvent;
  'notification.created': NotificationCreatedEvent;
  'notification.read': NotificationReadEvent;
  'notification.deleted': NotificationDeletedEvent;
  'job.updated': JobUpdatedEvent;
  'ai.delta': AiDeltaEvent;
  'ai.reset': AiResetEvent;
  'post.updated': PostUpdatedEvent;
  'usage.updated': Base & { percent: number };
  'session.revoked': Base;
  replaced: Base;
  reconnect: ReconnectEvent;
}

export type RealtimeEventName = keyof RealtimeEventMap;

type Handler<K extends RealtimeEventName> = (data: RealtimeEventMap[K]) => void;

const handlers = new Map<RealtimeEventName, Set<(data: unknown) => void>>();

export function subscribeRealtime<K extends RealtimeEventName>(name: K, handler: Handler<K>): () => void {
  let set = handlers.get(name);
  if (!set) {
    set = new Set();
    handlers.set(name, set);
  }
  const wrapped = handler as (data: unknown) => void;
  set.add(wrapped);
  return () => set?.delete(wrapped);
}

export function emitRealtime(name: string, data: unknown): void {
  handlers.get(name as RealtimeEventName)?.forEach((h) => {
    try {
      h(data);
    } catch (e) {
      console.error('[realtime] handler error', name, e);
    }
  });
}

/** Nghe một sự kiện realtime trong component; handler luôn là bản mới nhất (không cần useCallback). */
export function useRealtimeEvent<K extends RealtimeEventName>(name: K, handler: Handler<K>): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribeRealtime(name, (data) => ref.current(data)), [name]);
}
