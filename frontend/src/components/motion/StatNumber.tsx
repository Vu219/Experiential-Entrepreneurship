import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from 'react';
import NumberFlow from '@number-flow/react';
import { useInView, useReducedMotion } from 'framer-motion';

// Type `format` của NumberFlow (tập con của Intl.NumberFormatOptions).
type NumberFlowFormat = ComponentProps<typeof NumberFlow>['format'];

// ===== Số đếm kiểu odometer =====
// Vào viewport lần đầu → chữ số "nhảy" từ 0 tới giá trị cuối (~1.2s) rồi dừng.
// Chống layout shift: render giá trị cuối vô hình để giữ đúng bề rộng ngay từ đầu.
// prefers-reduced-motion → hiện thẳng giá trị cuối, không animate.

const TIMING: EffectTiming = { duration: 1200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };

interface StatNumberProps {
  value: number;
  /** Hậu tố hiển thị liền sau số, vd "+", "×", "/7", "đ". */
  suffix?: string;
  prefix?: string;
  /** Định dạng số (Intl.NumberFormat) — vd giá tiền dùng locales "vi-VN". */
  locales?: string;
  format?: NumberFlowFormat;
  className?: string;
  style?: CSSProperties;
}

export default function StatNumber({ value, suffix, prefix, locales, format, className, style }: StatNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (inView) setShown(value);
  }, [inView, value]);

  const finalText = `${prefix ?? ''}${new Intl.NumberFormat(locales, format).format(value)}${suffix ?? ''}`;

  if (reduced) {
    return (
      <span ref={ref} className={className} style={style}>
        {finalText}
      </span>
    );
  }

  return (
    <span ref={ref} className={className} style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap', ...style }}>
      {/* Giữ chỗ: giá trị cuối vô hình quyết định bề rộng, số animate phủ lên trên. */}
      <span aria-hidden style={{ visibility: 'hidden' }}>
        {finalText}
      </span>
      <span style={{ position: 'absolute', inset: 0 }}>
        <NumberFlow
          value={shown}
          prefix={prefix}
          suffix={suffix}
          locales={locales}
          format={format}
          transformTiming={TIMING}
          spinTiming={TIMING}
        />
      </span>
    </span>
  );
}
