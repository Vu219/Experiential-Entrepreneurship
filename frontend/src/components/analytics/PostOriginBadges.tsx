import type { CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';
import type { AnalyticsTopPost } from '../../api/analytics';
import { C } from '../../styles/colors';

/**
 * Nhãn nhỏ cạnh một bài viết (analytics giai đoạn 2–3): "Ngoài AIMA" = bài người dùng tự đăng trên nền tảng,
 * "Đã xoá trên nền tảng" = bài không còn trên nền tảng (số liệu dừng ở lần thu cuối). Nhãn xoá cố ý TRUNG TÍNH (xám) —
 * không phải lỗi: nền tảng không cho biết bài bị gỡ hay người dùng tự xoá. Bài AIMA bình thường không có nhãn nào.
 */
export default function PostOriginBadges({ post }: { post: Pick<AnalyticsTopPost, 'origin' | 'platformStatus'> }) {
  const { t } = useApp();
  const external = post.origin === 'EXTERNAL';
  const deleted = post.platformStatus === 'DELETED';
  if (!external && !deleted) return null;
  return (
    <>
      {external && (
        <span title={t.anaExternalTip} style={{ ...badge, color: C.accentText, background: C.accentSoft }}>
          {t.anaExternalBadge}
        </span>
      )}
      {deleted && (
        <span title={t.anaDeletedTip} style={{ ...badge, color: C.slate, background: C.slateTint }}>
          {t.anaDeletedBadge}
        </span>
      )}
    </>
  );
}

const badge: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 7px', marginLeft: 6,
  fontSize: 10.5, fontWeight: 700, lineHeight: 1.6, whiteSpace: 'nowrap', verticalAlign: 'middle', cursor: 'help',
};
