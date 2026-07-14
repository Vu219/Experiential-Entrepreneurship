import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

/**
 * Textarea tự co giãn chiều cao theo số lượng chữ — luôn hiện TRỌN nội dung, người dùng không
 * phải cuộn bên trong ô.
 *
 * - Đo lại mỗi khi `value` đổi, nên cả khi AI ghi đè nội dung (định dạng / tạo lại) chứ không chỉ
 *   lúc gõ tay.
 * - `height:auto` trước khi đọc `scrollHeight` là bắt buộc: thiếu bước này ô chỉ phình ra mà
 *   không co lại khi xóa bớt chữ.
 * - Đo lại theo breakpoint vì layout 2 cột đổi bề rộng → số dòng đổi theo.
 */
export default function AutoGrowTextarea({
  value,
  onChange,
  minHeight = 56,
  style,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  /** Chiều cao tối thiểu khi ô rỗng — giữ ô không bị dẹt. */
  minHeight?: number;
  style?: CSSProperties;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'style'>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { width } = useBreakpoint();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
  }, [value, minHeight, width]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      style={{ ...style, minHeight, resize: 'none', overflow: 'hidden' }}
      {...rest}
    />
  );
}
