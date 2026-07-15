import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { ApiError } from '../../api/apiClient';
import { checkBrandVoice, type ContentVersion } from '../../api/contentCreationService';
import { useToast } from '../toast/ToastProvider';

/**
 * Trạng thái + hành động "Kiểm tra brand voice" dùng chung cho mốc 2/3/4 —
 * gọi service (mock, sau thay API thật) rồi ghi kết quả vào version qua onPatchVersion.
 * Lỗi kiểm tra báo qua toast.
 */
export function useBrandVoiceCheck(
  brandId: string,
  onPatchVersion: (versionId: string, patch: Partial<ContentVersion>) => void,
) {
  const { t } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (version: ContentVersion) => {
    if (busy) return;
    setBusy(true);
    try {
      const brandVoice = await checkBrandVoice({
        brandId,
        platform: version.platform,
        script: version.script,
        caption: version.caption,
      });
      onPatchVersion(version.id, { brandVoice });
    } catch (e) {
      toast.error(`${t.cwVoiceError}: ${(e as ApiError).message}`);
    } finally {
      setBusy(false);
    }
  };

  return { busy, run };
}
