import { useEffect, useMemo, useRef, useState } from 'react';
import { Square } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Loader } from '../ui';
import { useAiPreview } from '../../hooks/useAiPreview';
import { previewSections } from '../../realtime/aiPreview';
import { C } from '../../styles/colors';

const ANNOUNCE_MS = 2500; // aria-live: báo phần đang viết thưa thớt, không đọc từng chữ

/**
 * Mốc 2 — xem trước nội dung AI đang sinh (AI streaming, cờ backend `aima.ai.generation-streaming-enabled`): các phần hiện
 * lần lượt Mở đầu → Các bước → CTA → Caption → Hashtag → Gợi ý video. Chưa có chữ nào (cờ tắt / chưa tới) → loader như cũ.
 * Nút "Dừng" huỷ job (cờ tắt vẫn dừng được — kết quả về muộn bị bỏ). Bản lưu thật luôn lấy từ DB khi job xong.
 */
export default function AiStreamPreview({
  jobId,
  stopping,
  onStop,
}: {
  jobId?: string;
  stopping: boolean;
  onStop: () => void;
}) {
  const { t } = useApp();
  const dict = t as unknown as Record<string, string>;
  const preview = useAiPreview(jobId);
  const sections = useMemo(() => previewSections(preview.fields), [preview.fields]);
  const [announced, setAnnounced] = useState('');
  const lastAnnounce = useRef(0);

  const current = sections[sections.length - 1]?.key;
  useEffect(() => {
    if (!current || Date.now() - lastAnnounce.current < ANNOUNCE_MS) return;
    lastAnnounce.current = Date.now();
    setAnnounced(t.cwPreviewAria.replace('{section}', dict[`cwPrev_${current}`] ?? current));
  }, [current, t, dict]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: C.ink600 }}>
          <span className="run-dot-pulse" aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: C.primary }} />
          {sections.length > 0 ? t.cwStreamTitle : t.cwGenerating}
        </span>
        {jobId && (
          <button
            type="button"
            onClick={onStop}
            disabled={stopping}
            className="btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10, padding: '7px 13px', fontSize: 12.5, fontWeight: 700, color: C.rose, cursor: stopping ? 'not-allowed' : 'pointer', opacity: stopping ? 0.6 : 1 }}
          >
            <Square size={12} fill={C.rose} />
            {stopping ? t.cwStopping : t.cwStop}
          </button>
        )}
      </div>

      {preview.resets > 0 && sections.length === 0 && (
        <div style={{ fontSize: 12.5, color: C.amberText, background: C.amberSoft, borderRadius: 10, padding: '8px 12px' }}>
          {t.cwPreviewFallback}
        </div>
      )}

      {sections.length === 0 ? (
        <Loader label={t.cwGenerating} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map((section) => (
            <div key={section.key}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                {dict[`cwPrev_${section.key}`]}
              </div>
              {section.key === 'hashtags' ? (
                <div style={{ fontSize: 13, color: C.primary, lineHeight: 1.6 }}>{section.lines.join(' ')}</div>
              ) : section.key === 'steps' ? (
                <ol style={{ margin: 0, paddingLeft: 20, listStyle: 'decimal', fontSize: 13.5, color: C.textStrong, lineHeight: 1.6 }}>
                  {section.lines.map((line, i) => <li key={i}>{line}</li>)}
                </ol>
              ) : (
                <div style={{ fontSize: 13.5, color: C.textStrong, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{section.lines.join('\n')}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {announced}
      </span>
    </div>
  );
}
