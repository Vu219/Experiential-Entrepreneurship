// Google Analytics 4 cho web AIMA (landing + app): đo lượt truy cập trang và vài sự kiện chuyển đổi.
// Bật khi đặt VITE_GA4_MEASUREMENT_ID (dạng G-XXXXXXX); để trống = tắt hoàn toàn, không tải script nào.
// Quyền riêng tư: chỉ gửi pathname (KHÔNG gửi query string — có mã OTP/đơn hàng/mã xoá dữ liệu), không gửi
// email/tên/id người dùng, bỏ qua khu admin, ẩn IP.

type GtagArgs = [string, ...unknown[]];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArgs) => void;
  }
}

const MEASUREMENT_ID = (import.meta.env.VITE_GA4_MEASUREMENT_ID ?? '').trim();
const ENABLED = /^G-[A-Z0-9]+$/i.test(MEASUREMENT_ID);
const EXCLUDED_PREFIXES = ['/admin'];

let initialized = false;

export function isGa4Enabled(): boolean {
  return ENABLED;
}

/** Tải gtag.js một lần. page_view do trackPageView gửi tay (SPA đổi route không reload). */
export function initGa4(): void {
  if (!ENABLED || initialized || typeof window === 'undefined') return;
  initialized = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(..._args: GtagArgs) {
    // gtag.js đọc đúng đối tượng `arguments` từ dataLayer.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false, anonymize_ip: true });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);
}

function excluded(path: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function trackPageView(pathname: string): void {
  if (!ENABLED || !window.gtag || excluded(pathname)) return;
  window.gtag('event', 'page_view', {
    page_path: pathname,
    page_location: `${window.location.origin}${pathname}`,
    page_title: document.title,
  });
}

/** Sự kiện GA4 (vd sign_up, purchase). Không truyền dữ liệu cá nhân vào params. */
export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}): void {
  if (!ENABLED || !window.gtag || excluded(window.location.pathname)) return;
  window.gtag('event', name, params);
}
