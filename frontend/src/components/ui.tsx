import type { CSSProperties, ReactNode } from 'react';

/** Stroked single-path icon. */
export function Icon({
  path,
  size = 20,
  stroke = 'currentColor',
  width = 1.8,
}: {
  path: string;
  size?: number;
  stroke?: string;
  width?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

/** Gradient-stroked icon (used on landing/auth pillars). */
export function GradIcon({ path, size = 22 }: { path: string; size?: number }) {
  const id = 'g-' + path.slice(0, 8).replace(/[^a-z0-9]/gi, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" stroke={`url(#${id})`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#46D6EC" />
          <stop offset=".5" stopColor="#897CE3" />
          <stop offset="1" stopColor="#F083C0" />
        </linearGradient>
      </defs>
      <path d={path} />
    </svg>
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

/** Small square platform tag, e.g. "FB" on a Facebook-blue chip. */
export function PlatformTag({ tag, bg, size = 26, radius = 8, fontSize = 12 }: { tag: string; bg: string; size?: number; radius?: number; fontSize?: number }) {
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
      {tag}
    </span>
  );
}
