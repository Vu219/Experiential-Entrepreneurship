import type { AdminPostPlatform } from '../../../api/admin';

/**
 * DANH SÁCH NỀN TẢNG DUY NHẤT của trang "Bài đăng lỗi & bị từ chối" — dropdown lọc, chip nhanh
 * và logo trong bảng/drawer đều đọc từ đây.
 *
 * Scope MVP hiện tại là Facebook → Instagram → Threads (CLAUDE.md §2, rule.md §0.3): thiết kế có
 * chip TikTok nhưng CỐ Ý bỏ. Khi TikTok vào scope, thêm đúng một dòng ở mảng này (kèm màu trong
 * `theme.ts: PLATFORM_BG` và tag tương ứng ở backend) là cả trang tự có.
 */
export const AP_PLATFORMS: { tag: AdminPostPlatform; name: string }[] = [
  { tag: 'FB', name: 'Facebook' },
  { tag: 'IG', name: 'Instagram' },
  { tag: 'TH', name: 'Threads' },
];

export const AP_PLATFORM_NAME: Record<AdminPostPlatform, string> =
  AP_PLATFORMS.reduce((acc, p) => ({ ...acc, [p.tag]: p.name }), {} as Record<AdminPostPlatform, string>);
