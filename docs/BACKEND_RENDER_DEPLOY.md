# Backend trên Render (gói Free 512MB) — bộ nhớ & cấu hình JVM

> Đo ngày 2026-10-15 trên container mô phỏng (`--memory=512m --cpus=0.25`, image `eclipse-temurin:21-jre-alpine` như
> `backend/Dockerfile`, profile `production`, scheduling bật, PG/Redis local, DB trống đã migrate V17). Render Free chỉ có
> **0.1 CPU** → thời gian khởi động thật dài hơn ~2,5 lần các số dưới đây; bộ nhớ thì tương đương.

## 1. Sự cố 15/10: OOM khi khởi động (commit 04f0e74)

- Triệu chứng: heap ~128MB → `OutOfMemoryError: Java heap space` lúc tạo bean `postRepository` (stack đầy
  `ParserATNSimulator.closure_`); heap ~330MB → im lặng vài phút sau log `QueryEnhancerFactories…` rồi Render giết container
  "Out of memory (used over 512Mi)".
- Nguyên nhân: JPQL "Bài lỗi" (`PostRepository.findFailedForUser` / `countFailedForUserByState`, hằng `USER_FAILED_WHERE`) lồng
  `exists`/`not exists` 4 lần trong một mệnh đề OR nhiều tầng ngoặc. Parser ANTLR của Spring Data (`HqlParser`, chạy khi tạo
  repository) và của Hibernate (validate query) rơi vào dự đoán LL đầy đủ → **~1,7GB + ~0,6GB cấp phát cho MỖI câu** (3 câu),
  ~5 giây CPU mỗi câu trên máy dev — trên 0.1–0.25 CPU là vài phút GC liên tục.
- Sửa: các câu đó (và `findFailedForAdmin`, ~200MB/câu) chuyển sang **native SQL** giữ nguyên ngữ nghĩa (`PostRepository.LAST_FAILED_JOB`);
  `FailedPostQueryPgTest` so kết quả với JPQL cũ cho mọi tổ hợp mode × state.
- **Quy tắc:** đừng viết JPQL/HQL có nhiều `exists`/`not exists` lồng nhau trong các nhánh `or` có ngoặc — dùng native SQL hoặc
  Specification. Câu `@Query` JPQL nặng nhất còn lại hiện cấp phát ≤ 73MB khi parse.

## 2. Cấu hình JVM khuyến nghị (biến môi trường Render)

```
JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=35 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:ReservedCodeCacheSize=48m -XX:MaxMetaspaceSize=200m -Xss512k -XX:+ExitOnOutOfMemoryError
```

Giá trị này cũng là mặc định trong `backend/Dockerfile`; biến trên Render (nếu đặt) sẽ ghi đè.

| Cờ | Lý do |
|---|---|
| `MaxRAMPercentage=35` | heap tối đa ~179MB. Sau khởi động dữ liệu sống ~90–100MB; 65% (~333MB) để heap phình tới ~210MB rồi cộng phần ngoài heap là vượt 512MB. 30% làm old gen đầy 99% ngay sau khởi động — quá sát. |
| `UseSerialGC` | 1 CPU, ít overhead bộ nhớ nhất. |
| `TieredStopAtLevel=1` | chỉ JIT C1: khởi động 229s → ~140s (0.25 CPU), code cache 40MB → 21MB. Đổi lại throughput đỉnh thấp hơn C2 — chấp nhận được ở tải hiện tại. |
| `ReservedCodeCacheSize=48m` | trần code cache (dùng ~21MB với C1). |
| `MaxMetaspaceSize=200m` | trần an toàn (đang dùng ~127MB); vượt thì lỗi rõ ràng thay vì bị giết vì RSS. |
| `Xss512k` | stack luồng nhỏ hơn mặc định 1MB. |
| `ExitOnOutOfMemoryError` | chết hẳn để Render khởi động lại, không chạy tiếp ở trạng thái hỏng. |

## 3. Số đo (512MB, 0.25 CPU)

| Bản | JAVA_TOOL_OPTIONS | Kết quả | Khởi động | RSS sau khởi động (VmRSS) | cgroup (`docker stats`) |
|---|---|---|---|---|---|
| 04f0e74 (lỗi) | 65% + SerialGC (cũ) | **OOMKilled** ở 205s | — | — | 472MiB rồi bị giết |
| 04f0e74 (lỗi) | khuyến nghị | **`OutOfMemoryError: Java heap space`** ở 220s (đang ở `HqlParser.whereClause`) | — | — | — |
| đã sửa | 65% + SerialGC (cũ) | chạy | 229s | 495MB (đỉnh 501MB) | 465MiB |
| đã sửa | **khuyến nghị** | chạy | 136–161s | **428–440MB** | **400–414MiB** |

Phân bổ bộ nhớ (NMT, bản đã sửa + cấu hình khuyến nghị): heap 180MB · metaspace + class space ~132MB · symbol ~50MB ·
code cache ~21MB · CDS ~13MB · threads/GC/khác ~15MB; ~45MB ngoài NMT (malloc của musl, map file).

**Mục tiêu < 400MB RSS chưa đạt chỉ bằng cờ JVM:** ~230MB ngoài heap là chi phí cố định của số class nạp (Spring Boot 4,
Hibernate 7, WebFlux/Netty, springdoc, Lettuce…). Còn dư ~70MB so với 512MB. Nếu cần hạ thêm:
- bỏ dependency không dùng (`spring-boot-starter-mail` đã vestigial, `jjwt` — ký JWT bằng Nimbus), cân nhắc thay WebFlux
  (`WebClient`) bằng `RestClient`;
- giới hạn luồng Tomcat (`SERVER_TOMCAT_THREADS_MAX`, mặc định 200) cho gói Free;
- CDS/AOT cache của Spring Boot (giảm thời gian khởi động trên CPU yếu, cần đổi Dockerfile sang jar đã extract).

## 4. Tự đo lại

Chạy jar trong container giới hạn như Render, DB/Redis LOCAL (đừng trỏ Supabase/Upstash thật), lấy thread dump bằng
`docker kill --signal=QUIT <container>` (image JRE không có `jcmd`; dùng `eclipse-temurin:21-jdk-alpine` +
`-XX:NativeMemoryTracking=summary` rồi `jcmd 1 VM.native_memory summary` khi cần phân bổ chi tiết).
