package com.aima.content;

import com.aima.entity.ContentItem;
import com.aima.entity.ContentVersion;
import com.aima.entity.PostSchedule;
import com.aima.enums.ContentItemStatus;
import com.aima.enums.ContentVersionStatus;
import com.aima.enums.ScheduleStatus;
import com.aima.repository.projection.VersionPublishingState;
import com.aima.service.Impl.ContentItemStatusResolverImpl;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static com.aima.enums.ContentItemStatus.*;
import static org.junit.jupiter.api.Assertions.*;

/** Quy tắc tổng hợp trạng thái bài (plan §2.1) — hàm thuần, mọi tổ hợp 1–2 bản và mọi thứ tự hoàn thành. */
class ContentItemStatusResolverTest {

    static final ScheduleStatus NONE = null;

    static VersionPublishingState v(ContentVersionStatus status, ScheduleStatus schedule) {
        return new VersionPublishingState(status, schedule);
    }

    static VersionPublishingState formatted(ScheduleStatus schedule) {
        return v(ContentVersionStatus.FORMATTED, schedule);
    }

    static ContentItemStatus resolve(VersionPublishingState... versions) {
        return ContentItemStatusResolverImpl.resolve(List.of(versions), false);
    }

    @Test
    void readinessWithoutActiveSchedule() {
        assertEquals(DRAFT, ContentItemStatusResolverImpl.resolve(List.of(), false));
        assertEquals(GENERATED, ContentItemStatusResolverImpl.resolve(List.of(), true), "bài cũ có nội dung trên item");
        assertEquals(DRAFT, resolve(v(ContentVersionStatus.DRAFT, NONE)));
        assertEquals(GENERATED, resolve(v(ContentVersionStatus.GENERATED, NONE), formatted(NONE)));
        assertEquals(FORMATTED, resolve(formatted(NONE), formatted(NONE)));
        assertEquals(FORMATTED, resolve(formatted(ScheduleStatus.CANCELLED), formatted(NONE)), "CANCELLED không phải lịch hiệu lực");
    }

    @Test
    void publishingPriority() {
        assertEquals(POSTING, resolve(formatted(ScheduleStatus.POSTING), formatted(ScheduleStatus.POSTED)));
        assertEquals(POSTING, resolve(formatted(ScheduleStatus.POSTING), formatted(ScheduleStatus.FAILED)));
        assertEquals(POSTED, resolve(formatted(ScheduleStatus.POSTED), formatted(ScheduleStatus.POSTED)));
        assertEquals(PARTIALLY_POSTED, resolve(formatted(ScheduleStatus.POSTED), formatted(ScheduleStatus.FAILED)));
        assertEquals(PARTIALLY_POSTED, resolve(formatted(ScheduleStatus.POSTED), formatted(ScheduleStatus.SCHEDULED)));
        assertEquals(PARTIALLY_POSTED, resolve(formatted(ScheduleStatus.POSTED), formatted(NONE)), "bản chưa từng lên lịch vẫn là chưa đăng");
        assertEquals(FAILED, resolve(formatted(ScheduleStatus.FAILED), formatted(ScheduleStatus.ON_HOLD)));
        assertEquals(ON_HOLD, resolve(formatted(ScheduleStatus.ON_HOLD), formatted(ScheduleStatus.SCHEDULED)));
        assertEquals(SCHEDULED, resolve(formatted(ScheduleStatus.SCHEDULED), v(ContentVersionStatus.GENERATED, NONE)));
    }

    /** Mọi tổ hợp của 2 bản: kết quả không phụ thuộc thứ tự bản; CANCELLED ≡ không có lịch; đúng thứ bậc ưu tiên. */
    @Test
    void everyCombinationOfTwoVersionsIsOrderIndependentAndFollowsPriority() {
        List<VersionPublishingState> states = new ArrayList<>();
        for (ContentVersionStatus production : ContentVersionStatus.values()) {
            states.add(v(production, NONE));
            for (ScheduleStatus schedule : ScheduleStatus.values()) {
                states.add(v(production, schedule));
            }
        }
        int checked = 0;
        for (VersionPublishingState a : states) {
            for (VersionPublishingState b : states) {
                ContentItemStatus ab = resolve(a, b);
                assertEquals(ab, resolve(b, a), a + " + " + b);
                assertEquals(ab, resolve(uncancel(a), uncancel(b)), "CANCELLED phải như không có lịch: " + a + " + " + b);
                List<ScheduleStatus> s = Stream.of(a, b).map(VersionPublishingState::scheduleStatus).toList();
                ContentItemStatus expected;
                if (s.contains(ScheduleStatus.POSTING)) expected = POSTING;
                else if (s.contains(ScheduleStatus.POSTED))
                    expected = s.stream().allMatch(x -> x == ScheduleStatus.POSTED) ? POSTED : PARTIALLY_POSTED;
                else if (s.contains(ScheduleStatus.FAILED)) expected = FAILED;
                else if (s.contains(ScheduleStatus.ON_HOLD)) expected = ON_HOLD;
                else if (s.contains(ScheduleStatus.SCHEDULED)) expected = SCHEDULED;
                else expected = null; // readiness — kiểm ở dưới
                if (expected != null) {
                    assertEquals(expected, ab, a + " + " + b);
                } else {
                    assertTrue(ab.isPrePublishing(), a + " + " + b + " → " + ab);
                }
                checked++;
            }
        }
        assertEquals(states.size() * states.size(), checked);
    }

    /** Hai nền tảng cùng bài xong theo hai thứ tự khác nhau: trạng thái cuối như nhau, trạng thái giữa đúng. */
    @Test
    void completionOrderDoesNotChangeTheFinalStatus() {
        ScheduleStatus[][] outcomes = {
                {ScheduleStatus.POSTED, ScheduleStatus.POSTED},
                {ScheduleStatus.POSTED, ScheduleStatus.FAILED},
                {ScheduleStatus.FAILED, ScheduleStatus.FAILED},
        };
        for (ScheduleStatus[] outcome : outcomes) {
            ScheduleStatus[] fbFirst = {ScheduleStatus.POSTING, ScheduleStatus.POSTING};
            fbFirst[0] = outcome[0];
            ContentItemStatus midFb = resolve(formatted(fbFirst[0]), formatted(fbFirst[1]));
            fbFirst[1] = outcome[1];
            ContentItemStatus endFb = resolve(formatted(fbFirst[0]), formatted(fbFirst[1]));

            ScheduleStatus[] igFirst = {ScheduleStatus.POSTING, ScheduleStatus.POSTING};
            igFirst[1] = outcome[1];
            ContentItemStatus midIg = resolve(formatted(igFirst[0]), formatted(igFirst[1]));
            igFirst[0] = outcome[0];
            ContentItemStatus endIg = resolve(formatted(igFirst[0]), formatted(igFirst[1]));

            assertEquals(POSTING, midFb, "một nền tảng còn đang đăng: " + Arrays.toString(outcome));
            assertEquals(POSTING, midIg, "một nền tảng còn đang đăng: " + Arrays.toString(outcome));
            assertEquals(endFb, endIg, Arrays.toString(outcome));
        }
        assertEquals(PARTIALLY_POSTED, resolve(formatted(ScheduleStatus.POSTED), formatted(ScheduleStatus.FAILED)));
    }

    @Test
    void initializeUsesInMemoryGraphAndIgnoresDeletedVersionsAndCancelledSchedules() {
        ContentItem item = new ContentItem();
        ContentVersion live = version(item, ScheduleStatus.POSTED, false);
        version(item, ScheduleStatus.SCHEDULED, true); // bản đã xóa mềm — không tính
        assertEquals(POSTED, new ContentItemStatusResolverImpl(null, null).initialize(item));
        assertEquals(POSTED, item.getStatus());

        live.getPostSchedule().setStatus(ScheduleStatus.CANCELLED);
        assertEquals(FORMATTED, new ContentItemStatusResolverImpl(null, null).initialize(item));
    }

    /** Test kiến trúc: ContentItem không có setter status; chỉ resolver gọi applyResolvedStatus trong mã ứng dụng. */
    @Test
    void resolverIsTheOnlyWriterOfTheAggregateStatus() throws Exception {
        assertTrue(Arrays.stream(ContentItem.class.getMethods()).noneMatch(m -> m.getName().equals("setStatus")),
                "ContentItem không được có setStatus");
        Path main = Path.of("src/main/java");
        List<String> writers;
        try (Stream<Path> files = Files.walk(main)) {
            writers = files.filter(p -> p.toString().endsWith(".java"))
                    .filter(p -> read(p).contains("applyResolvedStatus("))
                    .map(p -> p.getFileName().toString())
                    .sorted().toList();
        }
        assertEquals(List.of("ContentItem.java", "ContentItemStatusResolverImpl.java"), writers);
    }

    private static ContentVersion version(ContentItem item, ScheduleStatus scheduleStatus, boolean deleted) {
        ContentVersion version = new ContentVersion();
        version.setContentItem(item);
        version.setStatus(ContentVersionStatus.FORMATTED);
        if (deleted) {
            version.setDeletedAt(java.time.LocalDateTime.now());
        }
        PostSchedule schedule = new PostSchedule();
        schedule.setContentVersion(version);
        schedule.setStatus(scheduleStatus);
        version.setPostSchedule(schedule);
        item.getContentVersions().add(version);
        return version;
    }

    private static VersionPublishingState uncancel(VersionPublishingState state) {
        return state.scheduleStatus() == ScheduleStatus.CANCELLED ? v(state.status(), NONE) : state;
    }

    private static String read(Path path) {
        try {
            return Files.readString(path);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
