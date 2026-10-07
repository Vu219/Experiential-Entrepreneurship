package com.aima.migration;

import org.flywaydb.core.Flyway;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import jakarta.persistence.Entity;
import java.sql.*;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Real PostgreSQL tests. Deliberately no configurable URL or production fallback. */
@EnabledIfSystemProperty(named = "isolated.postgres", matches = "true")
class PublishingMigrationTest {
    static final String URL = "jdbc:postgresql://127.0.0.1:55432/aima_isolated";
    String schema;
    Connection db;

    @BeforeEach void open() throws Exception {
        schema = "phase0_" + UUID.randomUUID().toString().replace("-", "");
        db = DriverManager.getConnection(URL, "aima_isolated", "isolated-only");
        db.createStatement().execute("CREATE SCHEMA " + schema);
        db.createStatement().execute("SET search_path TO " + schema);
    }

    @AfterEach void close() throws Exception {
        if (db != null) {
            if (schema.matches("phase0_[a-f0-9]{32}")) db.createStatement().execute("DROP SCHEMA " + schema + " CASCADE");
            db.close();
        }
    }

    Flyway flyway(String target) {
        var config = Flyway.configure().dataSource(URL, "aima_isolated", "isolated-only")
                .schemas(schema).defaultSchema(schema).baselineOnMigrate(false).cleanDisabled(true);
        if (target != null) config.target(target);
        return config.load();
    }

    @Test void emptyDatabaseMigratesValidatesAndSecondRunDoesNothing() throws Exception {
        assertEquals(10, flyway(null).migrate().migrationsExecuted);
        assertEquals(0, flyway(null).migrate().migrationsExecuted);
        flyway(null).validate();
        assertEquals("timestamp with time zone", scalar("select data_type from information_schema.columns where table_schema='" + schema + "' and table_name='post_schedules' and column_name='scheduled_time'"));
        assertEquals("timestamp without time zone", scalar("select data_type from information_schema.columns where table_schema='" + schema + "' and table_name='payments' and column_name='paid_at'"));
        assertEquals("2", scalar("select count(*) from pg_indexes where schemaname='" + schema + "' and indexname in ('uk_payments_gateway_txn','uk_payments_one_pending_per_user')"));
        validateHibernate();
        verifyEnumChecks();
    }

    @Test void legacyVietnamWallClocksKeepTheirInstantAcrossTimezones() throws Exception {
        flyway("1").migrate();
        // Minimal legacy fixture, deliberately including a soft-deleted row and NULL timestamps.
        String role = UUID.randomUUID().toString(), user = UUID.randomUUID().toString();
        String brand = UUID.randomUUID().toString(), item = UUID.randomUUID().toString();
        String version = UUID.randomUUID().toString(), account = UUID.randomUUID().toString();
        String schedule = UUID.randomUUID().toString(), post = UUID.randomUUID().toString();
        db.createStatement().execute("insert into roles(id,created_at,role_name) values ('"+role+"',now(),'USER')");
        db.createStatement().execute("insert into users(id,created_at,user_name,full_name,email,status,role_id) values ('"+user+"',now(),'fixture','Fixture','fixture@aima.invalid','ACTIVE','"+role+"')");
        db.createStatement().execute("insert into brand_profiles(id,created_at,user_id,brand_name,industry,target_audience,is_active) values ('"+brand+"',now(),'"+user+"','Fixture','test','test',true)");
        db.createStatement().execute("insert into content_items(id,created_at,brand_profile_id,status) values ('"+item+"',now(),'"+brand+"','DRAFT')");
        db.createStatement().execute("insert into content_versions(id,created_at,content_item_id,platform_name,status) values ('"+version+"',now(),'"+item+"','FACEBOOK','FORMATTED')");
        db.createStatement().execute("insert into platform_accounts(id,created_at,user_id,platform_name,connection_status,account_type,token_type,platform_account_id,account_name,access_token) values ('"+account+"',now(),'"+user+"','FACEBOOK','ACTIVE','PAGE','PAGE_TOKEN','fixture','Fixture','fake')");
        db.createStatement().execute("insert into post_schedules(id,created_at,deleted_at,content_version_id,platform_account_id,status,scheduled_time) values ('"+schedule+"',now(),now(),'"+version+"','"+account+"','CANCELLED','2026-09-30 00:30:00')");
        db.createStatement().execute("insert into posts(id,created_at,schedule_id,platform_name,status,published_at) values ('"+post+"',now(),'"+schedule+"','FACEBOOK','POSTED','2026-09-29 23:30:00')");
        db.createStatement().execute("insert into posting_jobs(id,created_at,post_id,status,retry_count,start_time,end_time,next_retry_at) values ('"+UUID.randomUUID()+"',now(),'"+post+"','RETRYING',1,'2026-09-29 23:30:00',null,'2026-09-30 00:30:00')");
        assertEquals(9, flyway(null).migrate().migrationsExecuted);
        for (String zone : new String[]{"UTC", "America/New_York", "Asia/Tokyo"}) {
            db.createStatement().execute("set time zone '"+zone+"'");
            try (var rs = db.createStatement().executeQuery("select scheduled_time from post_schedules")) {
                assertTrue(rs.next());
                assertEquals(Instant.parse("2026-09-29T17:30:00Z"), rs.getTimestamp(1).toInstant());
            }
            assertEquals("2026-09-29", scalar("select to_char(published_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD') from posts"));
        }
        assertEquals("Asia/Ho_Chi_Minh", scalar("select timezone from user_publishing_settings"));
        assertEquals("1", scalar("select count(*) from posting_jobs where end_time is null"));
        assertEquals(0, flyway(null).migrate().migrationsExecuted);
    }

    @Test void wrongLegacyTimezoneFailsWithoutPartiallyConvertingColumns() throws Exception {
        flyway("1").migrate();
        db.createStatement().execute("update system_config set config_value='UTC' where config_key='app.timezone'");
        assertThrows(Exception.class, () -> flyway(null).migrate());
        assertEquals("timestamp without time zone", scalar("select data_type from information_schema.columns where table_schema='"+schema+"' and table_name='post_schedules' and column_name='scheduled_time'"));
    }

    @Test void existingSchemaRequiresExplicitBaseline() throws Exception {
        flyway("1").migrate();
        db.createStatement().execute("drop table flyway_schema_history");
        assertThrows(Exception.class, () -> flyway(null).migrate());
        flyway(null).baseline();
        assertEquals(9, flyway(null).migrate().migrationsExecuted);
        validateHibernate();
    }

    // ===== V3 (Phase 1 D2): tách review_status, trạng thái sản xuất của bản, trạng thái tổng của bài

    @Test void legacyContentStatusesMapToReviewProductionAndAggregateIncludingSoftDeleted() throws Exception {
        flyway("2").migrate();
        String brand = legacyBrand();
        String[][] items = { // legacy status, soft-deleted?, expected status, expected review
                {"DRAFT", "f", "DRAFT", "NONE"}, {"GENERATED", "f", "GENERATED", "NONE"},
                {"NEED_REVIEW", "f", "GENERATED", "NEED_REVIEW"}, {"APPROVED", "t", "GENERATED", "APPROVED"},
                {"FORMATTED", "f", "FORMATTED", "NONE"}, {"SCHEDULED", "f", "SCHEDULED", "NONE"},
                {"POSTING", "f", "POSTING", "NONE"}, {"POSTED", "f", "POSTED", "NONE"}, {"FAILED", "f", "FAILED", "NONE"},
                {"ANALYZING", "f", "POSTED", "NONE"}, {"OPTIMIZED", "t", "POSTED", "NONE"}};
        String[][] versions = { // legacy status → production status
                {"DRAFT", "DRAFT"}, {"GENERATED", "GENERATED"}, {"NEED_REVIEW", "GENERATED"}, {"APPROVED", "GENERATED"},
                {"FORMATTED", "FORMATTED"}, {"SCHEDULED", "FORMATTED"}, {"POSTING", "FORMATTED"}, {"POSTED", "FORMATTED"},
                {"FAILED", "FORMATTED"}, {"ANALYZING", "FORMATTED"}, {"OPTIMIZED", "FORMATTED"}};
        String owner = null;
        for (String[] row : items) {
            String id = UUID.randomUUID().toString();
            owner = owner == null ? id : owner;
            db.createStatement().execute("insert into content_items(id,created_at,deleted_at,brand_profile_id,status) values ('"
                    + id + "',now()," + ("t".equals(row[1]) ? "now()" : "null") + ",'" + brand + "','" + row[0] + "')");
            row[1] = id;
        }
        for (String[] row : versions) {
            String id = UUID.randomUUID().toString();
            db.createStatement().execute("insert into content_versions(id,created_at,content_item_id,platform_name,status) values ('"
                    + id + "',now(),'" + owner + "','FACEBOOK','" + row[0] + "')");
            row[0] = id;
        }
        assertEquals(8, flyway(null).migrate().migrationsExecuted);
        for (String[] row : items) {
            assertEquals(row[2], scalar("select status from content_items where id='" + row[1] + "'"), row[1]);
            assertEquals(row[3], scalar("select review_status from content_items where id='" + row[1] + "'"), row[1]);
        }
        for (String[] row : versions) {
            assertEquals(row[1], scalar("select status from content_versions where id='" + row[0] + "'"));
        }
        String firstItem = owner;
        assertThrows(SQLException.class, () -> db.createStatement().execute(
                "update content_items set status='NEED_REVIEW' where id='" + firstItem + "'"), "CHECK mới chặn giá trị cũ");
        assertThrows(SQLException.class, () -> db.createStatement().execute(
                "update content_versions set status='SCHEDULED'"), "bản chỉ còn trạng thái sản xuất");
        validateHibernate();
        verifyEnumChecks();
    }

    @Test void unmappedLegacyContentStatusStopsMigrationWithoutPartialChanges() throws Exception {
        flyway("2").migrate();
        String brand = legacyBrand();
        // Schema drift giả lập: DB không có CHECK nên chứa giá trị lạ.
        db.createStatement().execute("alter table content_items drop constraint content_items_status_check");
        db.createStatement().execute("insert into content_items(id,created_at,brand_profile_id,status) values ('"
                + UUID.randomUUID() + "',now(),'" + brand + "','ARCHIVED')");
        Exception error = assertThrows(Exception.class, () -> flyway(null).migrate());
        assertTrue(String.valueOf(error.getMessage()).contains("ARCHIVED")
                || String.valueOf(error.getCause()).contains("ARCHIVED"), String.valueOf(error));
        assertEquals("0", scalar("select count(*) from information_schema.columns where table_schema='" + schema
                + "' and table_name='content_items' and column_name='review_status'"));
        assertEquals("1", scalar("select count(*) from content_items where status='ARCHIVED'"), "không xóa dữ liệu để qua migration");
    }

    // ===== V4 (Phase 2): lý do tạm giữ suy từ bằng chứng, Post cũ không có snapshot

    @Test void legacyHeldSchedulesGetEvidencedReasonsAndOldPostsAreUnknownSnapshots() throws Exception {
        flyway("3").migrate();
        String brand = legacyBrand();
        String owner = scalar("select user_id from brand_profiles where id='" + brand + "'");
        String item = UUID.randomUUID().toString();
        db.createStatement().execute("insert into content_items(id,created_at,brand_profile_id,status) values ('"+item+"',now(),'"+brand+"','ON_HOLD')");
        String removed = account(owner, "ACTIVE", true), expired = account(owner, "EXPIRED", false), healthy = account(owner, "ACTIVE", false);
        String sRemoved = heldSchedule(item, removed), sExpired = heldSchedule(item, expired), sUnknown = heldSchedule(item, healthy);
        String post = UUID.randomUUID().toString();
        db.createStatement().execute("insert into posts(id,created_at,schedule_id,platform_name,status) values ('"+post+"',now(),'"+sUnknown+"','FACEBOOK','POSTED')");

        assertEquals(7, flyway(null).migrate().migrationsExecuted);
        assertEquals("ACCOUNT_REMOVED", scalar("select string_agg(reason, ',') from post_schedule_holds where schedule_id='"+sRemoved+"'"));
        assertEquals("ACCOUNT_ISSUE", scalar("select string_agg(reason, ',') from post_schedule_holds where schedule_id='"+sExpired+"'"));
        assertEquals("0", scalar("select count(*) from post_schedule_holds where schedule_id='"+sUnknown+"'"), "không bằng chứng → chưa phân loại");
        assertEquals("UNKNOWN_LEGACY", scalar("select snapshot_state from posts where id='"+post+"'"));
        assertEquals(null, scalar("select snapshot_caption from posts where id='"+post+"'"), "không điền nội dung hiện tại thay cho nội dung lúc đăng");
        assertEquals("0", scalar("select min(revision) from content_versions"));
        assertThrows(SQLException.class, () -> db.createStatement().execute(
                "insert into post_schedule_holds(id,schedule_id,reason,created_at) values (gen_random_uuid(),'"+sRemoved+"','ACCOUNT_REMOVED',now())"),
                "unique theo lịch + lý do");
        validateHibernate();
        verifyEnumChecks();
    }

    // ===== V6 (analytics giai đoạn 0): platform_media backfill từ bài AIMA đã đăng, không đụng dữ liệu cũ

    @Test void platformMediaBackfilledOnlyFromLivePostedPostsWithPlatformId() throws Exception {
        flyway("5").migrate();
        String brand = legacyBrand();
        String owner = scalar("select user_id from brand_profiles where id='" + brand + "'");
        String item = UUID.randomUUID().toString();
        db.createStatement().execute("insert into content_items(id,created_at,brand_profile_id,status,review_status) values ('"+item+"',now(),'"+brand+"','POSTED','NONE')");
        String page = account(owner, "ACTIVE", false);
        String posted = post(item, page, "POSTED", "page_1", false);
        post(item, page, "POSTED", null, false);        // POSTED nhưng chưa có id nền tảng
        post(item, page, "FAILED", "page_2", false);    // đăng lỗi
        post(item, page, "POSTED", "page_3", true);     // đã xoá mềm
        db.createStatement().execute("insert into post_analytics(id,created_at,post_id,views,likes,milestone_hours,collected_at) values (gen_random_uuid(),now(),'"+posted+"',10,2,24,now())");

        assertEquals(5, flyway(null).migrate().migrationsExecuted);
        assertEquals("1", scalar("select count(*) from platform_media"));
        assertEquals(posted + "|" + page + "|FACEBOOK|page_1|AIMA|ACTIVE|ACTIVE|0", scalar(
                "select post_id||'|'||platform_account_id||'|'||platform_name||'|'||platform_media_id||'|'||origin||'|'||platform_status||'|'||sync_status||'|'||consecutive_failures from platform_media"));
        assertEquals("4", scalar("select count(*) from posts"), "không xoá/sửa bài cũ");
        assertEquals("1", scalar("select count(*) from post_analytics"), "không đụng số liệu cũ");
        assertEquals("0", scalar("select count(*) from post_metric_snapshots"), "V7 chỉ tạo bảng — job mới chép số liệu cũ sang");
        assertThrows(SQLException.class, () -> db.createStatement().execute(
                "insert into post_metrics_daily(id,created_at,platform_media_id,metric_date) select gen_random_uuid(),now(),id,date '2026-10-01' from platform_media; "
                + "insert into post_metrics_daily(id,created_at,platform_media_id,metric_date) select gen_random_uuid(),now(),id,date '2026-10-01' from platform_media"),
                "unique theo bài + ngày");
        assertThrows(SQLException.class, () -> db.createStatement().execute(
                "insert into platform_media(id,created_at,platform_account_id,platform_name,platform_media_id,origin,platform_status,sync_status) values (gen_random_uuid(),now(),'"+page+"','FACEBOOK','page_1','AIMA','ACTIVE','ACTIVE')"),
                "unique theo tài khoản + id nền tảng");
        validateHibernate();
        verifyEnumChecks();
    }

    // ===== V8 (analytics giai đoạn 2): chỉ thêm bảng + cột nullable, dòng platform_media cũ giữ nguyên

    @Test void v8AddsAccountTablesAndNullableMediaColumnsWithoutTouchingExistingRows() throws Exception {
        flyway("7").migrate();
        String brand = legacyBrand();
        String owner = scalar("select user_id from brand_profiles where id='" + brand + "'");
        String item = UUID.randomUUID().toString();
        db.createStatement().execute("insert into content_items(id,created_at,brand_profile_id,status,review_status) values ('"+item+"',now(),'"+brand+"','POSTED','NONE')");
        String page = account(owner, "ACTIVE", false);
        post(item, page, "POSTED", "page_1", false);
        db.createStatement().execute("insert into platform_media(id,created_at,platform_account_id,platform_name,platform_media_id,origin,platform_status,sync_status,consecutive_failures) "
                + "values (gen_random_uuid(),now(),'"+page+"','FACEBOOK','page_9','AIMA','ACTIVE','ACTIVE',0)");

        assertEquals(3, flyway(null).migrate().migrationsExecuted);
        assertEquals("1|0", scalar("select count(*)||'|'||count(media_type)+count(permalink)+count(caption_excerpt) from platform_media"),
                "cột mới nullable, dòng cũ giữ nguyên");
        db.createStatement().execute("insert into account_sync_state(id,created_at,platform_account_id,consecutive_failures,instagram_link_status) values (gen_random_uuid(),now(),'"+page+"',0,'NOT_LINKED')");
        assertThrows(SQLException.class, () -> db.createStatement().execute(
                "insert into account_sync_state(id,created_at,platform_account_id,consecutive_failures) values (gen_random_uuid(),now(),'"+page+"',0)"),
                "một trạng thái / kênh");
        assertThrows(SQLException.class, () -> db.createStatement().execute(
                "insert into account_sync_state(id,created_at,platform_account_id,consecutive_failures,instagram_link_status) values (gen_random_uuid(),now(),'"+account(owner, "ACTIVE", false)+"',0,'PERSONAL')"),
                "CHECK instagram_link_status");
        db.createStatement().execute("insert into account_insights_daily(id,created_at,platform_account_id,metric_date,follows,collected_at) values (gen_random_uuid(),now(),'"+page+"',date '2026-10-01',3,now())");
        assertThrows(SQLException.class, () -> db.createStatement().execute(
                "insert into account_insights_daily(id,created_at,platform_account_id,metric_date,collected_at) values (gen_random_uuid(),now(),'"+page+"',date '2026-10-01',now())"),
                "unique theo kênh + ngày");
        validateHibernate();
        verifyEnumChecks();
    }

    // ===== V9 (analytics giai đoạn 3): sự kiện webhook + cột trạng thái webhook của kênh

    @Test void v9AddsWebhookEventsWithDedupeAndStatusCheck() throws Exception {
        flyway("8").migrate();
        assertEquals(2, flyway(null).migrate().migrationsExecuted);
        String insert = "insert into meta_webhook_events(id,created_at,dedupe_key,status,attempts) values (gen_random_uuid(),now(),'k1','%s',0)";
        db.createStatement().execute(insert.formatted("PENDING"));
        assertThrows(SQLException.class, () -> db.createStatement().execute(insert.formatted("PENDING")), "unique dedupe_key");
        assertThrows(SQLException.class, () -> db.createStatement().execute(
                "insert into meta_webhook_events(id,created_at,dedupe_key,status,attempts) values (gen_random_uuid(),now(),'k2','DONE',0)"),
                "CHECK status");
        assertEquals("2", scalar("select count(*) from information_schema.columns where table_schema='" + schema
                + "' and table_name='account_sync_state' and column_name in ('webhook_subscribed_at','webhook_error_code')"));
        validateHibernate();
        verifyEnumChecks();
    }

    // ===== V10: gộp bản ghi theo dõi trùng do ngắt kết nối rồi kết nối lại (chỉ xoá mềm, chạy lại an toàn)

    @Test void v10MergesReconnectDuplicatesIdempotentlyAndOnlySoftDeletes() throws Exception {
        flyway("9").migrate();
        String brand = legacyBrand();
        String owner = scalar("select user_id from brand_profiles where id='" + brand + "'");
        String item = UUID.randomUUID().toString();
        db.createStatement().execute("insert into content_items(id,created_at,brand_profile_id,status,review_status) values ('"+item+"',now(),'"+brand+"','POSTED','NONE')");
        String oldPage = UUID.randomUUID().toString(), newPage = UUID.randomUUID().toString();
        String insertPage = "insert into platform_accounts(id,created_at,deleted_at,user_id,platform_name,connection_status,account_type,token_type,platform_account_id,account_name,access_token) "
                + "values ('%s',now(),%s,'" + owner + "','FACEBOOK','%s','PAGE','PAGE_TOKEN','page-x','Page','fake')";
        db.createStatement().execute(insertPage.formatted(oldPage, "now() - interval '1 hour'", "DISCONNECTED"));
        db.createStatement().execute(insertPage.formatted(newPage, "null", "ACTIVE"));
        String aimaPost = post(item, oldPage, "POSTED", "page-x_1", false);
        String keeper = UUID.randomUUID().toString(), duplicate = UUID.randomUUID().toString(), moved = UUID.randomUUID().toString();
        String insertMedia = "insert into platform_media(id,created_at,platform_account_id,platform_name,platform_media_id,post_id,origin,platform_status,sync_status,consecutive_failures) "
                + "values ('%s',now() - interval '%s',  '%s','FACEBOOK','%s',%s,'%s','ACTIVE','ACTIVE',0)";
        db.createStatement().execute(insertMedia.formatted(keeper, "2 days", oldPage, "page-x_1", "'" + aimaPost + "'", "AIMA"));
        db.createStatement().execute(insertMedia.formatted(duplicate, "1 hour", newPage, "page-x_1", "null", "EXTERNAL"));
        db.createStatement().execute(insertMedia.formatted(moved, "3 days", oldPage, "page-x_2", "null", "EXTERNAL")); // chỉ kẹt ở kết nối cũ
        String insertSnapshot = "insert into post_metric_snapshots(id,created_at,platform_media_id,collected_at,views,source) values (gen_random_uuid(),now(),'%s',now(),%d,'POLL')";
        db.createStatement().execute(insertSnapshot.formatted(keeper, 10));
        db.createStatement().execute(insertSnapshot.formatted(duplicate, 12));
        db.createStatement().execute("insert into post_metrics_daily(id,created_at,platform_media_id,metric_date,views_delta) values (gen_random_uuid(),now(),'"+duplicate+"',current_date,12)");
        db.createStatement().execute("insert into post_analytics(id,created_at,post_id,views,likes,milestone_hours,collected_at) values (gen_random_uuid(),now(),'"+aimaPost+"',10,1,24,now())");
        db.createStatement().execute("insert into account_insights_daily(id,created_at,platform_account_id,metric_date,follows,collected_at) values (gen_random_uuid(),now(),'"+oldPage+"',current_date,3,now())");
        String untouched = "select (select count(*) from posts where deleted_at is null)||'|'||(select string_agg(id::text||status||coalesce(deleted_at::text,''),',' order by id) from posts)"
                + "||'|'||(select string_agg(id::text||views||milestone_hours,',') from post_analytics)||'|'||(select string_agg(platform_account_id::text||follows,',') from account_insights_daily)";
        String before = scalar(untouched);

        assertEquals(1, flyway(null).migrate().migrationsExecuted);

        assertEquals(newPage + "|AIMA|true", scalar("select platform_account_id||'|'||origin||'|'||(deleted_at is null) from platform_media where id='" + keeper + "'"),
                "bài AIMA chuyển sang kết nối đang hoạt động");
        assertEquals("f", scalar("select deleted_at is null from platform_media where id='" + duplicate + "'"), "bản Ngoài AIMA trùng bị xoá MỀM");
        assertEquals("1", scalar("select count(*) from platform_media where id='" + duplicate + "'"), "không xoá cứng");
        assertEquals("2", scalar("select count(*) from post_metric_snapshots where platform_media_id='" + keeper + "'"), "snapshot gộp về bản giữ");
        assertEquals("f", scalar("select deleted_at is null from post_metrics_daily where platform_media_id='" + duplicate + "'"));
        assertEquals("t", scalar("select next_sync_at is not null from platform_media where id='" + keeper + "'"), "đồng bộ lại để tính lại số theo ngày");
        assertEquals(newPage, scalar("select platform_account_id from platform_media where id='" + moved + "'"));
        assertEquals(before, scalar(untouched), "posts / mốc 24-48-168h / số cấp Trang không đổi");

        // Chạy lại nguyên script: không còn gì để làm.
        String state = "select string_agg(id::text||platform_account_id||coalesce(deleted_at::text,'')||coalesce(next_sync_at::text,''),',' order by id) from platform_media";
        String afterFirst = scalar(state);
        String snapshotsFirst = scalar("select string_agg(id::text||platform_media_id,',' order by id) from post_metric_snapshots");
        db.setAutoCommit(false);
        db.createStatement().execute(new String(getClass().getResourceAsStream(
                "/db/migration/V10__merge_reconnect_duplicate_media.sql").readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
        db.commit();
        db.setAutoCommit(true);
        assertEquals(afterFirst, scalar(state), "idempotent");
        assertEquals(snapshotsFirst, scalar("select string_agg(id::text||platform_media_id,',' order by id) from post_metric_snapshots"));
        validateHibernate();
    }

    String post(String item, String account, String status, String platformPostId, boolean deleted) throws SQLException {
        String version = UUID.randomUUID().toString(), schedule = UUID.randomUUID().toString(), post = UUID.randomUUID().toString();
        db.createStatement().execute("insert into content_versions(id,created_at,content_item_id,platform_name,status,revision) values ('"+version+"',now(),'"+item+"','FACEBOOK','FORMATTED',0)");
        db.createStatement().execute("insert into post_schedules(id,created_at,content_version_id,platform_account_id,status,scheduled_time) values ('"+schedule+"',now(),'"+version+"','"+account+"','"+status+"',now())");
        db.createStatement().execute("insert into posts(id,created_at,deleted_at,schedule_id,platform_name,status,platform_post_id,published_at,snapshot_state) values ('"
                +post+"',now(),"+(deleted ? "now()" : "null")+",'"+schedule+"','FACEBOOK','"+status+"',"+(platformPostId == null ? "null" : "'"+platformPostId+"'")+",now(),'UNKNOWN_LEGACY')");
        return post;
    }

    String account(String user, String status, boolean deleted) throws SQLException {
        String id = UUID.randomUUID().toString();
        db.createStatement().execute("insert into platform_accounts(id,created_at,deleted_at,user_id,platform_name,connection_status,account_type,token_type,platform_account_id,account_name,access_token) values ('"
                +id+"',now(),"+(deleted ? "now()" : "null")+",'"+user+"','FACEBOOK','"+status+"','PAGE','PAGE_TOKEN','"+id+"','Fixture','fake')");
        return id;
    }

    String heldSchedule(String item, String account) throws SQLException {
        String version = UUID.randomUUID().toString(), schedule = UUID.randomUUID().toString();
        db.createStatement().execute("insert into content_versions(id,created_at,content_item_id,platform_name,status) values ('"+version+"',now(),'"+item+"','FACEBOOK','FORMATTED')");
        db.createStatement().execute("insert into post_schedules(id,created_at,content_version_id,platform_account_id,status,scheduled_time) values ('"+schedule+"',now(),'"+version+"','"+account+"','ON_HOLD',now())");
        return schedule;
    }

    String legacyBrand() throws SQLException {
        String role = UUID.randomUUID().toString(), user = UUID.randomUUID().toString(), brand = UUID.randomUUID().toString();
        db.createStatement().execute("insert into roles(id,created_at,role_name) values ('"+role+"',now(),'USER')");
        db.createStatement().execute("insert into users(id,created_at,user_name,full_name,email,status,role_id) values ('"+user+"',now(),'v3-"+user+"','Fixture','"+user+"@aima.invalid','ACTIVE','"+role+"')");
        db.createStatement().execute("insert into brand_profiles(id,created_at,user_id,brand_name,industry,target_audience,is_active) values ('"+brand+"',now(),'"+user+"','Fixture','test','test',true)");
        return brand;
    }

    String scalar(String sql) throws SQLException {
        try (var rs = db.createStatement().executeQuery(sql)) { assertTrue(rs.next()); return rs.getString(1); }
    }

    void verifyEnumChecks() throws Exception {
        int checked = 0;
        for (var resource : new PathMatchingResourcePatternResolver().getResources("classpath*:com/aima/entity/*.class")) {
            String filename = resource.getFilename();
            Class<?> type = Class.forName("com.aima.entity."+filename.substring(0,filename.length()-6));
            var table = type.getAnnotation(jakarta.persistence.Table.class);
            if (table == null) continue;
            for (var field : type.getDeclaredFields()) {
                if (!field.isAnnotationPresent(jakarta.persistence.Enumerated.class)) continue;
                if (!field.getType().isEnum()) continue; // ElementCollection has its own join table.
                var column = field.getAnnotation(jakarta.persistence.Column.class);
                if (column == null) continue;
                String name = column.name().isBlank() ? field.getName() : column.name();
                try (var statement = db.prepareStatement("select pg_get_constraintdef(c.oid) from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) where c.contype='c' and c.conrelid=to_regclass(?) and a.attname=?")) {
                    statement.setString(1, table.name()); statement.setString(2, name);
                    try (var rs = statement.executeQuery()) {
                        StringBuilder definitions = new StringBuilder();
                        while(rs.next()) definitions.append(rs.getString(1));
                        for (Object value : field.getType().getEnumConstants()) {
                            assertTrue(definitions.toString().contains("'"+((Enum<?>)value).name()+"'"), table.name()+"."+name+" missing "+value);
                        }
                        assertFalse(definitions.isEmpty(), table.name()+"."+name+" missing CHECK");
                        checked++;
                    }
                }
            }
        }
        assertTrue(checked > 30, "All mapped enum columns must be audited");
    }

    void validateHibernate() throws Exception {
        var registry = new StandardServiceRegistryBuilder()
                .applySetting("hibernate.connection.url", URL + "?currentSchema=" + schema)
                .applySetting("hibernate.connection.username", "aima_isolated")
                .applySetting("hibernate.connection.password", "isolated-only")
                .applySetting("hibernate.hbm2ddl.auto", "validate")
                .applySetting("hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.PhysicalNamingStrategySnakeCaseImpl")
                .build();
        try {
            var sources = new MetadataSources(registry);
            for (var r : new PathMatchingResourcePatternResolver().getResources("classpath*:com/aima/entity/*.class")) {
                String name = r.getFilename();
                Class<?> type = Class.forName("com.aima.entity."+name.substring(0,name.length()-6));
                if (type.isAnnotationPresent(Entity.class)) sources.addAnnotatedClass(type);
            }
            try(var ignored = sources.buildMetadata().buildSessionFactory()) { }
        } finally { StandardServiceRegistryBuilder.destroy(registry); }
    }
}
