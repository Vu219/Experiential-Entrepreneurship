import axios, { type InternalAxiosRequestConfig } from "axios";
import { globalToast } from "../components/toast/ToastProvider";
import { getDict } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import { PLAN_LIMIT_EVENT, isPlanLimitCode, planLimitMessage } from "../utils/planLimitText";
import { createSessionRefresher, isProfileProbe, isRefreshExempt, type LockManagerLike } from "./sessionRefresh";

// Unified backend response format (API-01)
export interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}

// Khung phân trang dùng chung của backend (dto/response/PageResponse.java) — nằm trong result.
// `page` đánh số từ 0 theo Spring Pageable.
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// Auth dùng cookie HttpOnly do backend set (access_token / refresh_token).
// FE không đọc/ghi token — chỉ cần gửi kèm cookie trong mọi request.
// baseURL đọc từ biến môi trường VITE_API_BASE_URL (xem .env / .env.example).
// Mọi nơi gọi API dùng đường dẫn tương đối (vd client.get("/users/me")).
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

// Error mang theo `code` của ErrorCode backend (vd 1072 = sai OTP quá số lần)
// để UI xử lý theo từng trường hợp. Vẫn là Error nên `.message` không đổi.
export interface ApiError extends Error {
  code?: number;
  /** Tên ErrorCode backend của job async thất bại (vd "AI_TIMEOUT") — không đến từ HTTP envelope. */
  errorCode?: string;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _sentAt?: number;
  _authRetried?: boolean;
}

// Access token sống 1 giờ; gặp 401 thì làm mới phiên bằng cookie refresh rồi thử lại MỘT lần
// (single-flight + khoá giữa các tab — xem sessionRefresh.ts). Client SSE dùng chung refreshSession().
const refresher = createSessionRefresher(
  () => client.post("/auth/refresh", null, { timeout: 15_000 }),
  { getLocks: () => (typeof navigator !== "undefined" ? (navigator.locks as LockManagerLike | undefined) : undefined) },
);

export function refreshSession(sentAt?: number): Promise<boolean> {
  return refresher.refresh(sentAt);
}

// AuthContext đăng ký: refresh hỏng → xoá user (ProtectedRoute đưa về /login). Trả true nếu trước đó đang đăng nhập.
let sessionExpiredHandler: (() => boolean) | null = null;

export function setSessionExpiredHandler(handler: (() => boolean) | null): void {
  sessionExpiredHandler = handler;
}

/** Hết phiên thật (refresh thất bại): xoá trạng thái đăng nhập + báo một lần. */
export function endSession(): void {
  const hadSession = sessionExpiredHandler?.() ?? false;
  if (hadSession) {
    globalToast?.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", {
      title: "Lỗi kết nối",
      id: 401,
    });
  }
}

client.interceptors.request.use((config) => {
  (config as RetriableConfig)._sentAt = Date.now();
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const data = error.response?.data;
    const status = error.response?.status;
    const config = error.config as RetriableConfig | undefined;
    const message = data?.message ?? "Cannot reach the server. Please try again.";

    if (status === 401 && config && !config._authRetried && !isRefreshExempt(config.url)) {
      config._authRetried = true;
      if (await refreshSession(config._sentAt)) {
        return client(config);
      }
      if (!isProfileProbe(config.url)) endSession();
    } else if (status === 401 && config?._authRetried && !isProfileProbe(config.url)) {
      // Vừa làm mới phiên xong mà vẫn 401 (tài khoản bị khoá / đăng xuất ở nơi khác).
      endSession();
    } else if (status >= 500) {
      globalToast?.error("Máy chủ hiện không phản hồi. Vui lòng thử lại sau.", { title: "Lỗi hệ thống" });
    }

    let finalMessage = message;
    if (isPlanLimitCode(data?.code)) {
      // Chạm giới hạn gói: câu theo ngôn ngữ đang bật + nút "Nâng cấp gói". Component toast lại e.message thì
      // ToastProvider bỏ bản trùng.
      const t = getDict(useAppStore.getState().lang) as unknown as Record<string, string>;
      finalMessage = planLimitMessage(t, data.code, data.result);
      globalToast?.warning(finalMessage, {
        title: t.plgTitle,
        action: { label: t.plgUpgrade, onClick: () => window.location.assign("/billing") },
      });
      window.dispatchEvent(new CustomEvent(PLAN_LIMIT_EVENT));
    }

    const err: ApiError = new Error(finalMessage);
    if (typeof data?.code === "number") err.code = data.code;
    return Promise.reject(err);
  }
);

export default client;
