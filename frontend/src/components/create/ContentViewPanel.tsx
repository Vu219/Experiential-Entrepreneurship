import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Layers, Pencil, Save, Send, Undo2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, Icon, cardStyle } from '../ui';
import type { ApiError } from '../../api/apiClient';
import { type ContentLifecycle, ERR_TOKEN_QUOTA_EXCEEDED } from '../../api/contentGeneration';
import {
  getContentDetail,
  saveVersionEdit,
  changeContentStatus,
  formatContent,
  emptyScript,
  type ContentListItem,
  type ContentVersion,
} from '../../api/contentCreationService';
import { useScriptRegen } from './useScriptRegen';
import { listAllBrandProfiles, type Platform } from '../../api/brandProfile';
import type { Dict } from '../../i18n';
import PlatformTabs from './PlatformTabs';
import { VersionTabs, ScriptView, ContentFieldsView, MediaPromptView, type VersionTab } from './VersionContent';
import ScriptSections from './ScriptSections';
import SourceInfoCard, { type SourceInfoData } from './SourceInfoCard';
import PostImagePreview from './PostImagePreview';
import BrandVoicePanel from './BrandVoicePanel';
import { CaptionCounter, HashtagCounter, parseHashtags } from './platformLimits';
import { ContentViewSkeleton } from './CreateSkeleton';
import { CONTENT_STATUS_META, aiLabelKey } from './statusMeta';
import StatusBadge from '../admin/StatusBadge';
import { TONE_COLORS } from '../../statusTokens';
import { useToast } from '../toast/ToastProvider';

// FR-33: chỉ sửa được trước khi vào pipeline đăng (khớp EDITABLE_STATUSES backend).
const EDITABLE_STATUSES: ContentLifecycle[] = ['DRAFT', 'GENERATED', 'NEED_REVIEW', 'APPROVED'];

// FR-40..FR-46: "Định dạng lại theo nền tảng" — khớp FORMATTABLE_STATUSES backend.
const FORMATTABLE_STATUSES: ContentLifecycle[] = ['GENERATED', 'APPROVED', 'FORMATTED'];

// FR-34: action đổi trạng thái theo review flow — chỉ đưa ra bước hợp lệ kế tiếp của
// state machine (REVIEW_TRANSITIONS backend): Gửi duyệt / Duyệt / Trả về sửa.
const statusActions = (s: ContentLifecycle): { target: ContentLifecycle; labelKey: keyof Dict; icon: typeof Send; primary: boolean }[] => {
  if (s === 'DRAFT' || s === 'GENERATED') return [{ target: 'NEED_REVIEW', labelKey: 'cvSubmitReview', icon: Send, primary: true }];
  if (s === 'NEED_REVIEW')
    return [
      { target: 'APPROVED', labelKey: 'cvApprove', icon: CheckCircle2, primary: true },
      { target: 'GENERATED', labelKey: 'cvReturnEdit', icon: Undo2, primary: false },
    ];
  return [];
};

const label = { display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 8 } as const;
const inputBase = {
  width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '11px 14px',
  fontSize: 13.5, lineHeight: 1.55, color: '#241f3a', background: '#fbfaff', outline: 'none',
} as const;

// Bản sao sâu một version để sửa cục bộ (draft) — không đụng bản đang hiển thị.
const cloneVersion = (v: ContentVersion): ContentVersion => ({
  ...v,
  script: { ...v.script, hook: { ...v.script.hook }, cta: { ...v.script.cta }, steps: v.script.steps.map((s) => ({ ...s })) },
});

/** Xem nội dung FULL-PAGE thay bảng — mỗi nền tảng một version, 3 sub-tab + sửa tại chỗ + đổi trạng thái. */
export default function ContentViewPanel({
  item,
  onClose,
  onChanged,
  startInEdit = false,
}: {
  item: ContentListItem;
  onClose: () => void;
  /** Gọi sau mỗi thay đổi thành công (sửa/đổi trạng thái) để danh sách phía sau refresh. */
  onChanged?: () => void;
  /** Mở thẳng chế độ sửa (nút "Sửa" ở bảng danh sách) — chỉ khi trạng thái còn sửa được. */
  startInEdit?: boolean;
}) {
  const { t, brandGradient } = useApp();
  const toast = useToast();
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [platform, setPlatform] = useState<Platform>(item.platforms[0]);
  const [status, setStatus] = useState<ContentLifecycle>(item.status);
  const [tab, setTab] = useState<VersionTab>('script');
  // Chế độ sửa: draft = bản sao đang sửa của version hiện tại (null = đang xem read-only).
  const [draft, setDraft] = useState<ContentVersion | null>(null);
  const [hashtagText, setHashtagText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  // FR-40..FR-46: "Định dạng lại theo nền tảng" — mở lại job format cho bài đã có (PA2-a).
  const [formatBusy, setFormatBusy] = useState(false);
  // Thông tin nguồn (rút gọn) cho màn xem: brand + nền tảng có sẵn từ item; ngành hàng/logo
  // enrich best-effort từ hồ sơ thương hiệu (chi tiết này không mang strategy/trend nên các
  // dòng đó bị ẩn — SourceInfoCard tự ẩn dòng thiếu dữ liệu).
  const [srcInfo, setSrcInfo] = useState<SourceInfoData>({ brandName: item.brandName, platforms: item.platforms });
  const st = CONTENT_STATUS_META[status];

  useEffect(() => {
    let cancelled = false;
    listAllBrandProfiles()
      .then((bs) => {
        if (cancelled) return;
        const b = bs.find((x) => x.id === item.brandId);
        if (b) setSrcInfo({ brandName: b.brandName, logoUrl: b.logoUrl, industry: b.industry, platforms: item.platforms });
      })
      .catch(() => { /* best-effort: giữ brandName + nền tảng từ item */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    let cancelled = false;
    getContentDetail(item.id)
      .then(({ item: it, versions: vs }) => {
        if (cancelled) return;
        setVersions(vs);
        setStatus(it.status);
        setLoad('ok');
        // Nút "Sửa" ở bảng danh sách → vào thẳng chế độ sửa của nền tảng đầu tiên.
        if (startInEdit && EDITABLE_STATUSES.includes(it.status)) {
          const v = vs.find((x) => x.platform === item.platforms[0]) ?? vs[0];
          if (v) { setDraft(cloneVersion(v)); setHashtagText(v.hashtags.join(' ')); }
        }
      })
      .catch(() => { if (!cancelled) setLoad('error'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const version = versions.find((v) => v.platform === platform) ?? versions[0] ?? null;
  const shown = draft ?? version; // đang sửa thì mọi panel (voice/preview) phản ánh bản nháp
  const editable = EDITABLE_STATUSES.includes(status) && !!version;
  // Tạo lại từng phần kịch bản (chỉ khi đang sửa bản nháp) — patch merge vào draft mới nhất.
  const regen = useScriptRegen(item.id, draft?.id, draft?.script ?? emptyScript(), (s) =>
    setDraft((d) => (d ? { ...d, script: s } : d)),
  );

  const startEdit = () => {
    if (!version) return;
    setDraft(cloneVersion(version));
    setHashtagText(version.hashtags.join(' '));
  };
  const cancelEdit = () => setDraft(null);

  const saveEdit = async () => {
    if (!draft || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await saveVersionEdit(item.id, draft);
      setVersions(res.versions);
      setStatus(res.item.status); // APPROVED bị sửa → backend tự hạ về NEED_REVIEW
      setDraft(null);
      onChanged?.();
    } catch (e) {
      toast.error(`${t.cvEditError}: ${(e as ApiError).message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // FR-40..FR-46: định dạng lại theo nền tảng (job format thật). Xong thì nạp lại versions + status.
  const doFormat = async () => {
    if (formatBusy) return;
    setFormatBusy(true);
    try {
      await formatContent(item.id, item.platforms);
      const { item: it, versions: vs } = await getContentDetail(item.id);
      setVersions(vs);
      setStatus(it.status);
      toast.success(t.cvReformatDone);
      onChanged?.();
    } catch (e) {
      const err = e as ApiError;
      toast.error(err.code === ERR_TOKEN_QUOTA_EXCEEDED ? t.cwFormatQuota : err.message || t.cvReformatError);
    } finally {
      setFormatBusy(false);
    }
  };

  const applyStatus = async (target: ContentLifecycle) => {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      const res = await changeContentStatus(item.id, target);
      setStatus(res.status);
      onChanged?.();
    } catch (e) {
      toast.error(`${t.cvStatusError}: ${(e as ApiError).message}`);
    } finally {
      setStatusBusy(false);
    }
  };

  const editForm = draft && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {tab === 'script' && (
        <>
          <ScriptSections
            script={draft.script}
            editable
            onChange={(script) => setDraft({ ...draft, script })}
            onRegenerateSection={regen.onRegenerateSection}
            onRegenerateScene={regen.onRegenerateScene}
            onRegenerateStep={regen.onRegenerateStep}
            regenerating={regen.regenerating}
          />
        </>
      )}
      {tab === 'content' && (
        <div>
          <label style={label}>{t.cwTabCaption}</label>
          <textarea value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} style={{ ...inputBase, resize: 'vertical', minHeight: 90 }} />
          <CaptionCounter platform={draft.platform} text={draft.caption} />
          <label style={{ ...label, marginTop: 16 }}>{t.cwTabHashtag}</label>
          <input
            value={hashtagText}
            onChange={(e) => { setHashtagText(e.target.value); setDraft({ ...draft, hashtags: parseHashtags(e.target.value) }); }}
            placeholder={t.cwHashtagHint}
            style={inputBase}
          />
          <HashtagCounter platform={draft.platform} count={draft.hashtags.length} />
          <label style={{ ...label, marginTop: 16 }}>{t.cwTabCta}</label>
          <textarea value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} style={{ ...inputBase, resize: 'vertical', minHeight: 56 }} />
        </div>
      )}
      {tab === 'media' && (
        <div>
          <label style={label}>{t.cwTabMedia}</label>
          <textarea value={draft.mediaPrompt} onChange={(e) => setDraft({ ...draft, mediaPrompt: e.target.value })} style={{ ...inputBase, resize: 'vertical', minHeight: 90 }} />
        </div>
      )}
    </div>
  );

  // Cụm nút hành động gom chung: edit (Sửa/Hủy/Lưu) + status (Gửi duyệt/Duyệt/Trả về sửa).
  const actionButtons = load === 'ok' && (
    <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
      {/* FR-33: sửa tại chỗ — nút Sửa / Hủy+Lưu */}
      {editable && (
        draft ? (
          <>
            <button
              disabled={savingEdit}
              onClick={cancelEdit}
              className="btn-soft"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, color: '#574f6e', cursor: savingEdit ? 'not-allowed' : 'pointer', opacity: savingEdit ? 0.6 : 1 }}
            >
              <Icon icon={X} size={13} stroke="#574f6e" />{t.cvEditCancel}
            </button>
            <button
              disabled={savingEdit}
              onClick={saveEdit}
              className="btn-grad"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, color: '#fff', background: brandGradient, cursor: savingEdit ? 'not-allowed' : 'pointer', opacity: savingEdit ? 0.6 : 1 }}
            >
              <Icon icon={Save} size={13} stroke="#fff" />{savingEdit ? t.cvEditSaving : t.cvEditSave}
            </button>
          </>
        ) : (
          <button
            onClick={startEdit}
            className="btn-soft"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}
          >
            <Icon icon={Pencil} size={13} stroke="#7c3aed" />{t.cvEdit}
          </button>
        )
      )}
      {/* FR-40..FR-46: định dạng lại theo nền tảng — ẩn khi đang sửa; chỉ khi bài ở trạng thái format được */}
      {!draft && FORMATTABLE_STATUSES.includes(status) && (
        <button
          onClick={doFormat}
          disabled={formatBusy}
          className="btn-soft"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: formatBusy ? 'not-allowed' : 'pointer', opacity: formatBusy ? 0.6 : 1 }}
        >
          <Icon icon={Layers} size={13} stroke="#7c3aed" />{formatBusy ? t.cvReformatting : t.cvReformat}
        </button>
      )}
      {/* FR-34: bước hợp lệ kế tiếp của review flow — ẩn khi đang sửa để tránh đổi trạng thái giữa chừng */}
      {!draft && statusActions(status).map(({ target, labelKey, icon, primary }) => (
        <button
          key={target}
          disabled={statusBusy}
          onClick={() => applyStatus(target)}
          className={primary ? 'btn-grad' : 'btn-soft'}
          style={primary
            ? { display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, color: '#fff', background: brandGradient, cursor: statusBusy ? 'not-allowed' : 'pointer', opacity: statusBusy ? 0.6 : 1 }
            : { display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, color: '#574f6e', cursor: statusBusy ? 'not-allowed' : 'pointer', opacity: statusBusy ? 0.6 : 1 }}
        >
          <Icon icon={icon} size={14} stroke={primary ? '#fff' : '#574f6e'} />{t[labelKey]}
        </button>
      ))}
    </div>
  );

  const ai = TONE_COLORS.ai;

  return (
    <div className="view-pop" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header 2 TẦNG là MỘT CARD riêng (cùng token với các card khác: bo góc 20, bóng nhẹ),
          sticky đầu trang, tách khỏi vùng nội dung bởi gap của container — không dính liền. */}
      <div style={{ ...cardStyle, position: 'sticky', top: 8, zIndex: 20, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button onClick={onClose} className="btn-soft" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 11px', fontSize: 12.5, fontWeight: 700, color: '#574f6e', cursor: 'pointer' }}>
            <Icon icon={ArrowLeft} size={14} stroke="#574f6e" />{t.bpBack}
          </button>
          <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, minWidth: 0, whiteSpace: 'nowrap' }}>
            <button onClick={onClose} className="link-underline" style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 12, fontWeight: 600, color: '#8a85a0', cursor: 'pointer' }}>
              {t.navCreate}
            </button>
            <span aria-hidden style={{ color: '#c4bdd6' }}>/</span>
            <span style={{ fontWeight: 700, color: '#574f6e' }}>{t.cvBreadcrumbDetail}</span>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18, color: '#211c38', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>
              <StatusBadge tone={st.tone} label={t[st.labelKey]} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: ai.bg, color: ai.color, borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>✨ {t[aiLabelKey(status)]}</span>
            </div>
          </div>
          {actionButtons}
        </div>
      </div>
      {load === 'loading' ? (
        <ContentViewSkeleton />
      ) : load === 'error' ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: '#8a85a0', fontSize: 14 }}>{t.listError}</div>
      ) : shown ? (
        <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.2fr .9fr', gap: 16, alignItems: 'start' }}>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <PlatformTabs platforms={item.platforms} value={shown.platform} onChange={(p) => { if (!draft) setPlatform(p); }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <VersionTabs value={tab} onChange={setTab} />
            </div>
            {draft ? editForm : (
              <>
                {tab === 'script' && <ScriptView version={shown} />}
                {tab === 'content' && <ContentFieldsView version={shown} />}
                {tab === 'media' && <MediaPromptView version={shown} />}
              </>
            )}
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: stacked ? 'static' : 'sticky', top: 80 }}>
            {/* Thông tin nguồn (rút gọn) — mặc định thu gọn vì đây là màn xem/duyệt */}
            <SourceInfoCard info={srcInfo} defaultOpen={false} />
            <BrandVoicePanel check={shown.brandVoice} />
            <PostImagePreview version={shown} brandName={item.brandName} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
