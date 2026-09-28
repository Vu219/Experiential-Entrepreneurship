import client, { ApiResponse } from './apiClient';

// Trạng thái một yêu cầu xoá dữ liệu Meta (BE: GET /meta/data-deletion/{code}, public).
// Meta dẫn người dùng tới /data-deletion?code=<confirmation_code> sau khi gửi yêu cầu.
export interface DataDeletionStatus {
  confirmationCode: string;
  status: 'COMPLETED';
  requestedAt: string;
  completedAt: string | null;
  connectionsRemoved: number;
  schedulesHeld: number;
}

export async function getDataDeletionStatus(code: string): Promise<DataDeletionStatus> {
  const { data } = await client.get<ApiResponse<DataDeletionStatus>>(
    `/meta/data-deletion/${encodeURIComponent(code)}`,
  );
  return data.result;
}
