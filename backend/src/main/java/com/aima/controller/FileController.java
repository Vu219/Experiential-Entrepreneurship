package com.aima.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.FileUploadResponse;
import com.aima.dto.response.SignedUrlResponse;
import com.aima.service.FileService;

@RestController
@RequestMapping("/files")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Files", description = "Upload avatars/PDFs to Supabase Storage and generate signed URLs.")
public class FileController {

    FileService fileService;

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Upload the current user's avatar",
            description = "Uploads an image (jpg/png/webp, max 2 MB) to the public 'avatars' bucket and " +
                    "returns its public URL. The file is stored at {userId}/{uuid}_{filename}."
    )
    public ApiResponse<FileUploadResponse> uploadAvatar(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "Image file (jpg/png/webp, ≤ 2 MB)") @RequestParam("file") MultipartFile file) {
        return fileService.uploadAvatar(userDetails.getUsername(), file);
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Upload a private PDF document",
            description = "Uploads a PDF (max 10 MB) to the private 'documents' bucket and returns the storage " +
                    "path to persist in the DB. The file is NOT publicly accessible — use GET /files/documents/signed-url " +
                    "to obtain a temporary link."
    )
    public ApiResponse<FileUploadResponse> uploadDocument(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "PDF file (≤ 10 MB)") @RequestParam("file") MultipartFile file) {
        return fileService.uploadDocument(userDetails.getUsername(), file);
    }

    @GetMapping("/documents/signed-url")
    @Operation(
            summary = "Get a signed URL for a private PDF",
            description = "Generates a time-limited signed URL to view/download a private document stored in the " +
                    "'documents' bucket. Provide the storage path returned by the upload endpoint."
    )
    public ApiResponse<SignedUrlResponse> getDocumentSignedUrl(
            @Parameter(description = "Storage path inside the documents bucket ({userId}/{uuid}_{filename}).")
            @RequestParam("path") String path,
            @Parameter(description = "URL lifetime in seconds (default 3600).")
            @RequestParam(value = "expiresIn", defaultValue = "3600") int expiresIn) {
        return fileService.getDocumentSignedUrl(path, expiresIn);
    }
}
