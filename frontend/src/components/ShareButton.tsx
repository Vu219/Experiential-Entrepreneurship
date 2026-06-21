import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// Tiêu đề dùng khi chia sẻ (yêu cầu cố định).
const SHARE_TITLE = "AIMA — AI Content Marketing";

/** Icon chia sẻ (filled share-nodes) — xoay 180° khi hover. */
const ShareIcon = () => (
  <svg className="share-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92zM18 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM6 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 7.02c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="#1877f2" aria-hidden>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const ThreadsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 26 26" fill="#000" aria-hidden>
    <path d="M16.7051 11.1081C16.543 8.12137 14.911 6.41148 12.1708 6.39398C10.5193 6.3838 9.13771 7.08389 8.29233 8.36664L9.79941 9.40046C10.4334 8.43852 11.4342 8.24015 12.1593 8.24685C13.0616 8.2526 13.7425 8.51494 14.1832 9.02653C14.5038 9.39899 14.7183 9.91367 14.8245 10.5632C14.0246 10.4273 13.1594 10.3855 12.2345 10.4385C9.62919 10.5886 7.95426 12.1081 8.06675 14.2194C8.12384 15.2904 8.65739 16.2118 9.56906 16.8137C10.3399 17.3225 11.3326 17.5713 12.3644 17.515C13.727 17.4403 14.7959 16.9205 15.5416 15.9699C16.1079 15.248 16.4661 14.3125 16.6243 13.1338C17.2737 13.5257 17.7549 14.0414 18.0207 14.6613C18.4726 15.7151 18.499 17.4469 17.086 18.8587C15.848 20.0955 14.3598 20.6306 12.1108 20.6471C9.61601 20.6286 7.72924 19.8285 6.50253 18.269C5.35381 16.8088 4.76014 14.6996 4.73799 12C4.76014 9.30038 5.35381 7.19117 6.50253 5.73092C7.72924 4.17147 9.61597 3.37141 12.1107 3.35287C14.6236 3.37155 16.5433 4.17547 17.8169 5.74244C18.4415 6.51086 18.9123 7.47721 19.2227 8.60394L20.9888 8.13274C20.6125 6.74587 20.0205 5.55078 19.2148 4.55966C17.582 2.55073 15.1816 1.52134 12.1046 1.5C9.03385 1.52127 6.6725 2.55457 5.08614 4.57117C3.67451 6.3657 2.94634 8.87742 2.92188 12.0074C2.94634 15.1373 3.67451 17.6343 5.08614 19.4289C6.6725 21.4454 9.04616 22.4788 12.1169 22.5C14.847 22.4811 16.7713 21.7663 18.3566 20.1825C20.4307 18.1103 20.3682 15.513 19.6846 13.9185C19.1595 12.6943 18.1141 11.7129 16.7051 11.1081ZM12.2669 15.6648C11.125 15.7291 9.93869 15.2166 9.88019 14.1188C9.83684 13.3048 10.4595 12.3966 12.3369 12.2884C13.2594 12.2352 14.1138 12.2976 14.8701 12.463C14.6538 15.1648 13.3848 15.6035 12.2669 15.6648Z" />
  </svg>
);

const LinkIcon = () => (
  <svg className="copy-glyph" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6e8efb" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5" />
    <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.32-1.32" />
  </svg>
);

const CheckIcon = () => (
  <svg className="copy-glyph" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12l5 5L20 7" />
  </svg>
);

/**
 * Nút chia sẻ nổi, cố định góc dưới phải, hiển thị trên mọi trang.
 * Tooltip mở LÊN TRÊN với 3 lựa chọn: Facebook, Threads, Copy link.
 * URL lấy động từ window.location.href (useLocation buộc re-render khi đổi trang).
 */
export default function ShareButton() {
  useLocation(); // chỉ để re-render khi điều hướng SPA → href luôn mới
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);

  const url = window.location.href;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(`${SHARE_TITLE} ${url}`)}`;

  // Mở ngay / đóng có độ trễ — để con trỏ kịp băng qua khe trống lên menu mà không bị đóng.
  const openMenu = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = (delay = 220) => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), delay);
  };

  // Đóng khi bấm/chạm ra ngoài (touch) hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(
    () => () => {
      window.clearTimeout(copiedTimer.current);
      window.clearTimeout(closeTimer.current);
    },
    []
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard có thể bị chặn (không phải HTTPS / quyền) — bỏ qua im lặng.
    }
  };

  const caption = copied ? "Đã sao chép!" : hint || "Chia sẻ trang này";

  return (
    <div
      ref={wrapRef}
      className={`share-fab-wrap${open ? " open" : ""}`}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") openMenu(); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") scheduleClose(); }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) scheduleClose(0);
      }}
    >
      <div className="share-menu" role="menu" aria-label="Tùy chọn chia sẻ">
        <div className="share-menu-title">CHIA SẺ QUA</div>
        <div className="share-social-row">
          <a
            className="share-social facebook"
            role="menuitem"
            aria-label="Chia sẻ lên Facebook"
            href={fbUrl}
            target="_blank"
            rel="noopener"
            onMouseEnter={() => setHint("Facebook")}
            onMouseLeave={() => setHint("")}
            onFocus={() => setHint("Facebook")}
            onBlur={() => setHint("")}
            onClick={() => setOpen(false)}
          >
            <FacebookIcon />
          </a>
          <a
            className="share-social threads"
            role="menuitem"
            aria-label="Chia sẻ lên Threads"
            href={threadsUrl}
            target="_blank"
            rel="noopener"
            onMouseEnter={() => setHint("Threads")}
            onMouseLeave={() => setHint("")}
            onFocus={() => setHint("Threads")}
            onBlur={() => setHint("")}
            onClick={() => setOpen(false)}
          >
            <ThreadsIcon />
          </a>
          <button
            className="share-social copy"
            role="menuitem"
            type="button"
            aria-label="Sao chép liên kết"
            onMouseEnter={() => setHint("Copy link")}
            onMouseLeave={() => setHint("")}
            onFocus={() => setHint("Copy link")}
            onBlur={() => setHint("")}
            onClick={copyLink}
          >
            {copied ? <CheckIcon /> : <LinkIcon />}
          </button>
        </div>
        <div className={`share-status${copied ? " copied" : ""}`} aria-live="polite">
          {caption}
        </div>
      </div>

      <button
        type="button"
        className="share-fab"
        aria-label="Chia sẻ trang"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ShareIcon />
      </button>
    </div>
  );
}
