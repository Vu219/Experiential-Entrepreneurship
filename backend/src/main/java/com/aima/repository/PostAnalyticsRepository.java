package com.aima.repository;

import com.aima.entity.PostAnalytics;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PostAnalyticsRepository extends JpaRepository<PostAnalytics, UUID> {
}
