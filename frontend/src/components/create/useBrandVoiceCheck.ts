import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { ApiError } from '../../api/apiClient';
import { checkBrandVoice, type ContentVersion } from '../../api/contentCreationService';

/**
 * Trạng thái + hành động "Kiểm tra brand voice" dùng chung cho mốc 2/3/4 —
 * gọi service (mock, sau thay API thật) rồi ghi kết quả vào version qua onPatchVersion.
 */
export function useBrandVoiceCheck(
  brandId: string,
  onPatchVersion: (versionId: string, patch: Partial<ContentVersion>) => void,
) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (version: ContentVersion) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const brandVoice = await checkBrandVoice({
        brandId,
        platform: version.platform,
        post: version.post,
        caption: version.caption,
      });
      onPatchVersion(version.id, { brandVoice });
    } catch (e) {
      setError(`${t.cwVoiceError}: ${(e as ApiError).message}`);
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run };
}
