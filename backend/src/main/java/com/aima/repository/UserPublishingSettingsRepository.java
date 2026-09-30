package com.aima.repository;

import com.aima.entity.UserPublishingSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface UserPublishingSettingsRepository extends JpaRepository<UserPublishingSettings, UUID> {
}
