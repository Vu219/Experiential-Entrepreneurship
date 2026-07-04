import { useEffect, useRef } from 'react';

// Gắn ref vào container có CSS @keyframes infinite (vd hero). Khi container CUỘN RA
// ngoài viewport → thêm class 'anim-paused' (CSS đặt animation-play-state: paused cho
// mọi con) → nhả CPU/GPU, hàng Animations trong DevTools thưa hẳn. Vào lại → chạy tiếp.
// rootMargin nới nhẹ để pause hơi trễ / chạy lại hơi sớm, tránh giật ở mép.
// prefers-reduced-motion đã được CSS xử lý (animation: none) nên không cần lo ở đây.
export function usePauseWhenOffscreen<T extends HTMLElement>(rootMargin = '200px 0px') {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle('anim-paused', !entry.isIntersecting),
      { rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return ref;
}
