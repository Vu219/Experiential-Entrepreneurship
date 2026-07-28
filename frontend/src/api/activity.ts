import client, { type ApiResponse, type PageResponse } from './apiClient';
import type { ActivityAction, ActivityActionGroup, ActivityResult } from './admin';

/**
 * Hoạt động gần đây của CHÍNH người dùng đang đăng nhập — nguồn cho card "Hoạt động gần đây"
 * ở trang Hồ sơ (GET /users/me/activity). Cùng bảng `activity_logs` với tab log của admin,
 * nhưng backend đã lọc sẵn theo user nên FE không truyền bộ lọc nào ngoài `limit`.
 *
 * Kiểu dòng log dùng LẠI type của `api/admin.ts` (chỉ import type, không kéo runtime) —
 * hai đầu đọc cùng một DTO backend, tách ra thành hai định nghĩa sẽ lệch nhau khi enum đổi.
 */
export interface MyActivity {
  id: string;
  createdAt: string;
  action: ActivityAction;
  actionGroup: ActivityActionGroup;
  targetType: string | null;
  targetId: string | null;
  result: ActivityResult;
}

/** Phân trang server-side (`page` đánh số từ 0); `size` bị backend kẹp ở 20. */
export async function getMyActivity(page: number, size: number): Promise<PageResponse<MyActivity>> {
  const { data } = await client.get<ApiResponse<PageResponse<MyActivity>>>('/users/me/activity', {
    params: { page, size },
  });
  return data.result;
}
