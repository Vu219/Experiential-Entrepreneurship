import type { CSSProperties } from 'react';
import { useApp } from '../context/AppContext';

const bar = (h: number, bg: string, radius = 3): CSSProperties => ({ flex: 1, height: `${h}%`, borderRadius: radius, background: bg });

/**
 * Floating 3D-style hero illustration (pure CSS): a tilted dashboard card,
 * an AI chip, a trending tile, a target and gradient orbs.
 * Animations (floaty / floaty2 / spinslow) live in index.css.
 */
export default function AimaScene() {
  const { brandGradient } = useApp();
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: 430, height: 400, perspective: 1400 }}>
        {/* Tilted dashboard card */}
        <div style={{ position: 'absolute', left: 34, top: 54, width: 360, transform: 'rotateX(11deg) rotateY(-15deg) rotateZ(2deg)', transformStyle: 'preserve-3d', animation: 'floaty 6.5s ease-in-out infinite' }}>
          <div style={{ background: 'rgba(255,255,255,.92)', border: '1px solid rgba(255,255,255,.9)', borderRadius: 20, padding: 14, boxShadow: '0 40px 70px -28px rgba(94,53,177,.55)', backdropFilter: 'blur(6px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 11 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
              <div style={{ flex: 1, marginLeft: 8, height: 22, borderRadius: 7, background: '#f1eef9', display: 'flex', alignItems: 'center', padding: '0 8px', gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#b3acc7" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
                <span style={{ fontSize: 8, color: '#b3acc7' }}>Search...</span>
              </div>
              <span style={{ width: 22, height: 22, borderRadius: 7, background: '#ede9f8' }} />
              <span style={{ width: 22, height: 22, borderRadius: 7, background: brandGradient }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 9 }}>
              <div style={{ background: '#faf9fe', borderRadius: 13, padding: 11 }}>
                <div style={{ fontSize: 8.5, color: '#9a93b3', fontWeight: 600 }}>Analytics Overview</div>
                <div style={{ fontSize: 21, fontWeight: 800, color: '#241f3a', margin: '5px 0 1px' }}>24.8K</div>
                <div style={{ fontSize: 8, color: '#16a34a', fontWeight: 700 }}>+12.6%</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40, marginTop: 7 }}>
                  {[42, 64, 50, 82, 60, 96].map((h, i) => (
                    <div key={i} style={bar(h, i === 3 ? 'linear-gradient(#a855f7,#f0abfc)' : i === 5 ? 'linear-gradient(#ec4899,#f9a8d4)' : 'linear-gradient(#8B5CF6,#c4b5fd)')} />
                  ))}
                </div>
              </div>
              <div style={{ background: '#faf9fe', borderRadius: 13, padding: 11 }}>
                <div style={{ fontSize: 8.5, color: '#9a93b3', fontWeight: 600 }}>Performance</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#241f3a', margin: '5px 0 1px' }}>96.6%</div>
                <div style={{ fontSize: 8, color: '#9a93b3' }}>Reach</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, marginTop: 7 }}>
                  {[['30', '#d8b4fe'], ['46', '#c4b5fd'], ['60', '#a78bfa'], ['74', '#8b5cf6'], ['90', '#7c3aed']].map(([h, c], i) => (
                    <div key={i} style={bar(Number(h), c, 2)} />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 9, marginTop: 9 }}>
              <div style={{ background: '#faf9fe', borderRadius: 13, padding: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0114 0" /></svg>
                </div>
                <div>
                  <div style={{ fontSize: 7.5, color: '#9a93b3' }}>Rating cao nhất</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#241f3a' }}>AIMA User</div>
                  <div style={{ fontSize: 8, color: '#8b5cf6', fontWeight: 700 }}>● Premium Plan</div>
                </div>
              </div>
              <div style={{ background: '#faf9fe', borderRadius: 13, padding: 11 }}>
                <div style={{ fontSize: 8.5, color: '#9a93b3', fontWeight: 600 }}>Active Sessions</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#241f3a', margin: '4px 0 1px' }}>1,428</div>
                <div style={{ fontSize: 8, color: '#16a34a', fontWeight: 700 }}>+8.7%</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 24, marginTop: 5 }}>
                  {[['40', '#67e8f9'], ['64', '#38bdf8'], ['50', '#67e8f9'], ['88', '#22d3ee']].map(([h, c], i) => (
                    <div key={i} style={bar(Number(h), c, 2)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI chip */}
        <div style={{ position: 'absolute', right: -6, top: 78, width: 78, height: 78, borderRadius: 18, background: 'linear-gradient(150deg,#6d28d9,#3b1fa3)', boxShadow: '0 24px 40px -18px rgba(80,30,180,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(6deg)', animation: 'floaty2 5.5s ease-in-out infinite' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 18, border: '1px solid rgba(255,255,255,.18)' }} />
          <div style={{ width: 44, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#a855f7,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: '.5px' }}>AI</div>
          {[['left', 24], ['left', 44], ['right', 24], ['right', 44]].map(([side, top], i) => (
            <span key={i} style={{ position: 'absolute', [side as 'left' | 'right']: -7, top: top as number, width: 7, height: 2, background: '#7c5cd6' }} />
          ))}
        </div>

        {/* Trending tile */}
        <div style={{ position: 'absolute', left: -6, top: 120, width: 56, height: 56, borderRadius: 15, background: '#fff', boxShadow: '0 20px 34px -16px rgba(80,53,150,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-6deg)', animation: 'floaty 6s ease-in-out infinite' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 16l5-5 4 4 8-8M16 7h5v5" /></svg>
        </div>

        {/* Target */}
        <div style={{ position: 'absolute', left: 6, bottom: 8, width: 96, height: 96, animation: 'floaty2 6.5s ease-in-out infinite' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'linear-gradient(135deg,#a855f7,#7c3aed)', boxShadow: '0 22px 40px -16px rgba(124,58,237,.7)' }} />
          <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', background: '#fff' }} />
          <div style={{ position: 'absolute', inset: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#c084fc,#8b5cf6)' }} />
          <div style={{ position: 'absolute', inset: 40, borderRadius: '50%', background: '#fff' }} />
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 14, height: 14, borderRadius: '50%', background: '#7c3aed', transform: 'translate(-50%,-50%)' }} />
          <div style={{ position: 'absolute', right: -10, top: -6, width: 54, height: 4, borderRadius: 4, background: 'linear-gradient(90deg,#22d3ee,#8b5cf6)', transform: 'rotate(-32deg)', transformOrigin: 'right' }} />
        </div>

        {/* Floating orbs */}
        <div style={{ position: 'absolute', left: 108, top: 24, width: 30, height: 30, borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%,#fff,#c4b5fd 38%,#7c3aed)', boxShadow: '0 14px 22px -10px rgba(124,58,237,.7)', animation: 'floaty 5s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', right: 34, top: 8, width: 20, height: 20, borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%,#fff,#a5f3fc 38%,#22d3ee)', boxShadow: '0 12px 18px -8px rgba(34,211,238,.7)', animation: 'floaty2 5.8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', right: 54, bottom: 46, width: 44, height: 44, borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%,#fff,#f9a8d4 36%,#db2777)', boxShadow: '0 18px 28px -12px rgba(219,39,119,.6)', animation: 'floaty 6.2s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', right: 6, bottom: 120, width: 16, height: 16, borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%,#fff,#c4b5fd 40%,#8b5cf6)', boxShadow: '0 10px 16px -8px rgba(139,92,246,.7)', animation: 'floaty2 4.6s ease-in-out infinite' }} />
      </div>
    </div>
  );
}
