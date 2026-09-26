import type { CSSProperties, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Link do admin cấu hình trên Landing: nội bộ ("/pricing", "/#features") đi qua react-router
// ("/#id" khi đang ở "/" thì cuộn thẳng tới section); http(s) mở tab mới; mailto: giữ nguyên.
// href trống → chỉ hiện chữ (mục footer chưa có trang).
export default function LandingLink({ href, className, style, children }: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!href) return <span className={className} style={style}>{children}</span>;

  if (/^https?:\/\//i.test(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>{children}</a>;
  }
  if (href.startsWith('mailto:')) {
    return <a href={href} className={className} style={style}>{children}</a>;
  }

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const [path, id] = href.split('#');
    if (id && (path === '' || path === '/') && pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate(href);
    }
  };
  return <a href={href} onClick={onClick} className={className} style={style}>{children}</a>;
}
