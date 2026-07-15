import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
 * KHÁC NotificationBell (FR-75..FR-79) — hộp thư bền vững từ server; hai thứ song song.
 * Dùng: const toast = useToast(); toast.success(t.xxx) / toast.error(msg).
 */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading';

type ToastData = {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
  updatedAt: number;
  title?: string;
};

type ToastApi = {
  success: (message: string, opts?: { duration?: number; id?: number; title?: string }) => number;
  error: (message: string, opts?: { duration?: number; id?: number; title?: string }) => number;
  warning: (message: string, opts?: { duration?: number; id?: number; title?: string }) => number;
  info: (message: string, opts?: { duration?: number; id?: number; title?: string }) => number;
  loading: (message: string, opts?: { duration?: number; id?: number; title?: string }) => number;
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
    titleColor: '#1F2937',
    progressBg: 'linear-gradient(90deg, #4ade80, #22c55e, #16a34a)',
    iconTint: 'rgba(34,197,94,0.12)',
    icon: CheckCircle,
    titleKey: 'toastSuccess',
  },
  error: {
    primary: '#ef4444',
    titleColor: '#1F2937',
    progressBg: 'linear-gradient(90deg, #f87171, #ef4444, #dc2626)',
    iconTint: 'rgba(239,68,68,0.12)',
    icon: XCircle,
    titleKey: 'toastError',
  },
  warning: {
    primary: '#f59e0b',
    titleColor: '#1F2937',
    progressBg: 'linear-gradient(90deg, #fbbf24, #f59e0b, #d97706)',
    iconTint: 'rgba(245,158,11,0.12)',
    icon: AlertTriangle,
    titleKey: 'toastWarning',
  },
  info: {
    primary: '#06b6d4',
    titleColor: '#1F2937',
    progressBg: 'linear-gradient(90deg, #22d3ee, #06b6d4, #0891b2)',
    iconTint: 'rgba(6,182,212,0.12)',
    icon: Info,
    titleKey: 'toastInfo',
  },
  loading: {
    primary: '#6366f1',
    titleColor: '#1F2937',
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

  const push = useCallback((variant: ToastVariant, message: string, opts?: { duration?: number; id?: number; title?: string }) => {
    const id = opts?.id ?? nextId.current++;
    setToasts((list) => {
      const idx = list.findIndex((t) => t.id === id);
      const newToast: ToastData = {
        id,
        variant,
        message,
        duration: opts?.duration ?? (variant === 'loading' ? 999999 : DEFAULT_DURATION),
        updatedAt: Date.now(),
        title: opts?.title,
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

function ToastContainer({ toasts, onRemove }: { toasts: ToastData[]; onRemove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  // Portal ra document.body (như Modal.tsx) để không bị "nhốt" trong ancestor có
  // transform (.view-pop). z-index 1100 > Modal (1000) — toast hiện cả trên modal.
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: 'min(380px, calc(100vw - 32px))',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body,
  );
}

const LEAVE_MS = 220;

function ToastItem({ toast, onRemove }: { toast: ToastData; onRemove: (id: number) => void }) {
  const lang = useAppStore((s) => s.lang);
  const t = getDict(lang);
  const { primary, progressBg, iconTint, icon: IconCmp, titleKey } = VARIANT_STYLE[toast.variant];

  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Pause-on-hover: lưu mốc bắt đầu + thời gian còn lại; hover thì trừ phần đã trôi.
  const remainingRef = useRef(toast.duration);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const leavingRef = useRef(false);

  const close = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    // Chờ animation toast-out rồi mới gỡ khỏi state; reduced-motion tắt animation
    // nên gỡ ngay (animationend không bắn khi animation: none).
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => onRemove(toast.id), reduced ? 0 : LEAVE_MS);
  }, [onRemove, toast.id]);

  useEffect(() => {
    // Reset ref khi StrictMode double-mount (ref persist qua mount cycles)
    leavingRef.current = false;
    remainingRef.current = toast.duration;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(close, remainingRef.current);
    return () => clearTimeout(timerRef.current);
  }, [close, toast.duration, toast.updatedAt]);

  const pause = () => {
    if (leavingRef.current) return;
    clearTimeout(timerRef.current);
    remainingRef.current -= Date.now() - startedAtRef.current;
    setPaused(true);
  };
  const resume = () => {
    if (leavingRef.current) return;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(close, Math.max(remainingRef.current, 0));
    setPaused(false);
  };

  return (
    <div
      role={toast.variant === 'error' || toast.variant === 'warning' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' || toast.variant === 'warning' ? 'assertive' : 'polite'}
      className={leaving ? 'toast-item toast-item--leaving' : 'toast-item'}
      onMouseEnter={pause}
      onMouseLeave={resume}
      style={{
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'rgba(255,255,255,0.98)',
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 12px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)',
      }}
    >
      <span
        aria-hidden
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
        <IconCmp size={20} strokeWidth={2.5} style={toast.variant === 'loading' ? { animation: 'toast-spin 1s linear infinite' } : {}} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 15, color: '#1F2937', fontWeight: 600, lineHeight: 1.2 }}>
          {toast.title || t[titleKey]}
        </div>
        <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.45, overflowWrap: 'break-word' }}>
          {toast.message}
        </div>
      </div>
      <button
        onClick={close}
        aria-label={t.toastClose}
        className="toast-close"
        style={{
          width: 28,
          height: 28,
          flex: 'none',
          border: 'none',
          borderRadius: 8,
          background: 'transparent',
          color: '#9ca3af',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} strokeWidth={2} />
      </button>
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
          animationPlayState: paused ? 'paused' : 'running',
          visibility: toast.variant === 'loading' ? 'hidden' : 'visible',
        }}
      />
    </div>
  );
}
