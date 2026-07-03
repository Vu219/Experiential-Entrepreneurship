import axios from "axios";

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
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    const message = data?.message ?? "Cannot reach the server. Please try again.";
    const err: ApiError = new Error(message);
    if (typeof data?.code === "number") err.code = data.code;
    return Promise.reject(err);
  }
);

export default client;
