import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import LogoLoop, { type LogoItem } from '../LogoLoop';
import { Reveal } from '../motion/Reveal';
import { useLandingContent } from '../../hooks/useLandingContent';
import { tr } from '../../api/landing';
import { PlatformBadge } from './landingIcons';
import { C } from '../../styles/colors';

// Section "Nền tảng tích hợp" — LogoLoop chạy ngang phải→trái, fade 2 mép.
// Danh sách nền tảng do admin quản lý (icon có sẵn hoặc URL ảnh logo).
export default function IntegrationsLoop() {
  const { lang } = useApp();
  const { integrations } = useLandingContent();
  const title = tr(integrations.title, lang);
  const { isMobile } = useBreakpoint();

  const logos: LogoItem[] = integrations.platforms.map((p) => ({
    title: p.name,
    node: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 999, padding: '10px 22px 10px 12px', boxShadow: `0 14px 28px -22px ${C.legacyShadowrgba8040140_5_}` }}>
        <PlatformBadge icon={p.icon} logoUrl={p.logoUrl} name={p.name} />
        <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 15, color: C.textStrong, whiteSpace: 'nowrap' }}>{p.name}</span>
      </span>
    ),
  }));

  return (
    <section id="integrations" className="scroll-anchor cv-auto" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '10px 0 50px' : '10px 0 70px' }}>
      <Reveal>
        <div style={{ textAlign: 'center', padding: '0 18px', margin: '0 auto 26px' }}>
          <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: '.02em', color: C.textSecondary, margin: 0 }}>{title}</p>
        </div>
        <LogoLoop logos={logos} speed={50} gap={isMobile ? 20 : 32} repeat={8} pauseOnHover ariaLabel={title} />
      </Reveal>
    </section>
  );
}
