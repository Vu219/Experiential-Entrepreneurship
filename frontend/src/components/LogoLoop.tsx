import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

// ===== LogoLoop — dải logo chạy ngang vô tận (kiểu react-bits, bản TS + CSS) =====
// Track gồm 2 dãy (seq) giống hệt nhau, animate translateX(-50%) → loop liền mạch.
// Chỉ dùng transform (GPU); CSS ở index.css (.logoloop*) tự dừng khi
// prefers-reduced-motion: reduce. Fade 2 mép bằng mask gradient.

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
  const seqRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(40);

  // Thời lượng vòng lặp = bề rộng một dãy / tốc độ; đo lại khi kích thước đổi.
  useEffect(() => {
    const seq = seqRef.current;
    if (!seq) return;
    const measure = () => {
      const w = seq.scrollWidth;
      if (w > 0) setDuration(w / speed);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(seq);
    return () => ro.disconnect();
  }, [speed, logos, gap, repeat]);

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

  const cls = [
    'logoloop',
    fadeOut ? 'logoloop--fade' : '',
    direction === 'right' ? 'logoloop--reverse' : '',
    pauseOnHover ? 'logoloop--pausable' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} style={style} role="marquee" aria-label={ariaLabel}>
      <div className="logoloop__track" style={{ '--logoloop-duration': `${duration}s` } as CSSProperties}>
        {renderSeq(false, seqRef)}
        {renderSeq(true)}
      </div>
    </div>
  );
}
