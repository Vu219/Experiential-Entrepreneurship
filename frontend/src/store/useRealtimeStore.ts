import { create } from "zustand";

// Trạng thái kết nối realtime (SSE) — dùng chung cho chuông thông báo (badge, chấm "đang kết nối lại", poll dự phòng)
// và các màn chờ job. Vòng đời kết nối nằm ở realtime/realtimeClient.ts, gắn bởi components/RealtimeConnector.

export type RealtimeStatus =
  | "idle" // chưa kết nối (chưa đăng nhập)
  | "connecting"
  | "open" // đã nhận `ready`
  | "reconnecting" // đứt, đang chờ nối lại (backoff)
  | "paused" // tab ẩn > 5 phút / mất mạng — tự nối lại khi quay về
  | "stopped"; // dừng hẳn (tab khác thay thế, 403, hết phiên)

interface RealtimeState {
  status: RealtimeStatus;
  /** Thời điểm đổi trạng thái gần nhất (ms) — chuông đếm 10s/30s từ đây. */
  statusSince: number;
  /** null = chưa biết (chưa có `ready`). */
  unreadCount: number | null;
  /** id sự kiện bền gần nhất (id thông báo) — gửi lại qua Last-Event-ID khi nối lại. */
  lastEventId?: string;
  /** Tăng mỗi lần nhận `ready` (mở/nối lại xong) — màn hình đang mở dùng để tải lại dữ liệu. */
  readySeq: number;
  /** Tăng khi `ready.resync=true` — danh sách thông báo tải lại từ đầu. */
  resyncSeq: number;
  setStatus: (status: RealtimeStatus) => void;
  setUnreadCount: (count: number) => void;
  setLastEventId: (id: string) => void;
  markReady: (resync: boolean) => void;
  reset: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: "idle",
  statusSince: Date.now(),
  unreadCount: null,
  lastEventId: undefined,
  readySeq: 0,
  resyncSeq: 0,
  setStatus: (status) =>
    set((s) => (s.status === status ? s : { status, statusSince: Date.now() })),
  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
  setLastEventId: (id) => set({ lastEventId: id }),
  markReady: (resync) =>
    set((s) => ({ readySeq: s.readySeq + 1, resyncSeq: resync ? s.resyncSeq + 1 : s.resyncSeq })),
  reset: () =>
    set({ status: "idle", statusSince: Date.now(), unreadCount: null, lastEventId: undefined }),
}));
