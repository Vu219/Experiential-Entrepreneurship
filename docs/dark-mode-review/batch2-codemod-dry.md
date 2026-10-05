# Codemod dark mode — DRY-RUN (batch2)

Tổng: **60** chỗ thay · **10** chỗ không chắc (sửa tay) · 7 chỗ giữ trắng (chữ/icon trên nền màu) · 56 mã màu ngoài bảng (thương hiệu/trạng thái — xử lý tay/token tone).

## components/Modal.tsx

Thay 5: C.surface×1, C.surfaceMuted×1, C.textSecondary×2, C.textStrong×1 · giữ trắng 0

## components/Drawer.tsx

Thay 6: C.surfaceMuted×3, C.textStrong×1, C.textSecondary×1, C.surface×1 · giữ trắng 0

## components/ConfirmModal.tsx

Thay 3: C.border×1, C.surface×1, C.ink550×1 · giữ trắng 1

Ngoài bảng: L32 `#d97706`(VariableDeclaration), L32 `#d6336c`(VariableDeclaration)

## components/DatePicker.tsx

Thay 15: C.text×2, C.border×2, C.surfaceSubtle×1, C.textStrong×3, C.ink350×2, C.surface×1, C.surfaceMuted×2, C.textSecondary×2 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 278 | `#ece8f6` | border | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#ece8f6` |
| 279 | `#f6f3fc` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f6f3fc` |
| 316 | `#ece8f6` | border | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#ece8f6` |
| 317 | `#f6f3fc` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f6f3fc` |
| 366 | `#f6f3fc` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f6f3fc` |
| 414 | `#f6f3fc` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f6f3fc` |

Ngoài bảng: L23 `#8b5cf6`(VariableDeclaration), L23 `#d946ef`(VariableDeclaration), L210 `#f3aabf`(border), L356 `#d0cce0`(color), L356 `#d0cce0`(color), L360 `#d8cdf2`(outline), L389 `#e23d6e`(color), L395 `#fdeef2`(BinaryExpression), L408 `#8b5cf6`(color)

## components/OnboardingModal.tsx

Thay 8: C.border×2, C.surfaceSubtle×1, C.textStrong×1, C.ink350×1, C.textSecondary×1, C.surface×1, C.ink550×1 · giữ trắng 1

Ngoài bảng: L53 `#f1e9ff`(background), L54 `#7c3aed`(color)

## components/ChangePasswordModal.tsx

Thay 16: C.ink600×1, C.border×2, C.surfaceSubtle×1, C.textStrong×1, C.ink350×6, C.surfaceMuted×2, C.text×1, C.textMuted×1, C.surface×1 · giữ trắng 2

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 30 | `#fbfaff` | surfaceSubtle | stroke | màu nền dùng làm chữ | `#fbfaff` |

Ngoài bảng: L153 `#e23d6e`(color), L153 `#fdecf1`(background), L153 `#f6cdd9`(border), L174 `#e23d6e`(color), L180 `#8b5cf6`(color)

## components/PasswordStrengthBar.tsx

Thay 7: C.surfaceMuted×3, C.text×1, C.border×1, C.ink350×1, C.ink200×1 · giữ trắng 2

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 109 | `#ede8f9` | border | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#ede8f9` |
| 113 | `#f6f3fc` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f6f3fc` |
| 158 | `#ede8f9` | border | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#ede8f9` |

Ngoài bảng: L102 `#d8cdf2`(border), L110 `#b79df0`(BinaryExpression), L114 `#d8cdf2`(BinaryExpression), L122 `#8b5cf6`(background), L122 `#d946ef`(background), L139 `#8b5cf6`(color), L155 `#8b5cf6`(color), L157 `#e3dcf6`(BinaryExpression), L186 `#16a34a`(color), L199 `#16a34a`(background)

## components/toast/ToastProvider.tsx

Thay 0: — · giữ trắng 0

Ngoài bảng: L54 `#22c55e`(primary), L55 `#1f2937`(titleColor), L56 `#4ade80`(progressBg), L56 `#22c55e`(progressBg), L56 `#16a34a`(progressBg), L62 `#ef4444`(primary), L63 `#1f2937`(titleColor), L64 `#f87171`(progressBg), L64 `#ef4444`(progressBg), L64 `#dc2626`(progressBg), L70 `#f59e0b`(primary), L71 `#1f2937`(titleColor), L72 `#fbbf24`(progressBg), L72 `#f59e0b`(progressBg), L72 `#d97706`(progressBg), L78 `#06b6d4`(primary), L79 `#1f2937`(titleColor), L80 `#22d3ee`(progressBg), L80 `#06b6d4`(progressBg), L80 `#0891b2`(progressBg), L86 `#6366f1`(primary), L87 `#1f2937`(titleColor), L88 `#818cf8`(progressBg), L88 `#6366f1`(progressBg), L88 `#4f46e5`(progressBg), L270 `#1f2937`(color), L273 `#6b7280`(color), L288 `#9ca3af`(color)
