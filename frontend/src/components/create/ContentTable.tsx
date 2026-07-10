import { ArrowRight, Eye, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon, PlatformTag } from '../ui';
import { PLATFORM_BG } from '../../theme';
import { DataTable } from '../admin/AdminListPage';
import RowActionsMenu from '../admin/RowActionsMenu';
import StatusBadge from '../admin/StatusBadge';
import type { ContentLifecycle } from '../../api/contentGeneration';
import type { ContentListItem } from '../../api/contentCreationService';
import { CONTENT_STATUS_META } from './statusMeta';
import { STEP_KEYS } from './WizardStepper';
import { tagOfPlatform } from './PlatformTabs';

// FR-33: trạng thái còn sửa tại chỗ được (khớp EDITABLE_STATUSES của ContentViewPanel/backend).
const EDITABLE_STATUSES: ContentLifecycle[] = ['DRAFT', 'GENERATED', 'NEED_REVIEW', 'APPROVED'];

/**
 * Bước hiện tại của bài trên hành trình 5 mốc (cột "Tiến trình"):
 * - Bản nháp wizard → đúng mốc đang dừng (auto-save).
 * - GENERATED (kể cả bị "Trả về sửa") → mốc 3 Chỉnh sửa; NEED_REVIEW/APPROVED/FORMATTED →
 *   mốc 4 Duyệt & Lưu; từ SCHEDULED trở đi → mốc 5 Lên lịch/đăng.
 */
function progressStep(item: ContentListItem): number {
  if (item.isDraft) return item.draftStep ?? 1;
  if (item.status === 'GENERATED') return 3;
  if (item.status === 'NEED_REVIEW' || item.status === 'APPROVED' || item.status === 'FORMATTED') return 4;
  return 5;
}

const iconBtn = {
  width: 32, height: 32, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, cursor: 'pointer',
} as const;

/** Stepper mini 5 chấm + nhãn "n/5 · Tên mốc"; hover (title) liệt kê đủ 5 mốc. */
function ProgressCell({ item }: { item: ContentListItem }) {
  const { t, brandGradient } = useApp();
  const step = progressStep(item);
  const tooltip = STEP_KEYS.map((k, i) => `${i + 1}. ${t[k]}`).join('\n');
  return (
    <div title={tooltip} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 96 }}>
      <div style={{ display: 'flex', gap: 3 }} aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} style={{ width: 14, height: 5, borderRadius: 99, background: n <= step ? brandGradient : '#e7e2f2' }} />
        ))}
      </div>
      <span style={{ fontSize: 11.5, color: '#8a85a0', whiteSpace: 'nowrap' }}>
        {step}/5 · <span style={{ fontWeight: 700, color: '#574f6e' }}>{t[STEP_KEYS[step - 1]]}</span>
      </span>
    </div>
  );
}

/**
 * Bảng danh sách nội dung (lớp 1 — thay lưới card): mỗi bài một HÀNG với đủ cột
 * # / Nội dung / Nền tảng / Nguồn / Cập nhật / Tiến trình / Trạng thái / Thao tác,
 * checkbox chọn nhiều dòng cho thao tác hàng loạt. Cuộn ngang trên màn hẹp (DataTable).
 * KHÔNG có cột "Loại nội dung": mỗi bài là một GÓI Script + Caption + Hashtag + Media
 * prompt cho nhiều nền tảng — một cột loại đơn giá trị sẽ luôn giống nhau, vô nghĩa.
 */
export default function ContentTable({
  items,
  pageOffset,
  selected,
  onToggle,
  onToggleAll,
  onView,
  onEdit,
  onContinue,
  onDelete,
}: {
  items: ContentListItem[];
  /** Số thứ tự bắt đầu của trang hiện tại (cột #). */
  pageOffset: number;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onView: (item: ContentListItem) => void;
  onEdit: (item: ContentListItem) => void;
  onContinue: (item: ContentListItem) => void;
  onDelete: (item: ContentListItem) => void;
}) {
  const { t, lang, brandGradient } = useApp();
  const allChecked = items.length > 0 && items.every((it) => selected.has(it.id));
  const someChecked = items.some((it) => selected.has(it.id));
  const checkbox = { width: 15, height: 15, accentColor: '#8b5cf6', cursor: 'pointer' } as const;

  return (
    <DataTable
      minWidth={920}
      head={[
        <input
          key="all"
          type="checkbox"
          checked={allChecked}
          ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked; }}
          onChange={onToggleAll}
          aria-label={t.clSelectAll}
          style={checkbox}
        />,
        '#',
        t.clColContent,
        t.clColPlatform,
        t.clColSource,
        t.clUpdated,
        t.clColProgress,
        t.clFilterStatus,
        t.clColActions,
      ]}
    >
      {items.map((it, i) => {
        const st = CONTENT_STATUS_META[it.status];
        const updated = new Date(it.updatedAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN');
        const checked = selected.has(it.id);
        return (
          <tr key={it.id} style={{ borderTop: '1px solid #f1eef8', background: checked ? '#faf7ff' : undefined }}>
            <td style={{ padding: '12px 16px' }}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(it.id)} aria-label={t.clSelectRow} style={checkbox} />
            </td>
            <td style={{ padding: '12px 8px 12px 16px', fontSize: 12.5, color: '#a59fbb' }}>{pageOffset + i + 1}</td>
            <td style={{ padding: '12px 16px', minWidth: 220, maxWidth: 340 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                {/* Thumbnail placeholder: chữ cái đầu nguồn/thương hiệu (không sinh ảnh — FR-29) */}
                <span aria-hidden style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: brandGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15 }}>
                  {(it.brandName || it.title || 'A').trim()[0]?.toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: '#211c38', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                  <div style={{ fontSize: 11, color: '#a59fbb', marginTop: 2 }}>ID: {it.id.slice(0, 8)}</div>
                </div>
              </div>
            </td>
            <td style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {it.platforms.length === 0 ? (
                  <span style={{ fontSize: 12.5, color: '#b3acc6' }}>—</span>
                ) : (
                  it.platforms.map((p) => {
                    const tag = tagOfPlatform(p);
                    return <PlatformTag key={p} tag={tag} bg={PLATFORM_BG[tag]} size={22} radius={6} fontSize={9} />;
                  })
                )}
              </div>
            </td>
            <td style={{ padding: '12px 16px', fontSize: 13, color: '#3f3a55', maxWidth: 180 }}>
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.brandName || '—'}</span>
            </td>
            <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#8a85a0', whiteSpace: 'nowrap' }}>{updated}</td>
            <td style={{ padding: '12px 16px' }}><ProgressCell item={it} /></td>
            <td style={{ padding: '12px 16px' }}>
              <StatusBadge tone={st.tone} label={t[st.labelKey]} />
            </td>
            <td style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {it.isDraft ? (
                  <button onClick={() => onContinue(it)} className="btn-soft" title={t.clContinue} aria-label={t.clContinue} style={{ ...iconBtn, color: '#7c3aed' }}>
                    <Icon icon={ArrowRight} size={15} stroke="#7c3aed" />
                  </button>
                ) : (
                  <>
                    <button onClick={() => onView(it)} className="btn-soft" title={t.clView} aria-label={t.clView} style={iconBtn}>
                      <Icon icon={Eye} size={15} stroke="#574f6e" />
                    </button>
                    {EDITABLE_STATUSES.includes(it.status) && (
                      <button onClick={() => onEdit(it)} className="btn-soft" title={t.cvEdit} aria-label={t.cvEdit} style={iconBtn}>
                        <Icon icon={Pencil} size={14} stroke="#574f6e" />
                      </button>
                    )}
                  </>
                )}
                <RowActionsMenu
                  ariaLabel={t.clRowMenu}
                  actions={[
                    { key: 'delete', label: t.clDelete, icon: <Trash2 size={16} strokeWidth={1.9} />, danger: true, onClick: () => onDelete(it) },
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
