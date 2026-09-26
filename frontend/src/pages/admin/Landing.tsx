import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ExternalLink, RotateCcw, Save, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Loader } from '../../components/ui';
import PageContainer from '../../components/PageContainer';
import StatusBadge from '../../components/admin/StatusBadge';
import ConfirmDialog from '../../components/brand/ConfirmDialog';
import LandingSectionEditor from '../../components/admin/landing/LandingSectionEditor';
import { LandingLinkContext } from '../../components/admin/landing/LandingFields';
import { useToast } from '../../components/toast/ToastProvider';
import { invalidateLandingCache } from '../../hooks/useLandingContent';
import { validateLandingSection } from '../../validations/landingValidation';
import { formatDateTimeVN } from '../../utils/format';
import type { ApiError } from '../../api/apiClient';
import type { Dict } from '../../i18n';
import {
  discardLandingDraft, getAdminLanding, publishAllLanding, publishLandingSection, saveLandingDraft,
  ERR_LANDING_CONTENT_INVALID,
  type LandingContent, type LandingSectionDto, type LandingSectionKey,
} from '../../api/landing';

// Trang admin "Quản lý Landing Page": mỗi tab một section (không gồm "Chọn gói" — đã có Quản lý gói).
// Lưu nháp → landing chưa đổi; Xuất bản (từng tab hoặc tất cả) → landing đổi. Sửa dở giữa các tab
// được giữ trong state; rời trang khi còn tab chưa lưu → trình duyệt hỏi lại.

const TABS: { key: LandingSectionKey; label: keyof Dict }[] = [
  { key: 'hero', label: 'lpTabHero' },
  { key: 'features', label: 'lpTabFeatures' },
  { key: 'how_it_works', label: 'lpTabHowItWorks' },
  { key: 'integrations', label: 'lpTabIntegrations' },
  { key: 'cta', label: 'lpTabCta' },
  { key: 'faq', label: 'lpTabFaq' },
  { key: 'footer', label: 'lpTabFooter' },
];

type Sections = Partial<Record<LandingSectionKey, LandingSectionDto>>;
type Drafts = Partial<{ [K in LandingSectionKey]: LandingContent[K] }>;

const btn = (variant: 'primary' | 'soft' | 'danger', bg: string, disabled: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6, borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
  ...(variant === 'primary' ? { border: 'none', color: '#fff', background: bg }
    : variant === 'danger' ? { border: '1px solid #fbdce7', color: '#d6336c', background: '#fff' }
    : { border: '1px solid #ece8f6', color: '#5b5670', background: '#fff' }),
});

export default function Landing() {
  const { t, brandGradient } = useApp();
  const toast = useToast();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [sections, setSections] = useState<Sections>({});
  const [drafts, setDrafts] = useState<Drafts>({});
  const [errors, setErrors] = useState<Partial<Record<LandingSectionKey, Set<string>>>>({});
  const [tab, setTab] = useState<LandingSectionKey>('hero');
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /** Ghi đè section từ server + đồng bộ bản nháp đang sửa của section đó. */
  const applyServer = useCallback((list: LandingSectionDto[]) => {
    setSections((prev) => ({ ...prev, ...Object.fromEntries(list.map((s) => [s.key, s])) }));
    setDrafts((prev) => ({ ...prev, ...Object.fromEntries(list.map((s) => [s.key, s.draft])) }));
    setErrors((prev) => ({ ...prev, ...Object.fromEntries(list.map((s) => [s.key, new Set<string>()])) }));
  }, []);

  const fetchAll = useCallback(() => {
    setLoad('loading');
    getAdminLanding()
      .then((list) => { applyServer(list); setLoad('ok'); })
      .catch(() => setLoad('error'));
  }, [applyServer]);
  useEffect(() => fetchAll(), [fetchAll]);

  const isDirty = useCallback(
    (key: LandingSectionKey) => !!sections[key] && JSON.stringify(drafts[key]) !== JSON.stringify(sections[key]!.draft),
    [sections, drafts],
  );
  const anyDirty = TABS.some((x) => isDirty(x.key));

  // Rời trang khi còn tab chưa lưu → trình duyệt hỏi xác nhận.
  useEffect(() => {
    if (!anyDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [anyDirty]);

  const failToast = (err: unknown, fallback: string) => {
    const e = err as ApiError;
    toast.error(e.code === ERR_LANDING_CONTENT_INVALID ? t.lpInvalid : e.message || fallback);
  };

  /** Validate + lưu nháp; trả về section đã lưu (hoặc null nếu không hợp lệ / lỗi). */
  const save = async (key: LandingSectionKey): Promise<LandingSectionDto | null> => {
    const content = drafts[key];
    const section = sections[key];
    if (!content || !section) return null;
    const errs = validateLandingSection(key, content);
    setErrors((prev) => ({ ...prev, [key]: errs }));
    if (errs.size > 0) {
      toast.error(t.lpInvalid);
      return null;
    }
    const saved = await saveLandingDraft(key, content, section.version);
    applyServer([saved]);
    return saved;
  };

  const onSave = () => {
    setBusy(true);
    save(tab)
      .then((saved) => { if (saved) toast.success(t.lpSavedToast); })
      .catch((err) => failToast(err, t.lpSaveFail))
      .finally(() => setBusy(false));
  };

  const onPublish = () => {
    setBusy(true);
    (async () => {
      if (isDirty(tab) && !(await save(tab))) return;
      const published = await publishLandingSection(tab);
      applyServer([published]);
      invalidateLandingCache();
      toast.success(t.lpPublishedToast);
    })()
      .catch((err) => failToast(err, t.lpPublishFail))
      .finally(() => setBusy(false));
  };

  const pendingCount = TABS.filter((x) => sections[x.key]?.hasUnpublishedChanges).length;

  const onPublishAll = () => {
    if (anyDirty) {
      toast.warning(t.lpUnsavedOtherTabs);
      return;
    }
    if (pendingCount === 0) {
      toast.info(t.lpNothingToPublish);
      return;
    }
    setBusy(true);
    publishAllLanding()
      .then((list) => {
        applyServer(list);
        invalidateLandingCache();
        toast.success(t.lpPublishedAllToast.replace('{n}', String(pendingCount)));
      })
      .catch((err) => failToast(err, t.lpPublishFail))
      .finally(() => setBusy(false));
  };

  const onDiscard = () => {
    setBusy(true);
    discardLandingDraft(tab)
      .then((saved) => { applyServer([saved]); toast.success(t.lpDiscardedToast); })
      .catch((err) => failToast(err, t.lpSaveFail))
      .finally(() => { setBusy(false); setConfirmDiscard(false); });
  };

  if (load === 'loading') return <PageContainer><Card><Loader label={t.listLoading} /></Card></PageContainer>;
  if (load === 'error') return (
    <PageContainer>
      <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670', marginBottom: 14 }}>{t.listError}</div>
        <button onClick={fetchAll} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </Card>
    </PageContainer>
  );

  const current = sections[tab];
  const dirty = isDirty(tab);
  const content = drafts[tab];

  return (
    <PageContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            const pending = sections[key]?.hasUnpublishedChanges;
            const unsaved = isDirty(key);
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6', background: active ? brandGradient : '#fff', color: active ? '#fff' : '#5b5670', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {t[label]}
                {(unsaved || pending) && (
                  <span
                    title={unsaved ? t.lpUnsaved : t.lpUnpublished}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: unsaved ? '#e25c84' : '#f59e0b', boxShadow: active ? '0 0 0 2px rgba(255,255,255,.8)' : 'none' }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/" target="_blank" rel="noopener noreferrer" style={{ ...btn('soft', brandGradient, false), textDecoration: 'none' }}>
            <ExternalLink size={14} strokeWidth={2.2} /> {t.lpViewSite}
          </a>
          <button onClick={onPublishAll} disabled={busy || pendingCount === 0} style={btn('primary', brandGradient, busy || pendingCount === 0)}>
            <Send size={14} strokeWidth={2.2} /> {t.lpPublishAll}{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        </div>
      </div>

      {current && content && (
        <Card style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid #f0ecf8' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {dirty && <StatusBadge tone="danger" label={t.lpUnsaved} />}
                <StatusBadge tone={current.hasUnpublishedChanges ? 'warning' : 'success'} label={current.hasUnpublishedChanges ? t.lpUnpublished : t.lpPublished} />
              </div>
              <div style={{ fontSize: 12, color: '#8a85a0' }}>
                {t.lpLastPublished}: {formatDateTimeVN(current.publishedAt)}{current.publishedBy ? ` ${t.lpBy} ${current.publishedBy}` : ''}
                {current.updatedBy && <> · {t.lpLastSaved}: {formatDateTimeVN(current.updatedAt)} {t.lpBy} {current.updatedBy}</>}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {current.hasUnpublishedChanges && (
                <button onClick={() => setConfirmDiscard(true)} disabled={busy} style={btn('danger', brandGradient, busy)}>
                  <RotateCcw size={14} strokeWidth={2.2} /> {t.lpDiscard}
                </button>
              )}
              <button onClick={onSave} disabled={busy || !dirty} style={btn('soft', brandGradient, busy || !dirty)}>
                <Save size={14} strokeWidth={2.2} /> {t.lpSaveDraft}
              </button>
              <button onClick={onPublish} disabled={busy || (!dirty && !current.hasUnpublishedChanges)} style={btn('primary', brandGradient, busy || (!dirty && !current.hasUnpublishedChanges))}>
                <Send size={14} strokeWidth={2.2} /> {t.lpPublish}
              </button>
            </div>
          </div>

          {/* Email ở tab Footer (kể cả đang sửa dở) làm gợi ý "mailto:" cho mọi ô link. */}
          <LandingLinkContext.Provider value={{ contactEmail: drafts.footer?.email ?? '' }}>
            <LandingSectionEditor
              sectionKey={tab}
              value={content}
              onChange={(v) => setDrafts((prev) => ({ ...prev, [tab]: v }))}
              errors={errors[tab] ?? new Set()}
            />
          </LandingLinkContext.Provider>
        </Card>
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title={t.lpDiscardTitle}
          message={t.lpDiscardMsg}
          confirmLabel={t.lpDiscard}
          variant="warning"
          busy={busy}
          onConfirm={onDiscard}
          onClose={() => setConfirmDiscard(false)}
        />
      )}
    </PageContainer>
  );
}
