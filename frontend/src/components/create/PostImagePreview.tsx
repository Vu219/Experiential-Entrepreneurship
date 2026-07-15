import type { ReactNode } from 'react';
import {
  Bookmark,
  Globe,
  Heart,
  ImagePlus,
  Link2,
  MessageCircle,
  Repeat2,
  Send,
  Share2,
  ThumbsUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Dict } from '../../i18n';
import { Card, Icon, PlatformTag } from '../ui';
import { PLATFORM_BG } from '../../theme';
import type { ContentVersion } from '../../api/contentCreationService';

/**
 * Preview ẢNH bài đăng — mô phỏng đúng khung feed của TỪNG nền tảng:
 * Facebook (caption dài + link phía trên ảnh, hàng Thích/Bình luận/Chia sẻ),
 * Instagram (ảnh vuông trên, hàng icon, caption + hashtag dưới),
 * Threads (dạng hội thoại ngắn: avatar + vạch dọc, text gọn, ảnh thumbnail).
 * `version = null` → khung placeholder (mốc 2 lúc chưa tạo — giữ nguyên bố cục).
 */
export default function PostImagePreview({
  version,
  brandName,
  imageBusy = false,
  onGenerateImage,
}: {
  version: ContentVersion | null;
  brandName: string;
  imageBusy?: boolean;
  onGenerateImage?: () => void;
}) {
  const { t, brandGradient } = useApp();

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: '#211c38' }}>{t.cwPreviewTitle}</div>
        {version && onGenerateImage && (
          <button
            onClick={onGenerateImage}
            disabled={imageBusy}
            className="btn-grad"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9, padding: '7px 12px', fontSize: 11.5, fontWeight: 700, color: '#fff', background: brandGradient, cursor: imageBusy ? 'not-allowed' : 'pointer', opacity: imageBusy ? 0.6 : 1 }}
          >
            <Icon icon={ImagePlus} size={13} stroke="#fff" />
            {imageBusy ? t.cwGenImageBusy : t.cwGenImage}
          </button>
        )}
      </div>

      {version === null ? (
        // Placeholder mốc 2 lúc chưa tạo — khung giữ nguyên, nội dung "đổ vào" sau.
        <div style={{ border: '1.5px dashed #d9cef5', borderRadius: 14, padding: '48px 20px', textAlign: 'center', background: '#fdfcff' }}>
          <div style={{ fontSize: 12.5, color: '#a59fbb', lineHeight: 1.55 }}>{t.cwPreviewEmpty}</div>
        </div>
      ) : version.platform === 'FACEBOOK' ? (
        <FacebookFrame version={version} brandName={brandName} />
      ) : version.platform === 'INSTAGRAM' ? (
        <InstagramFrame version={version} brandName={brandName} />
      ) : (
        <ThreadsFrame version={version} brandName={brandName} />
      )}
    </Card>
  );
}

// ---- Các mảnh dùng chung giữa 3 khung ----

const frame = { border: '1px solid #ece7f6', borderRadius: 14, overflow: 'hidden', background: '#fff' } as const;

/** Nhãn nhỏ phân biệt Caption / Hashtag bên trong preview — giữ gọn, đúng design system. */
const previewSectionLabel = { fontSize: 10, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 4 } as const;

/** Khối hashtag tách riêng dùng chung cho cả 3 frame preview. */
function HashtagBlock({ hashtags, t }: { hashtags: string[]; t: Dict }) {
  if (!hashtags.length) return null;
  return (
    <div style={{ marginTop: 8, borderTop: '1px solid #f1edfa', paddingTop: 6 }}>
      <div style={previewSectionLabel}>{t.cwTabHashtag}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {hashtags.map((h, i) => (
          <span key={i} style={{ color: '#7c3aed', fontWeight: 600, fontSize: 12 }}>{h}</span>
        ))}
      </div>
    </div>
  );
}

function AiBadge() {
  const { t } = useApp();
  return <span style={{ marginLeft: 'auto', flex: 'none', background: '#f3edff', color: '#7c3aed', borderRadius: 7, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>✨ {t.cwAiLabel}</span>;
}

function ImageArea({ version, ratio }: { version: ContentVersion; ratio: string }) {
  const { t } = useApp();
  return version.imageUrl ? (
    <div style={{ aspectRatio: ratio, background: '#faf8fe', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <img src={version.imageUrl} alt={version.mediaPrompt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  ) : (
    <div style={{ background: '#faf8fe', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', fontSize: 12, color: '#a59fbb', lineHeight: 1.55 }}>{t.cwNoImage}</div>
    </div>
  );
}

function ActionRow({ items }: { items: [ReactNode, string?][] }) {
  return (
    <div style={{ display: 'flex', gap: 18, padding: '9px 12px', color: '#574f6e' }} aria-hidden>
      {items.map(([icon, label], i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600 }}>
          {icon}{label}
        </span>
      ))}
    </div>
  );
}

// ---- Facebook: header trang + caption + hashtag (tách riêng) + link + ảnh ngang + Thích/Bình luận/Chia sẻ ----
function FacebookFrame({ version, brandName }: { version: ContentVersion; brandName: string }) {
  const { t } = useApp();
  return (
    <div style={frame}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px' }}>
        <PlatformTag tag="FB" bg={PLATFORM_BG.FB} size={32} radius={16} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#211c38' }}>{brandName}</div>
          <div style={{ fontSize: 10.5, color: '#a59fbb', display: 'flex', alignItems: 'center', gap: 4 }}>
            Facebook · <Icon icon={Globe} size={10} stroke="#a59fbb" />
          </div>
        </div>
        <AiBadge />
      </div>
      {/* FB: caption + hashtag TÁCH RIÊNG, đứng TRÊN ảnh, kèm link */}
      <div style={{ padding: '0 12px 10px', fontSize: 12.5, color: '#3f3a55', lineHeight: 1.55 }}>
        <div style={previewSectionLabel}>{t.cwTabCaption}</div>
        {version.caption}
        <HashtagBlock hashtags={version.hashtags} t={t} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, background: '#f4f2fb', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#574f6e' }} aria-hidden>
          <Icon icon={Link2} size={11} stroke="#574f6e" />aima.vn
        </span>
      </div>
      <ImageArea version={version} ratio="4/3" />
      <ActionRow
        items={[
          [<Icon key="l" icon={ThumbsUp} size={15} stroke="#574f6e" />, t.cwActLike],
          [<Icon key="c" icon={MessageCircle} size={15} stroke="#574f6e" />, t.cwActComment],
          [<Icon key="s" icon={Share2} size={15} stroke="#574f6e" />, t.cwActShare],
        ]}
      />
    </div>
  );
}

// ---- Instagram: ảnh vuông trên → hàng icon → caption (tách riêng) + hashtag (tách riêng) dưới ----
function InstagramFrame({ version, brandName }: { version: ContentVersion; brandName: string }) {
  const { t } = useApp();
  return (
    <div style={frame}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px' }}>
        <PlatformTag tag="IG" bg={PLATFORM_BG.IG} size={30} radius={15} />
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#211c38', minWidth: 0 }}>{brandName.toLowerCase().replace(/\s+/g, '.')}</div>
        <AiBadge />
      </div>
      <ImageArea version={version} ratio="1/1" />
      <div style={{ display: 'flex', alignItems: 'center', padding: '9px 12px', color: '#574f6e' }} aria-hidden>
        <span style={{ display: 'inline-flex', gap: 14 }}>
          <Icon icon={Heart} size={17} stroke="#574f6e" />
          <Icon icon={MessageCircle} size={17} stroke="#574f6e" />
          <Icon icon={Send} size={17} stroke="#574f6e" />
        </span>
        <span style={{ marginLeft: 'auto' }}><Icon icon={Bookmark} size={17} stroke="#574f6e" /></span>
      </div>
      <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#3f3a55', lineHeight: 1.5 }}>
        <div style={previewSectionLabel}>{t.cwTabCaption}</div>
        <span style={{ fontWeight: 700 }}>{brandName.toLowerCase().replace(/\s+/g, '.')}</span> {version.caption}
        <HashtagBlock hashtags={version.hashtags} t={t} />
      </div>
    </div>
  );
}

// ---- Threads: dạng hội thoại — avatar + vạch dọc, caption + hashtag tách riêng, ảnh thumbnail nhỏ ----
function ThreadsFrame({ version, brandName }: { version: ContentVersion; brandName: string }) {
  const { t } = useApp();
  return (
    <div style={{ ...frame, padding: '12px 12px 6px' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
          <PlatformTag tag="TH" bg={PLATFORM_BG.TH} size={30} radius={15} />
          {/* vạch hội thoại dọc kiểu Threads */}
          <div style={{ flex: 1, width: 2, borderRadius: 2, background: '#ece7f6', marginTop: 6 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#211c38' }}>{brandName.toLowerCase().replace(/\s+/g, '.')}</span>
            <AiBadge />
          </div>
          <div style={{ marginTop: 4, fontSize: 12.5, color: '#3f3a55', lineHeight: 1.55 }}>
            <div style={previewSectionLabel}>{t.cwTabCaption}</div>
            {version.caption}
            <HashtagBlock hashtags={version.hashtags} t={t} />
          </div>
          {version.imageUrl && (
            <img src={version.imageUrl} alt={version.mediaPrompt} style={{ marginTop: 8, width: '70%', maxWidth: 220, borderRadius: 12, border: '1px solid #ece7f6', display: 'block' }} />
          )}
          <div style={{ display: 'flex', gap: 14, marginTop: 10, color: '#574f6e' }} aria-hidden>
            <Icon icon={Heart} size={15} stroke="#574f6e" />
            <Icon icon={MessageCircle} size={15} stroke="#574f6e" />
            <Icon icon={Repeat2} size={15} stroke="#574f6e" />
            <Icon icon={Send} size={15} stroke="#574f6e" />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 4px 40px', fontSize: 11, color: '#a59fbb' }}>{t.cwActReply}…</div>
    </div>
  );
}
