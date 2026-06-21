/**
 * Hero visual for the landing page: a floating AIMA logo inside a soft
 * glassmorphism slab, with a breathing halo glow behind it. Pure CSS;
 * animations (aima-float / aima-float-rot / aima-breathe / aima-halo) live
 * in index.css and honor prefers-reduced-motion.
 *
 * Replaces the old 3D-dashboard scene on the landing hero only. The login
 * page keeps using AimaScene, so that component is intentionally left as-is.
 */
export default function AimaHero() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 460, aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Soft radial halo glow */}
        <div className="aima-halo" style={{ position: 'absolute', width: '82.6%', height: '82.6%', borderRadius: '50%', background: 'radial-gradient(circle at 50% 45%,rgba(124,92,255,.30),rgba(69,212,255,.16) 42%,rgba(255,99,216,.12) 62%,transparent 72%)', filter: 'blur(6px)' }} />

        {/* Frosted glass slab */}
        <div style={{ position: 'absolute', width: '69.6%', height: '69.6%', borderRadius: 46, background: 'linear-gradient(160deg,rgba(255,255,255,.6),rgba(255,255,255,.22))', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,.75)', boxShadow: '0 50px 90px -34px rgba(94,53,177,.5),inset 0 1px 0 rgba(255,255,255,.9)', transform: 'rotate(-7deg)', animation: 'aima-float-rot 6.8s ease-in-out infinite' }} />

        {/* Sheen sweep clipped to the slab */}
        <div style={{ position: 'absolute', width: '69.6%', height: '69.6%', borderRadius: 46, overflow: 'hidden', transform: 'rotate(-7deg)', animation: 'aima-float-rot 6.8s ease-in-out infinite', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-40%', left: '-14%', width: '58%', height: '180%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent)', transform: 'rotate(18deg)' }} />
        </div>

        {/* Floating logo */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'aima-float 6.5s ease-in-out infinite' }}>
          <img
            src="/aima-logo.png"
            alt="AIMA"
            style={{ width: '62.2%', height: 'auto', display: 'block', filter: 'drop-shadow(0 26px 42px rgba(124,58,237,.42)) drop-shadow(0 6px 14px rgba(69,212,255,.3))', animation: 'aima-breathe 7.5s ease-in-out infinite', willChange: 'transform' }}
          />
        </div>
      </div>
    </div>
  );
}
