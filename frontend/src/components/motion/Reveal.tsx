import type { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

// ===== Reveal khi cuộn tới (fade + trượt lên) =====
// Chỉ animate transform + opacity (GPU). `once:false` để cuộn lên/xuống đều re-animate.
// prefers-reduced-motion → render tĩnh, không chuyển động.

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const VIEWPORT = { once: false, amount: 0.2 } as const;

interface RevealProps {
  children: ReactNode;
  /** Delay khởi đầu (giây). */
  delay?: number;
  /** Khoảng trượt lên ban đầu (px). */
  y?: number;
  className?: string;
  style?: CSSProperties;
}

export function Reveal({ children, delay = 0, y = 24, className, style }: RevealProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      viewport={VIEWPORT}
    >
      {children}
    </motion.div>
  );
}

// ===== Stagger cho danh sách (thẻ tính năng, gói giá…) =====
// <RevealGroup> bọc lưới, mỗi phần tử con bọc bằng <RevealItem> — con xuất hiện lần lượt.

const groupVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

interface RevealGroupProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function RevealGroup({ children, className, style }: RevealGroupProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      variants={groupVariants}
    >
      {children}
    </motion.div>
  );
}

interface RevealItemProps {
  children: ReactNode;
  y?: number;
  className?: string;
  style?: CSSProperties;
}

export function RevealItem({ children, y = 24, className, style }: RevealItemProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  const itemVariants: Variants = {
    hidden: { opacity: 0, y },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  };
  return (
    <motion.div className={className} style={style} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
