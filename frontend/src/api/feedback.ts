import client, { type ApiResponse, type PageResponse } from './apiClient';

// Đánh giá & góp ý trong app (G1.3). User: POST /feedback. Admin: GET /admin/feedback (+ /summary).

export interface Feedback {
  id: string;
  rating: number;
  comment: string | null;
  page: string | null;
  /** Chỉ có ở API admin. */
  userEmail?: string | null;
  userFullName?: string | null;
  /** true = dữ liệu mô phỏng do dev-seed sinh (POST /admin/feedback/dev-seed), không phải đánh giá thật. */
  sample?: boolean;
  createdAt: string;
}

export interface FeedbackSummary {
  total: number;
  averageRating: number;
  /** Khoá "1".."5" → số lượt. */
  distribution: Record<string, number>;
}

/** `page` = pathname đang mở (không query string — có thể chứa mã OTP/đơn hàng). */
export async function submitFeedback(rating: number, comment: string, page: string): Promise<Feedback> {
  const { data } = await client.post<ApiResponse<Feedback>>('/feedback', {
    rating,
    comment: comment.trim() || undefined,
    page,
  });
  return data.result;
}

export async function listFeedback(params: { rating?: number; page: number; size: number }): Promise<PageResponse<Feedback>> {
  const { data } = await client.get<ApiResponse<PageResponse<Feedback>>>('/admin/feedback', { params });
  return data.result;
}

export async function getFeedbackSummary(): Promise<FeedbackSummary> {
  const { data } = await client.get<ApiResponse<FeedbackSummary>>('/admin/feedback/summary');
  return data.result;
}
