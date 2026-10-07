import { useApp } from '../../context/AppContext';
import { formatGroupedNumber } from '../../utils/format';
import type { AnalyticsTopPost } from '../../api/analytics';

/**
 * Một con số của bài viết. `null` = KHÔNG có số liệu (khác 0) → hiện "—" kèm tooltip giải thích:
 * bài chỉ có số liệu chép từ mốc cũ (đăng trước khi có đồng bộ đầy đủ) hoặc chưa có lượt xem từ nền tảng.
 */
export default function MetricValue({ value, post }: { value: number | null; post: Pick<AnalyticsTopPost, 'legacyOnly'> }) {
  const { t, lang } = useApp();
  if (value !== null) return <>{formatGroupedNumber(value, lang)}</>;
  return (
    <span title={post.legacyOnly ? t.anaViewsLegacy : t.anaViewsMissing} style={{ cursor: 'help' }}>—</span>
  );
}
