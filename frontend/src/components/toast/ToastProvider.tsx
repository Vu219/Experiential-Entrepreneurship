import { C } from '../../styles/colors';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle, Info, X, XCircle, Loader2, type LucideIcon } from 'lucide-react';
import { getDict } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';

/**
 * Toast góc trên-phải: feedback thao tác NHẤT THỜI (lưu thành công, lỗi API…).
 * Cơ chế hiển thị:
 * - Khi có nhiều thông báo: hiển thị xếp chồng theo cơ chế cái nào có trước hiển thị trước (trên cùng).
 * - Khi lia chuột vào: bung ra hiển thị đầy đủ theo hàng dọc.
 * - Rê chuột ra: tự động gập lại xếp chồng.
 * - Thiết kế giao diện (icon, text, progress bar, màu sắc) giữ nguyên vẹn thiết kế ban đầu.
 */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading';

/** Nút hành động trong toast (vd "Xem" của thông báo realtime) — bấm thì chạy rồi đóng toast. */
export type ToastAction = { label: string; onClick: () => void };

export type ToastOptions = { duration?: number; id?: number; title?: string; action?: ToastAction };

type ToastData = {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
  updatedAt: number;
  title?: string;
  action?: ToastAction;
};

type ToastApi = {
  success: (message: string, opts?: ToastOptions) => number;
  error: (message: string, opts?: ToastOptions) => number;
  warning: (message: string, opts?: ToastOptions) => number;
  info: (message: string, opts?: ToastOptions) => number;
  loading: (message: string, opts?: ToastOptions) => number;
};

const DEFAULT_DURATION = 5000;

const VARIANT_STYLE: Record<
  ToastVariant,
  {
    primary: string;
    titleColor: string;
    progressBg: string;
    iconTint: string;
    icon: LucideIcon;
    titleKey: 'toastSuccess' | 'toastError' | 'toastWarning' | 'toastInfo';
  }
> = {
  success: {
    primary: '#22c55e',
    titleColor: C.toastTitle,
    progressBg: 'linear-gradient(90deg, #4ade80, #22c55e, #16a34a)',
    iconTint: 'rgba(34,197,94,0.12)',
    icon: CheckCircle,
    titleKey: 'toastSuccess',
  },
  error: {
    primary: '#ef4444',
    titleColor: C.toastTitle,
    progressBg: 'linear-gradient(90deg, #f87171, #ef4444, #dc2626)',
    iconTint: 'rgba(239,68,68,0.12)',
    icon: XCircle,
    titleKey: 'toastError',
  },
  warning: {
    primary: '#f59e0b',
    titleColor: C.toastTitle,
    progressBg: 'linear-gradient(90deg, #fbbf24, #f59e0b, #d97706)',
    iconTint: 'rgba(245,158,11,0.12)',
    icon: AlertTriangle,
    titleKey: 'toastWarning',
  },
  info: {
    primary: '#06b6d4',
    titleColor: C.toastTitle,
    progressBg: 'linear-gradient(90deg, #22d3ee, #06b6d4, #0891b2)',
    iconTint: 'rgba(6,182,212,0.12)',
    icon: Info,
    titleKey: 'toastInfo',
  },
  loading: {
    primary: '#6366f1',
    titleColor: C.toastTitle,
    progressBg: 'linear-gradient(90deg, #818cf8, #6366f1, #4f46e5)',
    iconTint: 'rgba(99,102,241,0.12)',
    icon: Loader2,
    titleKey: 'toastInfo',
  },
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export let globalToast: ToastApi | null = null;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const nextId = useRef(1);

  const push = useCallback((variant: ToastVariant, message: string, opts?: ToastOptions) => {
    const id = opts?.id ?? nextId.current++;
    setToasts((list) => {
      const idx = list.findIndex((t) => t.id === id);
      // Cùng một câu đang hiện (vd interceptor đã báo lỗi giới hạn gói, component lại toast e.message) → không xếp chồng.
      if (idx < 0 && variant !== 'loading' && list.some((t) => t.message === message && t.variant !== 'loading')) {
        return list;
      }
      const newToast: ToastData = {
        id,
        variant,
        message,
        duration: opts?.duration ?? (variant === 'loading' ? 999999 : DEFAULT_DURATION),
        updatedAt: Date.now(),
        title: opts?.title,
        action: opts?.action,
      };
      if (idx >= 0) {
        const newList = [...list];
        newList[idx] = newToast;
        return newList;
      }
      return [...list, newToast];
    });
    return id;
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const api = useMemo<ToastApi>(
    () => {
      const t: ToastApi = {
        success: (m, o) => push('success', m, o),
        error: (m, o) => push('error', m, o),
        warning: (m, o) => push('warning', m, o),
        info: (m, o) => push('info', m, o),
        loading: (m, o) => push('loading', m, o),
      };
      globalToast = t;
      return t;
    },
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}

const LEAVE_MS = 220;

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastData[];
  onRemove: (id: number) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const heightsRef = useRef<Record<number, number>>({});
  const [leavingIds, setLeavingIds] = useState<Set<number>>(new Set());
  const leavingRef = useRef<Set<number>>(new Set());

  const handleHeightChange = useCallback((id: number, height: number) => {
    if (heightsRef.current[id] !== height) {
      heightsRef.current[id] = height;
      setHeights((prev) => ({ ...prev, [id]: height }));
    }
  }, []);

  const handleClose = useCallback(
    (id: number) => {
      if (leavingRef.current.has(id)) return;
      leavingRef.current.add(id);
      setLeavingIds(new Set(leavingRef.current));
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => {
        leavingRef.current.delete(id);
        setLeavingIds(new Set(leavingRef.current));
        onRemove(id);
      }, reduced ? 0 : LEAVE_MS);
    },
    [onRemove],
  );

  if (toasts.length === 0) return null;

  // Tính chiều cao tổng thể của container để vùng hover bao trọn toàn bộ danh sách khi bung ra
  const containerHeight = (() => {
    if (isHovered) {
      let total = 0;
      for (let i = 0; i < toasts.length; i++) {
        const h = heights[toasts[i].id] || 68;
        total += h + (i < toasts.length - 1 ? 10 : 0);
      }
      return total;
    }
    const topH = (toasts[0] && heights[toasts[0].id]) || 68;
    const stackExtra = Math.min(toasts.length - 1, 2) * 10;
    return topH + stackExtra;
  })();

  return createPortal(
    <div
      className="toast-stack"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        right: 16,
        zIndex: 1100,
        width: 'min(380px, calc(100vw - 32px))',
        height: containerHeight,
        pointerEvents: isHovered ? 'auto' : 'none',
        transition: 'height 300ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {toasts.map((toast, index) => {
        const isLeaving = leavingIds.has(toast.id);

        let offsetY = 0;
        let scale = 1;
        let opacity = 1;
        let zIndex = 50 - index;
        let pointerEvents: 'auto' | 'none' = 'auto';

        if (isHovered) {
          // Khi lia chuột vào: bung ra hiển thị đầy đủ theo thứ tự từ trên xuống dưới
          let y = 0;
          for (let i = 0; i < index; i++) {
            const prevId = toasts[i].id;
            const h = heights[prevId] || 68;
            y += h + 10;
          }
          offsetY = y;
          scale = 1;
          opacity = 1;
          pointerEvents = 'auto';
        } else {
          // Khi bình thường: xếp chồng theo cơ chế cái nào có trước hiển thị trước
          // Index 0 là cái đến trước -> ở trên cùng (front layer)
          offsetY = index * 10;
          scale = Math.max(1 - index * 0.045, 0.85);
          opacity = index === 0 ? 1 : index === 1 ? 0.92 : index === 2 ? 0.75 : 0;
          pointerEvents = index === 0 ? 'auto' : 'none';
        }

        if (isLeaving) {
          scale = 0.95;
          opacity = 0;
          pointerEvents = 'none';
        }

        return (
          <ToastItem
            key={toast.id}
            toast={toast}
            isHovered={isHovered}
            isLeaving={isLeaving}
            offsetY={offsetY}
            scale={scale}
            opacity={opacity}
            zIndex={zIndex}
            pointerEvents={pointerEvents}
            onClose={() => handleClose(toast.id)}
            onHeightChange={handleHeightChange}
          />
        );
      })}
    </div>,
    document.body,
  );
}

interface ToastItemProps {
  toast: ToastData;
  isHovered: boolean;
  isLeaving: boolean;
  offsetY: number;
  scale: number;
  opacity: number;
  zIndex: number;
  pointerEvents: 'auto' | 'none';
  onClose: () => void;
  onHeightChange: (id: number, height: number) => void;
}

function ToastItem({
  toast,
  isHovered,
  isLeaving,
  offsetY,
  scale,
  opacity,
  zIndex,
  pointerEvents,
  onClose,
  onHeightChange,
}: ToastItemProps) {
  const lang = useAppStore((s) => s.lang);
  const t = getDict(lang);
  const itemRef = useRef<HTMLDivElement>(null);

  const { primary, progressBg, iconTint, icon: IconCmp, titleKey } = VARIANT_STYLE[toast.variant];

  // Đo chiều cao chính xác của card
  useLayoutEffect(() => {
    const el = itemRef.current;
    if (!el) return;
    const h = el.offsetHeight;
    if (h > 0) onHeightChange(toast.id, h);
  }, [toast.id, toast.message, toast.title, onHeightChange]);

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (h > 0) onHeightChange(toast.id, h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [toast.id, onHeightChange]);

  // Quản lý timer tự đóng & pause-on-hover:
  // - Mỗi thông báo tự đếm ngược thời gian từ lúc hiển thị độc lập với nhau (cái nào hết trước ẩn trước).
  // - Khi hover (isHovered): TẠM DỪNG đếm ngược cho tất cả các thẻ để người dùng đọc thoải mái.
  // - Khi chuột rời đi: tiếp tục đếm ngược thời gian còn lại.
  const remainingRef = useRef(toast.duration);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    remainingRef.current = toast.duration;
  }, [toast.id, toast.duration, toast.updatedAt]);

  useEffect(() => {
    if (isLeaving || toast.variant === 'loading') {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (isHovered) {
      // Khi hover: tạm dừng timer và trừ phần thời gian đã trôi qua
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (startedAtRef.current !== null) {
        const elapsed = Date.now() - startedAtRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
        startedAtRef.current = null;
      }
    } else {
      // Khi không hover: kích hoạt hoặc tiếp tục đếm ngược
      if (timerRef.current) clearTimeout(timerRef.current);
      startedAtRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        onCloseRef.current();
      }, Math.max(remainingRef.current, 0));
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (startedAtRef.current !== null) {
        const elapsed = Date.now() - startedAtRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
        startedAtRef.current = null;
      }
    };
  }, [isHovered, toast.variant, isLeaving]);

  return (
    <div
      ref={itemRef}
      role={toast.variant === 'error' || toast.variant === 'warning' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' || toast.variant === 'warning' ? 'assertive' : 'polite'}
      className={`toast-item toast-item--${toast.variant} ${isLeaving ? 'toast-item--leaving' : ''}`}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '100%',
        transform: isLeaving
          ? `translate3d(40px, ${offsetY}px, 0) scale(0.95)`
          : `translate3d(0, ${offsetY}px, 0) scale(${scale})`,
        transformOrigin: 'top center',
        opacity,
        zIndex,
        pointerEvents,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: C.toastSurface,
        border: `1px solid ${C.toastBorder}`,
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: C.shadowToast,
        transition: isLeaving
          ? 'transform 200ms ease-in, opacity 200ms ease-in'
          : 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease, box-shadow 240ms ease, scale 300ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Icon 42x42 nguyên bản */}
      <span
        aria-hidden
        className={`toast-icon toast-icon--${toast.variant}`}
        style={{
          width: 42,
          height: 42,
          flex: 'none',
          borderRadius: '50%',
          background: iconTint,
          color: primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'toast-icon-pop 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
        }}
      >
        <IconCmp
          size={20}
          strokeWidth={2.5}
          style={toast.variant === 'loading' ? { animation: 'toast-spin 1s linear infinite' } : {}}
        />
      </span>

      {/* Nội dung tiêu đề & message nguyên bản */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 15, color: C.toastTitle, fontWeight: 600, lineHeight: 1.2 }}>
          {toast.title || t[titleKey]}
        </div>
        <div className="toast-message" style={{ fontSize: 13, color: 'var(--c-toast-text, #4b5563)', lineHeight: 1.45, overflowWrap: 'break-word' }}>
          {toast.message}
        </div>
      </div>

      {/* Nút Action nguyên bản nếu có */}
      {toast.action && (
        <button
          type="button"
          className="btn-soft"
          onClick={() => {
            toast.action?.onClick();
            onClose();
          }}
          style={{
            flex: 'none',
            border: `1px solid ${C.border}`,
            borderRadius: 9,
            background: C.surfaceMuted,
            color: C.primary,
            fontSize: 12.5,
            fontWeight: 700,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          {toast.action.label}
        </button>
      )}

      {/* Nút đóng X nguyên bản */}
      <button
        onClick={onClose}
        aria-label={t.toastClose}
        className="toast-close"
        style={{
          width: 28,
          height: 28,
          flex: 'none',
          border: 'none',
          borderRadius: 8,
          background: 'transparent',
          color: C.toastClose,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} strokeWidth={2} />
      </button>

      {/* Thanh tiến trình nguyên bản */}
      <span
        aria-hidden
        className="toast-progress"
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 8,
          height: 2,
          borderRadius: 2,
          background: progressBg,
          animationDuration: `${toast.duration}ms`,
          animationPlayState: isHovered ? 'paused' : 'running',
          visibility: toast.variant === 'loading' ? 'hidden' : 'visible',
        }}
      />
    </div>
  );
}
