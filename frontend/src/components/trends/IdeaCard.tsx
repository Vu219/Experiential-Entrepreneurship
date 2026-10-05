import { memo } from 'react';
import { Sparkles, Bookmark, BookmarkCheck, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon, PlatformTag } from '../ui';
import { PLATFORMS, PLATFORM_BG } from '../../theme';
import { IDEA_STATUS_COLORS, type ContentIdea, type IdeaStatus } from '../../trendsData';
import { Pill } from './filters';
import { C } from '../../styles/colors';

/**
 * 1 thẻ ý tưởng content trong sub-tab "Ý tưởng content".
 * memo + callback nhận id/idea (thay vì closure per-card) để danh sách card
 * không render lại hàng loạt khi page đổi state không liên quan.
 */
export default memo(function IdeaCard({
  idea,
  trendName,
  saved,
  onCreate,
  onToggleSave,
  onDetail,
  compact = false,
}: {
  idea: ContentIdea;
  trendName: string;
  saved: boolean;
  onCreate: () => void;
  onToggleSave: (ideaId: string) => void;
  /** Mở modal chi tiết ý tưởng (kèm ngày ghi nhận trend). */
  onDetail: (idea: ContentIdea) => void;
  /** Tablet: thu gọn padding để 2 cột không bị chật. */
  compact?: boolean;
}) {
  const { t } = useApp();
  const status: IdeaStatus = saved && idea.status === 'new' ? 'saved' : idea.status;
  const statusLabel = { new: t.trStatusNew, used: t.trStatusUsed, saved: t.trStatusSaved } as const;
  const st = IDEA_STATUS_COLORS[status];
  const platformName = PLATFORMS.find((p) => p.tag === idea.platform)?.name ?? idea.platform;

  return (
    <Card style={{ padding: compact ? 14 : 18, display: 'flex', flexDirection: 'column', gap: compact ? 10 : 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <button
          type="button"
          onClick={() => onDetail(idea)}
          title={t.trViewDetail}
          style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', fontSize: 14, fontWeight: 700, color: C.ink750, lineHeight: 1.45, cursor: 'pointer' }}
        >
          {idea.title}
        </button>
        <Pill text={statusLabel[status]} color={st.color} bg={st.bg} style={{ flex: 'none' }} />
      </div>
      <div style={{ fontSize: 12.5, color: C.textMuted }}>
        {t.trFromTrend}: <span style={{ fontWeight: 600, color: C.primary }}>{trendName}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <PlatformTag tag={idea.platform} bg={PLATFORM_BG[idea.platform]} size={24} radius={7} fontSize={11} />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.ink650 }}>{platformName}</span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink650, background: C.surfaceMuted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px' }}>{idea.format}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.primary, background: C.primarySoft, borderRadius: 8, padding: '4px 10px' }}>
          {t.trScore}: {idea.score}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button
          type="button"
          onClick={onCreate}
          className="btn-soft"
          style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${C.accentLine}`, background: C.primarySoft, color: C.primaryStrong, fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '9px 12px', cursor: 'pointer' }}
        >
          <Icon icon={Sparkles} size={14} stroke={C.primaryStrong} />
          {t.trCreateContent}
        </button>
        <button
          type="button"
          onClick={() => onToggleSave(idea.id)}
          className="btn-outline"
          aria-pressed={status === 'saved'}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${C.border}`, background: C.surface, color: status === 'saved' ? C.success : C.ink650, fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '9px 12px', cursor: 'pointer' }}
        >
          <Icon icon={status === 'saved' ? BookmarkCheck : Bookmark} size={14} stroke={status === 'saved' ? C.success : C.ink650} />
          {status === 'saved' ? t.trStatusSaved : t.trSaveIdea}
        </button>
        <button
          type="button"
          onClick={() => onDetail(idea)}
          className="btn-outline"
          aria-label={t.trViewDetail}
          title={t.trViewDetail}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, background: C.surface, color: C.ink650, borderRadius: 10, padding: '9px 11px', cursor: 'pointer' }}
        >
          <Icon icon={Eye} size={14} stroke={C.primary} />
        </button>
      </div>
    </Card>
  );
});
