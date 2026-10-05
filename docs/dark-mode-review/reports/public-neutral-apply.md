# Codemod dark mode — ĐÃ ÁP DỤNG (public-neutral)

Tổng: **206** chỗ thay · **18** chỗ không chắc (sửa tay) · 18 chỗ giữ trắng (chữ/icon trên nền màu) · 87 mã màu ngoài bảng (thương hiệu/trạng thái — xử lý tay/token tone).

## pages/LandingPage.tsx

Thay 14: C.surface×3, C.border×3, C.ink900×3, C.ink550×2, C.textSecondary×2, C.textStrong×1 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 145 | `#f6effc` | border | background | nằm trong gradient | `linear-gradient(135deg,#edf9ff,#f6effc)` |

Ngoài bảng: L82 `#7c3aed`(color), L102 `#d9cef5`(border), L102 `#7c3aed`(color), L145 `#edf9ff`(background)

## pages/PricingPage.tsx

Thay 14: C.ink200×1, C.ink650×2, C.ink900×2, C.ink550×1, C.textMuted×2, C.surface×1, C.border×1, C.surfaceMuted×2, C.textStrong×1, C.bg×1 · giữ trắng 0

Ngoài bảng: L18 `#f3edff`(background), L19 `#7c3aed`(color), L86 `#6d28d9`(color), L88 `#6d28d9`(color), L88 `#f3edff`(background), L88 `#e7d9fb`(border), L98 `#7c3aed`(color)

## pages/Auth.tsx

Thay 50: C.border×8, C.surfaceSubtle×1, C.textStrong×5, C.ink600×3, C.ink350×6, C.surface×5, C.ink900×1, C.ink550×1, C.textSecondary×13, C.ink650×2, C.textMuted×4, C.text×1 · giữ trắng 2

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 55 | `#fbfaff` | surfaceSubtle | stroke | màu nền dùng làm chữ | `#fbfaff` |
| 292 | `#f1f2fc` | bg | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.13),transparent` |
| 292 | `#f5f1fb` | surfaceMuted | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.13),transparent` |
| 292 | `#f9f1fc` | surfaceMuted | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.13),transparent` |

Ngoài bảng: L27 `#f3aabf`(border), L35 `#e23d6e`(color), L36 `#16a34a`(color), L36 `#e8f8ee`(background), L36 `#cdeed8`(border), L37 `#8b5cf6`(color), L353 `#8b5cf6`(accentColor), L356 `#8b5cf6`(color), L358 `#e23d6e`(color), L376 `#8b5cf6`(color), L395 `#e23d6e`(color), L402 `#e23d6e`(color), L404 `#8b5cf6`(color), L434 `#8b5cf6`(accentColor), L457 `#8b5cf6`(color), L471 `#e23d6e`(color), L515 `#d8cdf2`(border), L541 `#8b5cf6`(color), L560 `#d7d2e3`(border), L572 `#ea4335`(fill), L573 `#4285f4`(fill), L574 `#fbbc05`(fill), L575 `#34a853`(fill)

## pages/ForgotPasswordPage.tsx

Thay 26: C.border×2, C.surfaceSubtle×1, C.textStrong×1, C.ink600×1, C.ink350×7, C.surface×3, C.ink900×1, C.ink550×1, C.ink650×2, C.textSecondary×3, C.surfaceMuted×2, C.text×1, C.textMuted×1 · giữ trắng 2

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 43 | `#fbfaff` | surfaceSubtle | stroke | màu nền dùng làm chữ | `#fbfaff` |
| 159 | `#f1f2fc` | bg | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.13),transparent` |
| 159 | `#f5f1fb` | surfaceMuted | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.13),transparent` |
| 159 | `#f9f1fc` | surfaceMuted | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.13),transparent` |

Ngoài bảng: L26 `#f3aabf`(border), L34 `#e23d6e`(color), L205 `#16a34a`(color), L205 `#e8f8ee`(background), L205 `#cdeed8`(border), L234 `#e23d6e`(color), L240 `#8b5cf6`(color)

## pages/GoogleCallbackPage.tsx

Thay 0: — · giữ trắng 0

## pages/CompleteProfilePage.tsx

Thay 20: C.border×3, C.surfaceSubtle×1, C.textStrong×1, C.ink600×1, C.ink350×6, C.surface×2, C.ink900×1, C.textSecondary×1, C.surfaceMuted×2, C.text×2 · giữ trắng 3

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 150 | `#f1f2fc` | bg | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.10),transparent` |
| 150 | `#f5f1fb` | surfaceMuted | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.10),transparent` |
| 150 | `#f9f1fc` | surfaceMuted | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.10),transparent` |

Ngoài bảng: L20 `#f3aabf`(border), L28 `#e23d6e`(color), L174 `#16a34a`(background), L181 `#9a95ad`(color), L184 `#16a34a`(background)

## components/LandingHeader.tsx

Thay 12: C.surface×4, C.border×4, C.ink650×3, C.surfaceMuted×1 · giữ trắng 2

Ngoài bảng: L167 `#d9cef5`(border), L168 `#7c3aed`(color), L206 `#7c3aed`(color), L254 `#7c3aed`(color)

## components/ShareButton.tsx

Thay 0: — · giữ trắng 0

Ngoài bảng: L12 `#1877f2`(fill), L18 `#000000`(fill), L23 `#6e8efb`(color), L25 `#16a34a`(color)

## pages/legal/DataDeletionPage.tsx

Thay 5: C.bg×1, C.textStrong×2, C.textSecondary×2 · giữ trắng 0

Ngoài bảng: L43 `#e6dcfb`(border), L46 `#b42318`(color)

## pages/legal/LegalPage.tsx

Thay 11: C.border×2, C.surface×1, C.ink650×4, C.ink900×1, C.textMuted×1, C.textStrong×1, C.textSecondary×1 · giữ trắng 0

Ngoài bảng: L44 `#f3edff`(background), L45 `#6d28d9`(color), L78 `#6d28d9`(color)

## pages/legal/PrivacyPage.tsx

Thay 0: — · giữ trắng 0

## pages/legal/TermsPage.tsx

Thay 0: — · giữ trắng 0

## components/landing/CtaSection.tsx

Thay 2: C.surface×2 · giữ trắng 1

Ngoài bảng: L33 `#e2e8f0`(border), L33 `#334155`(color), L36 `#1e1b4b`(color), L37 `#475569`(color), L49 `#e2e8f0`(border), L49 `#1e293b`(color), L57 `#334155`(color), L58 `#7c3aed`(color)

## components/landing/FaqSection.tsx

Thay 6: C.ink900×1, C.ink550×2, C.surface×1, C.border×1, C.textStrong×1 · giữ trắng 0

Ngoài bảng: L35 `#ddd0f7`(border), L44 `#7c3aed`(color)

## components/landing/HowItWorks.tsx

Thay 6: C.ink900×1, C.ink550×1, C.surface×1, C.border×1, C.textStrong×1, C.textSecondary×1 · giữ trắng 1

Ngoài bảng: L35 `#d9cbf8`(background)

## components/landing/IntegrationsLoop.tsx

Thay 4: C.surface×1, C.border×1, C.textStrong×1, C.textSecondary×1 · giữ trắng 0

## components/landing/LandingFooter.tsx

Thay 17: C.textSecondary×4, C.textMuted×3, C.border×4, C.textStrong×2, C.surface×2, C.ink750×1, C.ink650×1 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 34 | `#fbfafe` | surfaceSubtle | background | nằm trong gradient | `linear-gradient(180deg,rgba(247,246,253,0),rgba(244,243,251,.92)),radi` |

Ngoài bảng: L42 `#8b5cf6`(color), L78 `#e8f8ee`(background), L78 `#bfe8cd`(border), L78 `#15803d`(color), L83 `#f3aabf`(border), L95 `#d6336c`(color), L107 `#8b5cf6`(color)

## components/landing/landingIcons.tsx

Thay 0: — · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 59 | `#f6effc` | border | background | nằm trong gradient | `linear-gradient(135deg,#edf9ff,#f6effc)` |

Ngoài bảng: L59 `#edf9ff`(background), L60 `#7c5cff`(color)

## components/landing/LandingLink.tsx

Thay 0: — · giữ trắng 0

## components/landing/PlanCard.tsx

Thay 8: C.border×1, C.surface×1, C.textStrong×1, C.textSecondary×1, C.ink900×1, C.textMuted×1, C.surfaceMuted×1, C.ink650×1 · giữ trắng 3

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 37 | `#ffffff` | surface | background | nằm trong gradient | `linear-gradient(#fff,#fff) padding-box, ` |
| 37 | `#ffffff` | surface | background | nằm trong gradient | `linear-gradient(#fff,#fff) padding-box, ` |

Ngoài bảng: L72 `#2563eb`(color), L80 `#f3edff`(background), L81 `#7c3aed`(color)

## components/landing/PricingTeaser.tsx

Thay 11: C.ink900×2, C.ink550×1, C.border×1, C.surface×2, C.textStrong×1, C.textMuted×2, C.surfaceMuted×1, C.ink650×1 · giữ trắng 2

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 49 | `#ffffff` | surface | background | nằm trong gradient | `linear-gradient(#fff,#fff) padding-box, ` |
| 49 | `#ffffff` | surface | background | nằm trong gradient | `linear-gradient(#fff,#fff) padding-box, ` |

Ngoài bảng: L70 `#2563eb`(color), L78 `#f3edff`(background), L79 `#7c3aed`(color), L95 `#d9cef5`(border), L95 `#7c3aed`(color)
