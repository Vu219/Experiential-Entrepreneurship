import type { HTMLAttributes } from 'react';

/**
 * Khung nội dung chuẩn cho MỌI trang trong AppShell (app + admin) — UI refactor mục 1.
 * Toàn bộ padding (đối xứng hai bên) + max-width (--page-max 1600px, CĂN GIỮA để phần
 * dư chia đều hai bên) + khoảng cách dọc 24px nằm ở class .page-shell (index.css) —
 * trang KHÔNG tự đặt maxWidth/margin/padding riêng nữa. Topbar dùng cùng token nên
 * tiêu đề trang luôn thẳng hàng trái với card đầu tiên, kể cả trạng thái loading.
 */
export default function PageContainer({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className="view-pop page-shell">
      {children}
    </div>
  );
}
