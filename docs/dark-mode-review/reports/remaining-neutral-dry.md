# Codemod dark mode — DRY-RUN (remaining-neutral)

Tổng: **2177** chỗ thay · **73** chỗ không chắc (sửa tay) · 195 chỗ giữ trắng (chữ/icon trên nền màu) · 1097 mã màu ngoài bảng (thương hiệu/trạng thái — xử lý tay/token tone).

## pages/Profile.tsx

Thay 32: C.ink600×3, C.border×6, C.textStrong×5, C.surfaceSubtle×2, C.surface×6, C.ink350×2, C.surfaceMuted×1, C.textMuted×4, C.textFaint×1, C.ink650×2 · giữ trắng 6

Ngoài bảng: L203 `#fdeef2`(background), L203 `#f3c9d6`(border), L205 `#c0285a`(color), L206 `#8a5566`(color), L243 `#7c3aed`(color), L261 `#7c3aed`(color), L263 `#7c3aed`(color), L263 `#f3edff`(background), L280 `#f3c9d6`(border), L280 `#e23d6e`(color), L287 `#f3edff`(background), L287 `#7c3aed`(color), L295 `#7c3aed`(color), L300 `#f3c9d6`(border), L302 `#fdeef2`(background), L302 `#e23d6e`(color), L306 `#c0285a`(color), L310 `#f3c9d6`(border), L310 `#e23d6e`(color), L381 `#e23d6e`(background)

## pages/Settings.tsx

Thay 47: C.surface×8, C.textStrong×8, C.text×8, C.textMuted×12, C.border×8, C.surfaceMuted×1, C.ink750×2 · giữ trắng 2

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 700 | `#f4f1fb` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f4f1fb` |
| 722 | `#f4f1fb` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f4f1fb` |
| 853 | `#faf6ff` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#faf6ff` |

Ngoài bảng: L566 `#7c3aed`(color), L639 `#e9f0ff`(background), L639 `#f1e9ff`(background), L641 `#7c3aed`(color), L670 `#16a34a`(color), L670 `#dc2626`(color), L672 `#16a34a`(color), L672 `#dc2626`(color), L673 `#c2410c`(color), L692 `#7c3aed`(color), L712 `#c2410c`(color), L861 `#dc2626`(color), L862 `#fff5f5`(BinaryExpression)

## components/admin/AdminListPage.tsx

Thay 18: C.surfaceMuted×4, C.textMuted×3, C.ink550×1, C.ink350×2, C.border×2, C.textStrong×1, C.surface×1, C.ink650×1, C.ink750×1, C.surfaceSubtle×1, C.textFaint×1 · giữ trắng 1

Ngoài bảng: L45 `#fde8e8`(background), L46 `#dc2626`(stroke)

## components/admin/AiProviderCard.tsx

Thay 16: C.border×4, C.surfaceSubtle×1, C.ink350×1, C.ink750×2, C.surfaceMuted×2, C.surface×1, C.ink550×1, C.textFaint×2, C.text×2 · giữ trắng 1

Ngoài bảng: L36 `#dc2626`(color), L36 `#fde8e8`(background), L36 `#f4cccc`(border), L37 `#b45309`(color), L37 `#fdf6ea`(background), L37 `#f6e2c2`(border), L38 `#fdf6ea`(background), L38 `#f6e2c2`(border), L116 `#fdf1dd`(background), L116 `#f3d9a8`(borderColor), L117 `#92400e`(color), L121 `#a16207`(color), L124 `#b45309`(stroke), L140 `#b45309`(color), L146 `#92400e`(color), L149 `#a16207`(color), L151 `#b45309`(stroke), L159 `#8b5cf6`(stroke), L163 `#fdf0dc`(background), L163 `#f6e2c2`(borderColor), L164 `#b45309`(stroke), L165 `#b45309`(color), L172 `#8b5cf6`(stroke), L175 `#0e7490`(stroke), L178 `#7c3aed`(stroke)

## components/admin/AiServiceStatusBadge.tsx

Thay 0: — · giữ trắng 0

## components/admin/AiStatusBanner.tsx

Thay 0: — · giữ trắng 0

Ngoài bảng: L14 `#dc2626`(color), L14 `#b45309`(color), L14 `#0e7490`(color), L15 `#fde8e8`(background), L15 `#fdf0dc`(background), L15 `#e0f7fb`(background)

## components/admin/Avatar.tsx

Thay 0: — · giữ trắng 1

## components/admin/BarChart.tsx

Thay 1: C.textFaint×1 · giữ trắng 0

## components/admin/BlockError.tsx

Thay 2: C.textMuted×1, C.ink550×1 · giữ trắng 1

## components/admin/BlockSkeleton.tsx

Thay 4: C.surfaceMuted×2, C.surface×1, C.border×1 · giữ trắng 0

## components/admin/FallbackChainEditor.tsx

Thay 11: C.border×2, C.surfaceSubtle×1, C.surface×2, C.ink750×1, C.textFaint×2, C.ink550×2, C.textMuted×1 · giữ trắng 0

Ngoài bảng: L19 `#7c3aed`(color), L19 `#f1e9ff`(background), L70 `#b45309`(color), L79 `#dc2626`(stroke), L89 `#d9cef7`(border), L89 `#7c3aed`(color), L112 `#7c3aed`(color), L117 `#7c3aed`(stroke)

## components/admin/FilterMenu.tsx

Thay 9: C.border×3, C.surface×2, C.ink650×2, C.textFaint×1, C.bg×1 · giữ trắng 0

Ngoài bảng: L74 `#ddd0fb`(border), L85 `#6d28d9`(color), L98 `#8b5cf6`(color), L138 `#7c3aed`(color)

## components/admin/Heatmap.tsx

Thay 10: C.textMuted×3, C.text×1, C.textFaint×3, C.surfaceMuted×3 · giữ trắng 0

Ngoài bảng: L202 `#b45309`(color), L202 `#fff7ed`(background), L202 `#fed7aa`(border)

## components/admin/OverviewKpiCard.tsx

Thay 5: C.textMuted×1, C.textStrong×1, C.textFaint×3 · giữ trắng 0

## components/admin/Pagination.tsx

Thay 10: C.border×2, C.surface×2, C.ink200×2, C.ink550×2, C.textMuted×2 · giữ trắng 1

## components/admin/PaymentDetailModal.tsx

Thay 17: C.textStrong×3, C.ink350×3, C.textSecondary×2, C.bg×2, C.border×2, C.ink650×1, C.surfaceMuted×2, C.surfaceSubtle×1, C.textMuted×1 · giữ trắng 1

Ngoài bảng: L49 `#fdf0dc`(background), L49 `#f6dfae`(border), L52 `#b45309`(color), L53 `#7c4a08`(color), L127 `#16a34a`(CallExpression), L136 `#d6336c`(CallExpression)

## components/admin/RouteHealthBadge.tsx

Thay 0: — · giữ trắng 0

Ngoài bảng: L34 `#d97706`(stroke)

## components/admin/RowActionsMenu.tsx

Thay 10: C.border×3, C.surface×3, C.ink550×1, C.bg×1, C.ink650×1, C.ink350×1 · giữ trắng 0

Ngoài bảng: L83 `#f3edff`(background), L84 `#6d28d9`(color), L137 `#fdecf1`(background), L139 `#e23d6e`(color), L139 `#7c3aed`(color), L142 `#e23d6e`(color)

## components/admin/SectionCard.tsx

Thay 2: C.textStrong×1, C.surfaceMuted×1 · giữ trắng 0

## components/admin/StatCard.tsx

Thay 2: C.textStrong×1, C.textMuted×1 · giữ trắng 0

## components/admin/StatusBadge.tsx

Thay 0: — · giữ trắng 0

## components/admin/Switch.tsx

Thay 2: C.borderStrong×1, C.surface×1 · giữ trắng 0

Ngoài bảng: L20 `#7c3aed`(background)

## components/analytics/ActivityHeatmap.tsx

Thay 17: C.textStrong×2, C.textSecondary×1, C.textMuted×6, C.surface×3, C.textFaint×1, C.surfaceSubtle×2, C.border×1, C.ink550×1 · giữ trắng 0

Ngoài bảng: L116 `#b9a7ea`(border), L145 `#b9a7ea`(border), L151 `#a16207`(color), L151 `#fffaf0`(background), L151 `#fce7c3`(border)

## components/analytics/AllPostsModal.tsx

Thay 4: C.textSecondary×2, C.border×1, C.surface×1 · giữ trắng 0

Ngoài bảng: L75 `#d5cfe8`(color)

## components/analytics/AnalyticsFilterBar.tsx

Thay 21: C.textMuted×1, C.surfaceMuted×2, C.surface×5, C.textSecondary×1, C.border×5, C.ink650×1, C.ink550×1, C.text×2, C.textFaint×1, C.textStrong×1, C.surfaceSubtle×1 · giữ trắng 5

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 140 | `#ffffff` | surface | border | viền trắng (ring?) | `2px solid #fff` |

Ngoài bảng: L100 `#6b7280`(bg), L138 `#7c3aed`(background), L262 `#e4dbfa`(border), L263 `#5b21b6`(color), L271 `#7c3aed`(color), L306 `#6b7280`(bg), L332 `#dcd6ec`(border), L333 `#8b5cf6`(background), L333 `#d946ef`(background), L367 `#8b5cf6`(background), L367 `#d946ef`(background), L386 `#d8c9ff`(borderColor), L387 `#6d28d9`(color), L393 `#8b5cf6`(background), L393 `#d946ef`(background), L411 `#e23d6e`(color), L415 `#8b5cf6`(background), L415 `#d946ef`(background)

## components/analytics/AnalyticsSkeleton.tsx

Thay 4: C.surfaceMuted×2, C.surface×1, C.border×1 · giữ trắng 0

## components/analytics/analyticsTokens.ts

Thay 0: — · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 33 | `#f1eef8` | surfaceMuted | VariableDeclaration | ngữ cảnh không phải thuộc tính style (VariableDeclaration) | `#f1eef8` |
| 34 | `#a59fbb` | textFaint | VariableDeclaration | ngữ cảnh không phải thuộc tính style (VariableDeclaration) | `#a59fbb` |

Ngoài bảng: L16 `#8b5cf6`(views), L17 `#f43f5e`(likes), L18 `#f59e0b`(comments), L19 `#10b981`(shares), L38 `#1877f2`(FACEBOOK), L39 `#ee2a7b`(INSTAGRAM), L40 `#111111`(THREADS)

## components/analytics/AnalyticsTrendChart.tsx

Thay 11: C.textStrong×3, C.textSecondary×1, C.ink350×1, C.ink550×2, C.bg×1, C.textMuted×1, C.surface×1, C.border×1 · giữ trắng 1

Ngoài bảng: L69 `#f3edff`(background), L74 `#cfc9e0`(background)

## components/analytics/BlockError.tsx

Thay 3: C.textMuted×1, C.border×1, C.surface×1 · giữ trắng 0

Ngoài bảng: L21 `#7c3aed`(color)

## components/analytics/ContentTypeBreakdown.tsx

Thay 8: C.textStrong×2, C.textSecondary×1, C.textFaint×1, C.textMuted×3, C.text×1 · giữ trắng 0

## components/analytics/dateRange.ts

Thay 0: — · giữ trắng 0

## components/analytics/FilterPopover.tsx

Thay 2: C.surface×1, C.border×1 · giữ trắng 0

## components/analytics/InsightsStrip.tsx

Thay 8: C.textStrong×2, C.textSecondary×1, C.surfaceMuted×1, C.textMuted×2, C.ink200×1, C.ink350×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 100 | `#f1f5f9` | surfaceSubtle | bg | thuộc tính lạ: bg | `#f1f5f9` |
| 161 | `#fdf7f9` | surfaceSubtle | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#fdf7f9` |

Ngoài bảng: L100 `#64748b`(color), L101 `#16a34a`(color), L101 `#eafbf1`(bg), L101 `#e23d6e`(color), L101 `#fdecf1`(bg)

## components/analytics/KpiCard.tsx

Thay 3: C.textMuted×1, C.textStrong×1, C.ink350×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 37 | `#f1f5f9` | surfaceSubtle | bg | thuộc tính lạ: bg | `#f1f5f9` |

Ngoài bảng: L37 `#64748b`(color), L39 `#16a34a`(color), L39 `#eafbf1`(bg), L40 `#e23d6e`(color), L40 `#fdecf1`(bg)

## components/analytics/PlatformBreakdown.tsx

Thay 12: C.textStrong×3, C.textSecondary×1, C.textFaint×1, C.textMuted×4, C.ink750×1, C.border×1, C.surface×1 · giữ trắng 0

Ngoài bảng: L66 `#8b5cf6`(fill), L104 `#6b7280`(bg), L128 `#6d28d9`(color), L131 `#6d28d9`(stroke)

## components/analytics/PostDetailModal.tsx

Thay 12: C.surfaceSubtle×1, C.surfaceMuted×2, C.textStrong×1, C.textMuted×2, C.border×1, C.ink750×1, C.textSecondary×1, C.ink550×2, C.ink900×1 · giữ trắng 0

Ngoài bảng: L174 `#ecfdf5`(background), L174 `#047857`(color), L174 `#a7f3d0`(border), L175 `#fef2f2`(background), L175 `#b91c1c`(color), L175 `#fecaca`(border), L176 `#f3f4f6`(background), L176 `#e5e7eb`(border)

## components/analytics/PostDetailPanel.tsx

Thay 14: C.text×1, C.textFaint×1, C.ink900×3, C.textSecondary×1, C.textMuted×3, C.ink550×1, C.bg×2, C.border×2 · giữ trắng 1

Ngoài bảng: L44 `#6b7280`(bg), L98 `#7c3aed`(color)

## components/analytics/PostsCardList.tsx

Thay 10: C.border×1, C.surface×2, C.ink550×1, C.ink750×1, C.textFaint×1, C.surfaceSubtle×1, C.textMuted×1, C.textStrong×1, C.surfaceMuted×1 · giữ trắng 1

Ngoài bảng: L50 `#8b5cf6`(background), L50 `#d946ef`(background), L67 `#6b7280`(bg)

## components/analytics/PostsTable.tsx

Thay 7: C.textMuted×3, C.surfaceMuted×1, C.textFaint×1, C.ink900×2 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 96 | `#faf8fe` | bg | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#faf8fe` |

Ngoài bảng: L60 `#7c3aed`(color), L114 `#6b7280`(bg)

## components/analytics/RangeBadge.tsx

Thay 3: C.surfaceMuted×1, C.surfaceSubtle×1, C.textFaint×1 · giữ trắng 0

## components/analytics/RangeCalendar.tsx

Thay 6: C.textSecondary×2, C.textStrong×1, C.ink350×1, C.text×1, C.surfaceMuted×1 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 116 | `#f6f3fc` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f6f3fc` |

Ngoài bảng: L112 `#d0cce0`(color), L113 `#8b5cf6`(background), L113 `#d946ef`(background), L113 `#f3edff`(background)

## components/analytics/TopPostsTable.tsx

Thay 5: C.textStrong×1, C.textSecondary×1, C.textMuted×1, C.surfaceMuted×1, C.surface×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 66 | `#f6f3fc` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f6f3fc` |
| 67 | `#ffffff` | surface | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#fff` |

Ngoài bảng: L64 `#7c3aed`(color)

## components/billing/BillingSkeleton.tsx

Thay 1: C.surfaceMuted×1 · giữ trắng 0

## components/billing/CurrentPlanCard.tsx

Thay 10: C.textMuted×3, C.textStrong×2, C.ink650×1, C.border×1, C.surfaceMuted×1, C.ink350×1, C.textSecondary×1 · giữ trắng 1

## components/billing/PaymentHistory.tsx

Thay 12: C.textStrong×3, C.textMuted×3, C.surfaceMuted×1, C.bg×1, C.ink650×1, C.textSecondary×1, C.surface×1, C.border×1 · giữ trắng 0

## components/billing/PendingOrderCard.tsx

Thay 10: C.textStrong×2, C.textSecondary×2, C.textMuted×1, C.ink350×1, C.surfaceMuted×1, C.border×2, C.surface×1 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 45 | `#ffffff` | surface | background | nằm trong gradient | `linear-gradient(180deg,#fffdf7,#fff)` |

Ngoài bảng: L45 `#f6dfae`(borderColor), L45 `#fffdf7`(background), L48 `#fdf0dc`(background), L49 `#d97706`(color), L66 `#dc2626`(color), L122 `#fdf0dc`(background), L122 `#f6dfae`(border), L125 `#b45309`(color), L126 `#7c4a08`(color)

## components/billing/PlanChoiceGrid.tsx

Thay 8: C.surface×1, C.border×1, C.textStrong×1, C.ink900×1, C.textMuted×1, C.ink650×1, C.ink350×1, C.surfaceMuted×1 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 53 | `#ffffff` | surface | backgroundImage | nằm trong gradient | `linear-gradient(#fff,#fff), ` |
| 53 | `#ffffff` | surface | backgroundImage | nằm trong gradient | `linear-gradient(#fff,#fff), ` |

Ngoài bảng: L64 `#6d28d9`(color), L64 `#f3edff`(background), L64 `#e7d9fb`(border), L82 `#f3edff`(background), L83 `#7c3aed`(color)

## components/billing/useServerCountdown.ts

Thay 0: — · giữ trắng 0

## components/brand/AiBrandPanel.tsx

Thay 4: C.surface×1, C.ink600×1, C.ink250×1, C.ink650×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 23 | `#f6f2ff` | surfaceMuted | background | nằm trong gradient | `linear-gradient(150deg,#f6f2ff,#fcf1fc)` |

Ngoài bảng: L23 `#fcf1fc`(background), L23 `#efe6fb`(border), L24 `#5b2b9e`(color), L28 `#7d6aa3`(color), L34 `#d6cdf0`(border), L34 `#9b7fd6`(color), L44 `#16a34a`(color), L45 `#16a34a`(color), L48 `#d6336c`(color), L49 `#d6336c`(color), L54 `#9b7fd6`(color), L54 `#ece2fb`(borderTop)

## components/brand/brandHealth.ts

Thay 0: — · giữ trắng 0

## components/brand/BrandHealthBar.tsx

Thay 3: C.textMuted×1, C.ink600×1, C.border×1 · giữ trắng 0

Ngoài bảng: L12 `#7c3aed`(color)

## components/brand/BrandProfileCard.tsx

Thay 14: C.border×3, C.textStrong×1, C.surface×3, C.textMuted×2, C.surfaceMuted×2, C.textSecondary×2, C.ink550×1 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 39 | `#ffffff` | surface | backgroundImage | nằm trong gradient | `linear-gradient(#fff,#fff), ` |
| 39 | `#ffffff` | surface | backgroundImage | nằm trong gradient | `linear-gradient(#fff,#fff), ` |

Ngoài bảng: L54 `#5b4b86`(color), L63 `#a78bfa`(stroke), L72 `#7c3aed`(color), L72 `#e0d5fb`(borderColor), L76 `#d6336c`(color), L76 `#d6336c`(stroke)

## components/brand/BrandProfileForm.tsx

Thay 11: C.ink550×3, C.textStrong×2, C.bg×1, C.border×2, C.surface×2, C.surfaceMuted×1 · giữ trắng 1

Ngoài bảng: L146 `#16a34a`(color), L150 `#d6336c`(color), L167 `#d6cdf0`(border), L167 `#7c5cff`(color)

## components/brand/BrandProfileList.tsx

Thay 6: C.textMuted×3, C.surfaceMuted×1, C.ink550×1, C.textStrong×1 · giữ trắng 5

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 159 | `#f6f2ff` | surfaceMuted | background | nằm trong gradient | `linear-gradient(150deg,#f6f2ff,#fcf1fc)` |

Ngoài bảng: L159 `#fcf1fc`(background), L160 `#a78bfa`(stroke)

## components/brand/BrandProfileView.tsx

Thay 16: C.ink550×2, C.textStrong×5, C.textMuted×1, C.surfaceMuted×3, C.ink650×1, C.ink250×1, C.border×1, C.surface×1, C.ink350×1 · giữ trắng 1

## components/brand/BrandSkeleton.tsx

Thay 1: C.surface×1 · giữ trắng 0

Ngoài bảng: L88 `#e2e8f0`(border)

## components/brand/chips.tsx

Thay 27: C.ink600×1, C.border×6, C.textStrong×1, C.surfaceSubtle×2, C.ink350×2, C.surface×5, C.text×2, C.bg×3, C.surfaceMuted×3, C.ink750×1, C.ink250×1 · giữ trắng 5

Ngoài bảng: L17 `#d6336c`(color), L21 `#d6336c`(color), L71 `#d6cdf0`(border), L71 `#7c5cff`(color), L161 `#7c3aed`(color), L193 `#d6cdf0`(border), L193 `#7c5cff`(color), L208 `#7d6aa3`(color), L226 `#c9bdf3`(border), L229 `#7c3aed`(color), L241 `#efe6fb`(border), L264 `#d6cdf0`(border), L264 `#7c5cff`(color), L265 `#d6336c`(color), L277 `#5b4b86`(color)

## components/brand/ConfirmDialog.tsx

Thay 0: — · giữ trắng 0

## components/brand/LogoLightbox.tsx

Thay 1: C.surface×1 · giữ trắng 1

## components/brand/SearchSuggestInput.tsx

Thay 9: C.surfaceMuted×2, C.border×2, C.ink350×2, C.textStrong×1, C.surface×1, C.text×1 · giữ trắng 0

## components/brand/SlideOver.tsx

Thay 7: C.surface×1, C.surfaceMuted×3, C.textStrong×1, C.textMuted×1, C.textSecondary×1 · giữ trắng 0

## components/brand/StrategyCard.tsx

Thay 11: C.surface×3, C.textStrong×1, C.border×2, C.surfaceMuted×2, C.ink550×1, C.textMuted×1, C.text×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 150 | `#f4f1fb` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f4f1fb` |

Ngoài bảng: L77 `#a855f7`(border), L77 `#e2e8f0`(border), L134 `#5b4b86`(color), L138 `#b08968`(color), L138 `#fdf6ec`(background), L149 `#d6336c`(color), L150 `#fdeef2`(BinaryExpression), L153 `#d6336c`(color), L153 `#7c5cff`(color)

## components/brand/StrategyDetail.tsx

Thay 8: C.textStrong×2, C.textMuted×1, C.surface×2, C.border×2, C.ink600×1 · giữ trắng 1

Ngoài bảng: L72 `#f3c9d6`(border), L72 `#d6336c`(color)

## components/brand/StrategyEditor.tsx

Thay 11: C.textStrong×1, C.textMuted×1, C.ink550×2, C.surface×3, C.border×3, C.bg×1 · giữ trắng 1

Ngoài bảng: L83 `#5b4b86`(color), L149 `#f3c9d6`(border), L149 `#d6336c`(color), L151 `#d6cdf0`(border), L151 `#7c5cff`(color)

## components/brand/StrategyManager.tsx

Thay 27: C.textMuted×7, C.surfaceMuted×2, C.ink550×3, C.border×7, C.surface×5, C.bg×2, C.ink750×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 262 | `#ffffff` | surface | border | viền trắng (ring?) | `2px solid #fff` |
| 285 | `#fdfbff` | surfaceSubtle | background | nằm trong gradient | `linear-gradient(135deg, #fdfbff 0%, #f4ecff 100%)` |
| 285 | `#ffffff` | surface | border | viền trắng (ring?) | `2px solid #fff` |

Ngoài bảng: L24 `#16a34a`(ArrowFunction), L24 `#d97706`(ArrowFunction), L24 `#9b96ad`(ArrowFunction), L170 `#a78bfa`(stroke), L185 `#7c3aed`(color), L185 `#f4ecff`(background), L228 `#7c3aed`(stroke), L240 `#7c3aed`(stroke), L254 `#a855f7`(border), L254 `#5b4b86`(color), L285 `#f4ecff`(background), L287 `#8b5cf6`(stroke), L306 `#7c3aed`(stroke), L314 `#7c3aed`(stroke)

## components/brand/StrategyOptimization.tsx

Thay 10: C.border×2, C.textMuted×2, C.surfaceMuted×1, C.ink650×1, C.ink350×1, C.surfaceSubtle×1, C.ink750×1, C.textSecondary×1 · giữ trắng 1

Ngoài bảng: L96 `#7c3aed`(color), L97 `#7c3aed`(color), L115 `#e9defb`(border), L116 `#6d28d9`(color), L140 `#7c3aed`(color), L175 `#e3d9fb`(borderLeft), L186 `#16a34a`(CallExpression), L186 `#e8f8ee`(CallExpression), L189 `#64748b`(CallExpression), L189 `#eef2f7`(CallExpression)

## components/brand/StrategySummary.tsx

Thay 3: C.surface×1, C.ink350×1, C.textStrong×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 18 | `#f6f2ff` | surfaceMuted | background | nằm trong gradient | `linear-gradient(150deg,#f6f2ff,#fcf1fc)` |

Ngoài bảng: L18 `#fcf1fc`(background), L18 `#efe6fb`(border), L19 `#5b2b9e`(color), L23 `#efe6fb`(border)

## components/calendar/AgendaView.tsx

Thay 5: C.textMuted×2, C.ink650×1, C.textFaint×1, C.surfaceMuted×1 · giữ trắng 0

Ngoài bảng: L46 `#7c3aed`(color), L75 `#7c3aed`(color)

## components/calendar/CalendarSkeleton.tsx

Thay 0: — · giữ trắng 0

## components/calendar/dateUtils.ts

Thay 0: — · giữ trắng 0

## components/calendar/DaySheet.tsx

Thay 7: C.surface×2, C.surfaceMuted×1, C.textSecondary×2, C.textStrong×1, C.border×1 · giữ trắng 0

## components/calendar/MonthGrid.tsx

Thay 10: C.textFaint×1, C.surfaceMuted×3, C.border×1, C.bg×1, C.surfaceSubtle×1, C.text×1, C.ink650×1, C.textMuted×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 175 | `#f4f1fb` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f4f1fb` |
| 176 | `#4b4660` | ink650 | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#4b4660` |

Ngoài bảng: L37 `#6b7280`(bg), L126 `#8b5cf6`(border), L126 `#c4b5fd`(border), L127 `#f1e9ff`(background), L133 `#7c3aed`(color), L133 `#a39fb3`(color), L169 `#ebe4f9`(BinaryExpression), L170 `#7c3aed`(BinaryExpression)

## components/calendar/ScheduleDetailDrawer.tsx

Thay 0: — · giữ trắng 0

## components/calendar/ScheduleDetailModal.tsx

Thay 66: C.surfaceMuted×7, C.surface×10, C.border×9, C.textStrong×5, C.textMuted×10, C.textSecondary×2, C.surfaceSubtle×7, C.text×2, C.ink750×6, C.textFaint×2, C.ink650×2, C.bg×3, C.ink550×1 · giữ trắng 8

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 265 | `#211c38` | textStrong | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#211c38` |
| 268 | `#f4f1fb` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f4f1fb` |
| 269 | `#6b6680` | textSecondary | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#6b6680` |
| 315 | `#ffffff` | surface | border | viền trắng (ring?) | `2px solid #fff` |
| 664 | `#1f1838` | textStrong | background | nằm trong gradient | `linear-gradient(135deg, #1f1838 0%, #352668 50%, #4f2d7f 100%)` |
| 699 | `#f3efff` | border | color | màu nền dùng làm chữ | `#f3efff` |

Ngoài bảng: L59 `#7c3aed`(color), L74 `#7c3aed`(color), L229 `#7c3aed`(color), L264 `#ebe5f8`(BinaryExpression), L320 `#6b7280`(bg), L336 `#6b7280`(bg), L368 `#fdf1f1`(background), L369 `#f9d2d8`(border), L374 `#b91c1c`(color), L378 `#991b1b`(color), L390 `#b91c1c`(color), L410 `#fdf6e7`(background), L411 `#f6e2b3`(border), L416 `#b45309`(color), L420 `#92400e`(color), L436 `#e23d6e`(color), L436 `#16a34a`(color), L475 `#e5e0f2`(border), L476 `#e8f8ee`(background), L477 `#16a34a`(color), L477 `#7c3aed`(color), L523 `#7c3aed`(color), L523 `#efe9fb`(background), L548 `#7c3aed`(color), L551 `#7c3aed`(color), L560 `#7c3aed`(color), L592 `#7c3aed`(color), L619 `#e5e0f2`(border), L627 `#6b7280`(bg), L664 `#352668`(background), L664 `#4f2d7f`(background), L676 `#8b5cf6`(background), L707 `#c9bce8`(color), L809 `#e23d6e`(border), L809 `#f2c9d4`(border), L814 `#e23d6e`(background), L815 `#e23d6e`(color), L858 `#d4cbf2`(border), L864 `#7c3aed`(color)

## components/calendar/ScheduleDetailView.tsx

Thay 65: C.surfaceMuted×9, C.textSecondary×7, C.textStrong×6, C.surface×6, C.border×8, C.textMuted×6, C.ink550×1, C.ink750×7, C.surfaceSubtle×5, C.text×2, C.bg×4, C.textFaint×2, C.ink650×2 · giữ trắng 10

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 350 | `#f4f1fb` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f4f1fb` |
| 355 | `#ffffff` | surface | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#ffffff` |
| 356 | `#ece8f6` | border | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#ece8f6` |
| 514 | `#211c38` | textStrong | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#211c38` |
| 517 | `#f4f1fb` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f4f1fb` |
| 518 | `#6b6680` | textSecondary | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#6b6680` |
| 560 | `#ffffff` | surface | border | viền trắng (ring?) | `2px solid #fff` |
| 956 | `#f5f2fa` | surfaceMuted | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f5f2fa` |
| 958 | `#211c38` | textStrong | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#211c38` |
| 961 | `#ffffff` | surface | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#ffffff` |
| 963 | `#4b4660` | ink650 | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#4b4660` |
| 1222 | `#f3efff` | border | color | màu nền dùng làm chữ | `#f3efff` |

Ngoài bảng: L59 `#7c3aed`(color), L74 `#7c3aed`(color), L232 `#7c3aed`(color), L239 `#6025d8`(BinaryExpression), L240 `#7c3aed`(BinaryExpression), L245 `#c4b5fd`(color), L285 `#7c3aed`(color), L351 `#ddd7ed`(BinaryExpression), L402 `#f7f5fc`(BinaryExpression), L405 `#7c3aed`(color), L430 `#f7f5fc`(BinaryExpression), L455 `#f7f5fc`(BinaryExpression), L480 `#e23d6e`(color), L485 `#fdf1f4`(BinaryExpression), L488 `#e23d6e`(color), L513 `#ebe5f8`(BinaryExpression), L567 `#1877f2`(bg), L597 `#1877f2`(backgroundColor), L636 `#fdf1f1`(background), L637 `#f9d2d8`(border), L642 `#b91c1c`(color), L646 `#991b1b`(color), L655 `#b91c1c`(color), L671 `#fdf6e7`(background), L672 `#f6e2b3`(border), L677 `#b45309`(color), L681 `#92400e`(color), L685 `#92400e`(color), L690 `#b45309`(color), L730 `#e23d6e`(color), L731 `#fdf1f4`(background), L744 `#16a34a`(color), L745 `#eaf8ef`(background), L826 `#e5ddf5`(border), L827 `#eaf8ef`(background), L828 `#16a34a`(color), L828 `#7c3aed`(color), L881 `#7c3aed`(color), L889 `#7c3aed`(color), L909 `#7c3aed`(color), L921 `#7c3aed`(color), L945 `#e0daee`(border), L957 `#d2c8ea`(BinaryExpression), L962 `#e0daee`(BinaryExpression), L1029 `#e5e0f2`(border), L1046 `#1877f2`(bg), L1071 `#1877f2`(backgroundColor), L1116 `#65676b`(color), L1134 `#7c3aed`(color), L1155 `#18112d`(background), L1155 `#291b4f`(background), L1155 `#43226a`(background), L1172 `#8b5cf6`(background), L1230 `#c9bce8`(color), L1271 `#65676b`(color)

## components/calendar/ScheduleItem.tsx

Thay 11: C.border×3, C.surfaceSubtle×1, C.textStrong×1, C.textFaint×2, C.ink750×1, C.ink200×1, C.surface×1, C.ink550×1 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 64 | `#ffffff` | surface | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#ffffff` |
| 71 | `#efeaf8` | border | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#efeaf8` |
| 72 | `#fcfbfe` | surfaceSubtle | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#fcfbfe` |

Ngoài bảng: L63 `#c4b5fd`(BinaryExpression), L84 `#6b7280`(bg), L104 `#b91c1c`(color), L104 `#b45309`(color), L104 `#fdf1f1`(background), L104 `#fdf6e7`(background), L149 `#e23d6e`(border), L151 `#e23d6e`(background), L152 `#e23d6e`(color)

## components/calendar/ScheduleModals.tsx

Thay 4: C.ink650×1, C.border×1, C.textStrong×1, C.surface×1 · giữ trắng 1

Ngoài bảng: L67 `#e23d6e`(color), L67 `#fdecf1`(background)

## components/calendar/ScheduleQueueList.tsx

Thay 8: C.surfaceMuted×2, C.text×1, C.textMuted×2, C.ink650×1, C.textFaint×1, C.surfaceSubtle×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 181 | `#f4effe` | border | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#f4effe` |
| 185 | `#fbfaff` | surfaceSubtle | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#fbfaff` |

Ngoài bảng: L79 `#7c3aed`(color), L117 `#7c3aed`(color), L171 `#dcd4f0`(border), L176 `#7c3aed`(color), L182 `#c4b5fd`(BinaryExpression), L186 `#dcd4f0`(BinaryExpression), L213 `#7c3aed`(color)

## components/calendar/StatCards.tsx

Thay 4: C.textFaint×2, C.textStrong×1, C.textMuted×1 · giữ trắng 0

## components/calendar/statusMeta.ts

Thay 0: — · giữ trắng 0

## components/calendar/UpcomingPanel.tsx

Thay 4: C.border×1, C.surface×1, C.textSecondary×1, C.textStrong×1 · giữ trắng 1

Ngoài bảng: L26 `#c4b5fd`(border), L28 `#f1e9ff`(background), L29 `#7c3aed`(color), L46 `#f2d9df`(border), L46 `#fdf5f7`(background), L46 `#c0356a`(color), L50 `#c0356a`(background), L59 `#16a34a`(color), L59 `#e8f8ee`(background), L60 `#16a34a`(background)

## components/create/AutoGrowTextarea.tsx

Thay 0: — · giữ trắng 0

## components/create/BrandVoicePanel.tsx

Thay 20: C.ink600×1, C.textSecondary×2, C.border×4, C.surface×2, C.textMuted×3, C.textFaint×3, C.text×1, C.surfaceMuted×1, C.surfaceSubtle×1, C.textStrong×2 · giữ trắng 0

Ngoài bảng: L37 `#16a34a`(color), L37 `#e8f8ee`(bg), L37 `#22d3ee`(bar), L37 `#16a34a`(bar), L38 `#b45309`(color), L38 `#fdf0dc`(bg), L38 `#fbbf24`(bar), L38 `#d97706`(bar), L59 `#7c3aed`(color), L61 `#7c3aed`(stroke), L82 `#92600a`(color), L82 `#fdf0dc`(background), L98 `#d9cef5`(border)

## components/create/ContentFilterDrawer.tsx

Thay 7: C.ink600×2, C.border×2, C.textStrong×1, C.surfaceSubtle×1, C.surface×1 · giữ trắng 1

## components/create/ContentList.tsx

Thay 28: C.textMuted×6, C.surface×5, C.border×5, C.ink600×3, C.surfaceMuted×3, C.ink550×3, C.ink200×2, C.textStrong×1 · giữ trắng 5

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 417 | `#f6f2ff` | surfaceMuted | background | nằm trong gradient | `linear-gradient(150deg,#f6f2ff,#fcf1fc)` |

Ngoài bảng: L248 `#e0d5fb`(border), L249 `#5b2b9e`(color), L261 `#6d28d9`(color), L263 `#6d28d9`(stroke), L276 `#5b4b86`(color), L278 `#e5ddf6`(background), L278 `#5b4b86`(color), L279 `#5b4b86`(stroke), L283 `#7c3aed`(color), L303 `#7c3aed`(color), L308 `#f3edff`(background), L308 `#7c3aed`(color), L318 `#e0d5fb`(border), L319 `#5b2b9e`(color), L321 `#5b2b9e`(stroke), L324 `#5b2b9e`(stroke), L326 `#d6336c`(color), L326 `#f3c9d6`(borderColor), L327 `#d6336c`(stroke), L329 `#7d6aa3`(color), L330 `#7d6aa3`(stroke), L417 `#fcf1fc`(background), L418 `#a78bfa`(stroke)

## components/create/ContentTable.tsx

Thay 15: C.border×2, C.surface×1, C.textMuted×2, C.ink600×3, C.surfaceMuted×1, C.bg×1, C.textFaint×2, C.textStrong×1, C.ink250×1, C.text×1 · giữ trắng 1

Ngoài bảng: L94 `#8b5cf6`(accentColor), L169 `#7c3aed`(color), L170 `#7c3aed`(stroke), L185 `#7c3aed`(color), L186 `#7c3aed`(stroke)

## components/create/ContentViewPanel.tsx

Thay 23: C.textFaint×1, C.border×5, C.textStrong×2, C.surfaceSubtle×1, C.surface×4, C.ink600×7, C.textMuted×2, C.ink200×1 · giữ trắng 4

Ngoài bảng: L276 `#7c3aed`(color), L278 `#7c3aed`(stroke)

## components/create/CreateSkeleton.tsx

Thay 4: C.surfaceSubtle×1, C.surfaceMuted×1, C.border×1, C.bg×1 · giữ trắng 0

## components/create/platformLimits.tsx

Thay 1: C.textFaint×1 · giữ trắng 0

Ngoài bảng: L19 `#dc2626`(color)

## components/create/PlatformTabs.tsx

Thay 3: C.border×1, C.surface×1, C.text×1 · giữ trắng 1

Ngoài bảng: L12 `#d97706`(running), L13 `#16a34a`(done), L14 `#dc2626`(error)

## components/create/PostImagePreview.tsx

Thay 38: C.textStrong×4, C.surfaceSubtle×1, C.textFaint×6, C.border×4, C.surface×1, C.bg×2, C.ink600×16, C.text×3, C.surfaceMuted×1 · giữ trắng 2

Ngoài bảng: L59 `#d9cef5`(border), L88 `#7c3aed`(color), L97 `#f3edff`(background), L97 `#7c3aed`(color)

## components/create/ReadinessChecklist.tsx

Thay 5: C.bg×1, C.border×1, C.textFaint×1, C.textStrong×1, C.surface×1 · giữ trắng 0

Ngoài bảng: L38 `#6b7280`(bg), L68 `#15803d`(VariableDeclaration), L68 `#e23d6e`(VariableDeclaration), L68 `#b45309`(VariableDeclaration), L80 `#e3d9fb`(border), L80 `#6d28d9`(color)

## components/create/ScriptSections.tsx

Thay 20: C.border×4, C.textStrong×1, C.surfaceSubtle×2, C.surface×3, C.bg×1, C.textMuted×2, C.textSecondary×2, C.text×2, C.ink250×2, C.textFaint×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 260 | `#ffffff` | surface | border | viền trắng (ring?) | `3px solid #fff` |

Ngoài bảng: L17 `#7c3aed`(dot), L17 `#f3edff`(badgeBg), L17 `#7c3aed`(badgeColor), L18 `#0e7490`(dot), L18 `#e0f7fb`(badgeBg), L18 `#0e7490`(badgeColor), L19 `#be185d`(dot), L19 `#fdeef5`(badgeBg), L19 `#be185d`(badgeColor), L27 `#e3dcf4`(border), L47 `#7c3aed`(color), L51 `#7c3aed`(stroke), L191 `#0e7490`(color), L212 `#d9cef5`(border), L212 `#7c3aed`(color), L213 `#7c3aed`(stroke), L237 `#0e7490`(color), L237 `#e0f7fb`(background), L269 `#d9cef5`(background), L269 `#e3dcf4`(background)

## components/create/SourceInfoCard.tsx

Thay 13: C.textFaint×3, C.text×1, C.border×3, C.surfaceSubtle×1, C.surface×2, C.textStrong×2, C.textMuted×1 · giữ trắng 1

Ngoài bảng: L89 `#efe6fb`(border)

## components/create/statusMeta.ts

Thay 0: — · giữ trắng 0

## components/create/StepLayout.tsx

Thay 4: C.surface×2, C.border×2 · giữ trắng 0

## components/create/useBrandVoiceCheck.ts

Thay 0: — · giữ trắng 0

## components/create/useReadiness.ts

Thay 0: — · giữ trắng 0

## components/create/useScriptRegen.ts

Thay 0: — · giữ trắng 0

## components/create/VersionContent.tsx

Thay 12: C.textFaint×1, C.bg×1, C.text×1, C.surfaceMuted×1, C.surface×2, C.textMuted×1, C.border×1, C.ink600×2, C.surfaceSubtle×1, C.textSecondary×1 · giữ trắng 0

Ngoài bảng: L34 `#7c3aed`(color), L66 `#f3edff`(background), L66 `#7c3aed`(color), L96 `#16a34a`(color), L98 `#16a34a`(stroke), L102 `#d9cef5`(border)

## components/create/WizardStepper.tsx

Thay 12: C.border×4, C.surface×2, C.ink600×2, C.textStrong×2, C.textFaint×2 · giữ trắng 3

## components/failedPosts/ErrorDetailModal.tsx

Thay 24: C.surfaceSubtle×1, C.surfaceMuted×4, C.textFaint×3, C.ink750×2, C.border×2, C.surface×3, C.ink600×2, C.textMuted×3, C.ink200×1, C.textStrong×1, C.textSecondary×1, C.text×1 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 253 | `#241f3a` | textStrong | background | màu chữ dùng làm nền | `#241f3a` |

Ngoài bảng: L45 `#f2c9d4`(border), L47 `#e23d6e`(color), L143 `#7c3aed`(color), L144 `#7c3aed`(borderBottom), L231 `#b91c1c`(color), L231 `#b45309`(color), L231 `#fdf1f1`(background), L231 `#fdf6e7`(background), L244 `#6b7280`(bg), L253 `#e9e4f9`(color)

## components/failedPosts/ErrorOverviewPanel.tsx

Thay 12: C.ink600×3, C.textFaint×2, C.textStrong×3, C.textMuted×2, C.text×1, C.surfaceMuted×1 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 24 | `#f1eef8` | surfaceMuted | stroke | màu nền dùng làm chữ | `#f1eef8` |

Ngoài bảng: L91 `#fdf1f1`(background), L94 `#b91c1c`(color)

## components/failedPosts/FailedPostList.tsx

Thay 9: C.surfaceMuted×3, C.border×1, C.surface×1, C.textMuted×1, C.ink350×1, C.textFaint×1, C.surfaceSubtle×1 · giữ trắng 0

## components/failedPosts/FailedPostRow.tsx

Thay 18: C.ink650×2, C.surfaceMuted×4, C.textFaint×5, C.textSecondary×3, C.border×1, C.surface×1, C.ink750×2 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 106 | `#f7f3ff` | surfaceMuted | VariableDeclaration | ngữ cảnh không phải thuộc tính style (VariableDeclaration) | `#f7f3ff` |

Ngoài bảng: L23 `#a78bfa`(color), L78 `#c4b5fd`(border), L92 `#6b7280`(bg), L135 `#6b7280`(bg)

## components/failedPosts/FilterBar.tsx

Thay 7: C.border×2, C.surface×2, C.ink650×1, C.textFaint×2 · giữ trắng 0

Ngoài bảng: L64 `#7c3aed`(color), L70 `#f1e9ff`(background), L70 `#7c3aed`(color)

## components/failedPosts/shared.ts

Thay 0: — · giữ trắng 0

## components/failedPosts/TabBar.tsx

Thay 5: C.border×1, C.surface×1, C.textSecondary×1, C.surfaceMuted×1, C.textMuted×1 · giữ trắng 1

Ngoài bảng: L33 `#c4b5fd`(border), L35 `#f1e9ff`(background), L35 `#7c3aed`(color), L42 `#7c3aed`(background)

## components/profile/ProfileSkeleton.tsx

Thay 1: C.border×1 · giữ trắng 0

## components/profile/RecentActivityCard.tsx

Thay 10: C.textStrong×1, C.border×1, C.surface×1, C.textFaint×4, C.textMuted×2, C.text×1 · giữ trắng 0

Ngoài bảng: L80 `#7c3aed`(color)

## components/schedule/plannerLogic.ts

Thay 0: — · giữ trắng 0

## components/schedule/ScheduleDateField.tsx

Thay 14: C.border×5, C.textStrong×1, C.textFaint×1, C.ink350×1, C.surface×3, C.text×1, C.textMuted×1, C.bg×1 · giữ trắng 0

Ngoài bảng: L81 `#f3aabf`(borderColor), L81 `#c4b5fd`(borderColor), L99 `#c4b5fd`(border), L100 `#1877f2`(background), L103 `#7c3aed`(color)

## components/schedule/SchedulePlanner.tsx

Thay 12: C.textMuted×4, C.border×2, C.surfaceMuted×1, C.surfaceSubtle×1, C.text×1, C.textStrong×1, C.ink650×1, C.bg×1 · giữ trắng 1

Ngoài bảng: L205 `#e23d6e`(color), L223 `#c4b5fd`(border), L223 `#f1e9ff`(background), L227 `#6b7280`(bg), L230 `#4c1d95`(color), L293 `#b45309`(color), L293 `#15803d`(color), L293 `#fdf6e7`(background), L293 `#eafbf1`(background), L297 `#e23d6e`(color), L297 `#fdecf1`(background)

## components/schedule/SchedulePlatformRow.tsx

Thay 24: C.textFaint×2, C.textMuted×4, C.border×3, C.surfaceSubtle×1, C.surface×4, C.textStrong×2, C.textSecondary×1, C.surfaceMuted×4, C.bg×2, C.ink650×1 · giữ trắng 2

Ngoài bảng: L91 `#6d28d9`(color), L92 `#b45309`(color), L94 `#e23d6e`(color), L94 `#15803d`(color), L103 `#bbf7d0`(border), L103 `#f3aabf`(border), L106 `#6b7280`(bg), L116 `#e3d9fb`(border), L134 `#6d28d9`(color), L180 `#e23d6e`(color), L188 `#6d28d9`(border), L188 `#e3d9fb`(border), L188 `#6d28d9`(background), L188 `#6d28d9`(color), L198 `#7c3aed`(color), L208 `#b45309`(color), L208 `#fdf6e7`(background), L217 `#15803d`(color), L217 `#e23d6e`(color), L274 `#b45309`(color), L280 `#7c3aed`(color), L292 `#6d28d9`(border), L292 `#e3d9fb`(border), L293 `#6d28d9`(background), L294 `#6d28d9`(color), L334 `#e23d6e`(color), L335 `#6d28d9`(color)

## components/schedule/ScheduleTimeField.tsx

Thay 12: C.text×1, C.border×3, C.surface×3, C.textStrong×1, C.ink350×1, C.textMuted×1, C.textFaint×1, C.surfaceMuted×1 · giữ trắng 1

Ngoài bảng: L102 `#c9c4d8`(color), L116 `#f3aabf`(border), L116 `#c4b5fd`(border), L136 `#7c3aed`(color), L154 `#b45309`(color)

## components/settings/PublishingTab.tsx

Thay 9: C.border×1, C.textStrong×2, C.surfaceSubtle×1, C.surfaceMuted×1, C.text×1, C.textMuted×2, C.ink600×1 · giữ trắng 1

Ngoài bảng: L17 `#e23d6e`(color), L60 `#e23d6e`(color)

## components/settings/UsageTab.tsx

Thay 29: C.ink550×7, C.border×4, C.surface×3, C.textFaint×2, C.textMuted×6, C.bg×1, C.text×3, C.textStrong×1, C.surfaceMuted×2 · giữ trắng 5

Ngoài bảng: L64 `#ef4444`(VariableDeclaration), L64 `#f59e0b`(VariableDeclaration), L127 `#fdeaea`(background), L127 `#fff7ed`(background), L127 `#fecaca`(border), L127 `#fed7aa`(border), L128 `#b91c1c`(color), L128 `#b45309`(color), L141 `#f1e9ff`(iconBg), L141 `#fae9ff`(iconBg), L141 `#8b5cf6`(iconColor), L144 `#e9f0ff`(iconBg), L144 `#f1e9ff`(iconBg), L144 `#6366f1`(iconColor), L146 `#e7fff4`(iconBg), L146 `#e9f7ff`(iconBg), L146 `#10b981`(iconColor), L153 `#7d6aa3`(color), L159 `#ece6f8`(background), L167 `#7d6aa3`(color), L192 `#7c3aed`(color), L225 `#ece6f8`(background)

## components/trends/filters.tsx

Thay 4: C.surface×1, C.border×1, C.textMuted×1, C.ink750×1 · giữ trắng 0

## components/trends/HowItWorks.tsx

Thay 3: C.textStrong×1, C.ink750×1, C.textSecondary×1 · giữ trắng 0

Ngoài bảng: L9 `#e7f6ff`(bg), L9 `#eef2ff`(bg), L9 `#3b82f6`(color), L10 `#f1e9ff`(bg), L10 `#e9f0ff`(bg), L10 `#8b5cf6`(color), L11 `#fff3e0`(bg), L11 `#ffe9f3`(bg), L11 `#f59e0b`(color), L12 `#e7fff4`(bg), L12 `#e9f7ff`(bg), L12 `#10b981`(color), L14 `#e3daf5`(VariableDeclaration), L41 `#d9cef0`(color), L51 `#b9a8e6`(stroke), L57 `#b9a8e6`(stroke)

## components/trends/IdeaCard.tsx

Thay 13: C.ink750×1, C.textMuted×1, C.ink650×5, C.surfaceMuted×1, C.border×3, C.surface×2 · giữ trắng 0

Ngoài bảng: L53 `#7c3aed`(color), L61 `#7c3aed`(color), L61 `#f3edff`(background), L70 `#e7d9fb`(border), L70 `#f3edff`(background), L70 `#6d28d9`(color), L72 `#6d28d9`(stroke), L80 `#16a34a`(color), L82 `#16a34a`(stroke), L93 `#7c3aed`(stroke)

## components/trends/IdeaDetailModal.tsx

Thay 17: C.textMuted×3, C.ink750×3, C.textStrong×1, C.bg×1, C.border×2, C.ink650×3, C.ink350×1, C.surfaceSubtle×1, C.surfaceMuted×1, C.surface×1 · giữ trắng 2

Ngoài bảng: L58 `#7c3aed`(color), L78 `#7c3aed`(color), L78 `#f3edff`(background), L113 `#16a34a`(color), L115 `#16a34a`(stroke)

## components/trends/ResearchHistoryItem.tsx

Thay 2: C.ink750×1, C.textMuted×1 · giữ trắng 0

Ngoài bảng: L29 `#7c3aed`(color), L32 `#7c3aed`(stroke)

## components/trends/ResearchStartModal.tsx

Thay 23: C.border×5, C.textStrong×1, C.surface×4, C.textSecondary×2, C.textMuted×3, C.ink650×3, C.ink350×2, C.surfaceMuted×2, C.bg×1 · giữ trắng 3

Ngoài bảng: L141 `#dc2626`(color), L199 `#8b5cf6`(border), L201 `#6d28d9`(color), L225 `#6d28d9`(color), L242 `#7c3aed`(stroke), L281 `#fdf0dc`(background), L282 `#d97706`(stroke), L283 `#92600a`(color), L289 `#b45309`(color)

## components/trends/ScheduleModal.tsx

Thay 18: C.border×6, C.textStrong×1, C.surface×3, C.textSecondary×1, C.textMuted×2, C.ink650×3, C.bg×1, C.ink750×1 · giữ trắng 1

Ngoài bảng: L131 `#dc2626`(color), L138 `#8b5cf6`(stroke), L140 `#8b5cf6`(accentColor), L185 `#8b5cf6`(border), L187 `#6d28d9`(color), L227 `#8b5cf6`(border), L229 `#6d28d9`(color), L237 `#dc2626`(color)

## components/trends/SessionDetailModal.tsx

Thay 24: C.textMuted×8, C.ink750×2, C.textStrong×2, C.textSecondary×1, C.bg×1, C.border×2, C.ink650×2, C.surfaceSubtle×1, C.surfaceMuted×3, C.ink350×1, C.surface×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 78 | `#f1eef9` | surfaceMuted | bg | thuộc tính lạ: bg | `#f1eef9` |

Ngoài bảng: L126 `#dc2626`(color)

## components/trends/TrendsSidebar.tsx

Thay 28: C.textMuted×6, C.ink750×2, C.textStrong×8, C.surfaceMuted×5, C.border×2, C.textSecondary×1, C.surface×1, C.ink650×1, C.text×2 · giữ trắng 0

Ngoài bảng: L108 `#7c3aed`(stroke), L118 `#e7d9fb`(border), L118 `#f3edff`(background), L118 `#6d28d9`(color), L150 `#f1e9ff`(background), L150 `#e9f0ff`(background), L151 `#8b5cf6`(stroke), L198 `#7c3aed`(color), L201 `#7c3aed`(stroke), L270 `#7c3aed`(color)

## components/trends/TrendsSkeleton.tsx

Thay 9: C.surfaceMuted×8, C.border×1 · giữ trắng 0

## components/trends/TrendStatCards.tsx

Thay 3: C.ink550×1, C.textStrong×1, C.textMuted×1 · giữ trắng 0

## components/trends/TrendTable.tsx

Thay 17: C.ink350×1, C.textMuted×5, C.ink750×6, C.surfaceMuted×3, C.textSecondary×1, C.bg×1 · giữ trắng 0

Ngoài bảng: L33 `#16a34a`(VariableDeclaration), L33 `#dc2626`(VariableDeclaration), L51 `#f3edff`(background), L53 `#7c3aed`(color), L53 `#7c3aed`(fill), L66 `#8b5cf6`(accentColor), L77 `#7c3aed`(color), L80 `#7c3aed`(stroke), L138 `#8b5cf6`(outline), L148 `#7c3aed`(color), L148 `#7c3aed`(fill), L149 `#7c3aed`(color), L162 `#16a34a`(color), L162 `#dc2626`(color), L167 `#dc2626`(color), L167 `#16a34a`(color), L207 `#16a34a`(VariableDeclaration), L207 `#dc2626`(VariableDeclaration), L216 `#7c3aed`(color), L216 `#7c3aed`(fill), L217 `#7c3aed`(color), L241 `#dc2626`(color), L241 `#16a34a`(color)

## pages/admin/AiModels.tsx

Thay 32: C.border×5, C.surface×1, C.ink550×3, C.ink750×6, C.text×2, C.textMuted×3, C.surfaceMuted×5, C.textFaint×5, C.textSecondary×1, C.surfaceSubtle×1 · giữ trắng 5

Ngoài bảng: L464 `#dc2626`(color), L485 `#fdecec`(background), L485 `#f6c6c6`(borderColor), L485 `#dc2626`(color), L490 `#d9cef7`(borderColor), L490 `#7c3aed`(color), L516 `#fef2f2`(background), L548 `#d97706`(color), L636 `#fee2e2`(background), L636 `#dc2626`(color), L710 `#fee2e2`(background), L710 `#dc2626`(color), L732 `#d97706`(color), L795 `#fdf0dc`(background), L795 `#b45309`(color)

## pages/admin/aiProviderRegistry.tsx

Thay 0: — · giữ trắng 5

Ngoài bảng: L34 `#8b5cf6`(hue), L43 `#4285f4`(hue), L52 `#10a37f`(hue), L60 `#ff6b5e`(hue), L68 `#f5a623`(hue), L77 `#7c3aed`(hue)

## pages/admin/AiProviders.tsx

Thay 23: C.border×4, C.surface×3, C.ink550×3, C.ink750×1, C.text×1, C.textFaint×3, C.textMuted×5, C.ink350×2, C.textStrong×1 · giữ trắng 2

Ngoài bảng: L38 `#ded7ee`(border), L198 `#8b5cf6`(hue), L198 `#f1ecfe`(tint), L199 `#0e7490`(hue), L199 `#e3f3f6`(tint), L200 `#4285f4`(hue), L200 `#e8f0fe`(tint), L201 `#c0740b`(hue), L201 `#fdf1dd`(tint), L258 `#7c3aed`(stroke), L261 `#0e7490`(stroke), L275 `#f1e9ff`(background), L275 `#7c3aed`(color), L275 `#ddc9fb`(borderColor), L320 `#fee2e2`(background), L320 `#dc2626`(color), L356 `#fdf0dc`(background), L356 `#b45309`(color)

## pages/admin/AiUsage.tsx

Thay 15: C.ink750×1, C.textMuted×3, C.text×2, C.border×1, C.surface×1, C.ink650×1, C.surfaceMuted×5, C.textFaint×1 · giữ trắng 0

Ngoài bảng: L113 `#f1e9ff`(iconBg), L113 `#fae9ff`(iconBg), L113 `#8b5cf6`(iconColor), L115 `#fff3e0`(iconBg), L115 `#ffe9f3`(iconBg), L115 `#ec4899`(iconColor), L182 `#b45309`(color)

## pages/admin/ApiVersions.tsx

Thay 23: C.border×5, C.surface×3, C.surfaceMuted×2, C.ink750×3, C.text×5, C.ink550×2, C.textMuted×2, C.textFaint×1 · giữ trắng 2

Ngoài bảng: L157 `#7c3aed`(color), L166 `#7c3aed`(color), L188 `#7c3aed`(color), L248 `#7c3aed`(color), L273 `#fee2e2`(background), L273 `#dc2626`(color), L280 `#7c3aed`(color)

## pages/admin/EditUserModal.tsx

Thay 26: C.textStrong×2, C.textMuted×4, C.border×5, C.textFaint×3, C.textSecondary×2, C.surfaceSubtle×1, C.surfaceMuted×3, C.ink750×1, C.surface×3, C.ink550×2 · giữ trắng 1

Ngoài bảng: L179 `#fdf0dc`(background), L179 `#f7dca6`(border), L181 `#92400e`(color), L201 `#6d28d9`(color), L202 `#7c3aed`(borderBottom), L324 `#dc2626`(color), L345 `#dc2626`(color)

## pages/admin/Landing.tsx

Thay 10: C.surface×3, C.border×2, C.ink550×3, C.surfaceMuted×1, C.textMuted×1 · giữ trắng 3

Ngoài bảng: L43 `#fbdce7`(border), L43 `#d6336c`(color), L193 `#e25c84`(background), L193 `#f59e0b`(background)

## pages/admin/Logs.tsx

Thay 3: C.border×1, C.surface×1, C.ink550×1 · giữ trắng 1

## pages/admin/Overview.tsx

Thay 26: C.border×3, C.surface×2, C.textMuted×5, C.surfaceMuted×5, C.ink750×2, C.textFaint×1, C.surfaceSubtle×1, C.text×3, C.bg×1, C.ink550×2, C.textStrong×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 123 | `#ffffff` | surface | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#fff` |
| 124 | `#ece8f6` | border | BinaryExpression | ngữ cảnh không phải thuộc tính style (BinaryExpression) | `#ece8f6` |

Ngoài bảng: L113 `#8b5cf6`(color), L119 `#f5f3ff`(BinaryExpression), L120 `#ddd6fe`(BinaryExpression), L127 `#8b5cf6`(stroke), L174 `#8b5cf6`(color), L184 `#ede9fe`(iconBg), L184 `#7c3aed`(iconColor), L190 `#dcfce7`(iconBg), L190 `#16a34a`(iconColor), L196 `#e0f7fb`(iconBg), L196 `#0e7490`(iconColor), L202 `#fdf0dc`(iconBg), L202 `#d97706`(iconColor), L256 `#7c3aed`(color), L329 `#7c3aed`(stroke), L433 `#7c3aed`(stroke)

## pages/admin/Plans.tsx

Thay 71: C.border×11, C.textStrong×5, C.surface×15, C.textFaint×3, C.ink550×6, C.ink900×1, C.textMuted×11, C.textSecondary×1, C.surfaceMuted×7, C.bg×2, C.ink650×6, C.ink200×3 · giữ trắng 7

Ngoài bảng: L181 `#f59e0b`(fill), L181 `#f59e0b`(color), L182 `#6d28d9`(color), L182 `#f3edff`(background), L182 `#e7d9fb`(border), L192 `#7d6aa3`(color), L194 `#e3ddf2`(color), L199 `#8b5cf6`(stroke), L212 `#fbdce7`(border), L213 `#e25c84`(stroke), L231 `#6d28d9`(color), L242 `#7c3aed`(color), L249 `#7c3aed`(color), L257 `#8b5cf6`(stroke), L259 `#fbdce7`(border), L260 `#e25c84`(stroke), L352 `#6d28d9`(color), L354 `#6d28d9`(color), L354 `#f3edff`(background), L354 `#e7d9fb`(border), L365 `#7c3aed`(color), L374 `#f3edff`(background), L375 `#7c3aed`(color), L468 `#f3edff`(background), L468 `#6d28d9`(color), L642 `#f3edff`(background), L642 `#6d28d9`(color), L672 `#6d28d9`(color)

## pages/admin/Posts.tsx

Thay 0: — · giữ trắng 0

## pages/admin/Revenue.tsx

Thay 15: C.ink550×5, C.textMuted×4, C.border×2, C.surface×3, C.surfaceMuted×1 · giữ trắng 5

Ngoài bảng: L270 `#8b5cf6`(stroke), L287 `#7c3aed`(color), L313 `#fdf0dc`(background), L313 `#d97706`(color), L357 `#f1e9ff`(iconBg), L357 `#fae9ff`(iconBg), L357 `#8b5cf6`(iconColor), L363 `#e9f0ff`(iconBg), L363 `#f1e9ff`(iconBg), L363 `#6366f1`(iconColor), L369 `#e7fff4`(iconBg), L369 `#e9f7ff`(iconBg), L369 `#10b981`(iconColor), L380 `#dc2626`(color), L383 `#dc2626`(color), L421 `#7c3aed`(color)

## pages/admin/SystemStatus.tsx

Thay 30: C.ink550×2, C.textMuted×5, C.text×6, C.border×1, C.surface×1, C.ink750×3, C.textFaint×5, C.surfaceMuted×3, C.textSecondary×3, C.textStrong×1 · giữ trắng 2

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 205 | `#a59fbb` | textFaint | background | màu chữ dùng làm nền | `#a59fbb` |
| 314 | `#f4f1fb` | surfaceMuted | bg | thuộc tính lạ: bg | `#f4f1fb` |

Ngoài bảng: L205 `#ef4444`(background), L205 `#22c55e`(background), L206 `#dc2626`(color), L235 `#dc2626`(color), L258 `#16a34a`(tone), L258 `#e8f8ee`(bg), L259 `#d97706`(tone), L259 `#fef3e2`(bg), L260 `#dc2626`(tone), L260 `#fdeaea`(bg), L264 `#d97706`(color), L264 `#fef8ee`(background), L264 `#f6e2bf`(border), L298 `#6b5ca8`(color), L314 `#6b5ca8`(tone), L315 `#0e7490`(tone), L315 `#e0f7fb`(bg), L316 `#dc2626`(tone), L316 `#fde8e8`(bg), L317 `#dc2626`(tone), L317 `#16a34a`(tone), L317 `#fde8e8`(bg), L317 `#e8f8ee`(bg), L322 `#6b5ca8`(color), L325 `#7c3aed`(color), L335 `#dc2626`(color), L344 `#7c3aed`(color), L345 `#ec4899`(color), L354 `#ec4899`(background), L354 `#f9a8d4`(background), L374 `#6b5ca8`(color), L378 `#e8f8ee`(background), L379 `#16a34a`(stroke), L396 `#dc2626`(color), L396 `#fde8e8`(background), L404 `#7c3aed`(color)

## pages/admin/UsageOverview.tsx

Thay 66: C.ink750×3, C.textMuted×4, C.ink550×13, C.border×14, C.surface×9, C.textFaint×13, C.text×1, C.surfaceMuted×6, C.bg×2, C.surfaceSubtle×1 · giữ trắng 5

Ngoài bảng: L74 `#ef4444`(VariableDeclaration), L74 `#f59e0b`(VariableDeclaration), L81 `#ece6f8`(background), L306 `#e4d9fb`(border), L306 `#5b3fa8`(color), L318 `#f1e9ff`(iconBg), L318 `#fae9ff`(iconBg), L318 `#8b5cf6`(iconColor), L323 `#e7fff4`(iconBg), L323 `#e9f7ff`(iconBg), L323 `#10b981`(iconColor), L325 `#e9f0ff`(iconBg), L325 `#f1e9ff`(iconBg), L325 `#6366f1`(iconColor), L327 `#fff1e9`(iconBg), L327 `#ffe9f1`(iconBg), L327 `#f59e0b`(iconColor), L381 `#ece6f8`(background), L453 `#ef4444`(ArrowFunction), L453 `#f59e0b`(ArrowFunction), L463 `#ece6f8`(background), L475 `#b45309`(color), L476 `#dc2626`(color), L492 `#7c3aed`(color)

## pages/admin/Users.tsx

Thay 20: C.ink750×2, C.textFaint×3, C.textMuted×3, C.surfaceMuted×3, C.textSecondary×1, C.surfaceSubtle×1, C.text×1, C.border×2, C.surface×2, C.ink550×1, C.textStrong×1 · giữ trắng 3

Ngoài bảng: L88 `#e9f0ff`(tint), L88 `#f1e9ff`(tint), L88 `#6366f1`(color), L89 `#e7fff4`(tint), L89 `#e9f7ff`(tint), L89 `#10b981`(color), L90 `#fde8e8`(tint), L90 `#fff0f0`(tint), L90 `#dc2626`(color), L91 `#f1e9ff`(tint), L91 `#fae9ff`(tint), L91 `#8b5cf6`(color), L355 `#dc2626`(color)

## pages/admin/UserUsageDetail.tsx

Thay 36: C.border×4, C.ink750×2, C.surface×3, C.ink550×5, C.textMuted×7, C.textFaint×8, C.text×4, C.bg×1, C.surfaceMuted×2 · giữ trắng 3

Ngoài bảng: L182 `#ef4444`(VariableDeclaration), L182 `#f59e0b`(VariableDeclaration), L187 `#7d6aa3`(color), L193 `#fff7ed`(background), L193 `#fed7aa`(border), L194 `#b45309`(color), L199 `#92400e`(color), L228 `#ece6f8`(background), L237 `#059669`(color), L240 `#b45309`(color), L240 `#dc2626`(color), L254 `#b45309`(color), L255 `#ef4444`(CallExpression), L259 `#fecaca`(border), L259 `#dc2626`(color), L298 `#ece6f8`(background), L317 `#059669`(color), L317 `#dc2626`(color)

## pages/app/Analytics.tsx

Thay 1: C.textSecondary×1 · giữ trắng 0

## pages/app/Billing.tsx

Thay 3: C.textSecondary×1, C.textStrong×1, C.textMuted×1 · giữ trắng 0

## pages/app/BillingCheckout.tsx

Thay 7: C.textStrong×1, C.textSecondary×4, C.surface×1, C.border×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 193 | `#f1f2fc` | bg | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.10),transparent` |
| 193 | `#f5f1fb` | surfaceMuted | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.10),transparent` |
| 193 | `#f9f1fc` | surfaceMuted | background | nằm trong gradient | `radial-gradient(900px 700px at 18% 8%,rgba(34,211,238,.10),transparent` |

Ngoài bảng: L112 `#6d28d9`(color), L202 `#16a34a`(color)

## pages/app/BillingMock.tsx

Thay 6: C.textStrong×2, C.textSecondary×1, C.surface×1, C.border×1, C.ink350×1 · giữ trắng 0

Ngoài bảng: L41 `#16a34a`(color), L41 `#e8f8ee`(bg), L42 `#dc2626`(color), L42 `#fde8e8`(bg), L43 `#c2410c`(color), L43 `#ffedd5`(bg), L50 `#f1e9ff`(background), L51 `#7c3aed`(color)

## pages/app/BillingReturn.tsx

Thay 6: C.textSecondary×3, C.textStrong×1, C.surface×1, C.border×1 · giữ trắng 1

Ngoài bảng: L136 `#dc2626`(color), L136 `#fde8e8`(bg), L140 `#16a34a`(color), L140 `#e8f8ee`(bg), L142 `#dc2626`(color), L142 `#fde8e8`(bg), L144 `#6b7280`(color), L144 `#f3f4f6`(bg), L146 `#c2410c`(color), L146 `#ffedd5`(bg), L150 `#d97706`(color), L150 `#fdf0dc`(bg)

## pages/app/Brand.tsx

Thay 3: C.ink550×1, C.surface×1, C.border×1 · giữ trắng 3

Ngoài bảng: L62 `#7c3aed`(color), L62 `#f4ecff`(background), L62 `#e7d9fb`(border), L63 `#7c3aed`(stroke)

## pages/app/Calendar.tsx

Thay 14: C.textStrong×3, C.bg×1, C.surface×3, C.textSecondary×2, C.textMuted×2, C.ink550×1, C.border×2 · giữ trắng 5

Ngoài bảng: L394 `#7c3aed`(color), L431 `#7c3aed`(color), L537 `#e23d6e`(VariableDeclaration), L537 `#7c3aed`(VariableDeclaration), L538 `#fdeef2`(VariableDeclaration), L538 `#f4ecff`(VariableDeclaration), L561 `#c4b5fd`(border), L563 `#f1e9ff`(background), L564 `#7c3aed`(color)

## pages/app/Create.tsx

Thay 0: — · giữ trắng 0

## pages/app/CreateWizard.tsx

Thay 13: C.text×1, C.border×2, C.surface×3, C.ink600×4, C.surfaceMuted×1, C.textStrong×1, C.textMuted×1 · giữ trắng 0

Ngoài bảng: L552 `#a78bfa`(stroke), L556 `#e3d9fb`(border), L556 `#6d28d9`(color)

## pages/app/FailedPosts.tsx

Thay 0: — · giữ trắng 1

Ngoài bảng: L186 `#7c6f4f`(color), L186 `#fdf6e7`(background), L186 `#f3e6c4`(border)

## pages/app/Trends.tsx

Thay 29: C.textStrong×2, C.textMuted×4, C.surface×7, C.border×7, C.ink350×2, C.surfaceMuted×3, C.textSecondary×1, C.ink650×3 · giữ trắng 4

Ngoài bảng: L463 `#6d28d9`(color), L484 `#8b5cf6`(border), L484 `#6d28d9`(color), L486 `#7c3aed`(stroke), L495 `#f6d9d9`(border), L495 `#dc2626`(color), L497 `#dc2626`(stroke), L506 `#dc2626`(background), L528 `#8b5cf6`(accentColor), L561 `#6d28d9`(color)

## components/admin/landing/LandingFields.tsx

Thay 30: C.border×5, C.textStrong×2, C.surface×6, C.textFaint×2, C.ink250×2, C.surfaceMuted×3, C.ink350×1, C.text×1, C.textMuted×4, C.surfaceSubtle×1, C.ink650×2, C.bg×1 · giữ trắng 0

Ngoài bảng: L13 `#e25c84`(VariableDeclaration), L24 `#fff7fa`(background), L185 `#7c3aed`(color), L249 `#7c3aed`(color), L249 `#f3edff`(background), L253 `#fbdce7`(borderColor), L253 `#e25c84`(stroke), L262 `#d9cef5`(border), L262 `#7c3aed`(color), L288 `#8b5cf6`(border), L288 `#f3edff`(background), L290 `#7c3aed`(stroke)

## components/admin/landing/LandingSectionEditor.tsx

Thay 0: — · giữ trắng 0

Ngoài bảng: L74 `#e25c84`(borderColor)

## components/admin/logs/activityLabels.ts

Thay 0: — · giữ trắng 0

## components/admin/logs/ActivityLogDetailModal.tsx

Thay 3: C.textFaint×3 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 9 | `#1f1b2e` | ink900 | background | màu chữ dùng làm nền | `#1f1b2e` |

Ngoài bảng: L9 `#c9c2e8`(color)

## components/admin/logs/ActivityLogTab.tsx

Thay 22: C.ink750×1, C.textMuted×3, C.border×5, C.surface×5, C.ink650×2, C.ink550×2, C.surfaceMuted×1, C.textFaint×1, C.ink200×2 · giữ trắng 0

Ngoài bảng: L141 `#7d6aa3`(color)

## components/admin/logs/ErrorLogTab.tsx

Thay 12: C.border×2, C.surface×1, C.ink650×1, C.textMuted×2, C.surfaceMuted×1, C.text×1, C.textFaint×3, C.bg×1 · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 111 | `#1f1b2e` | ink900 | background | màu chữ dùng làm nền | `#1f1b2e` |
| 115 | `#1f1b2e` | ink900 | background | màu chữ dùng làm nền | `#1f1b2e` |

Ngoài bảng: L66 `#6b5ca8`(color), L81 `#6b5ca8`(color), L86 `#efeafc`(background), L86 `#6b5ca8`(color), L107 `#6b5ca8`(color), L111 `#e6e1ff`(color), L115 `#c9c2e8`(color)

## components/admin/posts/DateRangePill.tsx

Thay 15: C.border×4, C.surface×4, C.ink550×2, C.surfaceMuted×1, C.ink650×1, C.ink350×1, C.textMuted×2 · giữ trắng 1

Ngoài bảng: L109 `#c4b5fd`(border), L114 `#8b5cf6`(color)

## components/admin/posts/platforms.ts

Thay 0: — · giữ trắng 0

## components/admin/posts/PostProblemDetail.tsx

Thay 15: C.textFaint×2, C.border×1, C.surface×1, C.ink550×1, C.ink200×1, C.textStrong×1, C.textMuted×2, C.ink600×4, C.surfaceMuted×2 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 173 | `#1f1b2e` | ink900 | background | màu chữ dùng làm nền | `#1f1b2e` |

Ngoài bảng: L59 `#8b5cf6`(stroke), L128 `#7c3aed`(color), L159 `#6b5ca8`(color), L173 `#ffd9d9`(color), L182 `#7c3aed`(stroke)

## components/admin/posts/PostProblemFilterBar.tsx

Thay 6: C.border×2, C.surface×2, C.ink550×1, C.ink200×1 · giữ trắng 0

Ngoài bảng: L64 `#c4b5fd`(border), L65 `#f1e9ff`(background), L66 `#7c3aed`(color), L102 `#7c3aed`(color)

## components/admin/posts/PostProblemKpis.tsx

Thay 0: — · giữ trắng 0

Ngoài bảng: L28 `#ffe9ec`(iconBg), L28 `#fff1f3`(iconBg), L28 `#dc2626`(iconColor), L32 `#ffe9ec`(iconBg), L32 `#fff1f3`(iconBg), L32 `#dc2626`(iconColor), L36 `#f1e9ff`(iconBg), L36 `#faf0ff`(iconBg), L36 `#7c3aed`(iconColor), L46 `#fff1dc`(iconBg), L46 `#fff8ec`(iconBg), L46 `#d97706`(iconColor), L47 `#e0f2fe`(iconBg), L47 `#eff8ff`(iconBg), L47 `#0e7490`(iconColor), L52 `#fff1dc`(iconBg), L52 `#fff8ec`(iconBg), L52 `#d97706`(iconColor), L53 `#e0f2fe`(iconBg), L53 `#eff8ff`(iconBg), L53 `#0e7490`(iconColor)

## components/admin/posts/PostProblemTable.tsx

Thay 13: C.surfaceMuted×2, C.ink750×2, C.textMuted×2, C.textFaint×2, C.text×1, C.textSecondary×2, C.border×1, C.surface×1 · giữ trắng 1

Ngoài bảng: L103 `#7c3aed`(boxShadow), L163 `#c4b5fd`(border), L164 `#f1e9ff`(background), L165 `#7c3aed`(color)

## components/admin/posts/PostProblemToolbar.tsx

Thay 9: C.border×2, C.surface×2, C.textSecondary×1, C.surfaceMuted×1, C.textMuted×1, C.ink550×2 · giữ trắng 1

Ngoài bảng: L65 `#c4b5fd`(border), L67 `#f1e9ff`(background), L67 `#7c3aed`(color), L74 `#7c3aed`(background), L91 `#7c3aed`(color), L98 `#f1e9ff`(background), L98 `#7c3aed`(color), L111 `#8b5cf6`(color)

## components/admin/posts/rejectionReasons.ts

Thay 0: — · giữ trắng 0

## components/admin/posts/usePostProblems.ts

Thay 0: — · giữ trắng 0

## components/admin/revenue/chartTokens.ts

Thay 0: — · giữ trắng 0

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 19 | `#f1eef8` | surfaceMuted | VariableDeclaration | ngữ cảnh không phải thuộc tính style (VariableDeclaration) | `#f1eef8` |
| 20 | `#a59fbb` | textFaint | VariableDeclaration | ngữ cảnh không phải thuộc tính style (VariableDeclaration) | `#a59fbb` |

Ngoài bảng: L8 `#8b5cf6`(VariableDeclaration), L11 `#a78bfa`(VariableDeclaration), L14 `#f7f5fc`(VariableDeclaration), L17 `#ef4444`(VariableDeclaration), L26 `#8b5cf6`(ArrayLiteralExpression), L26 `#46d6ec`(ArrayLiteralExpression), L26 `#f083c0`(ArrayLiteralExpression), L26 `#10b981`(ArrayLiteralExpression), L26 `#f59e0b`(ArrayLiteralExpression), L26 `#6366f1`(ArrayLiteralExpression), L26 `#ec4899`(ArrayLiteralExpression), L26 `#14b8a6`(ArrayLiteralExpression), L35 `#10b981`(stroke), L36 `#f43f5e`(stroke), L37 `#8b5cf6`(stroke), L38 `#94a3b8`(stroke)

## components/admin/revenue/ForecastCard.tsx

Thay 12: C.surface×1, C.border×1, C.textStrong×2, C.textMuted×4, C.textFaint×2, C.text×1, C.surfaceMuted×1 · giữ trắng 2

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 115 | `#d9d3ea` | borderStrong | stroke | màu nền dùng làm chữ | `#d9d3ea` |

Ngoài bảng: L57 `#7c3aed`(color), L121 `#ddd6fe`(stroke)

## components/admin/revenue/OrdersTab.tsx

Thay 11: C.textSecondary×2, C.surfaceMuted×1, C.bg×1, C.textStrong×2, C.textMuted×1, C.ink650×1, C.surface×1, C.border×1, C.ink350×1 · giữ trắng 0

Ngoài bảng: L140 `#d97706`(color), L140 `#fdf0dc`(bg), L149 `#0e7490`(color), L149 `#e0f7fb`(bg), L160 `#dc2626`(color), L160 `#fde8e8`(bg), L161 `#16a34a`(color), L161 `#e8f8ee`(bg), L221 `#d97706`(color), L225 `#7c3aed`(color)

## components/admin/revenue/PlanDonut.tsx

Thay 6: C.textFaint×1, C.textStrong×1, C.textMuted×2, C.text×1, C.ink550×1 · giữ trắng 0

## components/admin/revenue/RevenueChart.tsx

Thay 5: C.surface×1, C.border×1, C.textStrong×1, C.ink550×1, C.textMuted×1 · giữ trắng 1

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 171 | `#d9d3ea` | borderStrong | stroke | màu nền dùng làm chữ | `#d9d3ea` |

Ngoài bảng: L93 `#7c3aed`(color), L99 `#7c3aed`(color), L176 `#ddd6fe`(stroke)

## components/admin/revenue/RevenueFilterBar.tsx

Thay 18: C.textMuted×3, C.border×4, C.surfaceMuted×1, C.surface×4, C.ink650×1, C.textFaint×1, C.ink350×1, C.ink550×3 · giữ trắng 2

Ngoài bảng: L156 `#c4b5fd`(border), L160 `#8b5cf6`(color), L253 `#dc2626`(color)

## components/admin/revenue/SparklineCard.tsx

Thay 2: C.textMuted×1, C.textStrong×1 · giữ trắng 0

## components/admin/revenue/TransactionsTable.tsx

Thay 11: C.ink750×2, C.textMuted×2, C.surfaceMuted×2, C.bg×2, C.textFaint×2, C.surface×1 · giữ trắng 0

Ngoài bảng: L47 `#7c3aed`(color), L80 `#6b5ca8`(color), L94 `#dc2626`(color)

## components/admin/usage/AlertsPanel.tsx

Thay 22: C.ink750×1, C.textMuted×3, C.border×4, C.surface×2, C.ink550×4, C.surfaceMuted×3, C.bg×1, C.textFaint×3, C.text×1 · giữ trắng 1

Ngoài bảng: L94 `#fecaca`(border), L94 `#dc2626`(color), L156 `#7d6aa3`(color)

## components/admin/usage/UsageEventsTable.tsx

Thay 21: C.ink750×3, C.textMuted×3, C.border×3, C.surface×3, C.surfaceMuted×2, C.ink550×2, C.textFaint×3, C.bg×2 · giữ trắng 2

Ngoài bảng: L249 `#fff7ed`(background), L249 `#fed7aa`(border), L249 `#b45309`(color), L277 `#7d6aa3`(color), L339 `#dc2626`(color)

## components/admin/usage/UsageRangeBar.tsx

Thay 17: C.textMuted×2, C.border×4, C.surfaceMuted×1, C.surface×4, C.ink650×1, C.textFaint×1, C.ink350×1, C.ink550×3 · giữ trắng 2

Ngoài bảng: L153 `#c4b5fd`(border), L157 `#8b5cf6`(color), L200 `#dc2626`(color)

## components/admin/users/UserPlanTab.tsx

Thay 30: C.textMuted×5, C.ink650×2, C.textFaint×4, C.ink750×3, C.ink550×3, C.surfaceSubtle×1, C.surfaceMuted×2, C.border×5, C.textStrong×1, C.surface×3, C.textSecondary×1 · giữ trắng 1

Ngoài bảng: L357 `#6d28d9`(color), L406 `#dc2626`(color), L427 `#fdf0dc`(background), L427 `#f7dca6`(border), L427 `#92400e`(color), L428 `#e9dcff`(border), L431 `#f5c2d3`(border), L431 `#d9c8fb`(border), L432 `#fdeef3`(background), L432 `#f3edff`(background), L433 `#be185d`(color), L433 `#6d28d9`(color), L438 `#d6336c`(background)

## components/billing/checkout/OrderSummaryCard.tsx

Thay 10: C.textMuted×3, C.surfaceMuted×2, C.textStrong×2, C.ink900×1, C.ink350×1, C.ink650×1 · giữ trắng 1

## components/billing/checkout/PaymentMethodList.tsx

Thay 7: C.textMuted×1, C.textSecondary×2, C.surface×2, C.border×1, C.textStrong×1 · giữ trắng 1

Ngoài bảng: L50 `#7c3aed`(border), L66 `#7c3aed`(border), L66 `#d6cfe8`(border)

## components/billing/checkout/SelectedPlanCard.tsx

Thay 8: C.textMuted×3, C.textStrong×1, C.ink900×1, C.textSecondary×1, C.ink650×1, C.surfaceMuted×1 · giữ trắng 0

Ngoài bảng: L58 `#f3edff`(background), L59 `#7c3aed`(color), L73 `#e7d9fb`(border), L74 `#6d28d9`(color)

## components/create/steps/FinalizeStep.tsx

Thay 31: C.textFaint×3, C.border×7, C.textStrong×3, C.surfaceSubtle×1, C.textMuted×3, C.surface×7, C.bg×1, C.surfaceMuted×2, C.ink600×4 · giữ trắng 2

Ngoài bảng: L196 `#b45309`(color), L206 `#7c3aed`(color), L209 `#7c3aed`(stroke), L218 `#e3d9fb`(border), L218 `#6d28d9`(color), L221 `#6d28d9`(stroke), L275 `#e3d9fb`(border), L275 `#6d28d9`(color), L277 `#6d28d9`(stroke), L296 `#7c3aed`(border), L296 `#7c3aed`(color), L298 `#7c3aed`(stroke), L368 `#b45309`(color), L382 `#d9cdf7`(border), L382 `#6d28d9`(color), L384 `#6d28d9`(stroke)

## components/create/steps/GenerateStep.tsx

Thay 25: C.textStrong×2, C.textMuted×1, C.border×7, C.surface×4, C.ink600×6, C.textSecondary×1, C.bg×1, C.surfaceSubtle×1, C.textFaint×2 · giữ trắng 7

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 107 | `#f6f2ff` | surfaceMuted | background | nằm trong gradient | `linear-gradient(150deg,#f6f2ff,#fcf1fc)` |

Ngoài bảng: L107 `#fcf1fc`(background), L108 `#a78bfa`(stroke), L134 `#8b5cf6`(border), L134 `#6d28d9`(color), L145 `#e0f7fb`(background), L145 `#0e7490`(color), L160 `#d1435b`(color), L160 `#fdf1f3`(background), L207 `#7c3aed`(color), L209 `#7c3aed`(stroke)

## components/create/steps/ScheduleStep.tsx

Thay 17: C.textStrong×2, C.textMuted×3, C.border×3, C.surface×3, C.ink600×6 · giữ trắng 3

Ngoài bảng: L49 `#effcf3`(background), L49 `#f1fbf6`(background), L50 `#16a34a`(stroke)

## components/create/steps/SourceStep.tsx

Thay 27: C.border×6, C.textStrong×4, C.surfaceSubtle×2, C.ink600×4, C.textFaint×5, C.surface×2, C.ink650×1, C.text×1, C.textMuted×2 · giữ trắng 7

| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |
|---|---|---|---|---|---|
| 317 | `#c4bdd6` | ink200 | bg | thuộc tính lạ: bg | `#c4bdd6` |

Ngoài bảng: L223 `#d1435b`(color), L223 `#fdf1f3`(background), L261 `#fdf0dc`(background), L262 `#d97706`(stroke), L263 `#92600a`(color), L311 `#8b5cf6`(border), L313 `#6d28d9`(color), L319 `#6d28d9`(stroke), L396 `#16a34a`(color), L397 `#e8f8ee`(background)
