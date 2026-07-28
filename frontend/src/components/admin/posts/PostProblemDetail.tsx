import { useState } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import Drawer, { type DrawerVariant } from '../../Drawer';
import { formatDateTimeVN } from '../../../utils/format';
import StatusBadge from '../StatusBadge';
import { Icon, PlatformTag } from '../../ui';
import { PLATFORM_BG } from '../../../theme';
import { AP_PLATFORM_NAME } from './platforms';
import { categoryOf, REASON_META, reasonText, violationBullets } from './rejectionReasons';
import type { AdminPostProblem } from '../../../api/admin';

// Khối F: panel chi tiết bài viết. Vỏ là Drawer dùng chung; component này chỉ lo NỘI DUNG.
//
// Hai chỗ lệch có chủ đích so với ảnh thiết kế, đã chốt trước khi làm:
//  - "Đề xuất từ AI" là đoạn hướng dẫn TĨNH theo phân loại (REASON_META.adviceKey), KHÔNG gọi AI
//    và không có nút "Xem gợi ý chỉnh sửa" vì nút đó chưa dẫn tới đâu.
//  - Chỉ còn "Sao chép nội dung"; "Chỉnh sửa & gửi lại" và "Xóa bài viết" bị ẩn vì backend chưa
//    có endpoint admin cho hai hành động đó — thà không hiện còn hơn hiện nút bấm không làm gì.

const sectionLabel = {
  fontSize: 12, fontWeight: 700, color: '#a59fbb', marginBottom: 8, marginTop: 20,
} as const;

const CAPTION_CLAMP_LINES = 4;

export default function PostProblemDetail({
  post,
  variant,
  width,
  stickyTop,
  stickyMaxHeight,
  onClose,
  onCopyContent,
}: {
  post: AdminPostProblem;
  variant: DrawerVariant;
  width?: number;
  stickyTop?: number;
  stickyMaxHeight?: string;
  onClose: () => void;
  onCopyContent: (post: AdminPostProblem) => void;
}) {
  const { t } = useApp();
  const meta = REASON_META[categoryOf(post)];
  const bullets = violationBullets(post);
  const isSystem = post.kind === 'system';
  const caption = post.content.trim();
  const [captionOpen, setCaptionOpen] = useState(false);

  return (
    <Drawer
      title={t.apDrawerTitle}
      variant={variant}
      width={width}
      stickyTop={stickyTop}
      stickyMaxHeight={stickyMaxHeight}
      closeLabel={t.close}
      icon={<Icon icon={Sparkles} size={16} stroke="#8b5cf6" />}
      onClose={onClose}
      footer={
        <button
          onClick={() => onCopyContent(post)}
          disabled={!post.content.trim()}
          className="btn-soft"
          style={{
            width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            border: '1px solid #ece8f6', background: '#fff', borderRadius: 11, padding: '11px 0',
            fontSize: 13.5, fontWeight: 700, cursor: post.content.trim() ? 'pointer' : 'default',
            color: post.content.trim() ? '#5b5670' : '#c4bdd6',
          }}
        >
          <Copy size={15} strokeWidth={1.8} />
          {t.apCopyContent}
        </button>
      }
    >
      {/* Đầu panel: nhận diện bài viết */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span
          aria-hidden
          style={{
            width: 46, height: 46, flex: 'none', borderRadius: 13, background: PLATFORM_BG[post.platform],
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19,
          }}
        >
          {(caption[0] ?? '#').toUpperCase()}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: '#211c38', lineHeight: 1.45,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {caption ? caption.split(/\r?\n/)[0] : t.apNoContent}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, fontSize: 12, color: '#8a85a0' }}>
            <span style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>#{post.id.slice(0, 8)}</span>
            <span aria-hidden>·</span>
            <PlatformTag tag={post.platform} bg={PLATFORM_BG[post.platform]} size={18} radius={999} />
            {AP_PLATFORM_NAME[post.platform]}
          </div>
          <div style={{ fontSize: 12, color: '#a59fbb', marginTop: 3 }}>
            {formatDateTimeVN(post.date.replace(' ', 'T'))}
          </div>
        </div>
      </div>

      {/* Nội dung bài: mặc định gói 4 dòng, bấm "Xem thêm" mới xổ hết. */}
      {caption && (
        <>
          <div style={sectionLabel}>{t.postContent}</div>
          <div style={{
            fontSize: 13, color: '#574f6e', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            ...(captionOpen ? {} : {
              display: '-webkit-box',
              WebkitLineClamp: CAPTION_CLAMP_LINES,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }),
          }}>
            {caption}
          </div>
          <button
            onClick={() => setCaptionOpen((v) => !v)}
            style={{
              border: 'none', background: 'transparent', padding: '6px 0 0', fontSize: 12.5,
              fontWeight: 700, color: '#7c3aed', cursor: 'pointer',
            }}
          >
            {captionOpen ? t.apSeeLess : t.apSeeMore}
          </button>
        </>
      )}

      <div style={sectionLabel}>{t.colStatus}</div>
      <StatusBadge tone={isSystem ? 'warning' : 'danger'} label={isSystem ? t.stSysError : t.stRejected} />

      <div style={sectionLabel}>{isSystem ? t.apColCause : t.apDrawerReason}</div>
      <StatusBadge tone={meta.tone} label={t[meta.labelKey]} />
      <div style={{ fontSize: 13, color: '#574f6e', lineHeight: 1.6, marginTop: 8 }}>{reasonText(post, t)}</div>

      {bullets.length > 1 && (
        <>
          <div style={sectionLabel}>{t.apViolationDetail}</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bullets.map((line, i) => (
              <li key={i} style={{ fontSize: 12.5, color: '#574f6e', lineHeight: 1.55 }}>{line}</li>
            ))}
          </ul>
        </>
      )}

      {/* Phản hồi gốc của nền tảng — nguồn sự thật, để admin đối chiếu khi cần */}
      <div style={sectionLabel}>{t.postPlatformErr}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{
          fontSize: 11.5, fontWeight: 800, fontFamily: 'ui-monospace,Menlo,Consolas,monospace',
          color: '#6b5ca8', background: '#f3f0fa', borderRadius: 7, padding: '3px 9px',
        }}>
          {t.apErrCode} {post.errorCode ?? '—'}
        </span>
        {isSystem && post.retryCount !== null && (
          <span style={{ fontSize: 12, color: '#8a85a0' }}>
            {t.apColRetry}: {t.apRetryOf.replace('{n}', String(post.retryCount))}
            {post.nextRetryAt
              ? ` · ${t.apNextRetry} ${formatDateTimeVN(post.nextRetryAt.replace(' ', 'T'))}`
              : ` · ${t.apRetryExhausted}`}
          </span>
        )}
      </div>
      <pre style={{
        margin: 0, background: '#1f1b2e', color: '#ffd9d9', borderRadius: 10, padding: '12px 14px',
        fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: 'ui-monospace,Menlo,Consolas,monospace',
      }}>
        {post.errorMessage ?? '—'}
      </pre>

      <div style={sectionLabel}>{t.apAiAdvice}</div>
      <div style={{ display: 'flex', gap: 10, background: '#f7f4ff', borderRadius: 12, padding: '12px 14px' }}>
        <Icon icon={Sparkles} size={15} stroke="#7c3aed" />
        <div style={{ fontSize: 12.5, color: '#574f6e', lineHeight: 1.6, minWidth: 0 }}>{t[meta.adviceKey]}</div>
      </div>
    </Drawer>
  );
}
