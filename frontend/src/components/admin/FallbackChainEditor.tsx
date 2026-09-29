import { type CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Sparkles, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  aiBlockReasonLabel, aiFallbackText, modelBlockReason, suggestedFallbackChain, MAX_FALLBACKS,
  type AiModelInfo, type AiProviderInfo,
} from '../../api/adminAi';

const rowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px 5px 8px', borderRadius: 8,
  border: '1px solid #ece8f6', background: '#faf9fe', minWidth: 0,
};
const iconBtn: CSSProperties = {
  width: 24, height: 24, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 6,
  border: '1px solid #ece8f6', background: '#fff', cursor: 'pointer', padding: 0,
};
const posBadge: CSSProperties = {
  width: 18, height: 18, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 5,
  fontSize: 10.5, fontWeight: 800, color: '#7c3aed', background: '#f1e9ff',
};

/**
 * Chuỗi model dự phòng có thứ tự (thử từ trên xuống): lên/xuống/bỏ từng mắt xích, thêm model
 * (không cho trùng, không cho chọn model chính), nút "Dùng gợi ý mặc định".
 * Model thuộc provider đang tắt / chưa có key: hiện mờ kèm lý do và KHÔNG chọn thêm được
 * (mắt xích đã có sẵn vẫn giữ — runtime tự bỏ qua).
 */
export default function FallbackChainEditor({
  value, onChange, primaryId, models, providers, compact = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  primaryId: string;
  models: AiModelInfo[];
  providers: AiProviderInfo[];
  compact?: boolean;
}) {
  const { lang } = useApp();
  const tx = aiFallbackText(lang);
  const byId = new Map(models.map((m) => [m.id, m]));
  const suggestion = suggestedFallbackChain(models, providers, primaryId);
  const sameAsSuggestion = suggestion.length === value.length && suggestion.every((id, i) => id === value[i]);

  const move = (i: number, delta: number) => {
    const next = value.slice();
    const [item] = next.splice(i, 1);
    next.splice(i + delta, 0, item);
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = (id: string) => { if (id && !value.includes(id) && id !== primaryId) onChange([...value, id]); };

  // Ứng viên thêm: model đang bật, chưa nằm trong chuỗi, không phải model chính; mờ nếu provider hỏng.
  const candidates = models.filter((m) => m.enabled && m.id !== primaryId && !value.includes(m.id));
  const fontSize = compact ? 12 : 12.5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: compact ? 200 : 0 }}>
      {value.map((id, i) => {
        const m = byId.get(id);
        const reason = m ? modelBlockReason(m, providers) : 'MODEL_DELETED';
        return (
          <div key={id} style={{ ...rowStyle, opacity: reason ? 0.55 : 1 }} title={reason ? aiBlockReasonLabel(lang, reason) : undefined}>
            <span style={posBadge}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'monospace', fontSize, color: '#2b2543', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m ? m.modelCode : id}
                {m && <span style={{ color: '#a59fbb' }}> · {m.providerCode}</span>}
              </div>
              {reason && <div style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>{aiBlockReasonLabel(lang, reason)}</div>}
            </div>
            <button type="button" aria-label={tx.up} title={tx.up} disabled={i === 0} onClick={() => move(i, -1)} style={{ ...iconBtn, opacity: i === 0 ? 0.35 : 1 }}>
              <ArrowUp size={13} stroke="#5b5670" />
            </button>
            <button type="button" aria-label={tx.down} title={tx.down} disabled={i === value.length - 1} onClick={() => move(i, 1)} style={{ ...iconBtn, opacity: i === value.length - 1 ? 0.35 : 1 }}>
              <ArrowDown size={13} stroke="#5b5670" />
            </button>
            <button type="button" aria-label={tx.remove} title={tx.remove} onClick={() => remove(i)} style={iconBtn}>
              <X size={13} stroke="#dc2626" />
            </button>
          </div>
        );
      })}

      {value.length < MAX_FALLBACKS ? (
        <select
          value=""
          onChange={(e) => add(e.target.value)}
          style={{ width: '100%', border: '1px dashed #d9cef7', borderRadius: 8, padding: compact ? '6px 8px' : '8px 10px', fontSize, color: '#7c3aed', background: '#fff', cursor: 'pointer', fontFamily: 'monospace' }}
        >
          <option value="">{tx.add}</option>
          {candidates.map((m) => {
            const reason = modelBlockReason(m, providers);
            return (
              <option key={m.id} value={m.id} disabled={!!reason}>
                {m.modelCode} · {m.providerCode}{reason ? ` — ${aiBlockReasonLabel(lang, reason)}` : ''}
              </option>
            );
          })}
        </select>
      ) : (
        <div style={{ fontSize: 11.5, color: '#a59fbb' }}>{tx.max}</div>
      )}

      <button
        type="button"
        onClick={() => onChange(suggestion)}
        disabled={suggestion.length === 0 || sameAsSuggestion}
        title={suggestion.length === 0 ? tx.suggestEmpty : tx.suggestHint}
        style={{
          alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent',
          padding: '2px 0', fontSize: 11.5, fontWeight: 700, color: '#7c3aed',
          cursor: suggestion.length === 0 || sameAsSuggestion ? 'not-allowed' : 'pointer',
          opacity: suggestion.length === 0 || sameAsSuggestion ? 0.45 : 1,
        }}
      >
        <Sparkles size={12} stroke="#7c3aed" />{tx.suggest}
      </button>
      {!compact && <div style={{ fontSize: 11.5, color: '#8a85a0' }}>{tx.chainHint} {tx.suggestHint}.</div>}
    </div>
  );
}
