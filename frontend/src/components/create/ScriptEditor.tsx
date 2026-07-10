import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon } from '../ui';
import ScriptBlock from './ScriptBlock';
import type { ScriptSection, VideoScript } from '../../api/contentCreationService';

/**
 * Editor kịch bản video có cấu trúc (FR-25): hook (timing) → các bước đánh số → CTA (timing).
 * Render bằng CÙNG khung ScriptBlock 2 cột với màn xem (editable=true → textarea).
 * Dùng ở mốc 3 wizard + sửa tại chỗ màn chi tiết.
 * - `collapsible`: accordion từng phần (mặc định thu gọn) — giảm cuộn ở trang chỉnh sửa.
 * - `stateKey`: khóa giữ trạng thái mở/đóng theo TỪNG bản nền tảng (đổi tab không mất).
 */
export default function ScriptEditor({
  script,
  onChange,
  collapsible = false,
  stateKey = '',
}: {
  script: VideoScript;
  onChange: (s: VideoScript) => void;
  collapsible?: boolean;
  stateKey?: string;
}) {
  const { t } = useApp();
  // Trạng thái mở/đóng accordion theo `${stateKey}:${phần}` — mặc định THU GỌN (undefined = đóng).
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const keyOf = (part: string) => `${stateKey}:${part}`;
  const isOpen = (part: string) => !collapsible || !!expanded[keyOf(part)];
  const toggle = (part: string) => setExpanded((prev) => ({ ...prev, [keyOf(part)]: !prev[keyOf(part)] }));

  const patchSection = (key: 'hook' | 'cta') => (p: Partial<ScriptSection>) =>
    onChange({ ...script, [key]: { ...script[key], ...p } });
  const patchStep = (i: number) => (p: Partial<ScriptSection>) =>
    onChange({ ...script, steps: script.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const removeStep = (i: number) =>
    onChange({ ...script, steps: script.steps.filter((_, j) => j !== i).map((s, j) => ({ ...s, index: j + 1 })) });
  const addStep = () => {
    // Bước mới tự MỞ để nhập ngay (kể cả ở chế độ accordion).
    setExpanded((prev) => ({ ...prev, [keyOf(`step-${script.steps.length}`)]: true }));
    onChange({ ...script, steps: [...script.steps, { index: script.steps.length + 1, content: '', sceneSuggestion: '' }] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ScriptBlock
        variant="hook"
        section={script.hook}
        editable
        onChange={patchSection('hook')}
        collapsible={collapsible}
        expanded={isOpen('hook')}
        onToggle={() => toggle('hook')}
      />

      {script.steps.map((step, i) => (
        <ScriptBlock
          key={i}
          variant="step"
          index={step.index}
          section={{ ...step, timing: '' }}
          editable
          onChange={patchStep(i)}
          onRemove={() => removeStep(i)}
          collapsible={collapsible}
          expanded={isOpen(`step-${i}`)}
          onToggle={() => toggle(`step-${i}`)}
        />
      ))}

      <button
        onClick={addStep}
        className="btn-soft"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1.5px dashed #d9cef5', background: '#fdfcff', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}
      >
        <Icon icon={Plus} size={14} stroke="#7c3aed" />{t.cwAddStep}
      </button>

      <ScriptBlock
        variant="cta"
        section={script.cta}
        editable
        onChange={patchSection('cta')}
        collapsible={collapsible}
        expanded={isOpen('cta')}
        onToggle={() => toggle('cta')}
      />
    </div>
  );
}
