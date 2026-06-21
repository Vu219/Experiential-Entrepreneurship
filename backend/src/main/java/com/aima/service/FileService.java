package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FileUploadResponse;
import com.aima.dto.response.SignedUrlResponse;
import org.springframework.web.multipart.MultipartFile;

public interface FileService {
    ApiResponse<FileUploadResponse> uploadAvatar(String email, MultipartFile file);

    ApiResponse<FileUploadResponse> uploadDocument(String email, MultipartFile file);

    ApiResponse<SignedUrlResponse> getDocumentSignedUrl(String path, int expiresInSeconds);
}
