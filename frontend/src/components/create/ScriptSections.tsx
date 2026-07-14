import { Plus, RefreshCw, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Icon } from '../ui';
import type { ScriptSection, ScriptStep, VideoScript } from '../../api/contentCreationService';
import type { Dict } from '../../i18n';
import AutoGrowTextarea from './AutoGrowTextarea';

/** Ba SECTION cố định của kịch bản video. */
export type SectionKind = 'hook' | 'body' | 'cta';

/** Khoá định danh phần đang tạo lại (spinner/disabled riêng từng phần). */
export type RegenKey = `${SectionKind}:content` | `${SectionKind}:scene` | `body:step:${number}`;
export const stepRegenKey = (index: number): RegenKey => `body:step:${index}`;

const SECTION_META: Record<SectionKind, { labelKey: keyof Dict; dot: string; badgeBg: string; badgeColor: string }> = {
  hook: { labelKey: 'cwHook', dot: '#7c3aed', badgeBg: '#f3edff', badgeColor: '#7c3aed' },
  body: { labelKey: 'cwSectionMain', dot: '#0e7490', badgeBg: '#e0f7fb', badgeColor: '#0e7490' },
  cta: { labelKey: 'cwEndCta', dot: '#be185d', badgeBg: '#fdeef5', badgeColor: '#be185d' },
};

const inputBase = {
  width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 10, padding: '10px 12px',
  fontSize: 13.5, lineHeight: 1.55, color: '#241f3a', background: '#fbfaff', outline: 'none',
} as const;
const card = { background: '#fff', border: '1px solid #ece7f6', borderRadius: 14, padding: '12px 14px' } as const;
const sceneCard = { background: '#faf8fe', border: '1px dashed #e3dcf4', borderRadius: 14, padding: '12px 14px' } as const;
const timingChip = {
  display: 'inline-block', flex: 'none', background: '#fff', border: '1px solid #ece7f6',
  color: '#8a85a0', borderRadius: 7, padding: '1px 8px', fontSize: 10.5, fontWeight: 700,
} as const;

/** Nút "Tạo lại" nhỏ (dùng cho cả section, cảnh quay, và từng bước). Chỉ hiện khi có handler. */
function RegenButton({ label, busy, disabled, onClick, subtle = false }: { label: string; busy: boolean; disabled: boolean; onClick: () => void; subtle?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="btn-soft"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none',
        border: subtle ? 'none' : '1px solid #ece8f6', background: subtle ? 'transparent' : '#fff',
        borderRadius: 8, padding: subtle ? 3 : '5px 10px', fontSize: 11.5, fontWeight: 700,
        color: '#7c3aed', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled && !busy ? 0.5 : 1,
      }}
    >
      <span style={{ display: 'inline-flex', animation: busy ? 'spinslow 0.8s linear infinite' : undefined }}>
        <Icon icon={RefreshCw} size={12.5} stroke="#7c3aed" />
      </span>
      {!subtle && label}
    </button>
  );
}

const emptySection = (): ScriptSection => ({ content: '', sceneSuggestion: '', timing: '' });

/** Chuẩn hoá script phòng dữ liệu thiếu nhánh (hook/cta null, steps null, field null) — mọi field
 *  luôn là chuỗi/mảng hợp lệ để render không bao giờ throw (tránh trắng trang). */
function normalizeScript(s: VideoScript | null | undefined): VideoScript {
  return {
    hook: { ...emptySection(), ...(s?.hook ?? {}) },
    cta: { ...emptySection(), ...(s?.cta ?? {}) },
    steps: (Array.isArray(s?.steps) ? s.steps : []).map((st, i) => ({
      index: st?.index ?? i + 1,
      content: st?.content ?? '',
      sceneSuggestion: st?.sceneSuggestion ?? '',
    })),
  };
}

/**
 * MỘT khung dùng chung cho kịch bản video ở CẢ ba màn (tạo / xem / sửa) — bố cục mới:
 * 3 SECTION cố định (Mở đầu · Nội dung chính · Kết bài) nối bởi timeline dọc bên trái,
 * mỗi section 2 cột LUÔN hiện: card nội dung (trái) + card "Gợi ý cảnh quay" riêng (phải).
 * Nội dung chính là MỘT card gom mọi bước; cảnh quay của nó là danh sách bullet cho cả cụm.
 * - `editable` → textarea + thêm/xóa bước; ngược lại read-only.
 * - Các nút "Tạo lại" (section / cảnh quay / từng bước) CHỈ hiện khi truyền handler tương ứng;
 *   `regenerating` giữ khoá phần đang chạy để spinner + disabled đúng phần đó.
 */
export default function ScriptSections({
  script: rawScript,
  editable = false,
  onChange,
  onRegenerateSection,
  onRegenerateScene,
  onRegenerateStep,
  regenerating = null,
}: {
  script: VideoScript;
  editable?: boolean;
  onChange?: (s: VideoScript) => void;
  onRegenerateSection?: (part: SectionKind) => void;
  onRegenerateScene?: (part: SectionKind) => void;
  onRegenerateStep?: (index: number) => void;
  regenerating?: RegenKey | null;
}) {
  const { t } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;
  const anyBusy = regenerating != null;
  // Luôn làm việc trên bản đã chuẩn hoá — render không phụ thuộc dữ liệu đầy đủ (không trắng trang).
  const script = normalizeScript(rawScript);

  const patchSection = (key: 'hook' | 'cta') => (p: Partial<ScriptSection>) =>
    onChange?.({ ...script, [key]: { ...script[key], ...p } });
  const patchStep = (i: number) => (p: Partial<ScriptStep>) =>
    onChange?.({ ...script, steps: script.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const removeStep = (i: number) =>
    onChange?.({ ...script, steps: script.steps.filter((_, j) => j !== i).map((s, j) => ({ ...s, index: j + 1 })) });
  const addStep = () =>
    onChange?.({ ...script, steps: [...script.steps, { index: script.steps.length + 1, content: '', sceneSuggestion: '' }] });

  // Header của một section: badge tên + timing (chip/input) + nút "Tạo lại" section.
  const sectionHeader = (kind: SectionKind, timing: string, onTiming?: (v: string) => void) => {
    const m = SECTION_META[kind];
    const busy = regenerating === `${kind}:content`;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ background: m.badgeBg, color: m.badgeColor, borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 800 }}>{t[m.labelKey]}</span>
        {editable && onTiming ? (
          <input value={timing} onChange={(e) => onTiming(e.target.value)} placeholder={t.cwTimingPh} aria-label={t.cwTiming} style={{ ...inputBase, width: 92, padding: '4px 9px', fontSize: 11.5 }} />
        ) : (
          timing && <span style={timingChip}>⏱ {timing}</span>
        )}
        {onRegenerateSection && (
          <span style={{ marginLeft: 'auto' }}>
            <RegenButton label={t.cwRegen} busy={busy} disabled={anyBusy} onClick={() => onRegenerateSection(kind)} />
          </span>
        )}
      </div>
    );
  };

  // Card "Gợi ý cảnh quay" của một section (khối riêng, luôn hiện) + nút tạo lại cảnh quay.
  const sceneBlock = (kind: SectionKind, body: React.ReactNode) => {
    const busy = regenerating === `${kind}:scene`;
    return (
      <div style={{ ...sceneCard, opacity: busy ? 0.55 : 1, transition: 'opacity .15s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#8a85a0' }}>🎬 {t.cwScene}</div>
          {onRegenerateScene && (
            <span style={{ marginLeft: 'auto' }}>
              <RegenButton label={t.cwSceneRegen} busy={busy} disabled={anyBusy} onClick={() => onRegenerateScene(kind)} />
            </span>
          )}
        </div>
        {body}
      </div>
    );
  };

  const sceneText = (value: string) => (
    <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#6b6680', whiteSpace: 'pre-line' }}>{value || '—'}</div>
  );

  // Nội dung một section hook/cta: card nội dung + card cảnh quay (2 cột).
  const simpleSection = (kind: 'hook' | 'cta') => {
    const sec = script[kind];
    const busy = regenerating === `${kind}:content`;
    const content = (
      <div style={{ ...card, opacity: busy ? 0.55 : 1, transition: 'opacity .15s' }}>
        {editable ? (
          <AutoGrowTextarea value={sec.content} onChange={(v) => patchSection(kind)({ content: v })} aria-label={t[SECTION_META[kind].labelKey]} minHeight={70} style={inputBase} />
        ) : (
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: '#3f3a55', whiteSpace: 'pre-line' }}>{sec.content}</div>
        )}
      </div>
    );
    const scene = sceneBlock(
      kind,
      editable
        ? <AutoGrowTextarea value={sec.sceneSuggestion} onChange={(v) => patchSection(kind)({ sceneSuggestion: v })} aria-label={t.cwScene} minHeight={70} style={{ ...inputBase, fontSize: 12.5 }} />
        : sceneText(sec.sceneSuggestion),
    );
    return columns(content, scene);
  };

  // Nội dung section "Nội dung chính": MỘT card gom các bước; cảnh quay = bullet cả cụm.
  const bodySection = () => {
    const busyContent = regenerating === 'body:content';
    const content = (
      <div style={{ ...card, opacity: busyContent ? 0.55 : 1, transition: 'opacity .15s', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {script.steps.map((step, i) => {
          const busyStep = regenerating === stepRegenKey(step.index);
          return (
            <div key={i} style={{ opacity: busyStep ? 0.55 : 1, transition: 'opacity .15s' }} className="step-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#0e7490' }}>{t.cwStepWord} {step.index}</span>
                {onRegenerateStep && (
                  <span className="step-regen" style={{ marginLeft: 'auto' }}>
                    <RegenButton label={t.cwRegenStep} busy={busyStep} disabled={anyBusy} onClick={() => onRegenerateStep(step.index)} subtle />
                  </span>
                )}
                {editable && (
                  <button onClick={() => removeStep(i)} aria-label={t.cwRemoveStep} title={t.cwRemoveStep} style={{ marginLeft: onRegenerateStep ? 0 : 'auto', display: 'inline-flex', alignItems: 'center', border: 'none', background: 'transparent', color: '#b7b2c8', cursor: 'pointer', padding: 3 }}>
                    <Icon icon={X} size={13} stroke="#b7b2c8" />
                  </button>
                )}
              </div>
              {editable ? (
                <AutoGrowTextarea value={step.content} onChange={(v) => patchStep(i)({ content: v })} aria-label={`${t.cwStepWord} ${step.index}`} minHeight={54} style={inputBase} />
              ) : (
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: '#3f3a55', whiteSpace: 'pre-line' }}>{step.content}</div>
              )}
            </div>
          );
        })}
        {editable && (
          <button onClick={addStep} className="btn-soft" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1.5px dashed #d9cef5', background: '#fdfcff', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}>
            <Icon icon={Plus} size={14} stroke="#7c3aed" />{t.cwAddStep}
          </button>
        )}
      </div>
    );
    // Cảnh quay cả cụm: bullet mỗi bước; edit thì textarea từng bước.
    const scene = sceneBlock(
      'body',
      editable ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {script.steps.map((step, i) => (
            <div key={i}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#a59fbb', marginBottom: 3 }}>{t.cwStepWord} {step.index}</div>
              <AutoGrowTextarea value={step.sceneSuggestion} onChange={(v) => patchStep(i)({ sceneSuggestion: v })} aria-label={`${t.cwScene} — ${t.cwStepWord} ${step.index}`} minHeight={48} style={{ ...inputBase, fontSize: 12 }} />
            </div>
          ))}
          {script.steps.length === 0 && sceneText('')}
        </div>
      ) : script.steps.some((s) => s.sceneSuggestion.trim()) ? (
        // Mỗi gợi ý cảnh quay ghi rõ "Bước n" để khớp với bước ở cột nội dung kế bên
        // (hiện ở màn Tạo nội dung & Duyệt/Lưu — người dùng biết cảnh nào của bước nào).
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {script.steps.map((step, i) => step.sceneSuggestion.trim() && (
            <div key={i} style={{ display: 'flex', gap: 7 }}>
              <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 800, color: '#0e7490', background: '#e0f7fb', borderRadius: 6, padding: '1px 7px', height: 'fit-content', marginTop: 1 }}>{t.cwStepWord} {step.index}</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: '#6b6680' }}>{step.sceneSuggestion}</span>
            </div>
          ))}
        </div>
      ) : sceneText(''),
    );
    return columns(content, scene);
  };

  // Khung 2 cột (mobile xếp chồng: nội dung trên, cảnh quay dưới).
  function columns(content: React.ReactNode, scene: React.ReactNode) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : 'minmax(0,1.25fr) minmax(0,1fr)', gap: stacked ? 10 : 14, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>{content}</div>
        <div style={{ minWidth: 0 }}>{scene}</div>
      </div>
    );
  }

  // Một hàng timeline: dot màu section + phần thân bên phải.
  const timelineRow = (kind: SectionKind, timing: string, onTiming: ((v: string) => void) | undefined, body: React.ReactNode) => (
    <div style={{ position: 'relative', paddingLeft: 34 }}>
      <span aria-hidden style={{ position: 'absolute', left: 8, top: 4, width: 15, height: 15, borderRadius: '50%', background: SECTION_META[kind].dot, border: '3px solid #fff', boxShadow: '0 0 0 1.5px ' + SECTION_META[kind].dot, zIndex: 1 }} />
      {sectionHeader(kind, timing, onTiming)}
      {body}
    </div>
  );

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Đường nối dọc liên kết 3 section theo thứ tự Mở đầu → Nội dung chính → Kết bài */}
      <span aria-hidden style={{ position: 'absolute', left: 15, top: 12, bottom: 12, width: 2, background: 'linear-gradient(#d9cef5,#e3dcf4)', borderRadius: 2 }} />
      {timelineRow('hook', script.hook.timing, editable ? (v) => patchSection('hook')({ timing: v }) : undefined, simpleSection('hook'))}
      {timelineRow('body', '', undefined, bodySection())}
      {timelineRow('cta', script.cta.timing, editable ? (v) => patchSection('cta')({ timing: v }) : undefined, simpleSection('cta'))}
    </div>
  );
}
