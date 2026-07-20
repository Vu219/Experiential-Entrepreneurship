package com.aima.connection;

import com.aima.dto.request.UpdateVersionRequest;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.ApiVersionResponse;
import com.aima.entity.PlatformApiVersion;
import com.aima.entity.PlatformApiVersionHistory;
import com.aima.entity.User;
import com.aima.enums.Platform;
import com.aima.enums.VersionChangeType;
import com.aima.mapper.PlatformApiVersionMapper;
import com.aima.repository.PlatformApiVersionHistoryRepository;
import com.aima.repository.PlatformApiVersionRepository;
import com.aima.repository.UserRepository;
import com.aima.service.ActivityLogService;
import com.aima.service.Impl.PlatformVersionServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlatformVersionServiceImplTest {

    @Mock PlatformApiVersionRepository versionRepository;
    @Mock PlatformApiVersionHistoryRepository historyRepository;
    @Mock UserRepository userRepository;
    @Mock PlatformApiVersionMapper versionMapper;
    @Mock ActivityLogService activityLogService;

    @InjectMocks PlatformVersionServiceImpl service;

    private PlatformApiVersion fbVersion(String current) {
        return PlatformApiVersion.builder()
                .platform(Platform.FACEBOOK)
                .currentVersion(current)
                .latestVersion(current)
                .build();
    }

    @Test
    void updateVersion_writesHistory_andSetsNewCurrent() {
        PlatformApiVersion entity = fbVersion("v25.0");
        User admin = User.builder().email("admin@gmail.com").build();
        admin.setId(UUID.randomUUID());

        when(versionRepository.findByPlatform(Platform.FACEBOOK)).thenReturn(Optional.of(entity));
        when(userRepository.findByEmail("admin@gmail.com")).thenReturn(Optional.of(admin));
        when(versionRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(versionMapper.toResponse(any())).thenReturn(ApiVersionResponse.builder().build());

        UpdateVersionRequest req = UpdateVersionRequest.builder().newVersion("v26.0").notes("upgrade").build();
        ApiResponse<ApiVersionResponse> response = service.updateVersion(Platform.FACEBOOK, req, "admin@gmail.com");

        assertEquals(200, response.getCode());
        assertEquals("v26.0", entity.getCurrentVersion());

        ArgumentCaptor<PlatformApiVersionHistory> captor = ArgumentCaptor.forClass(PlatformApiVersionHistory.class);
        verify(historyRepository).save(captor.capture());
        assertEquals("v25.0", captor.getValue().getFromVersion());
        assertEquals("v26.0", captor.getValue().getToVersion());
        assertEquals(VersionChangeType.MANUAL_UPDATE, captor.getValue().getChangeType());
    }

    @Test
    void updateVersion_toOlder_isRollback() {
        PlatformApiVersion entity = fbVersion("v25.0");
        User admin = User.builder().email("admin@gmail.com").build();
        admin.setId(UUID.randomUUID());

        when(versionRepository.findByPlatform(Platform.FACEBOOK)).thenReturn(Optional.of(entity));
        when(userRepository.findByEmail(any())).thenReturn(Optional.of(admin));
        when(versionRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(versionMapper.toResponse(any())).thenReturn(ApiVersionResponse.builder().build());

        service.updateVersion(Platform.FACEBOOK,
                UpdateVersionRequest.builder().newVersion("v24.0").build(), "admin@gmail.com");

        ArgumentCaptor<PlatformApiVersionHistory> captor = ArgumentCaptor.forClass(PlatformApiVersionHistory.class);
        verify(historyRepository).save(captor.capture());
        assertEquals(VersionChangeType.ROLLBACK, captor.getValue().getChangeType());
    }

    @Test
    void getCurrentVersion_isCached_afterFirstRead() {
        when(versionRepository.findByPlatform(Platform.THREADS)).thenReturn(Optional.of(
                PlatformApiVersion.builder().platform(Platform.THREADS).currentVersion("v1.0").build()));

        assertEquals("v1.0", service.getCurrentVersion(Platform.THREADS));
        assertEquals("v1.0", service.getCurrentVersion(Platform.THREADS));

        verify(versionRepository, times(1)).findByPlatform(Platform.THREADS);
    }

    @Test
    void getCurrentVersion_evictedAfterUpdate_readsAgain() {
        PlatformApiVersion entity = fbVersion("v25.0");
        User admin = User.builder().email("admin@gmail.com").build();
        admin.setId(UUID.randomUUID());

        when(versionRepository.findByPlatform(Platform.FACEBOOK)).thenReturn(Optional.of(entity));
        when(userRepository.findByEmail(any())).thenReturn(Optional.of(admin));
        when(versionRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(versionMapper.toResponse(any())).thenReturn(ApiVersionResponse.builder().build());

        assertEquals("v25.0", service.getCurrentVersion(Platform.FACEBOOK)); // cache populated
        service.updateVersion(Platform.FACEBOOK,
                UpdateVersionRequest.builder().newVersion("v26.0").build(), "admin@gmail.com"); // evicts
        assertEquals("v26.0", service.getCurrentVersion(Platform.FACEBOOK)); // re-read

        // 1 lần ở getCurrentVersion đầu, 1 lần trong updateVersion, 1 lần sau khi evict
        verify(versionRepository, times(3)).findByPlatform(Platform.FACEBOOK);
    }
}
