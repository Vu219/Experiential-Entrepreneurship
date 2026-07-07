import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, Icon, Loader } from '../ui';
import {
  getContentDetail,
  type ContentListItem,
  type ContentVersion,
} from '../../api/contentCreationService';
import type { Platform } from '../../api/brandProfile';
import PlatformTabs from './PlatformTabs';
import VersionContent from './VersionContent';
import PostImagePreview from './PostImagePreview';
import BrandVoicePanel from './BrandVoicePanel';
import { CONTENT_STATUS_META, aiLabelKey } from './statusMeta';

/** Xem nội dung READ-ONLY (full-page thay grid, giống BrandProfileView) — mỗi nền tảng một version. */
export default function ContentViewPanel({ item, onClose }: { item: ContentListItem; onClose: () => void }) {
  const { t } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [platform, setPlatform] = useState<Platform>(item.platforms[0]);
  const st = CONTENT_STATUS_META[item.status];

  useEffect(() => {
    let cancelled = false;
    getContentDetail(item.id)
      .then(({ versions: vs }) => {
        if (cancelled) return;
        setVersions(vs);
        setLoad('ok');
      })
      .catch(() => { if (!cancelled) setLoad('error'); });
    return () => { cancelled = true; };
  }, [item.id]);

  const version = versions.find((v) => v.platform === platform) ?? versions[0] ?? null;

  return (
    <div className="view-pop" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onClose} className="btn-soft" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, color: '#574f6e', cursor: 'pointer' }}>
          <Icon icon={ArrowLeft} size={15} stroke="#574f6e" />{t.bpBack}
        </button>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: '#211c38', minWidth: 0 }}>{item.title}</div>
        <span style={{ background: st.bg, color: st.color, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{t[st.labelKey]}</span>
        <span style={{ background: '#f3edff', color: '#7c3aed', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>✨ {t[aiLabelKey(item.status)]}</span>
      </div>

      {load === 'loading' ? (
        <Loader label={t.listLoading} />
      ) : load === 'error' ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: '#8a85a0', fontSize: 14 }}>{t.listError}</div>
      ) : version ? (
        <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.2fr .9fr', gap: 20, alignItems: 'start' }}>
          <Card>
            <div style={{ marginBottom: 18 }}>
              <PlatformTabs platforms={item.platforms} value={version.platform} onChange={setPlatform} />
            </div>
            <VersionContent version={version} />
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: stacked ? 'static' : 'sticky', top: 98 }}>
            <BrandVoicePanel check={version.brandVoice} />
            <PostImagePreview version={version} brandName={item.brandName} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
