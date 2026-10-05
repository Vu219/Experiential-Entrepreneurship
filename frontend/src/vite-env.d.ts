/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL của backend, gồm cả context-path. */
  readonly VITE_API_BASE_URL: string;
  /** "true" = ÉP trang Phân tích dùng DỮ LIỆU MẪU kể cả khi có số liệu thật. Mặc định: tự fallback
   *  mock khi chưa có số liệu / API lỗi (kèm badge). Xem api/analyticsMock.ts. */
  readonly VITE_USE_MOCK?: string;
  /** "true" = hiện nút chuyển Sáng/Tối/Theo hệ thống cho app/admin/public.
   *  Vite mặc định true; false giữ giao diện sáng và ẩn nút. Xem store/colorMode.ts. */
  readonly VITE_ENABLE_DARK_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
