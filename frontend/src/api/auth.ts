import client, { ApiResponse } from "./apiClient";

export interface User {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  fullName: string;
  phone: string | null;
  dateOfBirth: string | null; // ISO date, e.g. "1998-05-20"
  provider: string | null; // "LOCAL" | "GOOGLE"
  avatarUrl: string | null;
  status: "ACTIVE" | "LOCKED" | "PENDING_DELETE";
  /** Gói dịch vụ của user — hiển thị ở header/hồ sơ + điều kiện card "Nâng cấp Pro" (null coi như FREE). */
  plan: "FREE" | "PLUS" | "PRO" | null;
  deletionDate: string | null; // ISO datetime, set only while status === PENDING_DELETE
  profileCompleted: boolean;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  avatarUrl?: string; // bỏ qua nếu không đổi ảnh (backend IGNORE giá trị null)
}

export interface ResetPasswordRequest {
  email: string;
  otpCode: string;
  newPassword: string;
  confirmPassword: string;
}

// Onboarding (first Google login): personal info + a self-chosen password.
export interface CompleteProfileRequest {
  fullName: string;
  phone: string;
  dob: string; // ISO date, e.g. "2000-01-15"
  password: string;
  confirmPassword: string;
}

// Đăng nhập Google: điều hướng toàn trang tới endpoint OAuth2 của backend.
// Backend xử lý redirect Google rồi set cookie và quay về app.
// Đây là điều hướng cả trang (không qua axios) nên phải ghép URL backend tuyệt đối
// từ VITE_API_BASE_URL với đường dẫn endpoint OAuth2.
export const GOOGLE_LOGIN_URL = `${import.meta.env.VITE_API_BASE_URL}/oauth2/authorization/google`;

export async function register(request: RegisterRequest): Promise<void> {
  await client.post<ApiResponse<unknown>>("/users/register", request);
}

// Backend chỉ set cookie HttpOnly và không trả user trong body, nên sau khi
// đăng nhập ta gọi /users/me để lấy hồ sơ.
export async function login(email: string, password: string): Promise<User> {
  await client.post<ApiResponse<unknown>>("/auth/login", { email, password });
  return getProfile();
}

export async function logout(): Promise<void> {
  await client.post("/auth/logout");
}

export async function getProfile(): Promise<User> {
  const { data } = await client.get<ApiResponse<User>>("/users/me");
  return data.result;
}

export async function updateProfile(request: UpdateProfileRequest): Promise<User> {
  const { data } = await client.put<ApiResponse<User>>("/users/me", request);
  return data.result;
}

// Tải ảnh đại diện lên bucket 'avatars' (public) của Supabase qua backend.
// Trả về URL công khai để lưu vào hồ sơ qua updateProfile({ avatarUrl }).
// Backend giới hạn jpg/png/webp ≤ 2 MB và tự kiểm tra phía server.
export interface AvatarUploadResult {
  bucket: string;
  path: string;
  url: string;
}

export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<ApiResponse<AvatarUploadResult>>("/files/avatar", form);
  return data.result.url;
}

// Hoàn tất onboarding cho user đăng nhập Google lần đầu (đặt mật khẩu + thông tin
// cá nhân). Backend yêu cầu JWT, chặn nếu hồ sơ đã hoàn tất, hash mật khẩu BCrypt
// và gửi email xác nhận. FE gọi xong nên refresh /users/me để cập nhật trạng thái.
export async function completeProfile(
  request: CompleteProfileRequest
): Promise<void> {
  await client.patch<ApiResponse<unknown>>("/users/complete-profile", request);
}

// ----- Quên mật khẩu (3 bước) -----

export async function forgotPassword(email: string): Promise<void> {
  await client.post<ApiResponse<unknown>>("/users/forgot-password", { email });
}

export async function verifyOtp(email: string, otpCode: string): Promise<void> {
  await client.post<ApiResponse<unknown>>("/users/verify-otp", { email, otpCode });
}

export async function resetPassword(request: ResetPasswordRequest): Promise<void> {
  await client.post<ApiResponse<unknown>>("/users/reset-password", request);
}

// ----- Đổi mật khẩu khi đã đăng nhập (3 bước) -----
// Bước 1: xác minh mật khẩu hiện tại; nếu đúng backend gửi OTP về email.
export async function changePasswordInit(currentPassword: string): Promise<void> {
  await client.post<ApiResponse<unknown>>("/users/me/change-password/init", { currentPassword });
}

// Bước 2 dùng lại verifyOtp(email, otpCode) ở trên để xác thực OTP trước khi qua bước nhập mật khẩu mới.
// Bước 3: gửi OTP + mật khẩu mới; backend xác thực lại OTP, độ mạnh & khớp mật khẩu rồi đổi.
export interface ChangePasswordConfirmRequest {
  otpCode: string;
  newPassword: string;
  confirmPassword: string;
}

export async function changePasswordConfirm(
  request: ChangePasswordConfirmRequest
): Promise<void> {
  await client.post<ApiResponse<unknown>>("/users/me/change-password/confirm", request);
}

// ----- Xóa / khôi phục tài khoản -----
export interface DeleteAccountResult {
  status: string;
  deletionDate: string | null;
  daysRemaining: number | null;
  message: string;
}

// Gửi yêu cầu xóa: tài khoản chuyển PENDING_DELETE, có 30 ngày để khôi phục.
export async function requestDeleteAccount(): Promise<DeleteAccountResult> {
  const { data } = await client.post<ApiResponse<DeleteAccountResult>>("/users/me/deactivate-request");
  return data.result;
}

// Khôi phục tài khoản đang chờ xóa trong thời hạn 30 ngày.
export async function restoreAccount(): Promise<DeleteAccountResult> {
  const { data } = await client.post<ApiResponse<DeleteAccountResult>>("/users/me/restore");
  return data.result;
}
