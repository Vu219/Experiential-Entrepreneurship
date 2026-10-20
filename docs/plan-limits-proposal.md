# Đề xuất: Giới hạn tính năng theo gói (admin cấu hình)

> Trạng thái: **ĐÃ TRIỂN KHAI** (2026-10-20, Flyway V18) với số mặc định ở mục 3 — admin chỉnh được ở "Quản lý gói". Ghi chú: PRO để không giới hạn hồ sơ thương hiệu cho khớp nội dung gói đang bán.

## 1. Hiện trạng (đã kiểm tra trong code)

| Đã có | Ở đâu |
|---|---|
| Gói do admin CRUD (giá, chu kỳ `billing_interval_months`, mô tả song ngữ, bảng so sánh landing) | `Plan`, `PlanFeature`/`PlanFeatureValue`, `PlanAdminController`, `pages/admin/Plans.tsx` |
| Hạn mức token AI / tháng | `plans.monthly_token_limit` → `TokenUsageService.checkQuota` (chặn generate/format/research/optimize/AI assist) |
| Lượt AI kiểm tra chính sách / tháng, số lần AI sửa bài / bản | `plans.policy_check_ai_monthly_limit`, `plans.ai_fix_max_per_version` (Flyway V15) → `PlanLimitService` |
| Quy ước giá trị | `null` = mặc định hệ thống (yml), `-1` = không giới hạn, `0` = tắt, `>0` = số lượt |
| Gói hiện hành của user | `Subscription` (nguồn sự thật, không dùng nhãn `User.plan`); kỳ tính usage = `currentPeriodStart/End` |

**Chưa giới hạn gì**: số hồ sơ thương hiệu, số chiến lược, số kênh kết nối, số phiên nghiên cứu xu hướng, lượt research tự động 2:00, số bài lên lịch, giờ vàng, mức độ phân tích, xuất dữ liệu, tối ưu chiến lược. Bảng so sánh landing (`plan_features`) chỉ là chữ hiển thị, không ràng buộc gì.

## 2. Nguyên tắc thiết kế

1. **Mở rộng đúng chỗ đã có**: thêm cột vào `plans` + đọc DUY NHẤT qua `PlanLimitService` (đúng quy tắc trong `backend/CLAUDE.md`), cùng quy ước `null / -1 / 0 / >0`. Cờ bật/tắt dùng `Boolean` nullable (`null` = mặc định).
2. **Đếm usage từ bảng nguồn**, không thêm bảng đếm (không lệch số): đếm trong kỳ subscription hiện tại (`currentPeriodStart..End`).
3. **Chặn ở backend** (service), FE chỉ hiển thị trạng thái khoá + nút nâng cấp. Một `ErrorCode` chung `PLAN_LIMIT_REACHED` / `PLAN_FEATURE_NOT_INCLUDED` kèm `limitKey`, `used`, `limit` để FE dựng câu + CTA.
4. **Hạ gói không xoá dữ liệu**: dữ liệu vượt hạn mức giữ nguyên, chỉ chặn TẠO MỚI. Lịch đã tạo vẫn đăng; kênh đã kết nối vẫn hoạt động; kết nối lại kênh cũ luôn được phép.
5. **Thu thập analytics không bao giờ dừng theo gói** (BR-09) — gói chỉ giới hạn phần XEM/xuất.
6. Không đổi state machine bài đăng, không thêm trạng thái mới.

## 3. Danh mục giới hạn đề xuất

| Nhóm | Khoá (`limitKey`) | Kiểu | Điểm chặn | FREE | PLUS | PRO |
|---|---|---|---|---|---|---|
| Thương hiệu | `BRAND_PROFILES` | số | `BrandProfileServiceImpl.create` | 1 | 3 | ∞ |
| Thương hiệu | `STRATEGIES_PER_BRAND` | số | `ContentStrategyServiceImpl.create` | 1 | 5 | ∞ |
| Kết nối | `CONNECTED_CHANNELS` (Trang/kênh đăng được, không tính kết nối USER gốc) | số | OAuth callback: kênh MỚI vượt hạn mức bị bỏ qua, kênh cũ vẫn upsert | 1 | 3 | 10 |
| Xu hướng | `TREND_RESEARCH_PER_PERIOD` (phiên MANUAL) | số | `TrendResearchServiceImpl` start | 3 | 30 | ∞ |
| Xu hướng | `AUTO_TREND_RESEARCH` (lượt 2:00) | cờ | `DailyTrendResearchJob` bỏ qua user | tắt | bật | bật |
| Xu hướng | `IDEAS_PER_RESEARCH` (trần `articleCount`) | số | validate `articleCount` | 5 | 10 | 20 |
| Lên lịch | `SCHEDULING` (chế độ SCHEDULE + batch) | cờ | `PostScheduleServiceImpl.create/batch` | bật | bật | bật |
| Lên lịch | `SCHEDULED_POSTS_PER_PERIOD` (lịch tạo trong kỳ, gồm "đăng ngay") | số | create/batch/publish-now | 10 | 100 | ∞ |
| Lên lịch | `ACTIVE_SCHEDULES` (SCHEDULED/ON_HOLD cùng lúc) | số | create/batch | 5 | 50 | ∞ |
| Lên lịch | `SCHEDULE_HORIZON_DAYS` (đặt lịch xa nhất) | số | validate `scheduledTime` | 7 | 30 | 90 |
| Giờ vàng | `GOLDEN_HOURS` (AI `golden-hours` + `suggested-slots`) | cờ | `PostScheduleServiceImpl` | tắt | bật | bật |
| Phân tích | `ANALYTICS_HISTORY_DAYS` (kẹp `from`) | số | `AnalyticsServiceImpl` | 7 | 90 | 365 |
| Phân tích | `ANALYTICS_ADVANCED` (heatmap, insights, theo loại nội dung, so kỳ) | cờ | các endpoint tương ứng | tắt | bật | bật |
| Phân tích | `ANALYTICS_EXPORT` (CSV/PDF) | cờ | `/analytics/export` | tắt | tắt | bật |
| Tối ưu | `STRATEGY_OPTIMIZATION_PER_PERIOD` | số | `StrategyOptimizationServiceImpl` | 0 | 5 | ∞ |
| AI (đã có) | token/tháng, AI kiểm tra chính sách, AI sửa bài | số | giữ nguyên | 1.000 | 100.000 | 1.000.000 |

Tuỳ chọn mở rộng sau (không làm đợt này): bắt buộc duyệt bài nhiều người, email thông báo, số thành viên nhóm.

## 4. Thay đổi kỹ thuật

**Backend**
- Flyway **V18** `plan_feature_limits`: thêm cột vào `plans` (số: `integer CHECK (x >= -1)`, cờ: `boolean`), backfill FREE/PLUS/PRO theo bảng mục 3 (chỉ khi cột còn NULL), gói admin tự tạo để NULL (= mặc định). Kèm rollback `docs/sql/rollback/V18__…_down.sql`.
- `Plan` entity + `PlanCreateRequest/PlanUpdateRequest/PlanResponse/PlanLimitDefaultsResponse` + `PlanMapper`.
- `enums/PlanLimitKey` (danh mục mục 3, kèm loại số/cờ) để FE/BE dùng chung tên khoá.
- `PlanLimitService` mở rộng: `PlanLimits` thêm các trường mới; thêm `assertWithin(user, key)` (đếm usage + ném lỗi) và `assertIncluded(user, key)`; mặc định hệ thống ở `aima.plan-limits.*` trong `application.yml`.
- Đếm usage bằng query trên bảng nguồn (`brand_profiles`, `content_strategies`, `platform_accounts`, `trend_research_sessions` trigger MANUAL, `post_schedules`, `strategy_optimization_jobs`) trong kỳ subscription; khoá dòng subscription khi kiểm + tạo để 2 request song song không vượt.
- `ErrorCode` mới (dải ≥ 2205): `PLAN_LIMIT_REACHED`, `PLAN_FEATURE_NOT_INCLUDED` (HTTP 403), message có `limitKey`.
- `GET /users/me/plan-usage` → danh sách `{key, type, used, limit, included, resetAt}`.
- Admin: `GET /admin/plans` trả `limitDefaults` đầy đủ; PUT gói là full update (null = về mặc định) như V15.

**Frontend**
- `pages/admin/Plans.tsx`: khối "Giới hạn tính năng" theo nhóm, tái dùng ô nhập kiểu `AiLimitDraft` (Mặc định / Không giới hạn / Tắt / Số).
- `api/plans.ts` + `api/planUsage.ts` (hook cache theo phiên, làm mới sau thao tác tạo).
- Gating UI: Thương hiệu (nút tạo hồ sơ/chiến lược), Cài đặt → Kết nối, Xu hướng (Research ngay, lịch tự động, số ý tưởng), Lên lịch (chế độ, giờ vàng, ngày tối đa trên lịch), Phân tích (khoảng ngày, khối nâng cao, Xuất). Khi bị chặn: badge khoá + modal "Nâng cấp" dẫn `/billing`.
- Trang `Gói & thanh toán`: thẻ "Mức sử dụng trong kỳ" (thanh tiến độ mỗi giới hạn số).
- Xử lý lỗi `PLAN_LIMIT_REACHED`/`PLAN_FEATURE_NOT_INCLUDED` tập trung (một helper), i18n vi/en.

**Tài liệu/kiểm thử**: test service cho từng điểm chặn (đủ hạn mức, vượt, `-1`, `0`, `null`, hạ gói giữ dữ liệu, song song), cập nhật `docs/PLAN.md`, `backend/CLAUDE.md` (mục Plan Management), `docs/PAYMENT.md` nếu cần.

## 5. Cần chủ sản phẩm chốt

1. Số mặc định FREE/PLUS/PRO ở mục 3.
2. Hạ gói khi đang vượt hạn mức: giữ dữ liệu + chặn tạo mới (đề xuất) hay khoá bớt (vd chỉ hồ sơ thương hiệu đầu tiên dùng được)?
3. Bảng so sánh landing: giữ nhập tay hay tự sinh từ giới hạn (đề xuất: để sau).
