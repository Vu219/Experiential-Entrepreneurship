import { Bookmark, BookmarkCheck, CalendarDays, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Modal from '../Modal';
import { Icon, PlatformTag } from '../ui';
import { PLATFORMS, PLATFORM_BG } from '../../theme';
import { IDEA_STATUS_COLORS, type ContentIdea, type IdeaStatus, type TrendItem } from '../../trendsData';
import { Pill } from './filters';
import { C } from '../../styles/colors';

const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } as const;
const labelStyle = { fontSize: 12.5, color: C.textMuted, fontWeight: 600 } as const;
const valueStyle = { fontSize: 13, fontWeight: 700, color: C.ink750, textAlign: 'right' } as const;

/**
 * Chi tiết một ý tưởng content: trend gốc + ngày ghi nhận trend, nền tảng (logo thật),
 * định dạng, điểm phù hợp, mô tả (dữ liệu thật có ideaDescription; mock hiện fallback).
 */
export default function IdeaDetailModal({
  idea,
  trend,
  trendDate,
  saved,
  onClose,
  onCreate,
  onToggleSave,
}: {
  idea: ContentIdea;
  trend: TrendItem | null;
  /** Ngày ghi nhận trend — từ researchTime của phiên (live) hoặc phiên mock gần nhất. */
  trendDate: string;
  saved: boolean;
  onClose: () => void;
  onCreate: () => void;
  onToggleSave: () => void;
}) {
  const { t } = useApp();
  const status: IdeaStatus = saved && idea.status === 'new' ? 'saved' : idea.status;
  const statusLabel = { new: t.trStatusNew, used: t.trStatusUsed, saved: t.trStatusSaved } as const;
  const st = IDEA_STATUS_COLORS[status];
  const platformName = PLATFORMS.find((p) => p.tag === idea.platform)?.name ?? idea.platform;

  return (
    <Modal title={t.trIdeaDetail} onClose={onClose} maxWidth={480} animateScale>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Tiêu đề + trạng thái */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.textStrong, lineHeight: 1.45 }}>{idea.title}</div>
          <Pill text={statusLabel[status]} color={st.color} bg={st.bg} style={{ flex: 'none' }} />
        </div>

        {/* Trend gốc */}
        {trend && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px' }}>
            <span aria-hidden style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: trend.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{trend.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.trFromTrend}: {trend.name}
              </div>
              <div style={{ fontSize: 12, color: C.primary, fontWeight: 600 }}>{trend.hashtag}</div>
            </div>
          </div>
        )}

        {/* Thuộc tính */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={rowStyle}>
            <span style={labelStyle}>{t.trPlatform}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <PlatformTag tag={idea.platform} bg={PLATFORM_BG[idea.platform]} size={22} radius={7} fontSize={10} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.ink750 }}>{platformName}</span>
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t.trFormatLabel}</span>
            <span style={valueStyle}>{idea.format}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t.trScore}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.primary, background: C.primarySoft, borderRadius: 8, padding: '4px 10px' }}>{idea.score}/100</span>
          </div>
          <div style={rowStyle}>
            <span style={{ ...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon icon={CalendarDays} size={13} stroke={C.textMuted} />
              {t.trTrendDate}
            </span>
            <span style={valueStyle}>{trendDate}</span>
          </div>
        </div>

        {/* Mô tả */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6 }}>{t.trIdeaDescLabel}</div>
          <div style={{ fontSize: 13, color: idea.desc ? C.ink650 : C.ink350, lineHeight: 1.6, background: C.surfaceSubtle, border: `1px solid ${C.surfaceMuted}`, borderRadius: 12, padding: '10px 12px' }}>
            {idea.desc ?? (trend ? `${t.trNoDesc} ${trend.desc}` : t.trNoDesc)}
          </div>
        </div>

        {/* Hành động */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCreate}
            className="btn-grad"
            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', background: 'var(--brand)', color: C.onBrand, fontWeight: 700, fontSize: 13, borderRadius: 11, padding: '10px 14px', cursor: 'pointer' }}
          >
            <Icon icon={Sparkles} size={14} stroke={C.onBrand} />
            {t.trCreateContent}
          </button>
          <button
            type="button"
            onClick={onToggleSave}
            className="btn-outline"
            aria-pressed={status === 'saved'}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${C.border}`, background: C.surface, color: status === 'saved' ? C.success : C.ink650, fontWeight: 700, fontSize: 13, borderRadius: 11, padding: '10px 14px', cursor: 'pointer' }}
          >
            <Icon icon={status === 'saved' ? BookmarkCheck : Bookmark} size={14} stroke={status === 'saved' ? C.success : C.ink650} />
            {status === 'saved' ? t.trStatusSaved : t.trSaveIdea}
          </button>
        </div>
      </div>
    </Modal>
  );
}
