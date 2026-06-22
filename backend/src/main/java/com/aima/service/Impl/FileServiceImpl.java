package com.aima.service.Impl;

import com.aima.config.storage.StorageBuckets;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FileUploadResponse;
import com.aima.dto.response.SignedUrlResponse;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.repository.UserRepository;
import com.aima.service.FileService;
import com.aima.service.StorageService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class FileServiceImpl implements FileService {

    StorageService storageService;
    UserRepository userRepository;

    @Override
    public ApiResponse<FileUploadResponse> uploadAvatar(String email, MultipartFile file) {
        String userId = currentUserId(email);
        String url = storageService.uploadAvatar(file, userId);

        return ApiResponse.success("Tải ảnh đại diện thành công",
                FileUploadResponse.builder()
                        .bucket(StorageBuckets.AVATARS)
                        .path(pathFromAvatarPublicUrl(url))
                        .url(url)
                        .build());
    }

    @Override
    public ApiResponse<FileUploadResponse> uploadDocument(String email, MultipartFile file) {
        String userId = currentUserId(email);
        String path = storageService.uploadDocument(file, userId);

        return ApiResponse.success("Tải tài liệu thành công",
                FileUploadResponse.builder()
                        .bucket(StorageBuckets.DOCUMENTS)
                        .path(path)
                        .build());
    }

    @Override
    public ApiResponse<SignedUrlResponse> getDocumentSignedUrl(String path, int expiresInSeconds) {
        String signedUrl = storageService.getSignedUrl(path, expiresInSeconds);

        return ApiResponse.success("Tạo đường dẫn truy cập thành công",
                SignedUrlResponse.builder()
                        .signedUrl(signedUrl)
                        .expiresInSeconds(expiresInSeconds)
                        .build());
    }

    private String currentUserId(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED))
                .getId()
                .toString();
    }

    /** Extract the bucket-relative path from an avatar public URL for echoing back in the response. */
    private String pathFromAvatarPublicUrl(String publicUrl) {
        int idx = publicUrl.indexOf(StorageBuckets.AVATAR_PUBLIC_PREFIX);
        return idx >= 0 ? publicUrl.substring(idx + StorageBuckets.AVATAR_PUBLIC_PREFIX.length()) : publicUrl;
    }
}
