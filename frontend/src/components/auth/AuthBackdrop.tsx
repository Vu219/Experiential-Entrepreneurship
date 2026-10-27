import type { CSSProperties } from 'react';
import { CalendarClock, CheckCircle2, Heart, MessageCircle, Repeat2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { PLATFORM_BG } from '../../theme';
import { alpha, C } from '../../styles/colors';

// Nền trang trí của khung đăng nhập/đăng ký — thuần trang trí (aria-hidden, không bắt chuột):
// mảng màu brand loang chậm + lưới chấm + các thẻ bài đăng Facebook/Instagram/Threads mờ
// trôi quanh viền và vài chip trạng thái ("Đã đăng", "Lên lịch"…) kể đúng việc AIMA làm.
// Chỉ animate transform (index.css .auth-float/.auth-blob); prefers-reduced-motion → đứng yên.
// `compact` (màn hẹp): chỉ giữ mảng màu + lưới, bỏ thẻ để nhẹ máy và không rối.

type Platform = 'FB' | 'IG' | 'TH';

interface FloatingPost {
  platform: Platform;
  style: CSSProperties;
  width: number;
  rotate: number;
  blur: number;
  dur: number;
  delay: number;
  media: boolean;
}

const POSTS: FloatingPost[] = [
  { platform: 'FB', style: { left: '3%', top: '9%' }, width: 250, rotate: -7, blur: 1.5, dur: 9, delay: 0, media: true },
  { platform: 'TH', style: { left: '7%', bottom: '7%' }, width: 230, rotate: 5, blur: 2.5, dur: 11, delay: 1.2, media: false },
  { platform: 'IG', style: { right: '3%', top: '7%' }, width: 240, rotate: 6, blur: 2, dur: 10, delay: 0.6, media: true },
  { platform: 'FB', style: { right: '6%', bottom: '6%' }, width: 230, rotate: -5, blur: 1.5, dur: 12, delay: 2, media: false },
  { platform: 'IG', style: { left: '27%', top: '-70px' }, width: 210, rotate: 3, blur: 4, dur: 13, delay: 0.3, media: true },
  { platform: 'TH', style: { right: '25%', bottom: '-80px' }, width: 210, rotate: -4, blur: 4, dur: 14, delay: 1.6, media: false },
];

const bar = (width: string, height = 7, color: string = C.border): CSSProperties => ({ width, height, borderRadius: 99, background: color });

function PostCard({ post }: { post: FloatingPost }) {
  const { brandGradient } = useApp();
  return (
    <div
      className="auth-float"
      style={{
        position: 'absolute', ...post.style, width: post.width,
        ['--r' as string]: `${post.rotate}deg`, ['--dur' as string]: `${post.dur}s`, ['--delay' as string]: `${post.delay}s`,
        filter: `blur(${post.blur}px)`, opacity: 0.78,
      }}
    >
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 14, boxShadow: `0 26px 50px -30px ${C.legacyShadowrgba8040140_5_}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: brandGradient, flex: 'none' }} />
          <div style={{ flex: 1, display: 'grid', gap: 5 }}>
            <span style={bar('62%', 7, C.ink250)} />
            <span style={bar('38%', 6)} />
          </div>
          <PlatformTag tag={post.platform} bg={PLATFORM_BG[post.platform]} size={20} radius={6} fontSize={9} />
        </div>
        <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          <span style={bar('100%')} />
          <span style={bar('86%')} />
          {!post.media && <span style={bar('64%')} />}
        </div>
        {post.media && (
          <div style={{ height: 96, borderRadius: 12, marginTop: 12, background: `linear-gradient(135deg, ${alpha(C.info, 0.35)}, ${alpha(C.primary, 0.35)})` }} />
        )}
        <div style={{ display: 'flex', gap: 14, marginTop: 12, color: C.ink350 }}>
          <Heart size={14} strokeWidth={2} />
          <MessageCircle size={14} strokeWidth={2} />
          <Repeat2 size={14} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function StatusChip({ icon: Icon, label, tone, style, dur, delay }: { icon: typeof Heart; label: string; tone: string; style: CSSProperties; dur: number; delay: number }) {
  return (
    <div
      className="auth-float"
      style={{
        position: 'absolute', ...style, ['--dur' as string]: `${dur}s`, ['--delay' as string]: `${delay}s`,
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 999,
        background: C.surface, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.textStrong, whiteSpace: 'nowrap',
        boxShadow: `0 18px 36px -22px ${C.legacyShadowrgba8040140_5_}`,
      }}
    >
      <Icon size={16} color={tone} strokeWidth={2.2} />
      {label}
    </div>
  );
}

export default function AuthBackdrop({ compact = false }: { compact?: boolean }) {
  const { t } = useApp();
  const blob = (style: CSSProperties, color: string, size: number, dur: number, dx: number, dy: number) => (
    <span
      className="auth-blob"
      style={{
        position: 'absolute', ...style, width: size, height: size, borderRadius: '50%',
        background: `radial-gradient(circle, ${alpha(color, 0.32)}, transparent 68%)`,
        ['--dur' as string]: `${dur}s`, ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`,
      }}
    />
  );

  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none', background: C.bg }}>
      {blob({ left: '-12%', top: '-18%' }, 'var(--brand-from)', 720, 24, 60, 40)}
      {blob({ right: '-14%', top: '10%' }, 'var(--brand-to)', 680, 28, -50, 50)}
      {blob({ left: '28%', bottom: '-30%' }, 'var(--brand-via)', 760, 26, 40, -40)}
      {/* Lưới chấm mờ dần ra viền */}
      <span
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(${alpha(C.textMuted, 0.22)} 1px, transparent 1.6px)`,
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 30%, transparent 80%)',
        }}
      />
      {!compact && (
        <>
          {POSTS.map((p, i) => <PostCard key={i} post={p} />)}
          <StatusChip icon={CheckCircle2} label={t.authBgPosted} tone={C.success} style={{ left: '12%', top: '46%' }} dur={8} delay={0.4} />
          <StatusChip icon={CalendarClock} label={t.authBgScheduled} tone={C.primary} style={{ right: '11%', top: '40%' }} dur={10} delay={1.1} />
          <StatusChip icon={Heart} label={t.authBgLikes} tone={C.rose} style={{ right: '4%', bottom: '30%' }} dur={9} delay={2.2} />
        </>
      )}
    </div>
  );
}
