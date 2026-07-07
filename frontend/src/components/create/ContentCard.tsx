import { Eye, Trash2, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon, PlatformTag } from '../ui';
import { PLATFORM_BG } from '../../theme';
import type { ContentListItem } from '../../api/contentCreationService';
import { CONTENT_STATUS_META, aiLabelKey } from './statusMeta';
import { STEP_KEYS } from './WizardStepper';

const tagOfPlatform = (p: string) => (p === 'FACEBOOK' ? 'FB' : p === 'INSTAGRAM' ? 'IG' : 'TH');

/** Card một nội dung ở lớp danh sách: trích caption, nền tảng, trạng thái, brand voice %, ngày cập nhật. */
export default function ContentCard({
  item,
  onView,
  onContinue,
  onDelete,
}: {
  item: ContentListItem;
  onView: () => void;
  onContinue: () => void;
  onDelete: () => void;
}) {
  const { t, lang, brandGradient } = useApp();
  const st = CONTENT_STATUS_META[item.status];
  const updated = new Date(item.updatedAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN');

  const actionBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff',
    borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: '#574f6e', cursor: 'pointer',
  } as const;

  return (
    <div className="lift-card" style={{ background: '#fff', border: '1px solid #efeaf8', borderRadius: 20, padding: 20, boxShadow: '0 18px 38px -34px rgba(80,40,140,.5)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#211c38', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</div>
          <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 5, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.excerpt}</div>
        </div>
        <div style={{ display: 'flex', gap: 5, flex: 'none' }}>
          {item.platforms.map((p) => {
            const tag = tagOfPlatform(p);
            return <PlatformTag key={p} tag={tag} bg={PLATFORM_BG[tag]} size={24} radius={7} fontSize={10} />;
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <span style={{ background: st.bg, color: st.color, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{t[st.labelKey]}</span>
        {/* Nhãn minh bạch AI */}
        {!item.isDraft && (
          <span style={{ background: '#f3edff', color: '#7c3aed', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>✨ {t[aiLabelKey(item.status)]}</span>
        )}
        {item.brandVoice > 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#16a34a' }}>{t.clBrandVoice} {item.brandVoice}%</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#a59fbb' }}>{item.brandName} · {t.clUpdated} {updated}</span>
      </div>

      {/* Bản nháp: cho biết đang dừng ở mốc nào + thanh tiến trình mini 5 mốc */}
      {item.isDraft && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11.5, color: '#8a85a0' }}>
            {t.clDraftStoppedAt}: <span style={{ fontWeight: 700, color: '#574f6e' }}>{t[STEP_KEYS[(item.draftStep ?? 1) - 1]]}</span>
          </div>
          <div style={{ display: 'flex', gap: 3 }} aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} style={{ flex: 1, height: 4, borderRadius: 99, background: n <= (item.draftStep ?? 1) ? brandGradient : '#e7e2f2' }} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        {item.isDraft ? (
          <button onClick={onContinue} className="btn-grad" style={{ ...actionBtn, flex: 1, justifyContent: 'center', border: 'none', background: brandGradient, color: '#fff' }}>
            {t.clContinue}<Icon icon={ArrowRight} size={14} stroke="#fff" />
          </button>
        ) : (
          <button onClick={onView} className="btn-soft" style={{ ...actionBtn, flex: 1, justifyContent: 'center' }}>
            <Icon icon={Eye} size={14} stroke="#574f6e" />{t.clView}
          </button>
        )}
        <button onClick={onDelete} className="btn-soft" aria-label={t.clDelete} style={{ ...actionBtn, color: '#d6336c' }}>
          <Icon icon={Trash2} size={14} stroke="#d6336c" />
        </button>
      </div>
    </div>
  );
}
