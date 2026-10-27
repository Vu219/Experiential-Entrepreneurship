import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, Check, Mail, RotateCcw, Ban } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useLandingContent } from '../hooks/useLandingContent';
import LandingHeader from '../components/LandingHeader';
import { GradIcon } from '../components/ui';
import { Reveal, RevealGroup, RevealItem } from '../components/motion/Reveal';
import FaqSection from '../components/landing/FaqSection';
import CtaSection from '../components/landing/CtaSection';
import LandingFooter from '../components/landing/LandingFooter';
import LandingLink from '../components/landing/LandingLink';
import { CONTENT_STATUS_META } from '../components/create/statusMeta';
import { tr } from '../api/landing';
import {
  RESOURCE_SECTION, RESOURCE_STATUS_ORDER, RESOURCES_ABOUT, RESOURCES_DOCS, RESOURCES_GUIDES,
  RESOURCES_HERO, RESOURCES_START, RESOURCES_TIPS,
} from '../config/resourcesContent';
import { C } from '../styles/colors';

// Trang Tài nguyên công khai (/resources) — mục "Tài nguyên" trên header + các link cột Tài nguyên/Công ty
// ở footer trỏ về `/resources#<id>`. Nội dung song ngữ ở config/resourcesContent.ts.

const cardBase = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 20,
  boxShadow: `0 22px 44px -34px ${C.legacyShadowrgba8040140_5_}`,
} as const;

const iconTile = {
  width: 48, height: 48, borderRadius: 13, flex: 'none',
  background: `linear-gradient(135deg,${C.legacyBgedf9ff},${C.legacyBgf6effc})`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
} as const;

function SectionHead({ title, subtitle, isMobile }: { title: string; subtitle: string; isMobile: boolean }) {
  return (
    <Reveal>
      <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 36px' }}>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 28 : 36, letterSpacing: '-.02em', margin: 0, color: C.ink900, textWrap: 'balance' }}>{title}</h2>
        <p style={{ fontSize: isMobile ? 15.5 : 17, color: C.ink550, margin: '12px 0 0' }}>{subtitle}</p>
      </div>
    </Reveal>
  );
}

function Section({ id, isMobile, children }: { id: string; isMobile: boolean; children: ReactNode }) {
  return (
    <section id={id} className="scroll-anchor" style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '10px 18px 56px' : '10px 28px 80px' }}>
      {children}
    </section>
  );
}

export default function ResourcesPage() {
  const { t, lang, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const { hash } = useLocation();
  const { footer } = useLandingContent();
  const cols3 = isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(3,1fr)';

  // Mở từ footer/header (điều hướng SPA giữ vị trí cuộn cũ): có hash → cuộn tới khối, không thì về đầu trang.
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const numStyle = { width: 40, height: 40, borderRadius: 12, background: brandGradient, color: C.onBrand, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15 } as const;
  const cardTitle = { fontWeight: 700, fontSize: 17, color: C.textStrong } as const;
  const bodyText = { fontSize: 14, lineHeight: 1.6, color: C.textSecondary } as const;

  // LandingHeader (position: fixed) nằm ngoài .view-pop — xem ghi chú ở LandingPage.
  return (
    <>
      <LandingHeader />

      <div className="view-pop overflow-x-hidden ambient-surface" style={{ minHeight: '100vh' }}>
        {/* Hero + mục lục nhảy nhanh */}
        <section style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '110px 18px 40px' : '150px 28px 56px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', maxWidth: 900, margin: '0 auto' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 999, padding: '7px 15px', fontSize: 13, fontWeight: 600, color: C.primary }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: brandGradient }} />
                {tr(RESOURCES_HERO.eyebrow, lang)}
              </div>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 30 : 46, lineHeight: 1.12, letterSpacing: '-.02em', maxWidth: 720, margin: '18px auto 0', color: C.ink900, textWrap: 'balance' }}>{tr(RESOURCES_HERO.title, lang)}</h1>
              <p style={{ fontSize: isMobile ? 15.5 : 17, lineHeight: 1.6, color: C.ink550, maxWidth: 640, margin: '14px auto 0' }}>{tr(RESOURCES_HERO.subtitle, lang)}</p>
              <nav style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 28 }}>
                {RESOURCES_HERO.nav.map((n) => (
                  <LandingLink
                    key={n.id}
                    href={`/resources#${n.id}`}
                    className="btn-soft"
                    style={{ fontSize: 13.5, fontWeight: 600, textDecoration: 'none', borderRadius: 999, padding: '8px 16px', border: `1px solid ${C.border}`, background: C.surface, color: C.ink650 }}
                  >
                    {tr(n.label, lang)}
                  </LandingLink>
                ))}
              </nav>
            </div>
          </Reveal>
        </section>

        {/* 1. Bắt đầu nhanh — 5 bước */}
        <Section id={RESOURCE_SECTION.start} isMobile={isMobile}>
          <SectionHead title={tr(RESOURCES_START.title, lang)} subtitle={tr(RESOURCES_START.subtitle, lang)} isMobile={isMobile} />
          <RevealGroup style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 18 }}>
            {RESOURCES_START.steps.map((s, i) => (
              <RevealItem key={i} style={{ display: 'flex' }}>
                <div className="lift-card" style={{ ...cardBase, flex: 1, padding: '24px 22px' }}>
                  <span style={numStyle}>{String(i + 1).padStart(2, '0')}</span>
                  <div style={{ ...cardTitle, fontSize: 16, margin: '16px 0 6px' }}>{tr(s.title, lang)}</div>
                  <div style={bodyText}>{tr(s.description, lang)}</div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </Section>

        {/* 2. Hướng dẫn theo tính năng */}
        <Section id={RESOURCE_SECTION.guides} isMobile={isMobile}>
          <SectionHead title={tr(RESOURCES_GUIDES.title, lang)} subtitle={tr(RESOURCES_GUIDES.subtitle, lang)} isMobile={isMobile} />
          <RevealGroup style={{ display: 'grid', gridTemplateColumns: cols3, gap: 20 }}>
            {RESOURCES_GUIDES.items.map((g, i) => (
              <RevealItem key={i} style={{ display: 'flex' }}>
                <div className="lift-card" style={{ ...cardBase, flex: 1, padding: 26 }}>
                  <div style={iconTile}><GradIcon icon={g.icon} size={24} /></div>
                  <div style={{ ...cardTitle, margin: '16px 0 6px' }}>{tr(g.title, lang)}</div>
                  <div style={bodyText}>{tr(g.description, lang)}</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 10 }}>
                    {g.points.map((p, pi) => (
                      <li key={pi} style={{ display: 'flex', gap: 9, fontSize: 13.5, lineHeight: 1.55, color: C.ink650 }}>
                        <Check size={16} strokeWidth={2.2} color={C.success} style={{ flex: 'none', marginTop: 2 }} aria-hidden />
                        <span>{tr(p, lang)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </Section>

        {/* 3. Kiến thức marketing */}
        <Section id={RESOURCE_SECTION.tips} isMobile={isMobile}>
          <SectionHead title={tr(RESOURCES_TIPS.title, lang)} subtitle={tr(RESOURCES_TIPS.subtitle, lang)} isMobile={isMobile} />
          <RevealGroup style={{ display: 'grid', gridTemplateColumns: cols3, gap: 20 }}>
            {RESOURCES_TIPS.items.map((tip, i) => (
              <RevealItem key={i} style={{ display: 'flex' }}>
                <div className="lift-card" style={{ ...cardBase, flex: 1, padding: 26 }}>
                  <div className="gradtext" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 28, lineHeight: 1 }}>{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ ...cardTitle, margin: '14px 0 8px' }}>{tr(tip.title, lang)}</div>
                  <div style={bodyText}>{tr(tip.body, lang)}</div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </Section>

        {/* 4. Tài liệu sản phẩm — trạng thái bài, chính sách thử lại, gói & pháp lý */}
        <Section id={RESOURCE_SECTION.docs} isMobile={isMobile}>
          <SectionHead title={tr(RESOURCES_DOCS.title, lang)} subtitle={tr(RESOURCES_DOCS.subtitle, lang)} isMobile={isMobile} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1.15fr 1fr', gap: 20, alignItems: 'start' }}>
            <Reveal>
              <div style={{ ...cardBase, padding: isMobile ? 22 : 28 }}>
                <div style={cardTitle}>{tr(RESOURCES_DOCS.statusTitle, lang)}</div>
                <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                  {RESOURCE_STATUS_ORDER.map((st) => {
                    const m = CONTENT_STATUS_META[st];
                    return (
                      <div key={st} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '150px 1fr', gap: isMobile ? 6 : 14, alignItems: 'center' }}>
                        <span style={{ justifySelf: 'start', fontSize: 12.5, fontWeight: 700, color: m.color, background: m.bg, borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap' }}>{String(t[m.labelKey])}</span>
                        <span style={{ fontSize: 14, lineHeight: 1.5, color: C.ink650 }}>{tr(RESOURCES_DOCS.statuses[st], lang)}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}`, fontSize: 13, lineHeight: 1.55, color: C.textMuted }}>{tr(RESOURCES_DOCS.statusNote, lang)}</div>
              </div>
            </Reveal>

            <div style={{ display: 'grid', gap: 20 }}>
              <Reveal delay={0.05}>
                <div style={{ ...cardBase, padding: isMobile ? 22 : 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <RotateCcw size={18} color={C.primary} strokeWidth={2} aria-hidden />
                    <div style={cardTitle}>{tr(RESOURCES_DOCS.retryTitle, lang)}</div>
                  </div>
                  <p style={{ ...bodyText, margin: '12px 0 14px' }}>{tr(RESOURCES_DOCS.retryIntro, lang)}</p>
                  <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                    {RESOURCES_DOCS.retrySteps.map((s, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: C.textStrong }}>
                        <span style={{ width: 24, height: 24, borderRadius: 8, background: C.primarySoft, color: C.primaryStrong, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flex: 'none' }}>{i + 1}</span>
                        {tr(s, lang)}
                      </li>
                    ))}
                  </ol>
                  <p style={{ ...bodyText, margin: '14px 0 0' }}>{tr(RESOURCES_DOCS.retryFinal, lang)}</p>
                  <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 14, background: C.dangerSoft }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: C.danger }}>
                      <Ban size={15} strokeWidth={2.2} aria-hidden />
                      {tr(RESOURCES_DOCS.noRetryTitle, lang)}
                    </div>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 20, listStyle: 'disc', display: 'grid', gap: 4 }}>
                      {RESOURCES_DOCS.noRetry.map((n, i) => (
                        <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5, color: C.ink650 }}>{tr(n, lang)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.1}>
                <div style={{ ...cardBase, padding: isMobile ? 22 : 28 }}>
                  <div style={cardTitle}>{tr(RESOURCES_DOCS.linksTitle, lang)}</div>
                  <div style={{ display: 'grid', gap: 4, marginTop: 10 }}>
                    {RESOURCES_DOCS.links.map((ln) => (
                      <LandingLink key={ln.href} href={ln.href} className="btn-soft" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', margin: '0 -12px', borderRadius: 12, textDecoration: 'none' }}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: C.textStrong }}>{tr(ln.label, lang)}</span>
                          <span style={{ display: 'block', fontSize: 13, color: C.textMuted, marginTop: 2 }}>{tr(ln.description, lang)}</span>
                        </span>
                        <ArrowRight size={16} color={C.primary} aria-hidden />
                      </LandingLink>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </Section>

        {/* 5. Về AIMA — đích của link "Giới thiệu" ở footer */}
        <Section id={RESOURCE_SECTION.about} isMobile={isMobile}>
          <Reveal>
            <div style={{ ...cardBase, padding: isMobile ? '28px 22px' : '44px 48px', display: 'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '1.1fr 1fr', gap: isMobile ? 28 : 48 }}>
              <div>
                <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 28 : 36, letterSpacing: '-.02em', margin: 0, color: C.ink900 }}>{tr(RESOURCES_ABOUT.title, lang)}</h2>
                {RESOURCES_ABOUT.paragraphs.map((p, i) => (
                  <p key={i} style={{ fontSize: 15.5, lineHeight: 1.7, color: C.ink650, margin: '16px 0 0' }}>{tr(p, lang)}</p>
                ))}
                <div style={{ marginTop: 24, fontSize: 14, fontWeight: 700, color: C.textStrong }}>{tr(RESOURCES_ABOUT.contactTitle, lang)}</div>
                <p style={{ ...bodyText, margin: '6px 0 0' }}>{tr(RESOURCES_ABOUT.contactText, lang)}</p>
                <a className="link-underline" href={`mailto:${footer.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 15, fontWeight: 600, color: C.primaryStrong, textDecoration: 'none' }}>
                  <Mail size={16} strokeWidth={1.8} aria-hidden />
                  {footer.email}
                </a>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.textMuted }}>{tr(RESOURCES_ABOUT.audienceTitle, lang)}</div>
                <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                  {RESOURCES_ABOUT.audiences.map((a, i) => (
                    <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 16, padding: '16px 18px', background: C.surfaceSubtle }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.textStrong }}>{tr(a.title, lang)}</div>
                      <div style={{ ...bodyText, marginTop: 4 }}>{tr(a.description, lang)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </Section>

        <FaqSection />
        <CtaSection />
        <LandingFooter />
      </div>
    </>
  );
}
