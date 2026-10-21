import { useEffect, useState } from 'react';
import { CalendarClock, Coins, ShieldCheck, TrendingUp, type LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { Card, Icon, Loader } from '../ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import UsageDailyChart, { sentenceCase, type UsageChartRange } from './UsageDailyChart';
import { typeColor } from '../dashboard/dashboardTokens';
import { formatVND } from '../../api/admin';
import { aiTaskLabel } from '../../api/adminAi';
import { getMyUsage, type UserUsage } from '../../api/usage';
import { C } from '../../styles/colors';

// Tab "Token & mức dùng" trong trang Cài đặt (UI refactor mục 7 — trước là trang /usage
// riêng): tổng kỳ này so hạn mức + DỰ BÁO cạn hạn mức (tính client từ tốc độ 7 ngày),
// biểu đồ token theo ngày (toggle tuần/tháng + xuất CSV), breakdown theo tính năng,
// giải thích token thô vs token quy đổi, banner cảnh báo ≥80%, card gói hiện tại.
// Nguồn số liệu: event log ai_usage (BE). Chưa có API cho: so sánh kỳ trước, breakdown
// theo model, lịch sử các kỳ trước — xem ghi chú cuối file.


/** Rút gọn số token: 1000 → 1K, 1000000 → 1M (cùng cách hiển thị thanh usage ở sidebar). */
const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${+(n / 1_000).toFixed(1)}K`
      : n.toLocaleString('vi-VN');

const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
/** Kỳ "2026-10" → "10/2026". */
const fmtPeriod = (period: string) => `${period.slice(5, 7)}/${period.slice(0, 4)}`;

export default function UsageTab() {
  const { t, lang, go, brandGradient } = useApp();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [data, setData] = useState<UserUsage | null>(null);
  const [range, setRange] = useState<UsageChartRange>('month');

  const fetchUsage = () => {
    setLoad('loading');
    getMyUsage()
      .then((u) => { setData(u); setLoad('ok'); })
      .catch(() => setLoad('error'));
  };
  useEffect(fetchUsage, []);

  if (load === 'loading') {
    return <Card><Loader label={t.listLoading} /></Card>;
  }
  if (load === 'error' || !data) {
    return (
      <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink550, marginBottom: 14 }}>{t.listError}</div>
        <button onClick={fetchUsage} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </Card>
    );
  }

  const planCode = data.planCode ?? user?.plan ?? 'FREE';
  const planName = (lang === 'en' ? data.planNameEn : data.planNameVi) ?? planCode;
  const pct = data.limit === null ? null : Math.min(data.limit > 0 ? (data.used / data.limit) * 100 : 100, 100);
  // Huy hiệu cạnh tiêu đề: không giới hạn / dưới 80% = xanh, ≥80% = cam, ≥100% = đỏ.
  const toneStyle = pct !== null && pct >= 100 ? { color: C.danger, background: C.roseSoft }
    : pct !== null && pct >= 80 ? { color: C.amberText, background: C.warningSoft }
      : { color: C.success, background: C.successSoft };
  const barFill = pct !== null && pct >= 100 ? '#ef4444' : pct !== null && pct >= 80 ? '#f59e0b' : brandGradient;

  // Lấp ngày trống của kỳ (BE chỉ trả ngày có hoạt động). Kỳ hiện tại = một tháng lịch.
  const [py, pm] = data.billingPeriod.split('-').map(Number);
  const daysInPeriod = new Date(py, pm, 0).getDate();
  const byDay = new Map(data.series.map((p) => [p.day, p.totalTokens]));
  const monthSeries = Array.from({ length: daysInPeriod }, (_, i) => ({ label: String(i + 1), value: byDay.get(i + 1) ?? 0 }));
  // Tuần = 7 ngày gần nhất trong kỳ (kết thúc hôm nay nếu đang ở kỳ hiện tại).
  const now = new Date();
  const endDay = now.getFullYear() === py && now.getMonth() + 1 === pm ? now.getDate() : daysInPeriod;
  const weekSeries = monthSeries.slice(Math.max(0, endDay - 7), endDay);
  const series = range === 'week' ? weekSeries : monthSeries;

  // ===== Dự báo cạn hạn mức (client-side, mục 7) =====
  // Tốc độ = trung bình token THÔ 7 ngày gần nhất, quy về đơn vị QUY ĐỔI bằng tỉ lệ
  // used/tổng-thô của kỳ (không có API pace billable riêng). Nếu ngày cạn dự kiến nằm
  // ngoài kỳ → hiển thị % dự kiến dùng đến cuối kỳ.
  const totalRaw = monthSeries.reduce((a, p) => a + p.value, 0);
  const raw7Avg = weekSeries.length > 0 ? weekSeries.reduce((a, p) => a + p.value, 0) / weekSeries.length : 0;
  const billablePerDay = totalRaw > 0 ? raw7Avg * (data.used / totalRaw) : 0;
  let forecastText: string = t.tuForecastNoData;
  if (data.limit === null) {
    forecastText = t.usageUnlimited;
  } else if (billablePerDay > 0) {
    const daysLeftInPeriod = daysInPeriod - endDay;
    const daysToExhaust = (data.limit - data.used) / billablePerDay;
    if (daysToExhaust <= daysLeftInPeriod) {
      const d = new Date(now);
      d.setDate(d.getDate() + Math.max(0, Math.floor(daysToExhaust)));
      forecastText = t.tuForecastDate.replace('{d}', `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`);
    } else {
      const projPct = Math.round(((data.used + billablePerDay * daysLeftInPeriod) / data.limit) * 100);
      forecastText = t.tuForecastPct.replace('{p}', String(projPct));
    }
  }

  // Xuất CSV token theo ngày của kỳ hiện tại (BOM UTF-8 để Excel đọc đúng).
  const exportCsv = () => {
    const rows = ['date,raw_tokens', ...monthSeries.map((p) => `${data.billingPeriod}-${p.label.padStart(2, '0')},${p.value}`)];
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aima-usage-${data.billingPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const daysLeft = Math.max(0, Math.ceil((new Date(data.periodEnd).getTime() - now.getTime()) / 86_400_000));
  const hasActivity = data.byFeature.length > 0;
  const maxFeature = Math.max(...data.byFeature.map((f) => f.totalTokens), 1);
  const featureTotal = data.byFeature.reduce((sum, f) => sum + f.totalTokens, 0);
  const noCredit = (data.creditLeft ?? 0) <= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Banner cảnh báo ngưỡng ≥80% (khi KHÔNG còn token mua thêm — còn credit thì
          các dòng credit bên dưới lo) + CTA nâng gói / mua thêm token. */}
      {pct !== null && pct >= 80 && noCredit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 12, background: pct >= 100 ? C.legacyBgfdeaea : C.legacyBgfff7ed, border: `1px solid ${pct >= 100 ? C.legacyBorderfecaca : C.legacyBorderfed7aa}` }}>
          <span style={{ flex: '1 1 260px', fontSize: 13, fontWeight: 600, color: pct >= 100 ? C.legacyTextb91c1c : C.amberText }}>
            {t.tuWarnBanner.replace('{p}', String(Math.round(pct)))}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => go('pricing')} style={{ border: 'none', borderRadius: 9, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>{t.tuWarnUpgrade}</button>
            <button onClick={() => go('pricing')} style={{ border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, color: C.ink550, background: C.surface, cursor: 'pointer' }}>{t.tuWarnBuy}</button>
          </div>
        </div>
      )}

      {/* Tổng quan kỳ này — MỘT card thay cho 3 thẻ rời + thanh tiến trình riêng (trước lặp số "đã dùng" 2 lần và
          để trống nhiều khi không giới hạn). Trái: số đã dùng + hạn mức + thanh; phải: dự báo · ngày đặt lại · TB 7 ngày. */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.35fr) minmax(0, 1fr)' }}>
          <div style={{ padding: isMobile ? '20px 20px 18px' : '24px 28px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.textFaint }}>
                {t.usageTitle} · {fmtPeriod(data.billingPeriod)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 999, padding: '4px 11px', ...toneStyle }}>
                {pct === null ? t.usageUnlimited : `${Math.round(pct)}%`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span title={data.used.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}
                style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: isMobile ? 34 : 40, lineHeight: 1, color: C.textStrong }}>
                {fmtTokens(data.used)}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.textMuted }}>
                / {data.limit === null ? '∞' : fmtTokens(data.limit)} token
              </span>
            </div>
            {/* Không giới hạn: thanh đầy màu thương hiệu nhạt — không giả vờ là % đã dùng. */}
            <div style={{ height: 10, borderRadius: 999, background: C.track, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                width: pct === null ? '100%' : `${Math.max(pct, data.used > 0 ? 2 : 0)}%`,
                background: pct === null ? brandGradient : barFill, opacity: pct === null ? 0.35 : 1,
              }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: C.textMuted }}>
              <span style={{ fontWeight: 700, color: C.text }}>{planName}</span>
              <span aria-hidden>·</span>
              <span>{data.unlimitedPlan ? t.tuAllUnlimited : data.limit === null ? t.usageUnlimited : `${t.tuLimit}: ${fmtTokens(data.limit)}`}</span>
            </div>
            {/* Token mua thêm: ≥80% mà còn credit thì KHÔNG cảnh báo — báo sẽ chuyển sang dùng credit */}
            {(data.creditLeft ?? 0) > 0 && pct !== null && pct >= 80 && (
              <div style={{ fontSize: 12.5, color: C.accentTextMuted, fontWeight: 600 }}>
                {(pct >= 100 ? t.tuCreditActive : t.tuCreditSoon).replace('{n}', fmtTokens(data.creditLeft ?? 0))}
              </div>
            )}
            {(data.creditUsed ?? 0) > 0 && (
              <div style={{ fontSize: 12.5, color: C.textMuted }}>
                {t.tuCreditUsedLine.replace('{n}', fmtTokens(data.creditUsed ?? 0))}
              </div>
            )}
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center', background: C.surfaceSubtle,
            borderLeft: isMobile ? 'none' : `1px solid ${C.surfaceMuted}`, borderTop: isMobile ? `1px solid ${C.surfaceMuted}` : 'none',
            padding: isMobile ? '4px 20px' : '8px 28px',
          }}>
            <MetricRow icon={TrendingUp} tint={C.purpleSoft} color={C.primary} label={t.tuForecast} value={forecastText} />
            <MetricRow icon={CalendarClock} tint={C.successSoft} color={C.success} label={t.tuReset} divider
              value={fmtDate(data.periodEnd)} hint={daysLeft > 0 ? t.tuDaysLeft.replace('{n}', String(daysLeft)) : undefined} />
            <MetricRow icon={Coins} tint={C.warningSoft} color={C.amberText} label={t.tuAvg7} divider
              value={t.tuPerDay.replace('{n}', fmtTokens(Math.round(raw7Avg)))} />
          </div>
        </div>
      </Card>

      {/* Token theo ngày trong kỳ + Tuần/Tháng + xuất CSV — xem UsageDailyChart. */}
      <UsageDailyChart
        points={series.map((p) => ({ day: Number(p.label), value: p.value }))}
        period={data.billingPeriod}
        range={range}
        onRangeChange={setRange}
        onExport={exportCsv}
        empty={hasActivity ? undefined : (
          <div style={{ textAlign: 'center', padding: '40px 16px 24px' }}>
            <div style={{ fontSize: 13.5, color: C.textMuted, marginBottom: planCode === 'FREE' ? 6 : 0 }}>{t.tuEmpty}</div>
            {planCode === 'FREE' && <div style={{ fontSize: 12.5, color: C.textFaint, marginBottom: 14 }}>{t.tuFreeHint}</div>}
            {planCode === 'FREE' && (
              <button onClick={() => go('pricing')} className="btn-grad" style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>{t.tuViewPlans}</button>
            )}
          </div>
        )}
      />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        {/* Breakdown theo tính năng AI: mỗi tính năng một màu + tỷ trọng. (Theo MODEL cần API bổ sung.) */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.textStrong }}>{t.tuByFeature}</div>
          <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 3 }}>{sentenceCase(t.tuRawNote)}</div>
          {hasActivity ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 18 }}>
                {data.byFeature.map((f, i) => {
                  const share = featureTotal > 0 ? Math.round((f.totalTokens / featureTotal) * 100) : 0;
                  return (
                    <div key={f.taskCode}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                        <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, flex: 'none', background: typeColor(i) }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {aiTaskLabel(lang, f.taskCode)}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>{share}%</span>
                        <span style={{ minWidth: 48, textAlign: 'right', fontSize: 13.5, fontWeight: 800, color: C.textStrong }}>{fmtTokens(f.totalTokens)}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: C.track, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(2, (f.totalTokens / maxFeature) * 100)}%`, borderRadius: 999, background: typeColor(i) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.surfaceMuted}`, fontSize: 13 }}>
                <span style={{ color: C.textMuted, fontWeight: 600 }}>{t.tuRangeTotal}</span>
                <span style={{ fontWeight: 800, color: C.textStrong }}>{fmtTokens(featureTotal)}</span>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: C.textMuted, fontSize: 13.5 }}>{t.tuEmpty}</div>
          )}
        </Card>

        {/* Card gói hiện tại (hạn mức sửa ở Quản lý gói, đây chỉ hiển thị) */}
        <Card style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 22px 18px', background: C.surfaceSubtle, borderBottom: `1px solid ${C.surfaceMuted}` }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.textFaint }}>{t.tuPlanCard}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <span className="gradtext" style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 26, lineHeight: 1.15 }}>{planName}</span>
              {data.unlimitedPlan && (
                <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 999, padding: '4px 11px', color: C.success, background: C.successSoft }}>{t.usageUnlimited}</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
              {data.planPrice === null || data.planPrice === 0 ? t.tuPriceFree : formatVND(data.planPrice)}
            </div>
          </div>
          <div style={{ padding: '4px 22px', flex: 1 }}>
            <MetricRow icon={Coins} tint={C.warningSoft} color={C.amberText} label={t.tuLimit}
              value={data.limit === null ? t.usageUnlimited : `${fmtTokens(data.limit)} token`} />
            {data.unlimitedPlan && (
              <MetricRow icon={ShieldCheck} tint={C.successSoft} color={C.success} label={t.tuFeatures} value={t.tuAllUnlimited} divider />
            )}
            <MetricRow icon={CalendarClock} tint={C.purpleSoft} color={C.primary} label={t.tuReset} divider
              value={fmtDate(data.periodEnd)} hint={daysLeft > 0 ? t.tuDaysLeft.replace('{n}', String(daysLeft)) : undefined} />
          </div>
          <div style={{ padding: '0 22px 20px' }}>
            {data.unlimitedPlan ? (
              <button onClick={() => go('billing')} className="btn-soft" style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 11, padding: 10, fontWeight: 700, fontSize: 13, color: C.primaryStrong, background: C.surface, cursor: 'pointer' }}>{t.tuManagePlan}</button>
            ) : (
              <button onClick={() => go('pricing')} className="btn-grad" style={{ width: '100%', border: 'none', borderRadius: 11, padding: 10, fontWeight: 700, fontSize: 13, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>{t.upgradeBtn}</button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Một chỉ số phụ ở cột phải card tổng quan: icon + nhãn + giá trị (+ gợi ý nhỏ). */
function MetricRow({ icon, tint, color, label, value, hint, divider = false }: {
  icon: LucideIcon; tint: string; color: string; label: string; value: string; hint?: string; divider?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0',
      borderTop: divider ? `1px solid ${C.surfaceMuted}` : 'none',
    }}>
      <span style={{ width: 36, height: 36, borderRadius: 11, background: tint, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon icon={icon} size={17} stroke={color} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.textStrong }}>{value}</span>
          {hint && <span style={{ fontSize: 12, fontWeight: 600, color: C.textFaint }}>{hint}</span>}
        </div>
      </div>
    </div>
  );
}

// CẦN API BACKEND BỔ SUNG (mục 7 — các cải tiến chưa làm được từ dữ liệu hiện có):
// 1. So sánh với kỳ trước (mũi tên ± % + biểu đồ chồng kỳ): /users/me/usage cần trả
//    thêm prevUsed / prevSeries.
// 2. Breakdown theo model: cần thêm byModel[] (modelCode, totalTokens).
// 3. Lịch sử các kỳ trước (bảng kỳ / token / % hạn mức / chi phí + CSV): cần endpoint
//    /users/me/usage/history.
