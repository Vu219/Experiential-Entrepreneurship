import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye, FileText, Lock, Package, RefreshCw, Server, Sparkles, TrendingUp, Unlock, Users as UsersIcon, Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useUiStore } from '../../store/useUiStore';
import { useToast } from '../../components/toast/ToastProvider';
import SectionCard from '../../components/admin/SectionCard';
import StatusBadge from '../../components/admin/StatusBadge';
import OverviewKpiCard from '../../components/admin/OverviewKpiCard';
import BlockError from '../../components/admin/BlockError';
import { BarListSkeleton, KpiRowSkeleton, ServiceListSkeleton, TableSkeleton } from '../../components/admin/BlockSkeleton';
import RowActionsMenu, { type RowAction } from '../../components/admin/RowActionsMenu';
import Avatar from '../../components/admin/Avatar';
import { DataTable } from '../../components/admin/AdminListPage';
import ConfirmDialog from '../../components/brand/ConfirmDialog';
import PageContainer from '../../components/PageContainer';
import EditUserModal from './EditUserModal';

import { Card, Icon } from '../../components/ui';
import { planColor } from '../../components/admin/revenue/chartTokens';
import { TONE_COLORS, type Tone } from '../../statusTokens';
import { adminShortcutsFor } from '../../config/adminNav';
import { getAdminOverviewSummary, type AdminOverviewSummary, type OverviewStat, type RecentUser } from '../../api/adminOverview';
import {
  formatVND, getAdminUser, getSystemStatus, initials as initialsOf, setUserLocked,
  userPlanMeta, userStatusMeta, type AdminUserRow, type SystemStatus,
} from '../../api/admin';
import { formatCompactNumber, formatDateVN, formatGroupedNumber } from '../../utils/format';
import { C } from '../../styles/colors';

/**
 * Trang Quản trị → Tổng quan (UI-10). Số liệu THẬT từ DB, không còn mock.
 *
 * Trang nạp hai nguồn ĐỘC LẬP để một nguồn hỏng không kéo sập cả trang:
 *  - `GET /admin/overview/summary` — KPI + phân bổ gói + người dùng gần đây (thuần DB, nhanh).
 *  - `GET /admin/system` — card Tình trạng hệ thống, tái dùng endpoint sẵn có của tab Trạng thái
 *    hệ thống; nó phải probe DB/Redis/AI nên chậm và dễ lỗi hơn hẳn.
 * Mỗi khối tự lo skeleton + lỗi + nút Thử lại của riêng nó.
 */

/** Chu kỳ tự làm mới. Đổi một chỗ này là đổi cho cả trang; 0 = tắt, chỉ làm mới thủ công. */
const AUTO_REFRESH_MS = 60_000;

export default function Overview() {
  const { t, lang, go, brandGradient } = useApp();
  const { user } = useAuth();
  const { isMobile, isTablet } = useBreakpoint();
  const toast = useToast();

  const [summary, setSummary] = useState<AdminOverviewSummary | null>(null);
  const [summaryState, setSummaryState] = useState<'loading' | 'error' | 'ok'>('loading');

  const [health, setHealth] = useState<SystemStatus | null>(null);
  const [healthState, setHealthState] = useState<'loading' | 'error' | 'ok'>('loading');
  /** Độ trễ vòng lặp thật của lời gọi /admin/system — đây là số đo trung thực cho dòng "API". */
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  // Hành động trên bảng người dùng — dùng LẠI nguyên bộ của tab Quản lý người dùng.
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [confirmLock, setConfirmLock] = useState<RecentUser | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSummary = useCallback(() => {
    setSummaryState((s) => (s === 'ok' ? s : 'loading'));
    getAdminOverviewSummary(8)
      .then((data) => { setSummary(data); setSummaryState('ok'); })
      .catch(() => setSummaryState('error'));
  }, []);

  const loadHealth = useCallback(() => {
    setHealthState((s) => (s === 'ok' ? s : 'loading'));
    const startedAt = performance.now();
    getSystemStatus(lang)
      .then((data) => {
        setApiLatencyMs(Math.round(performance.now() - startedAt));
        setHealth(data);
        setCheckedAt(new Date());
        setHealthState('ok');
      })
      .catch(() => setHealthState('error'));
  }, [lang]);

  const refreshAll = useCallback(() => { loadSummary(); loadHealth(); }, [loadSummary, loadHealth]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  useEffect(() => {
    if (!AUTO_REFRESH_MS) return;
    const timer = window.setInterval(refreshAll, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refreshAll]);

  const setHeaderAction = useUiStore((s) => s.setHeaderAction);

  useEffect(() => {
    setHeaderAction(
      <button
        onClick={refreshAll}
        title={t.ovrRefresh}
        aria-label={t.ovrRefresh}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: C.surface,
          color: C.violetLight,
          cursor: 'pointer',
          boxShadow: `0 2px 6px -2px ${C.legacyShadowrgba13992246015_}`,
          transition: 'all 0.15s ease',
        }}
        className={"dm-hover-3986d49"}


      >
        <Icon icon={RefreshCw} size={15} stroke={C.violetLight} />
      </button>
    );
    return () => setHeaderAction(null);
  }, [refreshAll, setHeaderAction, t.ovrRefresh]);

  // ----- Hành động hàng (tái sử dụng action của tab Quản lý người dùng) -----

  // Chi tiết/đổi gói đều mở EditUserModal sẵn có — nơi DUY NHẤT sửa hồ sơ/gói/vai trò, nên
  // không có logic nào bị viết lại ở đây. Bảng chỉ có bản rút gọn nên phải nạp bản đầy đủ.
  const openUser = (id: string) => {
    getAdminUser(id)
      .then(setSelected)
      .catch(() => toast.error(t.listError));
  };

  const submitLock = () => {
    if (!confirmLock || busy) return;
    const locking = confirmLock.status !== 'LOCKED';
    setBusy(true);
    setUserLocked(confirmLock.id, locking)
      .then(() => {
        toast.success(`${locking ? t.usrLocked : t.usrUnlocked}: ${confirmLock.fullName ?? confirmLock.email}`);
        loadSummary();
      })
      .catch(() => toast.error(t.usrNoLockAdmin))
      .finally(() => { setBusy(false); setConfirmLock(null); });
  };

  const rowActions = (u: RecentUser): RowAction[] => {
    const locked = u.status === 'LOCKED';
    return [
      { key: 'detail', label: t.detail, icon: <Eye size={16} strokeWidth={1.8} />, onClick: () => openUser(u.id) },
      {
        key: 'lock',
        label: locked ? t.usrUnlock : t.usrLock,
        icon: locked ? <Unlock size={16} strokeWidth={1.8} /> : <Lock size={16} strokeWidth={1.8} />,
        onClick: () => setConfirmLock(u),
      },
      { key: 'plan', label: t.usrPlanChangeBtn, icon: <Package size={16} strokeWidth={1.8} />, onClick: () => openUser(u.id) },
    ];
  };

  // ----- Bố cục -----
  const stacked = isMobile || isTablet;
  const kpiColumns = isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';

  const linkStyle = { fontSize: 13, fontWeight: 600, color: C.violetLight, cursor: 'pointer', border: 'none', background: 'none', padding: 0 } as const;

  return (
    <PageContainer>
      {/* ===== Hàng 4 thẻ KPI ===== */}
      {summaryState === 'loading' && <KpiRowSkeleton columns={kpiColumns} />}
      {summaryState === 'error' && <Card style={{ borderRadius: 18 }}><BlockError onRetry={loadSummary} /></Card>}
      {summaryState === 'ok' && summary && (
        <div style={{ display: 'grid', gridTemplateColumns: kpiColumns, gap: 18 }}>
          <OverviewKpiCard
            icon={UsersIcon} iconBg={C.legacyBgede9fe} iconColor={C.primary}
            label={t.ovrKpiUsers}
            value={formatGroupedNumber(summary.stats.totalUsers.total, lang)}
            {...deltaProps(summary.stats.totalUsers, t)}
          />
          <OverviewKpiCard
            icon={TrendingUp} iconBg={C.successSoft2} iconColor={C.success}
            label={t.ovrKpiActive}
            value={formatGroupedNumber(summary.stats.activeToday.total, lang)}
            {...deltaProps(summary.stats.activeToday, t)}
          />
          <OverviewKpiCard
            icon={Sparkles} iconBg={C.infoSoft} iconColor={C.info}
            label={t.ovrKpiContent}
            value={formatCompactNumber(summary.stats.contentCreated.total)}
            {...deltaProps(summary.stats.contentCreated, t)}
          />
          <OverviewKpiCard
            icon={Wallet} iconBg={C.warningSoft} iconColor={C.warning}
            label={t.ovrKpiMrr}
            value={formatVND(summary.stats.monthlyRecurringRevenue.total)}
            {...deltaProps(summary.stats.monthlyRecurringRevenue, t)}
          />
        </div>
      )}

      {/* ===== Bảng người dùng + cột phải ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.7fr 1fr', gap: 20, alignItems: 'start' }}>
        <SectionCard
          flush
          title={t.adRecent}
          action={<button onClick={() => go('adminUsers')} style={linkStyle}>{t.viewAll} →</button>}
        >
          {summaryState === 'loading' && <TableSkeleton />}
          {summaryState === 'error' && <BlockError onRetry={loadSummary} />}
          {summaryState === 'ok' && summary && (
            summary.recentUsers.length === 0 ? (
              <div style={{ padding: '44px 16px', textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: C.textMuted }}>
                {t.ovrEmptyUsers}
              </div>
            ) : (
              <>
                <DataTable head={[t.ovrColUser, t.colPlan, t.colStatus, t.colPosts, t.colJoined, '']} minWidth={620}>
                  {summary.recentUsers.map((u) => {
                    const planMeta = userPlanMeta(u.plan ?? 'FREE');
                    const statusMeta = userStatusMeta(lang, u.status);
                    return (
                      <tr key={u.id} style={{ borderTop: `1px solid ${C.surfaceMuted}` }}>
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar url={u.avatarUrl ?? undefined} initials={initialsOf(u.fullName ?? u.email)} size={32} gradient={brandGradient} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink750 }}>{u.fullName ?? u.email}</div>
                              <div style={{ fontSize: 11.5, color: C.textFaint }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '13px 16px' }}><StatusBadge tone={planMeta.tone} label={planMeta.label} /></td>
                        <td style={{ padding: '13px 16px' }}><StatusBadge tone={statusMeta.tone} label={statusMeta.label} /></td>
                        <td style={{ padding: '13px 16px', fontSize: 13.5, fontWeight: 600, color: C.ink750 }}>
                          {formatGroupedNumber(u.postCount, lang)}
                        </td>
                        <td style={{ padding: '13px 16px', fontSize: 13, color: C.textMuted }}>{formatDateVN(u.createdAt)}</td>
                        <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                          <RowActionsMenu actions={rowActions(u)} ariaLabel={`${t.usrMoreActions} — ${u.fullName ?? u.email}`} />
                        </td>
                      </tr>
                    );
                  })}
                </DataTable>
                <button
                  onClick={() => go('adminUsers')}
                  style={{ width: '100%', border: 'none', borderTop: `1px solid ${C.surfaceMuted}`, background: C.surfaceSubtle, padding: '13px 16px', fontSize: 13, fontWeight: 700, color: C.primary, cursor: 'pointer' }}
                >
                  {t.ovrViewAllUsers} →
                </button>
              </>
            )
          )}
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ----- Phân bổ gói ----- */}
          <SectionCard
            title={t.adPlanDist}
            action={<button onClick={() => go('adminPlans')} style={linkStyle}>{t.ovrViewDetail}</button>}
          >
            {summaryState === 'loading' && <BarListSkeleton />}
            {summaryState === 'error' && <BlockError onRetry={loadSummary} />}
            {summaryState === 'ok' && summary && (
              summary.planDistribution.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: C.textMuted }}>{t.ovrEmptyPlans}</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                    {summary.planDistribution.map((p, i) => (
                      <div key={p.planId}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{lang === 'en' ? p.nameEn : p.nameVi}</span>
                          <span style={{ fontSize: 13, color: C.textMuted }}>
                            {formatGroupedNumber(p.userCount, lang)} ({p.sharePct}%)
                          </span>
                        </div>
                        <div style={{ height: 9, borderRadius: 99, background: C.surfaceMuted, overflow: 'hidden' }}>
                          {/* Màu theo THỨ TỰ gói — cùng bảng màu với donut trang Doanh thu. */}
                          <div style={{ height: '100%', borderRadius: 99, width: `${p.sharePct}%`, background: planColor(i) }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16, padding: '11px 13px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink550 }}>{t.ovrKpiUsers}</span>
                    <span style={{ fontFamily: "'Plus Jakarta Sans'", fontSize: 15, fontWeight: 800, color: C.textStrong }}>
                      {formatGroupedNumber(summary.totalSubscribedUsers, lang)}
                    </span>
                  </div>
                </>
              )
            )}
          </SectionCard>

          {/* ----- Tình trạng hệ thống ----- */}
          <SectionCard
            title={t.adHealth}
            action={<button onClick={() => go('adminSystem')} style={linkStyle}>{t.ovrViewDetail}</button>}
          >
            {healthState === 'loading' && <ServiceListSkeleton />}
            {healthState === 'error' && <BlockError onRetry={loadHealth} />}
            {healthState === 'ok' && health && (
              <HealthList health={health} apiLatencyMs={apiLatencyMs} checkedAt={checkedAt} />
            )}
          </SectionCard>
        </div>
      </div>

      {/* ===== Lối tắt quản trị ===== */}
      <SectionCard title={t.ovrShortcuts}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 12 }}>
          {adminShortcutsFor(user?.role).map((s) => (
            <button
              key={s.key}
              onClick={() => go(s.key)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 14, padding: '16px 10px', cursor: 'pointer' }}
            >
              <span style={{ width: 38, height: 38, borderRadius: 11, background: C.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={s.icon} size={19} stroke={C.primary} />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, textAlign: 'center', lineHeight: 1.35 }}>{t[s.labelKey]}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {selected && (
        <EditUserModal
          user={selected}
          currentAdminId={user?.id ?? ''}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); loadSummary(); }}
        />
      )}

      {confirmLock && (
        <ConfirmDialog
          title={confirmLock.status === 'LOCKED' ? t.usrUnlockTitle : t.usrLockTitle}
          message={confirmLock.status === 'LOCKED' ? t.usrUnlockMsg : t.usrLockMsg}
          confirmLabel={confirmLock.status === 'LOCKED' ? t.usrUnlock : t.usrLock}
          variant={confirmLock.status === 'LOCKED' ? 'warning' : 'danger'}
          busy={busy}
          onConfirm={submitLock}
          onClose={() => setConfirmLock(null)}
        />
      )}
    </PageContainer>
  );
}

/** Nhãn mốc so sánh đi kèm % thay đổi — mỗi thẻ một mốc khác nhau (tuần / ngày). */
function deltaProps(stat: OverviewStat, t: ReturnType<typeof useApp>['t']) {
  return {
    deltaPct: stat.deltaPct,
    comparisonLabel: stat.comparison === 'PREV_DAY' ? t.ovrVsDay : t.ovrVsWeek,
    series: stat.series,
    emptyDeltaLabel: t.ovrNoBaseline,
  };
}

/** Một dòng dịch vụ: icon + tên + badge trạng thái + cột giá trị riêng bên phải. */
type HealthRow = { key: string; label: string; icon: typeof Server; tone: Tone; badge: string; value: string };

function HealthList({ health, apiLatencyMs, checkedAt }: {
  health: SystemStatus;
  apiLatencyMs: number | null;
  checkedAt: Date | null;
}) {
  const { t, lang } = useApp();

  const rows = useMemo<HealthRow[]>(() => {
    const label = (tone: Tone) => tone === 'success' ? t.ovrStatusOk : tone === 'warning' ? t.ovrStatusWarn : t.ovrStatusDown;
    const out: HealthRow[] = [];

    // API — đo THẬT bằng thời gian vòng lặp của chính lời gọi /admin/system vừa rồi (không phải
    // uptime: hệ thống chưa ghi lịch sử ping nên không có số uptime nào để hiển thị trung thực).
    const apiTone: Tone = apiLatencyMs === null ? 'neutral' : apiLatencyMs > 2000 ? 'warning' : 'success';
    out.push({
      key: 'api', label: t.ovrSvcApi, icon: Server, tone: apiTone, badge: label(apiTone),
      value: apiLatencyMs === null ? '—' : `${t.ovrLatency} ${apiLatencyMs} ms`,
    });

    // Bộ máy AI — trạng thái thật từ probe của backend.
    const ai = health.services.find((s) => s.key === 'aiService');
    const aiTone: Tone = ai?.status === 'operational' ? 'success' : 'danger';
    out.push({
      key: 'ai', label: t.ovrSvcAi, icon: Sparkles, tone: aiTone, badge: label(aiTone),
      value: ai?.latencyMs != null ? `${t.ovrLatency} ${ai.latencyMs} ms` : '—',
    });

    // Bộ lập lịch — không có health probe riêng (job @Scheduled chạy trong cùng tiến trình với
    // API), nên chỉ hiển thị khối lượng đang chờ chứ không bịa ra một trạng thái đo được.
    out.push({
      key: 'scheduler', label: t.ovrSvcScheduler, icon: FileText, tone: 'success', badge: label('success'),
      value: t.ovrSchedulerPending.replace('{n}', formatGroupedNumber(health.counters.pendingSchedules, lang)),
    });

    // Lưu trữ — % đã dùng tính từ dung lượng đĩa thật của container.
    if (health.host && health.host.diskTotalGb > 0) {
      const used = Math.round(((health.host.diskTotalGb - health.host.diskFreeGb) / health.host.diskTotalGb) * 100);
      const tone: Tone = used >= 90 ? 'danger' : used >= 75 ? 'warning' : 'success';
      out.push({
        key: 'storage', label: t.ovrSvcStorage, icon: Package, tone, badge: label(tone),
        value: t.ovrStorageUsed.replace('{n}', String(used)),
      });
    }

    return out;
  }, [health, apiLatencyMs, t, lang]);

  // Banner suy từ trạng thái XẤU NHẤT của các dòng ở trên — không hardcode "ổn định".
  const worst: Tone = rows.some((r) => r.tone === 'danger')
    ? 'danger'
    : rows.some((r) => r.tone === 'warning') ? 'warning' : 'success';
  const bannerText = worst === 'danger' ? t.ovrBannerDown : worst === 'warning' ? t.ovrBannerWarn : t.ovrBannerOk;
  const bannerColors = TONE_COLORS[worst];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, background: C.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={r.icon} size={16} stroke={C.primary} />
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.text }}>{r.label}</span>
          <StatusBadge tone={r.tone} label={r.badge} />
          <span style={{ flex: 'none', minWidth: 76, textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: C.ink550 }}>
            {r.value}
          </span>
        </div>
      ))}

      <div style={{ marginTop: 4, padding: '11px 13px', borderRadius: 14, background: bannerColors.bg }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: bannerColors.color }}>{bannerText}</div>
        {checkedAt && (
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
            {t.ovrLastUpdated}: {checkedAt.toLocaleTimeString(lang === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' })}
            {' • '}{formatDateVN(checkedAt)}
          </div>
        )}
      </div>
    </div>
  );
}
