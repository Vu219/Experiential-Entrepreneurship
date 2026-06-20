import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Card, PlatformTag } from '../components/ui';
import { ideas, toneLabels, scriptLines, genCaption, genHashtags, channels } from '../data';

export default function Create() {
  const { t, lang, go, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState(0);
  const [platform, setPlatform] = useState(0);
  const ideaList = ideas(lang);
  const tones = toneLabels(lang);
  const chans = channels(lang);
  const script = scriptLines(lang);
  const stacked = isMobile || isTablet;
  const activeChannel = chans[platform] ?? chans[0];

  const chip = (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    border: `1.5px solid ${active ? 'transparent' : '#ece8f6'}`,
    borderRadius: 10,
    padding: '7px 12px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? brandGradient : '#fff',
    color: active ? '#fff' : '#3f3a55',
  });

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1fr 1.15fr', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.crStudio}</div>
          <div style={{ fontSize: 12.5, color: '#8a85a0', marginBottom: 18 }}>{t.pageSubCreate}</div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', marginBottom: 8 }}>{t.crTopic}</label>
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t.crTopicPh} style={{ width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#241f3a', background: '#fbfaff', outline: 'none', resize: 'none', minHeight: 84 }} />

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', margin: '16px 0 8px' }}>{t.crPlatform}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {chans.map((c, i) => (
              <span key={i} onClick={() => setPlatform(i)} style={chip(platform === i)}>
                <PlatformTag tag={c.tag} bg={platform === i ? 'rgba(255,255,255,.25)' : c.bg} size={20} radius={6} fontSize={10} />
                {c.name}
              </span>
            ))}
          </div>

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', margin: '16px 0 8px' }}>{t.crTone}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tones.map((tn, i) => (
              <span key={i} onClick={() => setTone(i)} style={chip(tone === i)}>{tn}</span>
            ))}
          </div>

          <button style={{ width: '100%', marginTop: 22, border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: 'pointer' }}>{t.crGenerate}</button>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 2 }}>{t.crIdeaTitle}</div>
          <div style={{ fontSize: 12.5, color: '#8a85a0', marginBottom: 16 }}>{t.crIdeaSub}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ideaList.map((idea, i) => (
              <div key={i} style={{ border: '1px solid #efeaf8', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: '#fcfbfe' }}>
                <PlatformTag tag={idea.tag} bg={idea.bg} size={34} radius={9} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#2b2543', lineHeight: 1.35 }}>{idea.title}</div>
                  <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 3 }}>{idea.fmt} · {idea.platform}</div>
                </div>
                <div style={{ textAlign: 'center', flex: 'none' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed' }}>{idea.score}</div>
                  <div style={{ fontSize: 9, color: '#a59fbb', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t.crScore}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Preview panel */}
      <Card style={{ position: stacked ? 'static' : 'sticky', top: 98 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PlatformTag tag={activeChannel.tag} bg={activeChannel.bg} size={32} radius={9} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#211c38' }}>{activeChannel.name} · {t.crStudio}</div>
              <div style={{ fontSize: 11.5, color: '#a59fbb' }}>AI generated</div>
            </div>
          </div>
          <button style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: '#7c3aed', cursor: 'pointer' }}>↻ {t.regenerate}</button>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 9 }}>{t.crScript}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {script.map((ln, i) => (
            <div key={i} style={{ background: '#faf8fe', borderLeft: '3px solid #8b5cf6', borderRadius: '0 10px 10px 0', padding: '11px 14px', fontSize: 13.5, lineHeight: 1.5, color: '#3f3a55' }}>{ln}</div>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 9 }}>{t.crCaption}</div>
        <div style={{ background: '#faf8fe', borderRadius: 12, padding: '13px 15px', fontSize: 13.5, lineHeight: 1.55, color: '#3f3a55', marginBottom: 18 }}>{genCaption(lang)}</div>

        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 9 }}>{t.crHashtag}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
          {genHashtags.map((h, i) => (
            <span key={i} style={{ background: '#f3edff', color: '#7c3aed', borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600 }}>{h}</span>
          ))}
        </div>

        <div style={{ border: '1.5px dashed #d9cef5', borderRadius: 14, padding: 22, textAlign: 'center', background: 'repeating-linear-gradient(135deg,#faf8fe,#faf8fe 10px,#f4eefc 10px,#f4eefc 20px)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#7c3aed' }}>🎬 {t.crMedia}</div>
          <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 5 }}>{t.crMediaHint}</div>
        </div>

        <button onClick={() => go('calendar')} style={{ width: '100%', marginTop: 18, border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: 'pointer' }}>{t.calNew}</button>
      </Card>
    </div>
  );
}
