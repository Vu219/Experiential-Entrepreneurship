// Link ngắn mang thương hiệu để chia sẻ (vd aima-marketing.id.vn/go/fb) → chuyển về trang chủ kèm UTM của kênh.
// Thêm kênh = thêm một dòng. Module thuần để test bằng node --test.

const SHORT_LINKS: Record<string, string> = {
  fb: 'utm_source=facebook&utm_medium=social',
  tiktok: 'utm_source=tiktok&utm_medium=social',
};

/** Đích chuyển hướng của mã link ngắn; mã lạ → trang chủ không UTM. */
export function shortLinkTarget(code: string | undefined): string {
  const query = code ? SHORT_LINKS[code.toLowerCase()] : undefined;
  return query ? `/?${query}` : '/';
}
