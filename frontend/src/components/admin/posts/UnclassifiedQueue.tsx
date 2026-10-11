import { useCallback, useEffect, useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card, PlatformTag } from '../../ui';
import Modal from '../../Modal';
import BlockError from '../BlockError';
import { TableSkeleton } from '../BlockSkeleton';
import { FilterSelect } from '../AdminListPage';
import { useToast } from '../../toast/ToastProvider';
import { PLATFORM_BG } from '../../../theme';
import { PLATFORM_TO_TAG } from '../../../api/connections';
import type { ApiError } from '../../../api/apiClient';
import {
  createErrorMapping, deleteErrorMapping, getUnclassifiedErrors, listErrorMappings,
  type PublishErrorMapping, type UnclassifiedErrorGroup,
} from '../../../api/admin';
import {
  PUBLISH_ERROR_CODES, platformDisplayName, publishErrorCopy, type PublishErrorCode,
} from '../../../api/publishErrorCatalog';
import { formatDateTimeVN } from '../../../utils/format';
import { C } from '../../../styles/colors';

// Tab "Chưa phân loại": lỗi đăng bài mà backend chưa nhận diện (mã UNKNOWN) gom theo CHỮ KÝ (nền tảng + mã gốc +
// subcode + dạng chuẩn hoá của message), kèm payload mẫu ĐÃ REDACT. Admin ánh xạ chữ ký → một mã AIMA CÓ SẴN
// (không tự viết câu hiển thị — câu chữ luôn đi qua catalog i18n), tuỳ chọn áp cho các lỗi cũ cùng chữ ký.

const mono = 'ui-monospace,Menlo,Consolas,monospace';
// UNKNOWN không phải đích ánh xạ hợp lệ (ánh xạ để THOÁT khỏi UNKNOWN).
const TARGET_CODES = PUBLISH_ERROR_CODES.filter((c) => c !== 'UNKNOWN');

interface MappingDraft {
  group: UnclassifiedErrorGroup;
  errorCode: PublishErrorCode;
  useSubcode: boolean;
  messagePattern: string;
  note: string;
  applyToExisting: boolean;
}

const inputStyle = {
  width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 11px', fontSize: 13,
  fontFamily: 'inherit', background: C.surface, color: C.text, boxSizing: 'border-box' as const,
};

export default function UnclassifiedQueue({ range }: { range: { from: string; to: string } }) {
  const { t, lang, brandGradient } = useApp();
  const toast = useToast();
  const [groups, setGroups] = useState<UnclassifiedErrorGroup[]>([]);
  const [mappings, setMappings] = useState<PublishErrorMapping[]>([]);
  const [load, setLoad] = useState<'loading' | 'ok' | 'error'>('loading');
  const [draft, setDraft] = useState<MappingDraft | null>(null);
  const [busy, setBusy] = useState(false);

  // Phụ thuộc chuỗi from/to (object `range` đổi danh tính mỗi lần render của trang cha).
  const { from, to } = range;
  const reload = useCallback(async () => {
    setLoad('loading');
    try {
      const [g, m] = await Promise.all([getUnclassifiedErrors({ from, to }), listErrorMappings()]);
      setGroups(g);
      setMappings(m);
      setLoad('ok');
    } catch {
      setLoad('error');
    }
  }, [from, to]);

  useEffect(() => { reload(); }, [reload]);

  const openDraft = (group: UnclassifiedErrorGroup) => setDraft({
    group, errorCode: 'CONTENT_INVALID', useSubcode: !!group.platformSubcode, messagePattern: '', note: '',
    applyToExisting: true,
  });

  const saveDraft = async () => {
    if (!draft || !draft.group.platformCode) return;
    setBusy(true);
    try {
      const created = await createErrorMapping({
        platform: draft.group.platform,
        platformCode: draft.group.platformCode,
        platformSubcode: draft.useSubcode && draft.group.platformSubcode ? draft.group.platformSubcode : undefined,
        messagePattern: draft.messagePattern.trim() || undefined,
        errorCode: draft.errorCode,
        note: draft.note.trim() || undefined,
        applyToExisting: draft.applyToExisting,
      });
      toast.success(t.apMappingSaved.replace('{n}', String(created.appliedCount)));
      setDraft(null);
      await reload();
    } catch (e) {
      toast.error((e as ApiError).message);
    }
    setBusy(false);
  };

  const removeMapping = async (m: PublishErrorMapping) => {
    setBusy(true);
    try {
      await deleteErrorMapping(m.id);
      toast.success(t.apMappingDeleted);
      await reload();
    } catch (e) {
      toast.error((e as ApiError).message);
    }
    setBusy(false);
  };

  if (load === 'loading') return <Card style={{ borderRadius: 18, padding: 0 }}><TableSkeleton rows={4} /></Card>;
  if (load === 'error') return <Card style={{ borderRadius: 18 }}><BlockError onRetry={reload} /></Card>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.textStrong }}>{t.apTabUnclassified}</div>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4, lineHeight: 1.55 }}>{t.apUnclassifiedIntro}</div>
        {groups.length === 0 ? (
          <div style={{ padding: '30px 0 10px', textAlign: 'center', fontSize: 13.5, color: C.textMuted }}>{t.apUnclassifiedEmpty}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {groups.map((g) => {
              const tag = PLATFORM_TO_TAG[g.platform];
              return (
                <div key={`${g.platform}-${g.platformCode}-${g.platformSubcode}-${g.messageSample}`}
                  style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <PlatformTag tag={tag} bg={PLATFORM_BG[tag]} size={28} radius={8} />
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
                      <span style={{ fontFamily: mono, fontWeight: 800, color: C.ink750 }}>
                        {platformDisplayName(g.platform)} · {g.platformCode ?? '?'}{g.platformSubcode ? `/${g.platformSubcode}` : ''}
                      </span>
                      <span style={{ color: C.textMuted }}>
                        {t.apUnclassifiedStats.replace('{n}', String(g.count)).replace('{u}', String(g.affectedUsers))}
                      </span>
                      <span style={{ color: C.textFaint }}>· {t.apLastSeen} {formatDateTimeVN(g.lastSeen?.replace(' ', 'T'))}</span>
                      {g.sampleReferenceCode && <span style={{ fontFamily: mono, color: C.textFaint }}>· {g.sampleReferenceCode}</span>}
                    </div>
                    <pre style={{ margin: '8px 0 0', background: C.surfaceSubtle, borderRadius: 9, padding: '8px 10px', fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: mono, color: C.ink650, maxHeight: 120, overflowY: 'auto' }}>
                      {g.messageSample ?? '—'}
                    </pre>
                  </div>
                  <button
                    onClick={() => openDraft(g)}
                    disabled={!g.platformCode}
                    title={g.platformCode ? undefined : t.apMappingNoCode}
                    className="btn-grad"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: brandGradient, borderRadius: 9, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, color: C.onBrand, cursor: g.platformCode ? 'pointer' : 'not-allowed', opacity: g.platformCode ? 1 : 0.5 }}
                  >
                    <Link2 size={13} strokeWidth={2.2} />
                    {t.apMapAction}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card style={{ borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.textStrong }}>{t.apMappingsTitle}</div>
        {mappings.length === 0 ? (
          <div style={{ padding: '18px 0 4px', fontSize: 13, color: C.textMuted }}>{t.apMappingsEmpty}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {mappings.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: `1px solid ${C.surfaceMuted}`, paddingTop: 8, fontSize: 12.5 }}>
                <span style={{ fontFamily: mono, fontWeight: 800, color: C.ink750 }}>
                  {platformDisplayName(m.platform)} · {m.platformCode}{m.platformSubcode ? `/${m.platformSubcode}` : ''}
                  {m.messagePattern ? ` ~ "${m.messagePattern}"` : ''}
                </span>
                <span aria-hidden style={{ color: C.textFaint }}>→</span>
                <span style={{ fontWeight: 700, color: C.primary }} title={m.errorCode}>{publishErrorCopy(lang, m.errorCode).title}</span>
                <span style={{ color: C.textFaint, flex: 1, minWidth: 120 }}>{m.note ?? ''}{m.updatedByEmail ? ` · ${m.updatedByEmail}` : ''}</span>
                <button
                  onClick={() => removeMapping(m)}
                  disabled={busy}
                  aria-label={t.apMappingDelete}
                  title={t.apMappingDelete}
                  className="btn-soft"
                  style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 8, padding: '5px 8px', color: C.rose, cursor: 'pointer', display: 'inline-flex' }}
                >
                  <Trash2 size={14} strokeWidth={1.9} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {draft && (
        <Modal title={t.apMappingTitle} subtitle={`${platformDisplayName(draft.group.platform)} · ${draft.group.platformCode}`} onClose={() => setDraft(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 700, color: C.textMuted }}>
              {t.apMappingCode}
              <FilterSelect
                value={draft.errorCode}
                onChange={(v) => setDraft({ ...draft, errorCode: v as PublishErrorCode })}
                options={TARGET_CODES.map((c): [string, string] => [c, publishErrorCopy(lang, c).title])}
              />
            </label>
            <div style={{ fontSize: 12, color: C.textSecondary, background: C.surfaceSubtle, borderRadius: 9, padding: '8px 10px', lineHeight: 1.5 }}>
              {publishErrorCopy(lang, draft.errorCode, { platform: platformDisplayName(draft.group.platform) }).why}
            </div>
            {draft.group.platformSubcode && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.ink650 }}>
                <input type="checkbox" checked={draft.useSubcode} onChange={(e) => setDraft({ ...draft, useSubcode: e.target.checked })}
                  style={{ accentColor: C.primary }} />
                {t.apMappingSubcode.replace('{s}', draft.group.platformSubcode)}
              </label>
            )}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 700, color: C.textMuted }}>
              {t.apMappingPattern}
              <input value={draft.messagePattern} maxLength={200} onChange={(e) => setDraft({ ...draft, messagePattern: e.target.value })}
                placeholder={t.apMappingPatternHint} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 700, color: C.textMuted }}>
              {t.apMappingNote}
              <input value={draft.note} maxLength={500} onChange={(e) => setDraft({ ...draft, note: e.target.value })} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.ink650 }}>
              <input type="checkbox" checked={draft.applyToExisting} onChange={(e) => setDraft({ ...draft, applyToExisting: e.target.checked })}
                style={{ accentColor: C.primary }} />
              {t.apMappingApply}
            </label>
            <button
              onClick={saveDraft}
              disabled={busy}
              className="btn-grad"
              style={{ border: 'none', background: brandGradient, borderRadius: 11, padding: '11px 0', fontSize: 14, fontWeight: 700, color: C.onBrand, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}
            >
              {t.apMappingSave}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
