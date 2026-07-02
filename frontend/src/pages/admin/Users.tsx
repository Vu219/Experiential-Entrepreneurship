import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Users as UsersIcon, UserCheck, Lock, UserPlus, Download, SlidersHorizontal,
  ArrowUp, ArrowDown, ArrowUpDown, X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon } from '../../components/ui';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/brand/ConfirmDialog';
import StatusBadge from '../../components/admin/StatusBadge';
import Pagination from '../../components/admin/Pagination';
import AdminListPage, { SearchInput, FilterSelect, DataTable, DetailRow, type ListState } from '../../components/admin/AdminListPage';
import { validEmail } from '../../validations/authValidation';
import {
  getAdminUsers, setUserLocked, setUsersLocked, deleteAdminUser, createAdminUser,
  userStatusMeta, userPlanMeta, timeAgo, daysSinceLogin,
  type AdminUserRow, type UserRole, type UserPlan,
} from '../../api/admin';

const PAGE_SIZE = 8;

type SortKey = 'name' | 'createdAt' | 'lastLoginAt';
type ConfirmState =
  | { kind: 'lock' | 'unlock' | 'delete'; user: AdminUserRow }
  | { kind: 'bulkLock' | 'bulkUnlock'; users: AdminUserRow[]; skippedAdmins: number };

/** Màu progress token: xanh <70%, cam 70–90%, đỏ >90%. */
const tokenColor = (p: number) => (p > 90 ? '#dc2626' : p >= 70 ? '#d97706' : '#16a34a');

export default function Users() {
  const { t, lang, brandGradient } = useApp();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  // Bộ lọc nâng cao
  const [showAdv, setShowAdv] = useState(false);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [usage, setUsage] = useState('all');
  // Sắp xếp / phân trang / chọn hàng loạt
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Modal & feedback
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchUsers = () => {
    setLoad('loading');
    getAdminUsers().then((r) => { setRows(r); setLoad('ok'); }).catch(() => setLoad('error'));
  };
  useEffect(fetchUsers, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((u) =>
      (role === 'all' || u.role === role) &&
      (status === 'all' || u.status === status) &&
      (plan === 'all' || u.plan === plan) &&
      (!createdFrom || u.createdAt >= createdFrom) &&
      (!createdTo || u.createdAt <= createdTo) &&
      (usage === 'all' || (usage === 'quota' ? u.tokenUsagePercent > 90 : daysSinceLogin(u.lastLoginAt) > 30)) &&
      (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
  }, [rows, query, role, status, plan, createdFrom, createdTo, usage]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const c = sortKey === 'name'
        ? a.name.localeCompare(b.name, 'vi')
        : String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')); // null (chưa đăng nhập) xếp trước khi asc
      return sortDir === 'asc' ? c : -c;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  useEffect(() => setPage(1), [query, role, status, plan, createdFrom, createdTo, usage]);

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const state: ListState = load === 'loading' ? 'loading' : load === 'error' ? 'error' : filtered.length === 0 ? 'empty' : 'ready';

  // ===== 4 stat card (tính từ dữ liệu, đồng bộ khi khoá/xoá/tạo) =====
  const statCards = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((u) => u.status === 'ACTIVE').length;
    const locked = rows.filter((u) => u.status === 'LOCKED').length;
    const month = new Date().toISOString().slice(0, 7);
    const newMonth = rows.filter((u) => u.createdAt.startsWith(month)).length;
    const activePct = total ? Math.round((active / total) * 100) : 0;
    return [
      { value: total, label: t.usrStatTotal, pill: `+8.2% ${t.usrVsLastMonth}`, pillColor: '#16a34a', pillBg: '#e8f8ee', icon: UsersIcon, tint: 'linear-gradient(135deg,#e9f0ff,#f1e9ff)', color: '#6366f1' },
      { value: active, label: t.usrStatActive, pill: `${activePct}% ${t.usrOfTotal}`, pillColor: '#7c3aed', pillBg: '#f1e9ff', icon: UserCheck, tint: 'linear-gradient(135deg,#e7fff4,#e9f7ff)', color: '#10b981' },
      { value: locked, label: t.usrStatLocked, pill: null, pillColor: '', pillBg: '', icon: Lock, tint: 'linear-gradient(135deg,#fde8e8,#fff0f0)', color: '#dc2626' },
      { value: newMonth, label: t.usrStatNew, pill: `+12% ${t.usrVsLastMonth}`, pillColor: '#16a34a', pillBg: '#e8f8ee', icon: UserPlus, tint: 'linear-gradient(135deg,#f1e9ff,#fae9ff)', color: '#8b5cf6' },
    ];
  }, [rows, t]);

  // ===== Chọn hàng loạt =====
  const selectedRows = useMemo(() => rows.filter((u) => selectedIds.has(u.id)), [rows, selectedIds]);
  const selectedAdmins = selectedRows.filter((u) => u.role === 'ADMIN').length;
  const allPageChecked = paged.length > 0 && paged.every((u) => selectedIds.has(u.id));

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageChecked) paged.forEach((u) => next.delete(u.id));
      else paged.forEach((u) => next.add(u.id));
      return next;
    });

  // ===== Hành động (mọi hành động nhạy cảm đều qua ConfirmDialog) =====
  // Guard UI + logic: mọi đường vào lock/delete đều chặn ADMIN trước khi mở confirm;
  // api/admin.ts còn tự reject('ADMIN_PROTECTED') như lớp bảo vệ thứ hai.
  const requestLockToggle = (u: AdminUserRow) => {
    if (u.role === 'ADMIN') return;
    setConfirm({ kind: u.status === 'LOCKED' ? 'unlock' : 'lock', user: u });
  };
  const requestDelete = (u: AdminUserRow) => {
    if (u.role === 'ADMIN') return;
    setConfirm({ kind: 'delete', user: u });
  };
  const requestBulk = (lock: boolean) => {
    const eligible = selectedRows.filter((u) => u.role !== 'ADMIN' && (lock ? u.status === 'ACTIVE' : u.status === 'LOCKED'));
    if (eligible.length === 0) {
      setToast({ type: 'error', msg: t.usrNoneEligible });
      return;
    }
    setConfirm({ kind: lock ? 'bulkLock' : 'bulkUnlock', users: eligible, skippedAdmins: selectedAdmins });
  };

  const runConfirm = () => {
    if (!confirm) return;
    setBusy(true);
    const done = () => { setBusy(false); setConfirm(null); };

    if (confirm.kind === 'lock' || confirm.kind === 'unlock') {
      const u = confirm.user;
      setUserLocked(u.id, confirm.kind === 'lock')
        .then((res) => {
          setRows((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: res.status } : x)));
          setSelected((s) => (s && s.id === u.id ? { ...s, status: res.status } : s));
          setToast({ type: 'success', msg: `${confirm.kind === 'lock' ? t.usrLocked : t.usrUnlocked} ${u.name}` });
        })
        .catch(() => setToast({ type: 'error', msg: t.usrNoLockAdmin }))
        .finally(done);
    } else if (confirm.kind === 'delete') {
      const u = confirm.user;
      deleteAdminUser(u.id)
        .then(() => {
          setRows((prev) => prev.filter((x) => x.id !== u.id));
          setSelectedIds((prev) => { const next = new Set(prev); next.delete(u.id); return next; });
          setSelected((s) => (s && s.id === u.id ? null : s));
          setToast({ type: 'success', msg: `${t.usrDeleted}: ${u.name}` });
        })
        .catch(() => setToast({ type: 'error', msg: t.usrNoDeleteAdmin }))
        .finally(done);
    } else if (confirm.kind === 'bulkLock' || confirm.kind === 'bulkUnlock') {
      // Check dương tường minh trên discriminant — TS không tự loại các variant còn lại ở nhánh else.
      const lock = confirm.kind === 'bulkLock';
      setUsersLocked(confirm.users.map((u) => u.id), lock)
        .then((res) => {
          setRows((prev) => prev.map((x) => (res.updated.includes(x.id) ? { ...x, status: lock ? 'LOCKED' : 'ACTIVE' } : x)));
          setToast({ type: 'success', msg: `${lock ? t.usrLocked : t.usrUnlocked}: ${res.updated.length} ${t.usrUsers}` });
        })
        .catch(() => setToast({ type: 'error', msg: t.listError }))
        .finally(done);
    }
  };

  // ===== Xuất CSV (danh sách đang hiển thị theo filter, hoặc các dòng đã chọn) =====
  const exportCsv = (list: AdminUserRow[]) => {
    const head = ['Name', 'Email', 'Role', 'Plan', 'Status', 'Channels', 'Token %', 'Last login', 'Created'];
    const lines = list.map((u) =>
      [u.name, u.email, u.role, u.plan, u.status, `${u.channelsUsed}/${u.channelsLimit}`, u.tokenUsagePercent, u.lastLoginAt ?? '', u.createdAt]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
    );
    const url = URL.createObjectURL(new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `aima-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Sort header =====
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };
  const SortHead = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', padding: 0, fontSize: 12, fontWeight: 600, color: sortKey === k ? '#7c3aed' : '#a59fbb', cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      {label}
      <Icon icon={sortKey !== k ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown} size={12} stroke={sortKey === k ? '#7c3aed' : '#c4bdd6'} />
    </button>
  );

  const roleMeta = (r: UserRole) => (r === 'ADMIN' ? { tone: 'purple' as const, label: t.roleAdmin } : { tone: 'neutral' as const, label: t.roleUser });

  const dateInput = { height: 38, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '0 10px', fontSize: 13, color: '#4b4660', cursor: 'pointer' } as const;

  const toolbar = (
    <>
      <SearchInput value={query} onChange={setQuery} />
      <FilterSelect value={role} onChange={setRole} options={[['all', `${t.filterRole}: ${t.filterAll}`], ['USER', t.roleUser], ['ADMIN', t.roleAdmin]]} />
      <FilterSelect value={status} onChange={setStatus} options={[['all', `${t.colStatus}: ${t.filterAll}`], ['ACTIVE', t.stActive], ['LOCKED', t.stLocked], ['PENDING_DELETE', t.stPendingDel]]} />
      <FilterSelect value={plan} onChange={setPlan} options={[['all', `${t.filterPlan}: ${t.filterAll}`], ['free', 'Free'], ['plus', 'Plus'], ['pro', 'Pro']]} />
      <button
        type="button"
        onClick={() => setShowAdv((v) => !v)}
        aria-pressed={showAdv}
        className="btn-outline"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, border: '1px solid #ece8f6', background: showAdv ? '#f3edff' : '#fff', color: showAdv ? '#6d28d9' : '#4b4660', fontWeight: 600, fontSize: 12.5, borderRadius: 10, padding: '0 13px', cursor: 'pointer' }}
      >
        <Icon icon={SlidersHorizontal} size={14} stroke="#7c3aed" />
        {t.trAdvFilter}
      </button>
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <button type="button" onClick={() => exportCsv(sorted)} className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, border: '1px solid #ece8f6', background: '#fff', color: '#4b4660', fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '0 13px', cursor: 'pointer' }}>
          <Icon icon={Download} size={14} stroke="#7c3aed" />
          {t.usrExport}
        </button>
        <button type="button" onClick={() => setShowCreate(true)} className="btn-grad" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, border: 'none', background: brandGradient, color: '#fff', fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '0 14px', cursor: 'pointer' }}>
          <Icon icon={UserPlus} size={14} stroke="#fff" />
          {t.usrAdd}
        </button>
      </div>
      {showAdv && (
        <div style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', paddingTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#8a85a0' }}>{t.filterFrom}<input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} style={dateInput} /></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#8a85a0' }}>{t.filterTo}<input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} style={dateInput} /></label>
          <FilterSelect value={usage} onChange={setUsage} options={[['all', `${t.usrFilterUsage}: ${t.filterAll}`], ['quota', t.usrNearQuota], ['inactive', t.usrInactive30]]} />
        </div>
      )}
    </>
  );

  const checkboxStyle = { width: 15, height: 15, accentColor: '#7c3aed', cursor: 'pointer' } as const;

  const head: ReactNode[] = [
    <input key="all" type="checkbox" checked={allPageChecked} onChange={togglePage} style={checkboxStyle} aria-label={t.usrSelected} />,
    <SortHead key="name" label={t.colName} k="name" />,
    t.colRole, t.colPlan, t.colUsage,
    <SortHead key="login" label={t.colLastLogin} k="lastLoginAt" />,
    t.colStatus,
    <SortHead key="created" label={t.colCreated} k="createdAt" />,
    t.colAction,
  ];

  // ===== Nội dung ConfirmDialog theo hành động =====
  const confirmMeta = confirm && (() => {
    if (confirm.kind === 'delete') {
      return {
        title: t.usrDeleteTitle, message: t.usrDeleteMsg, confirmLabel: t.usrDelete, variant: 'danger' as const,
        body: <UserBox user={confirm.user} />,
      };
    }
    if (confirm.kind === 'lock' || confirm.kind === 'unlock') {
      return {
        title: confirm.kind === 'lock' ? t.usrLockTitle : t.usrUnlockTitle,
        message: confirm.kind === 'lock' ? t.usrLockMsg : t.usrUnlockMsg,
        confirmLabel: confirm.kind === 'lock' ? t.usrLock : t.usrUnlock,
        variant: confirm.kind === 'lock' ? ('danger' as const) : ('warning' as const),
        body: <UserBox user={confirm.user} />,
      };
    }
    if (confirm.kind === 'bulkLock' || confirm.kind === 'bulkUnlock') {
      // Check dương tường minh trên discriminant — TS không tự loại các variant còn lại ở nhánh else.
      const lock = confirm.kind === 'bulkLock';
      return {
        title: lock ? t.usrBulkLockTitle : t.usrBulkUnlockTitle,
        message: `${confirm.users.length} ${t.usrBulkAffected}`,
        confirmLabel: lock ? t.usrLockSel : t.usrUnlockSel,
        variant: lock ? ('danger' as const) : ('warning' as const),
        body: (
          <div style={{ marginBottom: 8 }}>
            {confirm.users.length <= 6 && (
              <div style={{ background: '#faf9fe', border: '1px solid #f1eef8', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#3f3a55', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {confirm.users.map((u) => (
                  <span key={u.id}><b>{u.name}</b> — {u.email}</span>
                ))}
              </div>
            )}
            {confirm.skippedAdmins > 0 && (
              <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: '#d97706', background: '#fdf0dc', borderRadius: 10, padding: '8px 12px' }}>
                ⚠ {confirm.skippedAdmins} {t.usrAdminSkipped}
              </div>
            )}
          </div>
        ),
      };
    }
    return null;
  })();

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast (pattern Settings: banner cục bộ, tự ẩn) */}
      {toast && (
        <div className="view-pop" style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, background: toast.type === 'success' ? '#dcfce7' : '#fee2e2', color: toast.type === 'success' ? '#16a34a' : '#dc2626', border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
          <span style={{ fontSize: 15 }}>{toast.type === 'success' ? '✓' : '✕'}</span>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', padding: 0 }}>×</button>
        </div>
      )}

      {/* 4 stat card (pattern Overview) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 18 }}>
        {statCards.map((s, i) => (
          <Card key={i} style={{ padding: 20, borderRadius: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: s.tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={s.icon} stroke={s.color} />
              </div>
              {s.pill && <span style={{ fontSize: 11.5, fontWeight: 700, color: s.pillColor, background: s.pillBg, padding: '3px 9px', borderRadius: 999 }}>{s.pill}</span>}
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 26, color: '#211c38', margin: '14px 0 2px' }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#8a85a0' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Thanh bulk action — sticky khi có dòng được chọn */}
      {selectedRows.length > 0 && (
        <div style={{ position: 'sticky', top: 8, zIndex: 30 }}>
          <Card style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', boxShadow: '0 14px 30px -16px rgba(80,40,140,.5)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#211c38' }}>{t.usrSelected} {selectedRows.length} {t.usrUsers}</span>
            {selectedAdmins > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706', background: '#fdf0dc', borderRadius: 999, padding: '3px 10px' }}>
                ⚠ {selectedAdmins} {t.usrAdminSkipped}
              </span>
            )}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
              <button onClick={() => requestBulk(true)} style={btnRed}>{t.usrLockSel}</button>
              <button onClick={() => requestBulk(false)} style={btnGreen}>{t.usrUnlockSel}</button>
              <button onClick={() => exportCsv(selectedRows)} style={btnGhost}>
                <Icon icon={Download} size={13} stroke="#5b5670" /> {t.usrExport}
              </button>
              <button onClick={() => setSelectedIds(new Set())} style={btnGhost} aria-label={t.usrClearSel}>
                <Icon icon={X} size={13} stroke="#5b5670" /> {t.usrClearSel}
              </button>
            </div>
          </Card>
        </div>
      )}

      <AdminListPage state={state} toolbar={toolbar} onRetry={fetchUsers}>
        <DataTable head={head} minWidth={1080}>
          {paged.map((u) => {
            const rm = roleMeta(u.role);
            const sm = userStatusMeta(lang, u.status);
            const pm = userPlanMeta(u.plan);
            const isAdmin = u.role === 'ADMIN';
            return (
              <tr key={u.id} style={{ borderTop: '1px solid #f1eef8', background: selectedIds.has(u.id) ? '#faf8ff' : 'transparent' }}>
                <td style={{ padding: '13px 16px', width: 36 }}>
                  <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleRow(u.id)} style={checkboxStyle} aria-label={u.name} />
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 32, height: 32, flex: 'none', borderRadius: '50%', background: brandGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{u.initials}</span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#2b2543' }}>{u.name}</div>
                      <div style={{ fontSize: 11.5, color: '#a59fbb' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '13px 16px' }}><StatusBadge tone={rm.tone} label={rm.label} /></td>
                <td style={{ padding: '13px 16px' }}><StatusBadge tone={pm.tone} label={pm.label} /></td>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2b2543', whiteSpace: 'nowrap' }}>{u.channelsUsed}/{u.channelsLimit} {t.usrChannelUnit}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <div style={{ width: 64, height: 6, borderRadius: 99, background: '#f1eef9', overflow: 'hidden' }}>
                      <div style={{ width: `${u.tokenUsagePercent}%`, height: '100%', borderRadius: 99, background: tokenColor(u.tokenUsagePercent) }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: tokenColor(u.tokenUsagePercent) }}>{u.tokenUsagePercent}%</span>
                  </div>
                </td>
                <td style={{ padding: '13px 16px', fontSize: 13, color: '#6b6680', whiteSpace: 'nowrap' }}>{timeAgo(lang, u.lastLoginAt)}</td>
                <td style={{ padding: '13px 16px' }}><StatusBadge tone={sm.tone} label={sm.label} /></td>
                <td style={{ padding: '13px 16px', fontSize: 13, color: '#8a85a0', whiteSpace: 'nowrap' }}>{u.createdAt}</td>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setSelected(u)} style={btnGhost}>{t.detail}</button>
                    {u.status !== 'PENDING_DELETE' && (
                      <button
                        onClick={() => requestLockToggle(u)}
                        disabled={isAdmin}
                        title={isAdmin ? t.usrNoLockAdmin : undefined}
                        style={{ ...(u.status === 'LOCKED' ? btnGreen : btnRed), ...(isAdmin ? btnDisabled : {}) }}
                      >
                        {u.status === 'LOCKED' ? t.usrUnlock : t.usrLock}
                      </button>
                    )}
                    <button
                      onClick={() => requestDelete(u)}
                      disabled={isAdmin}
                      title={isAdmin ? t.usrNoDeleteAdmin : undefined}
                      style={{ ...btnRed, ...(isAdmin ? btnDisabled : {}) }}
                    >
                      {t.usrDelete}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
        <div style={{ padding: '0 16px 16px' }}>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </div>
      </AdminListPage>

      {/* Modal chi tiết */}
      {selected && (
        <Modal title={t.usrDetailTitle} onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <span style={{ width: 52, height: 52, flex: 'none', borderRadius: '50%', background: brandGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>{selected.initials}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#211c38' }}>{selected.name}</div>
              <div style={{ fontSize: 13, color: '#8a85a0' }}>{selected.email}</div>
            </div>
          </div>
          <DetailRow label={t.colRole} value={<StatusBadge {...roleMeta(selected.role)} />} />
          <DetailRow label={t.colPlan} value={<StatusBadge {...userPlanMeta(selected.plan)} />} />
          <DetailRow label={t.colStatus} value={<StatusBadge {...userStatusMeta(lang, selected.status)} />} />
          <DetailRow label={t.colUsage} value={`${selected.channelsUsed}/${selected.channelsLimit} ${t.usrChannelUnit}`} />
          <DetailRow label={t.usrTokenLabel} value={<span style={{ color: tokenColor(selected.tokenUsagePercent) }}>{selected.tokenUsagePercent}%</span>} />
          <DetailRow label={t.colLastLogin} value={timeAgo(lang, selected.lastLoginAt)} />
          <DetailRow label={t.colCreated} value={selected.createdAt} />
          {selected.status !== 'PENDING_DELETE' && selected.role !== 'ADMIN' && (
            <button onClick={() => requestLockToggle(selected)} style={{ ...(selected.status === 'LOCKED' ? btnGreen : btnRed), width: '100%', marginTop: 18, padding: '11px 0', fontSize: 14 }}>
              {selected.status === 'LOCKED' ? t.usrUnlock : t.usrLock}
            </button>
          )}
        </Modal>
      )}

      {/* ConfirmDialog dùng chung cho khoá / mở khoá / xoá / bulk */}
      {confirm && confirmMeta && (
        <ConfirmDialog
          title={confirmMeta.title}
          message={confirmMeta.message}
          confirmLabel={confirmMeta.confirmLabel}
          variant={confirmMeta.variant}
          busy={busy}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        >
          {confirmMeta.body}
        </ConfirmDialog>
      )}

      {/* Modal thêm người dùng */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(row) => {
            setRows((prev) => [row, ...prev]);
            setShowCreate(false);
            setToast({ type: 'success', msg: `${t.usrCreated}: ${row.name}` });
          }}
        />
      )}
    </div>
  );
}

/** Hộp tên + email của user bị ảnh hưởng, dùng trong ConfirmDialog. */
function UserBox({ user }: { user: AdminUserRow }) {
  return (
    <div style={{ background: '#faf9fe', border: '1px solid #f1eef8', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#3f3a55', marginBottom: 8 }}>
      <b>{user.name}</b> — {user.email}
    </div>
  );
}

/** Form tạo user thủ công (Tên, Email, Vai trò, Gói) — validate qua validations/. */
function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (row: AdminUserRow) => void }) {
  const { t } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('USER');
  const [plan, setPlan] = useState<UserPlan>('free');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = () => {
    const er: typeof errors = {};
    if (!name.trim()) er.name = t.errNameReq;
    if (!email.trim()) er.email = t.errEmailReq;
    else if (!validEmail(email)) er.email = t.errEmailBad;
    setErrors(er);
    if (Object.keys(er).length > 0) return;
    setBusy(true);
    createAdminUser({ name: name.trim(), email: email.trim(), role, plan })
      .then(onCreated)
      .finally(() => setBusy(false));
  };

  return (
    <Modal title={t.usrAddTitle} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={t.colName} error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} style={fieldInput} />
        </Field>
        <Field label={t.colEmail} error={errors.email}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={fieldInput} />
        </Field>
        <div style={{ display: 'flex', gap: 12 }}>
          <Field label={t.colRole} style={{ flex: 1 }}>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={fieldInput}>
              <option value="USER">{t.roleUser}</option>
              <option value="ADMIN">{t.roleAdmin}</option>
            </select>
          </Field>
          <Field label={t.filterPlan} style={{ flex: 1 }}>
            <select value={plan} onChange={(e) => setPlan(e.target.value as UserPlan)} style={fieldInput}>
              <option value="free">Free</option>
              <option value="plus">Plus</option>
              <option value="pro">Pro</option>
            </select>
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} className="btn-soft" style={{ flex: 1, border: '1px solid #ece8f6', background: '#fff', borderRadius: 11, padding: '11px 0', fontSize: 14, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>
            {t.cancel}
          </button>
          <button onClick={submit} disabled={busy} className="btn-grad" style={{ flex: 1, border: 'none', background: 'var(--brand)', borderRadius: 11, padding: '11px 0', fontSize: 14, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {t.usrCreate}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, error, style, children }: { label: string; error?: string; style?: React.CSSProperties; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#8a85a0', letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{error}</span>}
    </label>
  );
}

const fieldInput = { width: '100%', height: 40, border: '1px solid #ece8f6', borderRadius: 10, padding: '0 12px', fontSize: 13.5, color: '#241f3a', outline: 'none', background: '#fff' } as const;

const btnGhost = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' } as const;
const btnRed = { border: 'none', background: '#fde8e8', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#dc2626', cursor: 'pointer' } as const;
const btnGreen = { border: 'none', background: '#e8f8ee', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#16a34a', cursor: 'pointer' } as const;
const btnDisabled = { opacity: 0.45, cursor: 'not-allowed' } as const;
