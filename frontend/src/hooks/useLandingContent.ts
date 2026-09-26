import { useEffect, useState } from 'react';
import { getPublicLanding, type LandingContent } from '../api/landing';
import { DEFAULT_LANDING } from '../config/landingDefaults';

// Cache module-level: Landing + /pricing (FAQ, CTA, Footer) dùng chung một lần gọi cho cả phiên.
let cache: LandingContent | null = null;
let pending: Promise<LandingContent> | null = null;

// Bản đã xuất bản lần gần nhất lưu ở localStorage: lượt vào sau render ĐÚNG nội dung ngay từ
// frame đầu (không nháy nội dung mặc định cũ rồi mới đổi → không layout shift), API vẫn làm mới
// ở nền. Lỗi đọc/ghi (chế độ riêng tư, bị chặn) → bỏ qua, lùi về mặc định.
const STORAGE_KEY = 'aima.landing.v1';
const readStored = (): LandingContent | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_LANDING, ...(JSON.parse(raw) as Partial<LandingContent>) } : null;
  } catch {
    return null;
  }
};
const writeStored = (c: LandingContent) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* hết quota / bị chặn — không sao, lần sau lại gọi API */
  }
};

/** Gọi sau khi admin xuất bản để lần mở landing kế tiếp trong phiên lấy bản mới. */
export function invalidateLandingCache() {
  cache = null;
  pending = null;
}

/**
 * Nội dung Landing đã xuất bản (DB). Trong lúc tải (hoặc khi API lỗi) trả bản đã lưu lần trước ở
 * localStorage; chưa có thì nội dung mặc định (config/landingDefaults.ts) — landing không bao giờ
 * trống. Section nào API thiếu cũng lùi về mặc định.
 */
export function useLandingContent(): LandingContent {
  const [content, setContent] = useState<LandingContent | null>(() => cache ?? readStored());

  useEffect(() => {
    if (cache) return;
    pending = pending ?? getPublicLanding().then((p) => ({ ...DEFAULT_LANDING, ...p }));
    let alive = true;
    pending
      .then((c) => {
        cache = c;
        writeStored(c);
        if (alive) setContent(c);
      })
      .catch(() => {
        pending = null; // lần mount sau thử lại; hiện tại dùng mặc định
      });
    return () => {
      alive = false;
    };
  }, []);

  return content ?? DEFAULT_LANDING;
}
