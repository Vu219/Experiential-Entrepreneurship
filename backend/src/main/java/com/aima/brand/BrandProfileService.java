package com.aima.brand;

import com.aima.brand.dto.BrandProfileRequest;
import com.aima.brand.dto.BrandProfileResponse;
import com.aima.common.AppException;
import com.aima.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BrandProfileService {

    private final BrandProfileRepository repository;

    // FR-05: create a brand profile owned by the current user
    @Transactional
    public BrandProfileResponse create(User user, BrandProfileRequest request) {
        BrandProfile profile = new BrandProfile();
        profile.setUser(user);
        apply(profile, request);
        return BrandProfileResponse.from(repository.save(profile));
    }

    // FR-07: list the current user's brand profiles
    @Transactional(readOnly = true)
    public List<BrandProfileResponse> list(UUID userId) {
        return repository.findByUser_IdAndDeletedAtIsNull(userId).stream()
                .map(BrandProfileResponse::from)
                .toList();
    }

    // FR-07: view a single brand profile
    @Transactional(readOnly = true)
    public BrandProfileResponse get(UUID userId, UUID id) {
        return BrandProfileResponse.from(find(userId, id));
    }

    // FR-06: update a brand profile
    @Transactional
    public BrandProfileResponse update(UUID userId, UUID id, BrandProfileRequest request) {
        BrandProfile profile = find(userId, id);
        apply(profile, request);
        return BrandProfileResponse.from(repository.save(profile));
    }

    // FR-08: soft delete a brand profile
    @Transactional
    public void delete(UUID userId, UUID id) {
        BrandProfile profile = find(userId, id);
        profile.setDeletedAt(Instant.now());
        repository.save(profile);
    }

    private BrandProfile find(UUID userId, UUID id) {
        return repository.findByIdAndUser_IdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Brand profile not found"));
    }

    private void apply(BrandProfile profile, BrandProfileRequest request) {
        profile.setBrandName(request.brandName().trim());
        profile.setIndustry(request.industry().trim());
        profile.setDescription(request.description());
        profile.setBrandVoice(request.brandVoice());
        profile.setTargetAudience(request.targetAudience().trim());
        profile.setContentGoal(request.contentGoal());
        profile.setPlatforms(new HashSet<>(request.platforms()));
        profile.setPostingFrequency(request.postingFrequency());
        profile.setPreferredTimes(request.preferredTimes() == null
                ? new ArrayList<>()
                : new ArrayList<>(request.preferredTimes()));
    }
}
