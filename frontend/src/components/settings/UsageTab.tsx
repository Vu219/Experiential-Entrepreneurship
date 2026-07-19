import { useEffect, useState } from 'react';
import { CalendarClock, Coins, Download, HelpCircle, TrendingUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { Card, Loader } from '../ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import StatCard from '../admin/StatCard';
import SectionCard from '../admin/SectionCard';
import BarChart from '../admin/BarChart';
import { formatVND } from '../../api/admin';
import { aiTaskLabel } from '../../api/adminAi';
import { getMyUsage, type UserUsage } from '../../api/usage';

// Tab "Token & mức dùng" trong trang Cài đặt (UI refactor mục 7 — trước là trang /usage
// riêng): tổng kỳ này so hạn mức + DỰ BÁO cạn hạn mức (tính client từ tốc độ 7 ngày),
// biểu đồ token theo ngày (toggle tuần/tháng + xuất CSV), breakdown theo tính năng,
// giải thích token thô vs token quy đổi, banner cảnh báo ≥80%, card gói hiện tại.
// Nguồn số liệu: event log ai_usage (BE). Chưa có API cho: so sánh kỳ trước, breakdown
// theo model, lịch sử các kỳ trước — xem ghi chú cuối file.

type ChartRange = 'week' | 'month';

/** Rút gọn số token: 1000 → 1K, 1000000 → 1M (cùng cách hiển thị thanh usage ở sidebar). */
const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${+(n / 1_000).toFixed(1)}K`
      : n.toLocaleString('vi-VN');

const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default function UsageTab() {
  const { t, lang, go, brandGradient } = useApp();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [data, setData] = useState<UserUsage | null>(null);
  const [range, setRange] = useState<ChartRange>('month');
  const [rawOpen, setRawOpen] = useState(false);

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
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670', marginBottom: 14 }}>{t.listError}</div>
        <button onClick={fetchUsage} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </Card>
    );
  }

  const planCode = data.planCode ?? user?.plan ?? 'FREE';
  const planName = (lang === 'en' ? data.planNameEn : data.planNameVi) ?? planCode;
  const pct = data.limit === null ? null : Math.min(data.limit > 0 ? (data.used / data.limit) * 100 : 100, 100);
  const pctTone = pct === null ? 'success' : pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'success';
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

  const hasActivity = data.byFeature.length > 0;
  const maxFeature = Math.max(...data.byFeature.map((f) => f.totalTokens), 1);
  const noCredit = (data.creditLeft ?? 0) <= 0;

  const rangeBtn = (r: ChartRange, label: string) => {
    const active = range === r;
    return (
      <button key={r} onClick={() => setRange(r)} style={{ border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6', background: active ? brandGradient : '#fff', color: active ? '#fff' : '#5b5670', borderRadius: 9, padding: '6px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Banner cảnh báo ngưỡng ≥80% (khi KHÔNG còn token mua thêm — còn credit thì
          các dòng credit bên dưới lo) + CTA nâng gói / mua thêm token. */}
      {pct !== null && pct >= 80 && noCredit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 12, background: pct >= 100 ? '#fdeaea' : '#fff7ed', border: `1px solid ${pct >= 100 ? '#fecaca' : '#fed7aa'}` }}>
          <span style={{ flex: '1 1 260px', fontSize: 13, fontWeight: 600, color: pct >= 100 ? '#b91c1c' : '#b45309' }}>
            {t.tuWarnBanner.replace('{p}', String(Math.round(pct)))}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => go('pricing')} style={{ border: 'none', borderRadius: 9, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.tuWarnUpgrade}</button>
            <button onClick={() => go('pricing')} style={{ border: '1px solid #ece8f6', borderRadius: 9, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, color: '#5b5670', background: '#fff', cursor: 'pointer' }}>{t.tuWarnBuy}</button>
          </div>
        </div>
      )}

      {/* Hàng chỉ số: Đã dùng · Dự báo · Ngày reset. Card "Hạn mức kỳ này" cũ đã bỏ —
          hạn mức chỉ còn ở thanh tiến trình + card Gói (tránh lặp 3 lần trên 1 màn). */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 18 }}>
        <StatCard icon={Coins} iconBg="linear-gradient(135deg,#f1e9ff,#fae9ff)" iconColor="#8b5cf6"
          value={fmtTokens(data.used)} label={`${t.tuUsed} · ${data.billingPeriod}`}
          pill={pct === null ? null : `${Math.round(pct)}%`} pillTone={pctTone} />
        <StatCard icon={TrendingUp} iconBg="linear-gradient(135deg,#e9f0ff,#f1e9ff)" iconColor="#6366f1"
          value={forecastText} label={t.tuForecast} valueFontSize={15} />
        <StatCard icon={CalendarClock} iconBg="linear-gradient(135deg,#e7fff4,#e9f7ff)" iconColor="#10b981"
          value={fmtDate(data.periodEnd)} label={t.tuReset} valueFontSize={22} />
      </div>

      {/* Thanh tiến trình mức dùng (cùng ngôn ngữ hình ảnh thanh usage ở sidebar) */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#7d6aa3' }}>{t.usageTitle}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#5b5670' }}>
            {fmtTokens(data.used)} / {data.limit === null ? '∞' : fmtTokens(data.limit)}
          </span>
        </div>
        {data.limit !== null ? (
          <div style={{ height: 8, borderRadius: 999, background: '#ece6f8', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: barFill, transition: 'width .4s ease' }} />
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#a59fbb' }}>{t.usageUnlimited}</div>
        )}
        {/* Token mua thêm: ≥80% mà còn credit thì KHÔNG cảnh báo — báo sẽ chuyển sang dùng credit */}
        {(data.creditLeft ?? 0) > 0 && pct !== null && pct >= 80 && (
          <div style={{ fontSize: 12.5, color: '#7d6aa3', fontWeight: 600, marginTop: 8 }}>
            {(pct >= 100 ? t.tuCreditActive : t.tuCreditSoon).replace('{n}', fmtTokens(data.creditLeft ?? 0))}
          </div>
        )}
        {(data.creditUsed ?? 0) > 0 && (
          <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 4 }}>
            {t.tuCreditUsedLine.replace('{n}', fmtTokens(data.creditUsed ?? 0))}
          </div>
        )}
      </Card>

      {/* Token theo ngày trong kỳ + toggle tuần/tháng + xuất CSV */}
      <SectionCard
        title={`${t.tuChartTitle} (${t.tuRawNote})`}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {rangeBtn('week', t.tuWeek)}{rangeBtn('month', t.tuMonth)}
            <button onClick={exportCsv} title={t.tuExportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>
              <Download size={13} strokeWidth={2.2} /> {t.tuExportCsv}
            </button>
          </div>
        }
      >
        {/* Accordion giải thích token thô vs token quy đổi (chuỗi "token thô — chưa quy
            đổi hạn mức" xuất hiện nhiều nơi mà chưa được giải thích). */}
        <button onClick={() => setRawOpen((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', padding: 0, marginBottom: rawOpen ? 8 : 14, fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}>
          <HelpCircle size={14} strokeWidth={2.2} /> {t.tuRawWhat}
        </button>
        {rawOpen && (
          <div style={{ fontSize: 12.5, color: '#5b5670', lineHeight: 1.6, background: '#f8f6fd', border: '1px solid #eee9f6', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            {t.tuRawExplain}
          </div>
        )}
        {hasActivity ? (
          <BarChart series={series} background={brandGradient} />
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 16px' }}>
            <div style={{ fontSize: 13.5, color: '#8a85a0', marginBottom: planCode === 'FREE' ? 6 : 0 }}>{t.tuEmpty}</div>
            {planCode === 'FREE' && <div style={{ fontSize: 12.5, color: '#a59fbb', marginBottom: 14 }}>{t.tuFreeHint}</div>}
            {planCode === 'FREE' && (
              <button onClick={() => go('pricing')} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.tuViewPlans}</button>
            )}
          </div>
        )}
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Breakdown theo tính năng AI. (Breakdown theo MODEL cần API bổ sung —
            /users/me/usage chưa trả byModel.) */}
        <SectionCard title={`${t.tuByFeature} (${t.tuRawNote})`}>
          {hasActivity ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.byFeature.map((f) => (
                <div key={f.taskCode}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#3f3a55' }}>{aiTaskLabel(lang, f.taskCode)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#5b5670' }}>{fmtTokens(f.totalTokens)}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: '#ece6f8', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(f.totalTokens / maxFeature) * 100}%`, borderRadius: 999, background: brandGradient }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '28px 16px', color: '#8a85a0', fontSize: 13.5 }}>{t.tuEmpty}</div>
          )}
        </SectionCard>

        {/* Card gói hiện tại + CTA nâng cấp (hạn mức sửa ở Quản lý gói, đây chỉ hiển thị) */}
        <SectionCard title={t.tuPlanCard}>
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, color: '#211c38' }}>{planName}</div>
          <div style={{ fontSize: 13, color: '#8a85a0', margin: '2px 0 12px' }}>
            {data.planPrice === null || data.planPrice === 0 ? 'Free' : formatVND(data.planPrice)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 0', borderTop: '1px solid #f1eef8', fontSize: 13 }}>
            <span style={{ color: '#8a85a0' }}>{t.tuLimit}</span>
            <span style={{ fontWeight: 700, color: '#3f3a55' }}>{data.limit === null ? t.usageUnlimited : fmtTokens(data.limit)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 0', borderTop: '1px solid #f1eef8', fontSize: 13, marginBottom: 12 }}>
            <span style={{ color: '#8a85a0' }}>{t.tuReset}</span>
            <span style={{ fontWeight: 700, color: '#3f3a55' }}>{fmtDate(data.periodEnd)}</span>
          </div>
          {planCode !== 'PRO' && (
            <button onClick={() => go('pricing')} style={{ width: '100%', border: 'none', borderRadius: 10, padding: 10, fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.upgradeBtn}</button>
          )}
        </SectionCard>
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
