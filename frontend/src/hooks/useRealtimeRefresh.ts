import { useEffect, useRef } from 'react';
import { subscribeRealtime, type RealtimeEventName } from '../realtime/events';
import { useRealtimeStore } from '../store/useRealtimeStore';

/**
 * Tải lại dữ liệu của một màn hình khi có sự kiện realtime liên quan (vd `post.updated` → Lịch đăng), gộp trong
 * `delayMs` (mặc định 500ms) để nhiều sự kiện liên tiếp chỉ gọi một lần. `ready` chỉ kích hoạt khi NỐI LẠI (không phải
 * lần kết nối đầu — màn hình đã tự tải lúc mở): lúc mất kết nối có thể đã lỡ sự kiện.
 */
export function useRealtimeRefresh(names: RealtimeEventName[], onRefresh: () => void, delayMs = 500): void {
  const callback = useRef(onRefresh);
  callback.current = onRefresh;
  const key = names.join('|');

  useEffect(() => {
    let timer: number | null = null;
    const fire = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        callback.current();
      }, delayMs);
    };
    const offs = key.split('|').map((name) => subscribeRealtime(name as RealtimeEventName, () => {
      if (name === 'ready' && useRealtimeStore.getState().readySeq <= 1) return;
      fire();
    }));
    return () => {
      offs.forEach((off) => off());
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [key, delayMs]);
}
