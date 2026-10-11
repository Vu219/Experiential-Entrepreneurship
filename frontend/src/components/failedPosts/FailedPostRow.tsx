import { memo, type CSSProperties, type KeyboardEvent } from 'react';
import { FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { PlatformTag } from '../ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { TONE_COLORS } from '../../statusTokens.ts';
import { PLATFORM_TO_TAG } from '../../api/connections.ts';
import type { FailedPost } from '../../api/failedPosts.ts';
import {
  platformDisplayName, publishErrorCategoryLabel, publishErrorCopy,
} from '../../api/publishErrorCatalog.ts';
import { fmtDate, fmtTime, STATE_TONE, stateLabel, toneOf } from './shared.ts';
import { C } from '../../styles/colors';

// Một bài lỗi trong danh sách master: variant 'row' (hàng bảng desktop) hoặc 'card' (thẻ dọc trên mobile/tablet).
// Lý do hiển thị = TIÊU ĐỀ THÂN THIỆN theo mã chuẩn (catalog) — không bao giờ là message gốc của nền tảng.
// Callback nhận id (dùng chung cho mọi dòng) để React.memo không bị phá bởi closure mới.

const tdStyle: CSSProperties = { padding: '12px 14px', fontSize: 13, color: C.ink650, verticalAlign: 'middle' };

/** Thumbnail placeholder — MVP không sinh ảnh (FR-29) nên dùng ô icon trung tính. */
function Thumb() {
  return (
    <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 9, background: C.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
      <FileText size={17} color={C.legacyTexta78bfa} strokeWidth={1.8} />
    </span>
  );
}

function StateBadge({ post }: { post: FailedPost }) {
  const { t } = useApp();
  const tone = TONE_COLORS[STATE_TONE[post.state]];
  const progress = post.state === 'AUTO_RETRYING' && post.maxAttempts
    ? ` · ${post.attempt}/${post.maxAttempts}` : '';
  return (
    <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, color: tone.color, background: tone.bg, whiteSpace: 'nowrap' }}>
      {stateLabel(post.state, t)}{progress}
    </span>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      onChange={onChange}
      style={{ width: 16, height: 16, accentColor: C.primary, cursor: 'pointer', flex: 'none' }}
    />
  );
}

function FailedPostRow({
  post,
  selected,
  checked,
  selectable,
  onSelect,
  onToggle,
  variant,
}: {
  post: FailedPost;
  /** Đang mở trong modal chi tiết. */
  selected: boolean;
  /** Đã chọn cho thao tác hàng loạt. */
  checked: boolean;
  selectable: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  variant: 'row' | 'card';
}) {
  const { t, lang } = useApp();
  const tag = PLATFORM_TO_TAG[post.platformName] ?? post.platformName.slice(0, 2);
  const caption = post.caption || t.fpNoCaption;
  const tone = toneOf(post);
  const reason = publishErrorCopy(lang, post.code, {
    platform: platformDisplayName(post.platformName), account: post.accountName,
  }).title;
  const category = publishErrorCategoryLabel(lang, post.category);
  const open = () => onSelect(post.id);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  };

  if (variant === 'card') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={onKey}
        className="row-hover"
        style={{
          border: `1px solid ${selected ? C.legacyBorderc4b5fd : C.border}`,
          borderLeft: `4px solid ${tone.color}`,
          borderRadius: 14, padding: 13,
          background: selected ? C.surfaceMuted : C.surface, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', gap: 9,
          transition: 'background-color 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {selectable && <Checkbox checked={checked} onChange={() => onToggle(post.id)} label={caption} />}
          <Thumb />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink750, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{caption}</div>
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 3 }}>{post.accountName ?? '—'}</div>
          </div>
          <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? C.gray} size={26} radius={8} />
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: tone.color, lineHeight: 1.45 }}>{reason}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StateBadge post={post} />
          <span style={{ fontSize: 11, color: C.textMuted }}>{category}</span>
          <span style={{ fontSize: 11, color: C.textFaint, marginLeft: 'auto' }}>{fmtDate(post.failedAt)} {fmtTime(post.failedAt)}</span>
        </div>
      </div>
    );
  }

  const td: CSSProperties = { ...tdStyle, borderTop: `1px solid ${C.surfaceMuted}` };
  return (
    <tr
      onClick={open}
      tabIndex={0}
      onKeyDown={onKey}
      className="row-hover"
      aria-selected={selected}
      style={{ cursor: 'pointer', background: selected ? C.surfaceMuted : undefined, transition: 'background-color 0.15s ease' }}
    >
      <td style={{ ...td, borderLeft: `4px solid ${tone.color}`, width: selectable ? 44 : 0, paddingRight: 0 }}>
        {selectable && <Checkbox checked={checked} onChange={() => onToggle(post.id)} label={caption} />}
      </td>
      <td style={td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Thumb />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div title={caption} style={{ fontSize: 13, fontWeight: 700, color: C.ink750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{caption}</div>
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.accountName ?? '—'}</div>
          </div>
        </div>
      </td>
      <td style={td}>
        <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? C.gray} size={26} radius={8} />
      </td>
      <td style={td}>
        <div title={reason} style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.45, color: C.ink750, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {reason}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{category}</div>
      </td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink650 }}>{fmtDate(post.failedAt)}</div>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>{fmtTime(post.failedAt)}</div>
      </td>
      <td style={td}>
        <StateBadge post={post} />
      </td>
    </tr>
  );
}

export default memo(FailedPostRow);
