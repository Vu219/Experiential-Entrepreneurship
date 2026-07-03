import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { PLATFORMS } from '../../theme';
import { PlatformTag } from '../ui';
import LogoLoop, { type LogoItem } from '../LogoLoop';
import { Reveal } from '../motion/Reveal';

// Section "Nền tảng tích hợp" — LogoLoop chạy ngang phải→trái, fade 2 mép.
// Chỉ 3 nền tảng trong scope: Facebook · Instagram · Threads (xem CLAUDE.md).
export default function IntegrationsLoop() {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();

  const logos: LogoItem[] = PLATFORMS.map((p) => ({
    title: p.name,
    node: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #efeaf8', borderRadius: 999, padding: '10px 22px 10px 12px', boxShadow: '0 14px 28px -22px rgba(80,40,140,.5)' }}>
        <PlatformTag tag={p.tag} bg={p.bg} size={30} radius={9} fontSize={12} />
        <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 15, color: '#211c38', whiteSpace: 'nowrap' }}>{p.name}</span>
      </span>
    ),
  }));

  return (
    <section id="integrations" className="scroll-anchor" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '10px 0 50px' : '10px 0 70px' }}>
      <Reveal>
        <div style={{ textAlign: 'center', padding: '0 18px', margin: '0 auto 26px' }}>
          <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: '.02em', color: '#6b6680', margin: 0 }}>{t.intTitle}</p>
        </div>
        <LogoLoop logos={logos} speed={50} gap={isMobile ? 20 : 32} repeat={8} ariaLabel={t.intTitle} />
      </Reveal>
    </section>
  );
}
