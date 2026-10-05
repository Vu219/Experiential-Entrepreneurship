import { useEffect, type ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import LandingHeader from '../../components/LandingHeader';
import LandingFooter from '../../components/landing/LandingFooter';
import LandingLink from '../../components/landing/LandingLink';
import { cardStyle } from '../../components/ui';
import { getLegalDoc, LEGAL_CONTACT_EMAIL, LEGAL_UPDATED_AT, type LegalDocKey } from '../../config/legalContent';
import { C } from '../../styles/colors';

// Khung chung cho 3 trang pháp lý công khai (/privacy, /terms, /data-deletion) — không cần đăng nhập.
// `children` chèn giữa phần mở đầu và các mục (trang xoá dữ liệu dùng để hiện trạng thái theo mã).
export default function LegalPage({ docKey, children }: { docKey: LegalDocKey; children?: ReactNode }) {
  const { t, lang } = useApp();
  const { isMobile } = useBreakpoint();
  const doc = getLegalDoc(docKey, lang);

  // Mở từ footer landing (điều hướng SPA giữ nguyên vị trí cuộn) hoặc chuyển giữa 3 trang → luôn về đầu trang.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [docKey]);

  const nav: { key: LegalDocKey; href: string; label: string }[] = [
    { key: 'privacy', href: '/privacy', label: t.privacy },
    { key: 'terms', href: '/terms', label: t.terms },
    { key: 'dataDeletion', href: '/data-deletion', label: t.ftDataDeletion },
  ];

  // LandingHeader (position: fixed) nằm ngoài .view-pop — xem ghi chú ở LandingPage.
  return (
    <>
      <LandingHeader />

      <div className="view-pop overflow-x-hidden ambient-surface" style={{ minHeight: '100vh' }}>
        <section style={{ maxWidth: 860, margin: '0 auto', padding: isMobile ? '110px 18px 56px' : '150px 28px 80px' }}>
          <nav aria-label={t.lgNavLabel} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
            {nav.map((n) => (
              <LandingLink
                key={n.key}
                href={n.href}
                className="btn-soft"
                style={{
                  fontSize: 13, fontWeight: 600, textDecoration: 'none', borderRadius: 999, padding: '7px 14px',
                  border: `1px solid ${C.border}`,
                  background: n.key === docKey ? C.primarySoft : C.surface,
                  color: n.key === docKey ? C.primaryStrong : C.ink650,
                }}
              >
                {n.label}
              </LandingLink>
            ))}
          </nav>

          <article style={{ ...cardStyle, padding: isMobile ? '26px 20px' : '40px 44px' }}>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 28 : 38, letterSpacing: '-.02em', margin: 0, color: C.ink900 }}>{doc.title}</h1>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>{t.lgUpdated}: {LEGAL_UPDATED_AT}</div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.ink650, margin: '20px 0 0' }}>{doc.intro}</p>

            {children}

            {doc.sections.map((s) => (
              <section key={s.heading} style={{ marginTop: 28 }}>
                <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: isMobile ? 17 : 19, margin: '0 0 10px', color: C.textStrong }}>{s.heading}</h2>
                {s.paragraphs?.map((p) => (
                  <p key={p} style={{ fontSize: 14.5, lineHeight: 1.7, color: C.ink650, margin: '0 0 10px' }}>{p}</p>
                ))}
                {s.bullets && (
                  <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8, listStyle: 'disc' }}>
                    {s.bullets.map((b) => (
                      <li key={b} style={{ fontSize: 14.5, lineHeight: 1.7, color: C.ink650 }}>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <div style={{ marginTop: 32, paddingTop: 18, borderTop: `1px solid ${C.border}`, fontSize: 14, color: C.textSecondary }}>
              {t.lgContact}:{' '}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="link-underline" style={{ color: C.primaryStrong, fontWeight: 600, textDecoration: 'none' }}>{LEGAL_CONTACT_EMAIL}</a>
            </div>
          </article>
        </section>

        <LandingFooter />
      </div>
    </>
  );
}
