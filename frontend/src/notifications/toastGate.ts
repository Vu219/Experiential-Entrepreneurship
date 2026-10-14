// Giới hạn toast thông báo realtime: tối đa `limit` toast trong `windowMs`; vượt thì gom lại để hiện MỘT toast
// "Bạn có N thông báo mới". Module thuần (đồng hồ tiêm vào) — test ở tests/notificationText.test.ts.

export interface ToastGate {
  /** true = hiện toast này; false = đã gom vào bản tóm tắt. */
  offer(): boolean;
  /** Số thông báo đã gom chưa báo (đọc xong về 0). */
  takeSuppressed(): number;
}

export function createToastGate(limit = 3, windowMs = 10_000, now: () => number = Date.now): ToastGate {
  let shown: number[] = [];
  let suppressed = 0;
  return {
    offer() {
      const at = now();
      shown = shown.filter((t) => at - t < windowMs);
      if (shown.length < limit) {
        shown.push(at);
        return true;
      }
      suppressed++;
      return false;
    },
    takeSuppressed() {
      const n = suppressed;
      suppressed = 0;
      return n;
    },
  };
}
