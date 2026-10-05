# Bảng ánh xạ màu cũ → token (dark mode)

> Sinh tự động từ `frontend/src` (đếm mã hex trong .ts/.tsx/.css). ΔE = CIEDE2000.
> Quy tắc gộp: chỉ màu **trung tính** (tông xám-tím, chroma < 26) có ΔE < 3 so với mốc gần nhất.
> Không gộp: màu thương hiệu, màu trạng thái (`statusTokens`, `*Tokens.ts`, `statusMeta`…) và sắc tím/hồng nhấn.

## 1. Token trung tính

| Token | Sáng | Tối | Vai trò | Số lần dùng (khớp + gộp) |
|---|---|---|---|---|
| `--c-surface` | `#ffffff` | `#121829` | nền card/modal/menu | 615 + 2 |
| `--c-surface-subtle` | `#fbfaff` | `#151c2f` | vùng nhấn rất nhẹ trong card | 29 + 60 |
| `--c-bg` | `#f7f6fd` | `#0b0f1e` | nền trang | 9 + 62 |
| `--c-surface-muted` | `#f1eef8` | `#182036` | input, ô tìm kiếm, nút phụ, hover, lưới chart | 89 + 197 |
| `--c-border` | `#ece8f6` | `#232b42` | viền card/input, đường phân tách | 252 + 194 |
| `--c-border-strong` | `#d9d3ea` | `#2e3752` | viền đậm, thumb scrollbar | 3 + 0 |
| `--c-ink-200` | `#c4bdd6` | `#3d4762` | icon/viền disabled | 12 + 6 |
| `--c-ink-250` | `#b3acc6` | `#4f5975` | chữ rất mờ | 4 + 7 |
| `--c-text-faint` | `#a59fbb` | `#8690aa` | placeholder | 168 + 1 |
| `--c-ink-350` | `#9b94b5` | `#8c96b0` | chữ mờ phụ | 6 + 83 |
| `--c-text-muted` | `#8a85a0` | `#939db6` | chữ mờ | 343 + 0 |
| `--c-text-secondary` | `#6b6680` | `#a3abc4` | phụ đề | 124 + 6 |
| `--c-ink-550` | `#5b5670` | `#b0b8cf` | chữ thân nhạt | 136 + 0 |
| `--c-ink-600` | `#574f6e` | `#b7bed3` | chữ thân nhạt (tím) | 84 + 0 |
| `--c-ink-650` | `#4b4660` | `#c3c9db` | chữ thân / icon nút | 88 + 2 |
| `--c-text` | `#3f3a55` | `#d5d9e8` | chữ thân | 96 + 0 |
| `--c-ink-750` | `#2b2543` | `#e2e6f1` | chữ đậm | 76 + 11 |
| `--c-text-strong` | `#211c38` | `#f1f3fb` | tiêu đề | 157 + 72 |
| `--c-ink-900` | `#171327` | `#f7f8fc` | chữ đậm nhất | 18 + 10 |

Chỉnh giá trị tối ngày 2026-10-04 để các nhãn nhỏ đạt WCAG AA ≥4,5:1 trên nền trung tính.
`--c-chart-axis`: sáng `#a59fbb`, tối `#8c96b0`. Các mã sáng và quy tắc gộp giữ nguyên.

## 2. Màu được gộp (giao diện sáng thay đổi ΔE < 3)

| Màu cũ | Số lần | → Token | Giá trị mới (sáng) | ΔE |
|---|---|---|---|---|
| `#faf8ff` | 16 | `--c-bg` | `#f7f6fd` | 0.65 |
| `#f8f6fd` | 11 | `--c-bg` | `#f7f6fd` | 0.48 |
| `#faf8fe` | 9 | `--c-bg` | `#f7f6fd` | 0.74 |
| `#f6f3fb` | 5 | `--c-bg` | `#f7f6fd` | 1.24 |
| `#f6f4fa` | 4 | `--c-bg` | `#f7f6fd` | 0.70 |
| `#f1f2fc` | 4 | `--c-bg` | `#f7f6fd` | 1.71 |
| `#f6f4fb` | 3 | `--c-bg` | `#f7f6fd` | 0.60 |
| `#f8f6fc` | 3 | `--c-bg` | `#f7f6fd` | 0.60 |
| `#f4f3f8` | 3 | `--c-bg` | `#f7f6fd` | 1.14 |
| `#faf7ff` | 3 | `--c-bg` | `#f7f6fd` | 1.16 |
| `#f7f5fd` | 1 | `--c-bg` | `#f7f6fd` | 0.74 |
| `#efeaf8` | 78 | `--c-border` | `#ece8f6` | 0.64 |
| `#e7e2f2` | 23 | `--c-border` | `#ece8f6` | 1.57 |
| `#eee9f6` | 14 | `--c-border` | `#ece8f6` | 0.61 |
| `#ece7f6` | 10 | `--c-border` | `#ece8f6` | 0.65 |
| `#e0ddee` | 10 | `--c-border` | `#ece8f6` | 2.72 |
| `#f6f1ff` | 9 | `--c-border` | `#ece8f6` | 1.98 |
| `#f1edfa` | 9 | `--c-border` | `#ece8f6` | 1.13 |
| `#ece8f5` | 6 | `--c-border` | `#ece8f6` | 0.41 |
| `#eae6f4` | 5 | `--c-border` | `#ece8f6` | 0.43 |
| `#e8e4f1` | 4 | `--c-border` | `#ece8f6` | 0.96 |
| `#f6effc` | 4 | `--c-border` | `#ece8f6` | 2.05 |
| `#f5f0ff` | 3 | `--c-border` | `#ece8f6` | 1.84 |
| `#e6e2f2` | 3 | `--c-border` | `#ece8f6` | 1.52 |
| `#ede8f9` | 3 | `--c-border` | `#ece8f6` | 1.31 |
| `#f3efff` | 2 | `--c-border` | `#ece8f6` | 1.69 |
| `#ede8f8` | 2 | `--c-border` | `#ece8f6` | 0.96 |
| `#ece8f7` | 2 | `--c-border` | `#ece8f6` | 0.40 |
| `#e5e0f0` | 1 | `--c-border` | `#ece8f6` | 1.94 |
| `#ede9f8` | 1 | `--c-border` | `#ece8f6` | 0.46 |
| `#ede8f6` | 1 | `--c-border` | `#ece8f6` | 0.44 |
| `#f4effe` | 1 | `--c-border` | `#ece8f6` | 1.65 |
| `#f4eefe` | 1 | `--c-border` | `#ece8f6` | 1.84 |
| `#f4f0ff` | 1 | `--c-border` | `#ece8f6` | 1.74 |
| `#f1ecfc` | 1 | `--c-border` | `#ece8f6` | 1.31 |
| `#c9c2dd` | 4 | `--c-ink-200` | `#c4bdd6` | 1.46 |
| `#c3bcd8` | 1 | `--c-ink-200` | `#c4bdd6` | 1.04 |
| `#c5c0d4` | 1 | `--c-ink-200` | `#c4bdd6` | 2.12 |
| `#b3aacb` | 2 | `--c-ink-250` | `#b3acc6` | 2.43 |
| `#b3acc7` | 2 | `--c-ink-250` | `#b3acc6` | 0.34 |
| `#b7b2c8` | 2 | `--c-ink-250` | `#b3acc6` | 2.25 |
| `#b3adc8` | 1 | `--c-ink-250` | `#b3acc6` | 0.57 |
| `#a39bbf` | 75 | `--c-ink-350` | `#9b94b5` | 2.50 |
| `#9a93b3` | 5 | `--c-ink-350` | `#9b94b5` | 0.47 |
| `#948eae` | 3 | `--c-ink-350` | `#9b94b5` | 2.10 |
| `#514b66` | 2 | `--c-ink-650` | `#4b4660` | 1.86 |
| `#2d2745` | 9 | `--c-ink-750` | `#2b2543` | 0.63 |
| `#2d264b` | 1 | `--c-ink-750` | `#2b2543` | 2.41 |
| `#2b2740` | 1 | `--c-ink-750` | `#2b2543` | 2.16 |
| `#1e1b2e` | 6 | `--c-ink-900` | `#171327` | 2.56 |
| `#1f1b2e` | 4 | `--c-ink-900` | `#171327` | 2.54 |
| `#fdfcfe` | 1 | `--c-surface` | `#ffffff` | 1.39 |
| `#f8fafc` | 1 | `--c-surface` | `#ffffff` | 1.62 |
| `#f4f1fb` | 38 | `--c-surface-muted` | `#f1eef8` | 0.63 |
| `#f4f2fb` | 24 | `--c-surface-muted` | `#f1eef8` | 1.05 |
| `#f0ecf8` | 21 | `--c-surface-muted` | `#f1eef8` | 1.09 |
| `#f6f3fc` | 18 | `--c-surface-muted` | `#f1eef8` | 1.12 |
| `#f4f1fa` | 17 | `--c-surface-muted` | `#f1eef8` | 0.76 |
| `#f6f2ff` | 11 | `--c-surface-muted` | `#f1eef8` | 1.67 |
| `#f1eef9` | 8 | `--c-surface-muted` | `#f1eef8` | 0.43 |
| `#f3f0fa` | 6 | `--c-surface-muted` | `#f1eef8` | 0.42 |
| `#f7f4ff` | 5 | `--c-surface-muted` | `#f1eef8` | 1.32 |
| `#f2f0f8` | 4 | `--c-surface-muted` | `#f1eef8` | 1.14 |
| `#f8f5ff` | 4 | `--c-surface-muted` | `#f1eef8` | 1.45 |
| `#efecf7` | 4 | `--c-surface-muted` | `#f1eef8` | 0.60 |
| `#eceaf4` | 4 | `--c-surface-muted` | `#f1eef8` | 1.00 |
| `#f5f1fb` | 4 | `--c-surface-muted` | `#f1eef8` | 0.80 |
| `#f9f1fc` | 4 | `--c-surface-muted` | `#f1eef8` | 2.40 |
| `#f7f3ff` | 3 | `--c-surface-muted` | `#f1eef8` | 1.50 |
| `#f3effc` | 3 | `--c-surface-muted` | `#f1eef8` | 1.44 |
| `#f1edf8` | 3 | `--c-surface-muted` | `#f1eef8` | 0.69 |
| `#faf6ff` | 3 | `--c-surface-muted` | `#f1eef8` | 1.78 |
| `#f4f0fd` | 2 | `--c-surface-muted` | `#f1eef8` | 1.49 |
| `#f5f2fa` | 2 | `--c-surface-muted` | `#f1eef8` | 1.21 |
| `#f0edf9` | 2 | `--c-surface-muted` | `#f1eef8` | 0.88 |
| `#f5f3fc` | 1 | `--c-surface-muted` | `#f1eef8` | 1.21 |
| `#f0edf7` | 1 | `--c-surface-muted` | `#f1eef8` | 0.21 |
| `#f3f0f9` | 1 | `--c-surface-muted` | `#f1eef8` | 0.60 |
| `#f7f2ff` | 1 | `--c-surface-muted` | `#f1eef8` | 1.90 |
| `#f5f2fb` | 1 | `--c-surface-muted` | `#f1eef8` | 0.93 |
| `#ece9f3` | 1 | `--c-surface-muted` | `#f1eef8` | 1.06 |
| `#f1eefb` | 1 | `--c-surface-muted` | `#f1eef8` | 1.28 |
| `#faf9fe` | 28 | `--c-surface-subtle` | `#fbfaff` | 0.20 |
| `#fcfbfe` | 10 | `--c-surface-subtle` | `#fbfaff` | 1.01 |
| `#f1f5f9` | 4 | `--c-surface-subtle` | `#fbfaff` | 2.94 |
| `#fdfcff` | 4 | `--c-surface-subtle` | `#fbfaff` | 1.06 |
| `#faf9fd` | 3 | `--c-surface-subtle` | `#fbfaff` | 0.53 |
| `#f5f4f8` | 2 | `--c-surface-subtle` | `#fbfaff` | 1.32 |
| `#f9f8fc` | 2 | `--c-surface-subtle` | `#fbfaff` | 0.64 |
| `#fcfbff` | 1 | `--c-surface-subtle` | `#fbfaff` | 0.53 |
| `#fdf7f9` | 1 | `--c-surface-subtle` | `#fbfaff` | 2.51 |
| `#fdfbff` | 1 | `--c-surface-subtle` | `#fbfaff` | 0.65 |
| `#fbfafe` | 1 | `--c-surface-subtle` | `#fbfaff` | 0.49 |
| `#fbf9ff` | 1 | `--c-surface-subtle` | `#fbfaff` | 0.76 |
| `#f9f8fd` | 1 | `--c-surface-subtle` | `#fbfaff` | 0.40 |
| `#f7f6fb` | 1 | `--c-surface-subtle` | `#fbfaff` | 0.81 |
| `#aaa5bb` | 1 | `--c-text-faint` | `#a59fbb` | 2.73 |
| `#6f6a86` | 3 | `--c-text-secondary` | `#6b6680` | 1.74 |
| `#6b6580` | 3 | `--c-text-secondary` | `#6b6680` | 0.63 |
| `#241f3a` | 44 | `--c-text-strong` | `#211c38` | 1.03 |
| `#1b1730` | 25 | `--c-text-strong` | `#211c38` | 2.00 |
| `#1f1b33` | 2 | `--c-text-strong` | `#211c38` | 1.69 |
| `#1f1838` | 1 | `--c-text-strong` | `#211c38` | 2.01 |

## 3. Không gộp — xử lý bằng token tone hoặc sửa tay (top 60 theo số lần dùng)

| Màu | Số lần | Lý do |
|---|---|---|
| `#7c3aed` | 228 | token trạng thái/thương hiệu |
| `#8b5cf6` | 90 | token trạng thái/thương hiệu |
| `#16a34a` | 68 | token trạng thái/thương hiệu |
| `#6d28d9` | 67 | màu có sắc độ (thương hiệu/trạng thái) |
| `#dc2626` | 60 | token trạng thái/thương hiệu |
| `#e23d6e` | 51 | token trạng thái/thương hiệu |
| `#b45309` | 36 | màu có sắc độ (thương hiệu/trạng thái) |
| `#f1e9ff` | 36 | token trạng thái/thương hiệu |
| `#f3edff` | 32 | token trạng thái/thương hiệu |
| `#d97706` | 27 | token trạng thái/thương hiệu |
| `#c4b5fd` | 22 | màu có sắc độ (thương hiệu/trạng thái) |
| `#e8f8ee` | 21 | token trạng thái/thương hiệu |
| `#6b7280` | 21 | token trạng thái/thương hiệu |
| `#fdf0dc` | 20 | token trạng thái/thương hiệu |
| `#d6336c` | 19 | màu có sắc độ (thương hiệu/trạng thái) |
| `#f59e0b` | 19 | token trạng thái/thương hiệu |
| `#0e7490` | 16 | token trạng thái/thương hiệu |
| `#ec4899` | 15 | token trạng thái/thương hiệu |
| `#7d6aa3` | 13 | màu có sắc độ (thương hiệu/trạng thái) |
| `#10b981` | 13 | token trạng thái/thương hiệu |
| `#22d3ee` | 13 | token trạng thái/thương hiệu |
| `#fde8e8` | 12 | token trạng thái/thương hiệu |
| `#6366f1` | 11 | token trạng thái/thương hiệu |
| `#fdecf1` | 11 | token trạng thái/thương hiệu |
| `#1877f2` | 11 | token trạng thái/thương hiệu |
| `#7c5cff` | 11 | màu có sắc độ (thương hiệu/trạng thái) |
| `#e9f0ff` | 11 | trung tính lẻ (gần bg Δ4.6) |
| `#6b5ca8` | 10 | màu có sắc độ (thương hiệu/trạng thái) |
| `#ef4444` | 10 | token trạng thái/thương hiệu |
| `#d9cef5` | 9 | sắc tím/hồng nhấn |
| `#a78bfa` | 9 | token trạng thái/thương hiệu |
| `#b91c1c` | 9 | màu có sắc độ (thương hiệu/trạng thái) |
| `#e7d9fb` | 9 | sắc tím/hồng nhấn |
| `#e7fff4` | 9 | màu có sắc độ (thương hiệu/trạng thái) |
| `#e9f7ff` | 9 | màu có sắc độ (thương hiệu/trạng thái) |
| `#92400e` | 8 | màu có sắc độ (thương hiệu/trạng thái) |
| `#e0f7fb` | 8 | token trạng thái/thương hiệu |
| `#d946ef` | 8 | màu có sắc độ (thương hiệu/trạng thái) |
| `#5b4b86` | 8 | màu có sắc độ (thương hiệu/trạng thái) |
| `#e3d9fb` | 8 | sắc tím/hồng nhấn |
| `#f3aabf` | 8 | màu có sắc độ (thương hiệu/trạng thái) |
| `#ece6f8` | 8 | sắc tím/hồng nhấn |
| `#000000` | 8 | token trạng thái/thương hiệu |
| `#eafbf1` | 7 | token trạng thái/thương hiệu |
| `#5b2b9e` | 7 | màu có sắc độ (thương hiệu/trạng thái) |
| `#f3c9d6` | 7 | màu có sắc độ (thương hiệu/trạng thái) |
| `#fdf6e7` | 7 | màu có sắc độ (thương hiệu/trạng thái) |
| `#fae9ff` | 7 | sắc tím/hồng nhấn |
| `#3b82f6` | 7 | token trạng thái/thương hiệu |
| `#ffe9f3` | 7 | màu có sắc độ (thương hiệu/trạng thái) |
| `#e25c84` | 6 | màu có sắc độ (thương hiệu/trạng thái) |
| `#fcf1fc` | 6 | trung tính lẻ (gần surface-muted Δ3.6) |
| `#efe6fb` | 6 | sắc tím/hồng nhấn |
| `#d6cdf0` | 6 | sắc tím/hồng nhấn |
| `#fdeef2` | 6 | màu có sắc độ (thương hiệu/trạng thái) |
| `#f4ecff` | 6 | sắc tím/hồng nhấn |
| `#1f2937` | 6 | trung tính lẻ (gần ink-900 Δ11.1) |
| `#eef2ff` | 6 | trung tính lẻ (gần bg Δ3.2) |
| `#46d6ec` | 5 | token trạng thái/thương hiệu |
| `#a855f7` | 5 | màu có sắc độ (thương hiệu/trạng thái) |

Còn 243 màu ít dùng khác (≤ 5 lần mỗi màu) — xử lý khi migrate từng trang.

## Token bổ sung đợt 2 (2026-10-05)

Màu ngoài bảng dùng token riêng và giữ chính xác giá trị sáng. Fill nút thương hiệu/xác nhận giữ nguyên.

| Token | Sáng | Tối |
|---|---|---|
| `--c-modal-overlay` | `rgba(26, 18, 48, 0.5)` | `rgba(0, 0, 0, 0.65)` |
| `--c-drawer-overlay` | `rgba(26, 18, 48, 0.42)` | `rgba(0, 0, 0, 0.6)` |
| `--c-shadow-modal` | `0 40px 80px -30px rgba(60, 30, 110, 0.55)` | `0 40px 80px -30px rgba(0, 0, 0, 0.65)` |
| `--c-shadow-datepicker` | `0 18px 38px -12px rgba(80, 40, 140, 0.35)` | `0 18px 38px -12px rgba(0, 0, 0, 0.65)` |
| `--c-date-disabled` | `#d0cce0` | `#4f5975` |
| `--c-violet-light` | `#8b5cf6` | `#a78bfa` |
| `--c-violet-line` | `#d8cdf2` | `rgba(167, 139, 250, 0.4)` |
| `--c-violet-line-hover` | `#b79df0` | `rgba(167, 139, 250, 0.65)` |
| `--c-violet-selected` | `#faf6ff` | `rgba(139, 92, 246, 0.14)` |
| `--c-violet-hover` | `#ede8f9` | `rgba(139, 92, 246, 0.18)` |
| `--c-violet-hover-strong` | `#e3dcf6` | `rgba(139, 92, 246, 0.28)` |
| `--c-rose-border` | `#f6cdd9` | `rgba(251, 113, 133, 0.3)` |
| `--c-input-error-border` | `#f3aabf` | `rgba(251, 113, 133, 0.55)` |
| `--c-toast-surface` | `rgba(255, 255, 255, 0.98)` | `rgba(18, 24, 41, 0.98)` |
| `--c-toast-border` | `rgba(15, 23, 42, 0.08)` | `#232b42` |
| `--c-toast-title` | `#1f2937` | `#f1f3fb` |
| `--c-toast-close` | `#9ca3af` | `#939db6` |
| `--c-shadow-toast` | `0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)` | `0 12px 32px rgba(0, 0, 0, 0.4)` |
| `--c-strength-fair` | `#f59e0b` | `#fbbf24` |

## Catalog hiện tại (2026-10-05)

Giá trị sáng/tối thực tế, gồm các alias giữ chính xác màu sáng và token Landing, ở
[final/token-catalog.json](dark-mode-review/final/token-catalog.json). Catalog được sinh từ tất cả
khối `:root`/`:root.dark` bằng `frontend/scripts/dark-mode/token-catalog.mjs`.
Các số lần dùng ở bảng cũ là thống kê trước migration; giá trị tối đã đồng bộ với CSS hiện tại.
