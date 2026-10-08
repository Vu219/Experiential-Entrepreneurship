package com.aima.entity;

import com.aima.enums.Platform;
import com.aima.enums.ResearchStatus;
import com.aima.enums.ResearchTrigger;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Trend-research session for a brand profile. Runs as an async background job (NFR-04).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "trend_research_sessions")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TrendResearchSession extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "brand_profile_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    BrandProfile brandProfile;

    // Chiến lược user chọn khi bắt đầu phiên (FR-19); null = worker tự lấy chiến lược ACTIVE mới nhất.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "content_strategy_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    ContentStrategy contentStrategy;

    // Số ý tưởng content mong muốn (1-20); null = mặc định của worker.
    @Column(name = "article_count")
    Integer articleCount;

    @Column(name = "industry", nullable = false, length = 100)
    String industry;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 20)
    Platform platform;

    @Column(name = "research_time", nullable = false)
    LocalDateTime researchTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    ResearchStatus status = ResearchStatus.PENDING;

    // Tóm tắt phiên do AI trả về (ResearchResponse.summary) — FR-23 lưu phiên nghiên cứu.
    @Column(name = "summary", columnDefinition = "text")
    String summary;

    @Column(name = "error_message", columnDefinition = "text")
    String errorMessage;

    // Phiên do user bấm hay do job 2:00 AM tạo — quyết định hàng đợi + ngưỡng "kẹt".
    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_type", nullable = false, length = 20)
    ResearchTrigger triggerType = ResearchTrigger.MANUAL;

    // true = AI đã tìm kiếm web thật (Claude web search / Google Search grounding) thành công.
    @Column(name = "grounded")
    Boolean grounded;

    @Column(name = "web_searches")
    Integer webSearches;

    // JSON [{name, status, items}] — nguồn dữ liệu đã dùng, FE hiển thị để minh bạch chất lượng.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "data_sources", columnDefinition = "jsonb")
    String dataSources;

    /** IP/User-Agent client lúc user tạo job (X-Forwarded-For aware qua util RequestMeta) —
     *  null với job do hệ thống/scheduler tạo. Nguồn copy sang event usage (điều tra bất thường). */
    @Column(name = "client_ip", length = 45)
    String clientIp;

    @Column(name = "user_agent", length = 300)
    String userAgent;

    // SQLRestriction: trend bị user xóa (soft delete, FE multi-select) không còn xuất hiện
    // trong response phiên lẫn counts của summary — không cần lọc thủ công ở mapper.
    @OneToMany(mappedBy = "researchSession", cascade = CascadeType.ALL, orphanRemoval = true)
    @org.hibernate.annotations.SQLRestriction("deleted_at is null")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    List<Trend> trends = new ArrayList<>();
}
