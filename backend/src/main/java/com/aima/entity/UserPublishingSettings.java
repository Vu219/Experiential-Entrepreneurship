package com.aima.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "user_publishing_settings")
@Getter
@Setter
@NoArgsConstructor
public class UserPublishingSettings {
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 100)
    private String timezone = "Asia/Ho_Chi_Minh";

    @Column(name = "require_approval", nullable = false)
    private boolean requireApproval;

    @Column(name = "conflict_window_minutes", nullable = false)
    private int conflictWindowMinutes = 60;

    @Column(name = "brand_voice_blocking_enabled", nullable = false)
    private boolean brandVoiceBlockingEnabled;

    @Column(name = "brand_voice_threshold")
    private Integer brandVoiceThreshold;
}
