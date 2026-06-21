import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface RevealOptions {
  /** Selector con để stagger lần lượt; bỏ trống thì animate chính phần tử gắn ref. */
  selector?: string;
  translateY?: number;
  duration?: number;
  /** Khoảng cách thời gian giữa các phần tử con (ms) khi stagger. */
  delayStep?: number;
  /** Delay khởi đầu (ms). */
  start?: number;
  once?: boolean;
  threshold?: number;
}

/**
 * Hiện phần tử bằng anime.js (fade + trượt lên) khi cuộn vào màn hình.
 * Dùng IntersectionObserver; tôn trọng prefers-reduced-motion (hiện ngay, không animate).
 *
 * Ví dụ:
 *   const ref = useReveal<HTMLDivElement>({ selector: ".card", delayStep: 90 });
 *   <div ref={ref}>...<div className="card" />...</div>
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(opts: RevealOptions = {}) {
  const ref = useRef<T>(null);
  const {
    selector,
    translateY = 24,
    duration = 700,
    delayStep = 90,
    start = 0,
    once = true,
    threshold = 0.15,
  } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const nodes: HTMLElement[] = selector
      ? Array.from(el.querySelectorAll<HTMLElement>(selector))
      : [el];
    if (nodes.length === 0) return;

    // Reduced motion: hiện ngay, bỏ qua animation.
    if (prefersReducedMotion()) {
      nodes.forEach((n) => (n.style.opacity = "1"));
      return;
    }

    // Trạng thái ban đầu: ẩn để tránh "nháy" trước khi animate.
    nodes.forEach((n) => {
      n.style.opacity = "0";
      n.style.willChange = "transform, opacity";
    });

    let played = false;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit || (once && played)) return;
        played = true;
        animate(nodes, {
          opacity: [0, 1],
          translateY: [translateY, 0],
          duration,
          delay: selector ? stagger(delayStep, { start }) : start,
          ease: "outExpo",
          onComplete: () => nodes.forEach((n) => (n.style.willChange = "auto")),
        });
        if (once) io.disconnect();
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [selector, translateY, duration, delayStep, start, once, threshold]);

  return ref;
}
