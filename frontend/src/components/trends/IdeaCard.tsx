import { Sparkles, Bookmark, BookmarkCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon, PlatformTag } from '../ui';
import { PLATFORM_BG } from '../../theme';
import { IDEA_STATUS_COLORS, type ContentIdea, type IdeaStatus } from '../../trendsData';
import { Pill } from './filters';

/** 1 thẻ ý tưởng content trong sub-tab "Ý tưởng content". */
export default function IdeaCard({
  idea,
  trendName,
  saved,
  onCreate,
  onToggleSave,
  compact = false,
}: {
  idea: ContentIdea;
  trendName: string;
  saved: boolean;
  onCreate: () => void;
  onToggleSave: () => void;
  /** Tablet: thu gọn padding để 2 cột không bị chật. */
  compact?: boolean;
}) {
  const { t } = useApp();
  const status: IdeaStatus = saved && idea.status === 'new' ? 'saved' : idea.status;
  const statusLabel = { new: t.trStatusNew, used: t.trStatusUsed, saved: t.trStatusSaved } as const;
  const st = IDEA_STATUS_COLORS[status];

  return (
    <Card style={{ padding: compact ? 14 : 18, display: 'flex', flexDirection: 'column', gap: compact ? 10 : 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2b2543', lineHeight: 1.45 }}>{idea.title}</div>
        <Pill text={statusLabel[status]} color={st.color} bg={st.bg} style={{ flex: 'none' }} />
      </div>
      <div style={{ fontSize: 12.5, color: '#8a85a0' }}>
        {t.trFromTrend}: <span style={{ fontWeight: 600, color: '#7c3aed' }}>{trendName}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <PlatformTag tag={idea.platform} bg={PLATFORM_BG[idea.platform]} size={24} radius={7} fontSize={11} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#4b4660', background: '#f4f2fb', border: '1px solid #ece8f6', borderRadius: 8, padding: '4px 10px' }}>{idea.format}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f3edff', borderRadius: 8, padding: '4px 10px' }}>
          {t.trScore}: {idea.score}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button
          type="button"
          onClick={onCreate}
          className="btn-soft"
          style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid #e7d9fb', background: '#f3edff', color: '#6d28d9', fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '9px 12px', cursor: 'pointer' }}
        >
          <Icon icon={Sparkles} size={14} stroke="#6d28d9" />
          {t.trCreateContent}
        </button>
        <button
          type="button"
          onClick={onToggleSave}
          className="btn-outline"
          aria-pressed={status === 'saved'}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', color: status === 'saved' ? '#16a34a' : '#4b4660', fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '9px 12px', cursor: 'pointer' }}
        >
          <Icon icon={status === 'saved' ? BookmarkCheck : Bookmark} size={14} stroke={status === 'saved' ? '#16a34a' : '#4b4660'} />
          {status === 'saved' ? t.trStatusSaved : t.trSaveIdea}
        </button>
      </div>
    </Card>
  );
}
