import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

// ===== LogoLoop — dải logo chạy ngang vô tận (kiểu react-bits, bản TS) =====
// Track gồm 2 dãy (seq) giống hệt nhau; JS animate translateX từ 0 → -seqWidth
// (bằng requestAnimationFrame) rồi wrap → loop liền mạch. Chỉ transform (GPU).
//
// Tối ưu chạy:
//  A. Chỉ chạy khi container CÒN trong viewport (IntersectionObserver) — cuộn ra
//     ngoài thì HỦY rAF hẳn (nhả CPU, không còn giật khi tương tác chỗ khác).
//  B. Hover (khi pauseOnHover) → hệ số tốc độ ease 1→0 (~500ms) rồi dừng mượt; rời
//     chuột → ease 0→1. Dùng rAF nên ramp trơn, không khựng.
//  C. Tôn trọng prefers-reduced-motion → render tĩnh, bỏ qua hover.
// Fade 2 mép bằng mask gradient (.logoloop--fade trong index.css).

export interface LogoItem {
  node: ReactNode;
  title?: string;
}

interface LogoLoopProps {
  logos: LogoItem[];
  /** Tốc độ chạy (px/giây). */
  speed?: number;
  direction?: 'left' | 'right';
  /** Khoảng cách giữa các logo (px). */
  gap?: number;
  /** Số lần lặp danh sách trong MỘT dãy — đủ lớn để dãy rộng hơn khung nhìn. */
  repeat?: number;
  fadeOut?: boolean;
  pauseOnHover?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export default function LogoLoop({
  logos,
  speed = 60,
  direction = 'left',
  gap = 48,
  repeat = 6,
  fadeOut = true,
  pauseOnHover = false,
  ariaLabel,
  className,
  style,
}: LogoLoopProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef<HTMLDivElement>(null);

  // Trạng thái animation giữ trong ref → không re-render mỗi frame.
  const seqWidthRef = useRef(0);
  const offsetRef = useRef(0); // px đã trôi (0..seqWidth)
  const sfRef = useRef(1); // hệ số tốc độ hiện tại 0..1 (ramp mượt)
  const inViewRef = useRef(false);
  const hoverRef = useRef(false);
  const reducedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  // Giá trị prop đọc trong rAF qua ref → đổi speed/direction không phải reset offset.
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const dirRef = useRef(direction);
  dirRef.current = direction;
  const pauseHoverRef = useRef(pauseOnHover);
  pauseHoverRef.current = pauseOnHover;

  useEffect(() => {
    const container = containerRef.current;
    const seq = seqRef.current;
    if (!container || !seq) return;

    const applyTransform = () => {
      const seqW = seqWidthRef.current;
      const off = seqW > 0 ? offsetRef.current % seqW : 0;
      // left: 0 → -seqW ; right: -seqW → 0 (đều liền mạch vì 2 dãy giống hệt).
      const x = dirRef.current === 'right' ? off - seqW : -off;
      if (trackRef.current) trackRef.current.style.transform = `translate3d(${x}px,0,0)`;
    };

    const tick = (ts: number) => {
      // clamp dt: sau khi tab ẩn/rAF ngủ, dt có thể rất lớn → tránh nhảy vọt.
      const dt = lastTsRef.current ? Math.min(ts - lastTsRef.current, 64) : 16;
      lastTsRef.current = ts;

      const target = pauseHoverRef.current && hoverRef.current ? 0 : 1;
      // Ease-out độc lập frame-rate (~500ms tới đích) → chậm dần/nhanh dần tự nhiên.
      sfRef.current = target + (sfRef.current - target) * Math.exp(-dt / 180);
      if (Math.abs(sfRef.current - target) < 0.001) sfRef.current = target;

      const seqW = seqWidthRef.current;
      if (seqW > 0 && sfRef.current > 0.0001) {
        offsetRef.current = (offsetRef.current + speedRef.current * sfRef.current * (dt / 1000)) % seqW;
        applyTransform();
      }

      // Dừng hẳn rAF khi: ra ngoài viewport, giảm chuyển động, hoặc hover đã dừng hẳn.
      const hoverHold = pauseHoverRef.current && hoverRef.current && sfRef.current === 0;
      if (inViewRef.current && !reducedRef.current && !hoverHold) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        lastTsRef.current = 0;
      }
    };

    const ensureRunning = () => {
      if (rafRef.current != null) return; // đang chạy
      if (!inViewRef.current || reducedRef.current) return;
      if (pauseHoverRef.current && hoverRef.current && sfRef.current === 0) return; // hover-hold
      lastTsRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = 0;
    };

    // ——— prefers-reduced-motion ———
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onReduced = () => {
      reducedRef.current = mq.matches;
      if (mq.matches) {
        stop();
        sfRef.current = 1;
        offsetRef.current = 0;
        applyTransform();
      } else {
        ensureRunning();
      }
    };
    reducedRef.current = mq.matches;
    mq.addEventListener('change', onReduced);

    // ——— Đo bề rộng một dãy (px) ———
    const measure = () => {
      const w = seq.scrollWidth;
      if (w > 0) {
        seqWidthRef.current = w;
        if (rafRef.current == null) applyTransform(); // giữ đúng vị trí khi đang dừng
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(seq);

    // ——— A. Chỉ chạy khi trong viewport ———
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        inViewRef.current = e.isIntersecting;
        if (e.isIntersecting) ensureRunning();
        else stop(); // ra ngoài → nhả CPU ngay (override cả hover)
      },
      { threshold: 0.1, rootMargin: '200px 0px' },
    );
    io.observe(container);

    // ——— B. Hover ramp (chỉ khi pauseOnHover) ———
    const onEnter = () => {
      hoverRef.current = true;
      ensureRunning(); // cần rAF để animate ramp-down
    };
    const onLeave = () => {
      hoverRef.current = false;
      ensureRunning(); // khởi động lại nếu đã dừng do hover-hold
    };
    if (pauseOnHover) {
      container.addEventListener('mouseenter', onEnter);
      container.addEventListener('mouseleave', onLeave);
    }

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener('change', onReduced);
      if (pauseOnHover) {
        container.removeEventListener('mouseenter', onEnter);
        container.removeEventListener('mouseleave', onLeave);
      }
    };
    // Chỉ re-init khi pauseOnHover đổi (gắn/tháo listener hover). Mọi thay đổi
    // kích thước do logos/gap/repeat đã được ResizeObserver bắt → không cần re-init.
  }, [pauseOnHover]);

  const items = Array.from({ length: repeat }, () => logos).flat();

  const renderSeq = (ariaHidden: boolean, ref?: typeof seqRef) => (
    <div className="logoloop__seq" ref={ref} aria-hidden={ariaHidden || undefined}>
      {items.map((logo, i) => (
        <div key={i} className="logoloop__item" title={logo.title} style={{ marginRight: gap }}>
          {logo.node}
        </div>
      ))}
    </div>
  );

  const cls = ['logoloop', fadeOut ? 'logoloop--fade' : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={cls} style={style} role="marquee" aria-label={ariaLabel} ref={containerRef}>
      <div className="logoloop__track" ref={trackRef}>
        {renderSeq(false, seqRef)}
        {renderSeq(true)}
      </div>
    </div>
  );
}
