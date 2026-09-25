import { useEffect, useRef, useState } from 'react';

/**
 * Đếm ngược tới hạn thanh toán, neo theo **giờ SERVER**.
 *
 * <p>Không bao giờ so `expiresAt` với `Date.now()`: đồng hồ máy người dùng lệch vài phút là
 * chuyện thường, và backend trả `LocalDateTime` KHÔNG kèm múi giờ nên JS hiểu nó là giờ local
 * của máy — hai sai số cộng dồn có thể làm đếm ngược âm ngay khi vừa mở trang.</p>
 *
 * <p>Cách làm: lấy hiệu `expiresAt − serverTime` (hai mốc do CÙNG server sinh ra, nên phần
 * diễn giải múi giờ triệt tiêu nhau → đây là một KHOẢNG thời gian thuần tuý), rồi trừ dần bằng
 * {@link performance.now} — đồng hồ đơn điệu, không nhảy khi hệ điều hành chỉnh giờ.</p>
 *
 * @param onExpire gọi ĐÚNG MỘT LẦN khi về 0. Caller phải gọi lại API để lấy trạng thái thật —
 *   job đóng đơn chạy mỗi phút nên có độ trễ, FE tuyệt đối không được tự kết luận đơn đã huỷ.
 */
export function useServerCountdown(
  expiresAt: string | null | undefined,
  serverTime: string | null | undefined,
  onExpire?: () => void
): number | null {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  // Giữ callback trong ref: caller truyền arrow function mới mỗi lần render, đưa thẳng vào
  // deps sẽ khiến interval bị dựng lại liên tục.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const totalMs = durationBetween(serverTime, expiresAt);
    if (totalMs === null) {
      setRemainingMs(null);
      return;
    }

    const anchor = performance.now();
    let fired = false;

    const tick = () => {
      const left = totalMs - (performance.now() - anchor);
      setRemainingMs(left > 0 ? left : 0);
      if (left <= 0 && !fired) {
        fired = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, serverTime]);

  return remainingMs;
}

/**
 * Khoảng cách giữa hai mốc do CÙNG backend sinh ra, tính bằng ms. null khi thiếu/không parse
 * được — caller hiểu là "không có đếm ngược" chứ không phải "đã hết hạn".
 */
function durationBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = parseServerDateTime(from);
  const b = parseServerDateTime(to);
  if (a === null || b === null) return null;
  const diff = b - a;
  return diff > 0 ? diff : 0;
}

/**
 * Parse `LocalDateTime` của backend. Jackson có thể trả tới 6–9 chữ số phần giây
 * (`2026-09-22T20:15:30.123456`), trong khi chuẩn ISO của JS chỉ định nghĩa 3 — cắt bớt cho
 * chắc thay vì trông chờ vào sự dễ tính của từng engine.
 */
function parseServerDateTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/(\.\d{3})\d+/, '$1');
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

/** `mm:ss` cho đếm ngược; ≥ 1 giờ thì thêm phần giờ. null → '—'. */
export function formatCountdown(ms: number | null): string {
  if (ms === null) return '—';
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
