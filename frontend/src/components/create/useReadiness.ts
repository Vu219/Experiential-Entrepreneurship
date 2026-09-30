import { useEffect, useState } from 'react';
import { listConnections } from '../../api/connections';
import { getPublishingSettings, type PublishingSettings } from '../../api/schedules';
import type { Platform } from '../../api/brandProfile';
import type { ContentVersion, SaveReviewChoice } from '../../api/contentCreationService';

// "Sẵn sàng lên lịch" theo từng nền tảng ở mốc 3 — MỘT nguồn cho chấm trạng thái trên tab, checklist và dòng
// nhắc dưới nút "Tiếp theo". Điều kiện khớp các lý do khóa ở mốc 4 (plannerLogic.blockOf) + brand voice dưới ngưỡng
// khi user bật chặn. Chỉ là gợi ý UX — server kiểm lại mọi điều kiện.

/** Ngưỡng brand voice khi user chưa đặt ở Cài đặt → Đăng bài (user chốt 30/9/2026). */
export const DEFAULT_VOICE_THRESHOLD = 70;

export type ReadinessIssue = 'IG_MEDIA' | 'NOT_FORMATTED' | 'NO_ACCOUNT' | 'VOICE_LOW';

export interface PlatformReadiness {
  version: ContentVersion | undefined;
  formatted: boolean;
  /** null = chưa tải được danh sách kết nối (không coi là thiếu). */
  connected: boolean | null;
  issues: ReadinessIssue[];
}

/** Bản nền tảng đang làm việc — CÙNG bản được sửa ở cột trái và được đem lên lịch (không dùng `some`). */
export const versionOf = (versions: ContentVersion[], p: Platform) => versions.find((v) => v.platform === p);
export const isFormatted = (v: ContentVersion | undefined) => v?.status === 'FORMATTED';

export function useReadiness(platforms: Platform[], versions: ContentVersion[], status: SaveReviewChoice) {
  const [connected, setConnected] = useState<Set<Platform> | null>(null);
  const [settings, setSettings] = useState<PublishingSettings | null>(null);

  useEffect(() => {
    listConnections()
      .then((conns) => setConnected(new Set(conns
        .filter((c) => c.connectionStatus === 'ACTIVE' && !(c.platform === 'FACEBOOK' && c.accountType !== 'PAGE'))
        .map((c) => c.platform as Platform))))
      .catch(() => setConnected(null));
    getPublishingSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  const voiceThreshold = settings?.brandVoiceThreshold ?? DEFAULT_VOICE_THRESHOLD;
  const byPlatform = Object.fromEntries(platforms.map((p): [Platform, PlatformReadiness] => {
    const version = versionOf(versions, p);
    const formatted = isFormatted(version);
    const isConnected = connected ? connected.has(p) : null;
    const issues: ReadinessIssue[] = [];
    if (p === 'INSTAGRAM') issues.push('IG_MEDIA');
    else {
      if (!formatted) issues.push('NOT_FORMATTED');
      if (isConnected === false) issues.push('NO_ACCOUNT');
      if (settings?.brandVoiceBlockingEnabled && settings.brandVoiceThreshold != null
        && (version?.brandVoice.score ?? 0) < settings.brandVoiceThreshold) issues.push('VOICE_LOW');
    }
    return [p, { version, formatted, connected: isConnected, issues }];
  })) as Record<Platform, PlatformReadiness>;

  return {
    byPlatform,
    settings,
    voiceThreshold,
    /** Đang bật bắt buộc duyệt mà chưa chọn Đã duyệt → lịch sẽ bị tạm giữ (không chặn lên lịch). */
    approvalNeeded: !!settings?.requireApproval && status !== 'APPROVED',
    eligible: platforms.filter((p) => byPlatform[p].issues.length === 0),
  };
}

export type Readiness = ReturnType<typeof useReadiness>;
