import { useEffect, useState } from 'react';
import { MessageSquareHeart, Star } from 'lucide-react';
import PageContainer from '../../components/PageContainer';
import StatCard from '../../components/admin/StatCard';
import Pagination from '../../components/admin/Pagination';
import AdminListPage, { FilterSelect, DataTable, type ListState } from '../../components/admin/AdminListPage';
import { usePageSize } from '../../hooks/usePageSize';
import { useApp } from '../../context/AppContext';
import { getFeedbackSummary, listFeedback, type Feedback, type FeedbackSummary } from '../../api/feedback';
import { C } from '../../styles/colors';

// /admin/feedback — đánh giá & góp ý người dùng gửi từ trong app (G1.3): 2 thẻ tổng quan + bảng lọc theo số sao.

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value}/5`} style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={15} strokeWidth={1.6} color={s <= value ? C.warning : C.borderStrong} fill={s <= value ? C.warning : 'none'} />
      ))}
    </span>
  );
}

export default function AdminFeedback() {
  const { t, lang } = useApp();
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [rows, setRows] = useState<Feedback[]>([]);
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [pageCount, setPageCount] = useState(0);
  const [rating, setRating] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = usePageSize('feedback');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    getFeedbackSummary().then(setSummary).catch(() => setSummary(null));
  }, [reload]);

  useEffect(() => {
    setLoad('loading');
    listFeedback({ rating: rating === 'all' ? undefined : Number(rating), page, size: pageSize })
      .then((p) => { setRows(p.content); setPageCount(p.totalPages); setLoad('ok'); })
      .catch(() => setLoad('error'));
  }, [rating, page, pageSize, reload]);

  useEffect(() => setPage(0), [rating, pageSize]);

  const state: ListState = load === 'loading' ? 'loading' : load === 'error' ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const fmtTime = (iso: string) => new Date(iso).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');

  const toolbar = (
    <FilterSelect
      value={rating}
      onChange={setRating}
      options={[['all', t.fbAdmAllRatings], ...[5, 4, 3, 2, 1].map((s) => [String(s), `${s} ${t.fbAdmStars}`] as [string, string])]}
    />
  );

  return (
    <PageContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18 }}>
          <StatCard icon={MessageSquareHeart} iconBg={C.accentSoft} iconColor={C.primary}
            value={summary ? summary.total.toLocaleString() : '—'} label={t.fbAdmTotal} />
          <StatCard icon={Star} iconBg={C.warningSoft} iconColor={C.warning}
            value={summary && summary.total > 0 ? `${summary.averageRating.toFixed(2)} / 5` : '—'} label={t.fbAdmAverage} />
        </div>

        <AdminListPage state={state} toolbar={toolbar} onRetry={() => setReload((r) => r + 1)} emptyLabel={t.fbAdmEmpty}>
          <DataTable head={[t.fbAdmColTime, t.fbAdmColUser, t.fbAdmColRating, t.fbAdmColComment, t.fbAdmColPage]} minWidth={820}>
            {rows.map((f) => (
              <tr key={f.id} style={{ borderTop: `1px solid ${C.surfaceMuted}`, verticalAlign: 'top' }}>
                <td style={{ padding: '12px 16px', fontSize: 12.5, color: C.textMuted, whiteSpace: 'nowrap' }}>{fmtTime(f.createdAt)}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: C.text }}>{f.userFullName || '—'}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{f.userEmail}</div>
                </td>
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <Stars value={f.rating} />
                  {f.sample && (
                    <span title={t.fbAdmSampleHint} style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: C.textMuted, background: C.surfaceMuted, borderRadius: 999, padding: '2px 8px' }}>
                      {t.fbAdmSample}
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: f.comment ? C.text : C.textFaint, maxWidth: 420, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {f.comment || t.fbAdmNoComment}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: C.textMuted, fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>{f.page || '—'}</td>
              </tr>
            ))}
          </DataTable>
          <div style={{ padding: '0 16px 16px' }}>
            <Pagination page={page + 1} pageCount={pageCount} onChange={(p) => setPage(p - 1)}
              pageSize={pageSize} onPageSizeChange={setPageSize} />
          </div>
        </AdminListPage>
      </div>
    </PageContainer>
  );
}
