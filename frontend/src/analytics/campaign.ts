// Tham số chiến dịch GA4 đọc từ URL (UTM — mỗi kênh mạng xã hội một link gắn tag).
// Module thuần (không đụng import.meta.env) để test bằng node --test.

const CAMPAIGN_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'];

/**
 * Chỉ giữ tham số chiến dịch của query string (vd "?utm_source=facebook&utm_medium=social"), bỏ mọi thứ khác —
 * query của AIMA có thể chứa mã OTP / mã đơn / mã xoá dữ liệu, không được gửi lên GA4. Không có UTM → "".
 */
export function campaignQuery(search: string): string {
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of CAMPAIGN_PARAMS) {
    const value = params.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `?${query}` : '';
}
