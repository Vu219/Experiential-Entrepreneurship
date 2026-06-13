package com.aima.brand;

import com.aima.common.BaseEntity;
import com.aima.user.User;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "brand_profiles")
public class BrandProfile extends BaseEntity {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "brand_name", nullable = false, length = 150)
    private String brandName;

    @Column(nullable = false, length = 100)
    private String industry;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "brand_voice", length = 255)
    private String brandVoice;

    @Column(name = "target_audience", nullable = false, length = 500)
    private String targetAudience;

    @Column(name = "content_goal", columnDefinition = "text")
    private String contentGoal;

    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    @CollectionTable(name = "brand_profile_platforms", joinColumns = @JoinColumn(name = "brand_profile_id"))
    @Column(name = "platform", length = 20)
    private Set<Platform> platforms = new HashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "posting_frequency", nullable = false, length = 20)
    private PostingFrequency postingFrequency;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "brand_profile_time_slots", joinColumns = @JoinColumn(name = "brand_profile_id"))
    @Column(name = "time_slot", length = 30)
    private List<String> preferredTimes = new ArrayList<>();
}
