import { useId, type CSSProperties, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Render a Lucide icon with the app's default sizing/stroke. */
export function Icon({
  icon: IconCmp,
  size = 20,
  stroke = 'currentColor',
  width = 1.8,
}: {
  icon: LucideIcon;
  size?: number;
  stroke?: string;
  width?: number;
}) {
  return <IconCmp size={size} color={stroke} strokeWidth={width} />;
}

/** Gradient-stroked Lucide icon (used on landing/auth pillars). */
export function GradIcon({ icon: IconCmp, size = 22 }: { icon: LucideIcon; size?: number }) {
  const id = 'grad-' + useId().replace(/[^a-z0-9]/gi, '');
  return (
    <span style={{ display: 'inline-flex', width: size, height: size }}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#46D6EC" />
            <stop offset=".5" stopColor="#897CE3" />
            <stop offset="1" stopColor="#F083C0" />
          </linearGradient>
        </defs>
      </svg>
      <IconCmp size={size} color={`url(#${id})`} strokeWidth={1.8} />
    </span>
  );
}

/** Bouncing-ball loader. `fullScreen` centers it over the viewport. */
export function Loader({ label, fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        paddingTop: 60, // chừa chỗ cho quả bóng nảy lên trên khung loader
        ...(fullScreen ? { minHeight: '100vh' } : { padding: '60px 0 24px' }),
      }}
    >
      <div className="loader" />
      {label && <div style={{ color: '#8a85a0', fontSize: 14, fontWeight: 600 }}>{label}</div>}
    </div>
  );
}

export const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #efeaf8',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 18px 38px -34px rgba(80,40,140,.5)',
};

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...cardStyle, ...style }}>{children}</div>;
}

/** White brand glyphs drawn on the colored platform chip (no hover effect). */
const PLATFORM_LOGO: Record<string, (s: number) => ReactNode> = {
  FB: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <path d="M14 9h3V5.5h-3c-2.2 0-3.8 1.7-3.8 3.9V11H8v3.4h2.2V21h3.4v-6.6H16L16.5 11h-2.9V9.4c0-.3.2-.4.4-.4z" />
    </svg>
  ),
  IG: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="17.2" cy="6.8" r="1" fill="#fff" stroke="none" />
    </svg>
  ),
  TH: (s) => (
    <svg width={s} height={s} viewBox="0 0 26 26" fill="#fff" aria-hidden>
      <path d="M16.7051 11.1081C16.543 8.12137 14.911 6.41148 12.1708 6.39398C10.5193 6.3838 9.13771 7.08389 8.29233 8.36664L9.79941 9.40046C10.4334 8.43852 11.4342 8.24015 12.1593 8.24685C13.0616 8.2526 13.7425 8.51494 14.1832 9.02653C14.5038 9.39899 14.7183 9.91367 14.8245 10.5632C14.0246 10.4273 13.1594 10.3855 12.2345 10.4385C9.62919 10.5886 7.95426 12.1081 8.06675 14.2194C8.12384 15.2904 8.65739 16.2118 9.56906 16.8137C10.3399 17.3225 11.3326 17.5713 12.3644 17.515C13.727 17.4403 14.7959 16.9205 15.5416 15.9699C16.1079 15.248 16.4661 14.3125 16.6243 13.1338C17.2737 13.5257 17.7549 14.0414 18.0207 14.6613C18.4726 15.7151 18.499 17.4469 17.086 18.8587C15.848 20.0955 14.3598 20.6306 12.1108 20.6471C9.61601 20.6286 7.72924 19.8285 6.50253 18.269C5.35381 16.8088 4.76014 14.6996 4.73799 12C4.76014 9.30038 5.35381 7.19117 6.50253 5.73092C7.72924 4.17147 9.61597 3.37141 12.1107 3.35287C14.6236 3.37155 16.5433 4.17547 17.8169 5.74244C18.4415 6.51086 18.9123 7.47721 19.2227 8.60394L20.9888 8.13274C20.6125 6.74587 20.0205 5.55078 19.2148 4.55966C17.582 2.55073 15.1816 1.52134 12.1046 1.5C9.03385 1.52127 6.6725 2.55457 5.08614 4.57117C3.67451 6.3657 2.94634 8.87742 2.92188 12.0074C2.94634 15.1373 3.67451 17.6343 5.08614 19.4289C6.6725 21.4454 9.04616 22.4788 12.1169 22.5C14.847 22.4811 16.7713 21.7663 18.3566 20.1825C20.4307 18.1103 20.3682 15.513 19.6846 13.9185C19.1595 12.6943 18.1141 11.7129 16.7051 11.1081ZM12.2669 15.6648C11.125 15.7291 9.93869 15.2166 9.88019 14.1188C9.83684 13.3048 10.4595 12.3966 12.3369 12.2884C13.2594 12.2352 14.1138 12.2976 14.8701 12.463C14.6538 15.1648 13.3848 15.6035 12.2669 15.6648Z" />
    </svg>
  ),
};

/** Platform chip: real brand logo (white) on the platform's brand color. */
export function PlatformTag({ tag, bg, size = 26, radius = 8, fontSize = 12 }: { tag: string; bg: string; size?: number; radius?: number; fontSize?: number }) {
  const logo = PLATFORM_LOGO[tag];
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: radius,
        background: bg,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 800,
      }}
    >
      {logo ? logo(Math.round(size * 0.62)) : tag}
    </span>
  );
}
