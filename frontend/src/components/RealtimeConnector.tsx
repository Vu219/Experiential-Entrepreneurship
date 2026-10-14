import { useEffect } from 'react';
import { endSession, refreshSession } from '../api/apiClient';
import { browserRealtimeEnvironment, createRealtimeClient } from '../realtime/realtimeClient';
import { emitRealtime } from '../realtime/events';
import { useRealtimeStore } from '../store/useRealtimeStore';
import type { SseEvent } from '../realtime/sseParser';

/**
 * Mở MỘT luồng SSE cho tab này (D3) khi đã đăng nhập — gắn trong AppShell (chỉ render dưới ProtectedRoute /
 * AdminLayout, unmount khi đăng xuất). StrictMode mount 2 lần ở dev: cleanup abort sạch kết nối đầu.
 * Không render gì; badge/danh sách đọc từ useRealtimeStore + useRealtimeEvent.
 */
export default function RealtimeConnector() {
  useEffect(() => {
    const store = useRealtimeStore.getState();
    const handle = (event: SseEvent) => {
      if (event.id) store.setLastEventId(event.id);
      let data: Record<string, unknown> = {};
      try {
        data = event.data ? JSON.parse(event.data) : {};
      } catch {
        return; // payload hỏng: bỏ qua, DB vẫn là nguồn đúng
      }
      if (typeof data.unreadCount === 'number') store.setUnreadCount(data.unreadCount);
      if (event.event === 'ready') store.markReady(data.resync === true);
      emitRealtime(event.event, data);
    };
    const client = createRealtimeClient({
      url: `${import.meta.env.VITE_API_BASE_URL}/realtime/stream`,
      refresh: refreshSession,
      onSessionEnd: endSession,
      onEvent: handle,
      onStatus: (status) => useRealtimeStore.getState().setStatus(status),
      getLastEventId: () => useRealtimeStore.getState().lastEventId,
      env: browserRealtimeEnvironment(),
    });
    client.start();
    return () => {
      client.stop();
      useRealtimeStore.getState().reset();
    };
  }, []);
  return null;
}
