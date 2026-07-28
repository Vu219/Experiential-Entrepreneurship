import { useApp } from '../../../context/AppContext';
import { Copy, Eye } from 'lucide-react';
import { DataTable } from '../AdminListPage';
import StatusBadge from '../StatusBadge';
import RowActionsMenu from '../RowActionsMenu';
import { PlatformTag } from '../../ui';
import { PLATFORM_BG } from '../../../theme';
import { AP_PLATFORM_NAME } from './platforms';
import { formatDateVN } from '../../../utils/format';
import { categoryOf, REASON_META, reasonText } from './rejectionReasons';
import type { AdminPostProblem, PostProblemKind } from '../../../api/admin';

// Khối E: bảng danh sách. MỘT bảng dùng cho cả hai tab — chỉ khác cột (tab lỗi hệ thống thay
// "Lý do từ chối" bằng "Nguyên nhân lỗi" + thêm cột số lần thử lại), nên không tách thành hai
// component gần trùng nhau.

/** Ô đầu dòng thay cho ảnh: MVP không sinh ảnh/video (FR-29) nên bài đăng không có thumbnail. */
function PostThumb({ post }: { post: AdminPostProblem }) {
  const letter = (post.content.trim()[0] ?? '#').toUpperCase();
  return (
    <span
      aria-hidden
      style={{
        width: 44, height: 44, flex: 'none', borderRadius: 12,
        background: PLATFORM_BG[post.platform], color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17,
      }}
    >
      {letter}
    </span>
  );
}

/** Tiêu đề = dòng đầu của caption; trích đoạn = phần còn lại. Bài rỗng thì nói thẳng là rỗng. */
function postLines(post: AdminPostProblem, emptyLabel: string): { title: string; excerpt: string } {
  const text = post.content.trim();
  if (!text) {
    return { title: emptyLabel, excerpt: '' };
  }
  const [first, ...rest] = text.split(/\r?\n/);
  return { title: first, excerpt: rest.join(' ').trim() };
}

/** Một dòng, cắt bằng ellipsis — tiêu đề và trích đoạn trong cột "Bài viết" đều dùng cái này. */
const clamp1 = {
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
};

/** Hai dòng — dùng cho ô mô tả lý do (câu thân thiện, không phải chuỗi lỗi thô). */
const clamp2 = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden', textOverflow: 'ellipsis',
};

const cell = { padding: '14px 16px', verticalAlign: 'top' as const };

export default function PostProblemTable({
  kind,
  rows,
  selectedId,
  onToggleDetail,
  onCopyContent,
}: {
  kind: PostProblemKind;
  rows: AdminPostProblem[];
  /** Bài đang mở ở panel chi tiết — hàng tương ứng được tô nổi bật. */
  selectedId: string | null;
  /** BẬT/TẮT panel: bấm lại đúng bài đang xem thì đóng luôn, không cần với tay lên nút ✕. */
  onToggleDetail: (post: AdminPostProblem) => void;
  onCopyContent: (post: AdminPostProblem) => void;
}) {
  const { t } = useApp();
  const isSystem = kind === 'system';

  const head = [
    t.apColPost, t.colPlatform, t.colUser,
    isSystem ? t.apColCause : t.apColReason,
    ...(isSystem ? [t.apColRetry] : []),
    t.colTime, t.colStatus, t.colAction,
  ];

  return (
    <DataTable head={head} minWidth={isSystem ? 1120 : 1020}>
      {rows.map((post) => {
        const meta = REASON_META[categoryOf(post)];
        const { title, excerpt } = postLines(post, t.apNoContent);
        // Parse cả 'YYYY-MM-DDTHH:mm' (giờ ĐỊA PHƯƠNG); nếu chỉ truyền phần ngày thì trình duyệt
        // hiểu là UTC và múi giờ âm sẽ lùi mất một ngày.
        const [, time] = post.date.split(' ');
        const dateLabel = formatDateVN(post.date.replace(' ', 'T'));
        const selected = post.id === selectedId;
        return (
          <tr
            key={post.id}
            onClick={() => onToggleDetail(post)}
            style={{
              borderTop: '1px solid #f1eef8',
              cursor: 'pointer',
              background: selected ? '#f7f4ff' : undefined,
              // Viền trái tím báo hàng đang xem — dùng box-shadow inset vì <tr> không nhận
              // border-left liền mạch khi border-collapse.
              boxShadow: selected ? 'inset 3px 0 0 0 #7c3aed' : undefined,
            }}
          >
            <td style={{ ...cell, minWidth: 260, maxWidth: 320 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <PostThumb post={post} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2b2543', ...clamp1 }}>{title}</div>
                  {excerpt && (
                    <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 2, ...clamp1 }}>{excerpt}</div>
                  )}
                  <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 4, fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>
                    #{post.id.slice(0, 8)}
                  </div>
                </div>
              </div>
            </td>

            <td style={cell}>
              <PlatformTag tag={post.platform} bg={PLATFORM_BG[post.platform]} size={28} radius={999} />
              <span className="sr-only">{AP_PLATFORM_NAME[post.platform]}</span>
            </td>

            <td style={{ ...cell, fontSize: 13, color: '#3f3a55', wordBreak: 'break-word' }}>{post.user}</td>

            <td style={{ ...cell, maxWidth: 300 }}>
              <StatusBadge tone={meta.tone} label={t[meta.labelKey]} />
              <div style={{ fontSize: 12.5, color: '#6b6680', marginTop: 6, lineHeight: 1.5, ...clamp2 }}>
                {reasonText(post, t)}
              </div>
            </td>

            {isSystem && (
              <td style={{ ...cell, fontSize: 12.5, color: '#6b6680', whiteSpace: 'nowrap' }}>
                {post.retryCount === null
                  ? '—'
                  : t.apRetryOf.replace('{n}', String(post.retryCount))}
                <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 3 }}>
                  {post.nextRetryAt ? `${t.apNextRetry} ${post.nextRetryAt.slice(11, 16)}` : t.apRetryExhausted}
                </div>
              </td>
            )}

            <td style={{ ...cell, whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2b2543' }}>{dateLabel}</div>
              <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 2 }}>{time ?? ''}</div>
            </td>

            <td style={cell}>
              <StatusBadge tone={isSystem ? 'warning' : 'danger'} label={isSystem ? t.stSysError : t.stRejected} />
            </td>

            {/* Ô hành động tự xử lý click: nếu để nổi bọt lên <tr> thì bấm menu ⋮ cũng mở panel. */}
            <td style={cell} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => onToggleDetail(post)}
                  aria-expanded={selected}
                  className="btn-soft"
                  style={{
                    border: `1px solid ${selected ? '#c4b5fd' : '#ece8f6'}`,
                    background: selected ? '#f1e9ff' : '#fff', borderRadius: 9, padding: '6px 12px',
                    fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {t.detail}
                </button>
                <RowActionsMenu
                  ariaLabel={t.apRowMenu}
                  actions={[
                    { key: 'detail', label: t.detail, icon: <Eye size={16} strokeWidth={1.8} />, onClick: () => onToggleDetail(post) },
                    { key: 'copy', label: t.apCopyContent, icon: <Copy size={16} strokeWidth={1.8} />, onClick: () => onCopyContent(post) },
                  ]}
                />
              </div>
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
