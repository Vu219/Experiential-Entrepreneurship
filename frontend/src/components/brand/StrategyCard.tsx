import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { MoreVertical, Play, Pause, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import StatusBadge, { type Tone } from '../admin/StatusBadge';
import type { ContentStrategy, StrategyStatus } from '../../api/contentStrategy';
import { FREQUENCY_UNIT_OPTIONS } from '../../data';
import { useToast } from '../toast/ToastProvider';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
};

// Badge map theo status backend trả về (không hardcode theo điều kiện UI) — nguồn hiển thị duy nhất cho trạng thái:
// DRAFT → neutral (xám); ACTIVE → success (xanh lá); PAUSED → warning (vàng/cam).
export function statusMeta(s: StrategyStatus, t: ReturnType<typeof useApp>['t']): { tone: Tone; label: string } {
  if (s === 'ACTIVE') return { tone: 'success', label: t.csStActive };
  if (s === 'PAUSED') return { tone: 'warning', label: t.csStPaused };
  return { tone: 'neutral', label: t.csStDraft };
}

export default function StrategyCard({ s, selected, onSelect, onToggleStatus, onEdit, onDelete }: {
  s: ContentStrategy;
  selected: boolean;
  onSelect: () => void;
  onToggleStatus: (next: StrategyStatus) => void | Promise<unknown>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, lang, brandGradient } = useApp();
  const meta = statusMeta(s.status, t);
  const unitLabel = FREQUENCY_UNIT_OPTIONS(lang).find((u) => u.value === (s.frequencyUnit ?? 'WEEK'))?.label ?? '';
  const runnable = s.status === 'ACTIVE';
  // Đổi trạng thái là tác vụ async (PATCH) — disable menu khi đang xử lý + báo lỗi qua toast (không fail âm thầm), rollback do parent refetch/cập nhật state.
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi click ra ngoài / nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: globalThis.MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // FR-13: DRAFT/PAUSED → ACTIVE (Kích hoạt / Tiếp tục); ACTIVE → PAUSED (Tạm dừng).
  const changeStatus = (e: MouseEvent, next: StrategyStatus) => {
    e.stopPropagation();
    setOpen(false);
    if (pending) return;
    setPending(true);
    Promise.resolve(onToggleStatus(next))
      .then(() => toast.success(t.csStatusUpdated))
      .catch(() => toast.error(t.csToggleErr))
      .finally(() => setPending(false));
  };

  // Nhãn action chuyển trạng thái theo trạng thái hiện tại (lấy từ backend qua s.status).
  const statusAction = runnable
    ? { label: t.csPause, icon: Pause, next: 'PAUSED' as const }
    : { label: s.status === 'PAUSED' ? t.csResume : t.csActivate, icon: Play, next: 'ACTIVE' as const };

  return (
    <div
      onClick={onSelect}
      className="strategy-card"
      style={{
        position: 'relative',
        zIndex: open ? 50 : undefined,
        overflow: 'visible',
        cursor: 'pointer',
        // Active: viền đều 4 cạnh + nền tím nhạt + shadow bao đều (#3). Không active: viền slate-200 luôn rõ trên nền trắng (#4.1).
        border: selected ? '1.5px solid #a855f7' : '1px solid #e2e8f0',
        background: selected ? 'rgba(168, 85, 247, 0.06)' : '#fff',
        borderRadius: 14,
        padding: 15,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        boxShadow: selected ? '0 2px 8px rgba(168, 85, 247, 0.12)' : undefined,
      }}
    >
      {/* Accent bar dọc trái (gradient brand cyan→purple) để nhận biết card đang chọn (#3). */}
      {selected && (
        <div style={{ position: 'absolute', inset: -1.5, borderRadius: 14, overflow: 'hidden', pointerEvents: 'none' }}>
          <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4.5, background: brandGradient }} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          aria-current={selected ? 'true' : undefined}
          style={{ flex: 1, textAlign: 'left', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 14.5, color: '#211c38' }}
        >
          {s.name || '—'}
        </button>
        {/* Badge trạng thái = nguồn hiển thị duy nhất cho trạng thái. */}
        <StatusBadge tone={meta.tone} label={meta.label} />
        {/* Menu 3 chấm — action theo trạng thái hiện tại. */}
        <div ref={menuRef} style={{ position: 'relative', flex: 'none' }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (!pending) setOpen((o) => !o); }}
            disabled={pending}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t.csMenu}
            aria-busy={pending}
            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #ece8f6', background: open ? '#f4f1fb' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.6 : 1 }}
          >
            <MoreVertical size={16} color="#5b5670" />
          </button>
          {open && (
            <div
              role="menu"
              className="menu-pop"
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 168, background: '#fff', border: '1px solid #ece8f6', borderRadius: 12, boxShadow: '0 12px 32px -10px rgba(40,20,90,.28)', padding: 6, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <MenuItem icon={statusAction.icon} label={statusAction.label} onClick={(e) => changeStatus(e, statusAction.next)} />
              <MenuItem icon={Pencil} label={t.csEditBtn} onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }} />
              <MenuItem icon={Trash2} label={t.csDeleteBtn} danger onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8a85a0' }}>
        <span style={{ background: '#f4f1fb', color: '#5b4b86', borderRadius: 7, padding: '3px 9px', fontWeight: 700 }}>{s.frequencyCount ?? 3} {t.csPostsPer} {unitLabel}</span>
        <span>{t.csUpdatedAt}: {fmtDate(s.updatedAt)}</span>
      </div>

      {!runnable && <div style={{ fontSize: 11.5, color: '#b08968', background: '#fdf6ec', borderRadius: 8, padding: '6px 9px' }}>{t.csPausedNote}</div>}
    </div>
  );
}

function MenuItem({ icon: IconCmp, label, danger, onClick }: { icon: typeof Play; label: string; danger?: boolean; onClick: (e: MouseEvent) => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontWeight: 600, color: danger ? '#d6336c' : '#3f3a55', cursor: 'pointer' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? '#fdeef2' : '#f4f1fb')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <IconCmp size={15} color={danger ? '#d6336c' : '#7c5cff'} />
      {label}
    </button>
  );
}
