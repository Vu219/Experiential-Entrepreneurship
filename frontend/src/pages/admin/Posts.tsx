import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../../components/ui';
import { PLATFORM_BG } from '../../theme';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/admin/StatusBadge';
import AdminListPage, { DataTable, DetailRow, type ListState } from '../../components/admin/AdminListPage';
import { getPostProblems, type AdminPostProblem, type PostProblemKind } from '../../api/admin';
import PageContainer from '../../components/PageContainer';


export default function Posts() {
  const { t, lang } = useApp();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [rows, setRows] = useState<AdminPostProblem[]>([]);
  const [tab, setTab] = useState<PostProblemKind>('rejected');
  const [selected, setSelected] = useState<AdminPostProblem | null>(null);

  const fetchProblems = () => {
    setLoad('loading');
    getPostProblems(lang).then((r) => { setRows(r); setLoad('ok'); }).catch(() => setLoad('error'));
  };
  useEffect(fetchProblems, [lang]);

  const filtered = useMemo(() => rows.filter((p) => p.kind === tab), [rows, tab]);
  const state: ListState = load === 'loading' ? 'loading' : load === 'error' ? 'error' : filtered.length === 0 ? 'empty' : 'ready';

  const kindMeta = (k: PostProblemKind) => (k === 'rejected' ? { tone: 'danger' as const, label: t.stRejected } : { tone: 'warning' as const, label: t.stSysError });
  const count = (k: PostProblemKind) => rows.filter((p) => p.kind === k).length;

  const tabBtn = (k: PostProblemKind, label: string) => {
    const active = tab === k;
    return (
      <button
        key={k}
        onClick={() => setTab(k)}
        style={{
          border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6', background: active ? (k === 'rejected' ? '#fde8e8' : '#fdf0dc') : '#fff',
          color: active ? (k === 'rejected' ? '#dc2626' : '#d97706') : '#6b6680',
          borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {label} {load === 'ok' && <span style={{ opacity: 0.7 }}>· {count(k)}</span>}
      </button>
    );
  };

  return (
    <PageContainer>
      <AdminListPage
        state={state}
        onRetry={fetchProblems}
        toolbar={<>{tabBtn('rejected', t.tabRejected)}{tabBtn('system', t.tabSysError)}</>}
      >
        <DataTable head={[t.colUser, t.colPlatform, t.colStatus, t.colReason, t.colAction]} minWidth={760}>
          {filtered.map((p) => {
            const m = kindMeta(p.kind);
            return (
              <tr key={p.id} style={{ borderTop: '1px solid #f1eef8' }}>
                <td style={{ padding: '13px 16px', fontSize: 13.5, fontWeight: 600, color: '#2b2543' }}>{p.user}</td>
                <td style={{ padding: '13px 16px' }}><PlatformTag tag={p.platform} bg={PLATFORM_BG[p.platform]} /></td>
                <td style={{ padding: '13px 16px' }}><StatusBadge tone={m.tone} label={m.label} /></td>
                <td style={{ padding: '13px 16px', fontSize: 13, color: '#6b6680', maxWidth: 280 }}>{p.reason}</td>
                <td style={{ padding: '13px 16px' }}>
                  <button onClick={() => setSelected(p)} style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.detail}</button>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </AdminListPage>

      {selected && (
        <Modal title={t.postDetailTitle} maxWidth={520} onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <PlatformTag tag={selected.platform} bg={PLATFORM_BG[selected.platform]} />
            <StatusBadge {...kindMeta(selected.kind)} />
          </div>
          <DetailRow label={t.colUser} value={selected.user} />
          <DetailRow label={t.colDate} value={selected.date} />
          <DetailRow label={t.postReason} value={selected.reason} />
          <DetailRow label={t.postContent} value={selected.content} />
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a59fbb', marginBottom: 6 }}>{t.postPlatformErr}</div>
            <pre style={{ margin: 0, background: '#1f1b2e', color: '#ffd9d9', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>{selected.platformError}</pre>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button style={{ flex: 1, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '10px 0', fontSize: 13.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.actContact}</button>
            <button style={{ flex: 1, border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(120deg,#8b5cf6,#ec4899)', cursor: 'pointer' }}>{t.actRepost}</button>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
