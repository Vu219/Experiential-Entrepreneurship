package com.aima.service.Impl;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import com.aima.config.storage.StorageBuckets;
import com.aima.config.storage.SupabaseProperties;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.service.SupabaseStorageService;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SupabaseStorageServiceImpl implements SupabaseStorageService {

    WebClient supabaseWebClient;
    SupabaseProperties supabaseProperties;

    static final String BUCKET_AVATARS = StorageBuckets.AVATARS;     // public
    static final String BUCKET_DOCUMENTS = StorageBuckets.DOCUMENTS; // private

    static final long MAX_AVATAR_SIZE = 2L * 1024 * 1024;   // 2 MB
    static final long MAX_DOCUMENT_SIZE = 10L * 1024 * 1024; // 10 MB
    static final Set<String> ALLOWED_IMAGE_TYPES =
            Set.of(MediaType.IMAGE_JPEG_VALUE, MediaType.IMAGE_PNG_VALUE, "image/webp");
    static final String PDF_TYPE = MediaType.APPLICATION_PDF_VALUE;

    @Override
    public String uploadAvatar(MultipartFile file, String userId) {
        validate(file, ALLOWED_IMAGE_TYPES, MAX_AVATAR_SIZE);
        String path = buildObjectPath(userId, file.getOriginalFilename());
        upload(BUCKET_AVATARS, path, file);
        // avatars bucket is public → return the public URL
        return buildPublicUrl(BUCKET_AVATARS, path);
    }

    @Override
    public String uploadDocument(MultipartFile file, String userId) {
        validate(file, Set.of(PDF_TYPE), MAX_DOCUMENT_SIZE);
        String path = buildObjectPath(userId, file.getOriginalFilename());
        upload(BUCKET_DOCUMENTS, path, file);
        // documents bucket is private → persist the path; access goes through a signed URL
        return path;
    }

    @Override
    public String uploadAvatarFromUrl(String imageUrl, String userId) {
        if (!StringUtils.hasText(imageUrl)) {
            throw new AppException(ErrorCode.FILE_REQUIRED);
        }

        HttpResponse<byte[]> response;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(imageUrl))
                    .GET()
                    .build();
            response = HttpClient.newHttpClient()
                    .send(request, HttpResponse.BodyHandlers.ofByteArray());
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.error("Không tải được ảnh từ URL '{}'", imageUrl, e);
            throw new AppException(ErrorCode.FILE_READ_FAILED);
        }

        if (response.statusCode() >= 300 || response.body() == null || response.body().length == 0) {
            log.error("Tải ảnh từ URL '{}' trả về status {}", imageUrl, response.statusCode());
            throw new AppException(ErrorCode.FILE_READ_FAILED);
        }

        String contentType = response.headers().firstValue("content-type")
                .map(String::toLowerCase)
                .filter(ALLOWED_IMAGE_TYPES::contains)
                .orElse(MediaType.IMAGE_JPEG_VALUE); // Google avatar mặc định là JPEG

        if (response.body().length > MAX_AVATAR_SIZE) {
            throw new AppException(ErrorCode.FILE_TOO_LARGE);
        }

        String extension = contentType.substring(contentType.lastIndexOf('/') + 1);
        String path = buildObjectPath(userId, "google_avatar." + extension);
        uploadBytes(BUCKET_AVATARS, path, response.body(), contentType);
        return buildPublicUrl(BUCKET_AVATARS, path);
    }

    @Override
    public String getSignedUrl(String path, int expiresInSeconds) {
        if (!StringUtils.hasText(path)) {
            throw new AppException(ErrorCode.FILE_PATH_REQUIRED);
        }
        try {
            SignedUrlResult result = supabaseWebClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .pathSegment("object", "sign", BUCKET_DOCUMENTS)
                            .pathSegment(path.split("/"))
                            .build())
                    .bodyValue(Map.of("expiresIn", expiresInSeconds))
                    .retrieve()
                    .bodyToMono(SignedUrlResult.class)
                    .block();

            if (result == null || !StringUtils.hasText(result.signedUrl())) {
                throw new AppException(ErrorCode.SIGNED_URL_FAILED);
            }
            // signedUrl is relative (e.g. "/object/sign/...") → prefix with the Storage base URL
            return supabaseProperties.url() + "/storage/v1" + result.signedUrl();
        } catch (WebClientResponseException e) {
            log.error("Supabase signed-url failed for path '{}': {} {}", path, e.getStatusCode(),
                    e.getResponseBodyAsString());
            throw new AppException(ErrorCode.SIGNED_URL_FAILED);
        }
    }

    @Override
    public void deleteFile(String bucket, String path) {
        if (!StringUtils.hasText(bucket) || !StringUtils.hasText(path)) {
            throw new AppException(ErrorCode.FILE_PATH_REQUIRED);
        }
        try {
            supabaseWebClient.delete()
                    .uri(uriBuilder -> uriBuilder
                            .pathSegment("object", bucket)
                            .pathSegment(path.split("/"))
                            .build())
                    .retrieve()
                    .toBodilessEntity()
                    .block();
        } catch (WebClientResponseException e) {
            log.error("Supabase delete failed for {}/{}: {} {}", bucket, path, e.getStatusCode(),
                    e.getResponseBodyAsString());
            throw new AppException(ErrorCode.FILE_DELETE_FAILED);
        }
    }

    // ─── Internals ──────────────────────────────────────

    /** Read a MultipartFile and delegate to {@link #uploadBytes}. */
    private void upload(String bucket, String path, MultipartFile file) {
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            log.error("Failed to read uploaded file '{}'", file.getOriginalFilename(), e);
            throw new AppException(ErrorCode.FILE_READ_FAILED);
        }

        String contentType = StringUtils.hasText(file.getContentType())
                ? file.getContentType()
                : MediaType.APPLICATION_OCTET_STREAM_VALUE;

        uploadBytes(bucket, path, bytes, contentType);
    }

    /** Upload raw bytes to {bucket}/{path}; x-upsert overwrites an existing object at the same path. */
    private void uploadBytes(String bucket, String path, byte[] bytes, String contentType) {
        try {
            supabaseWebClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .pathSegment("object", bucket)
                            .pathSegment(path.split("/"))
                            .build())
                    .header("x-upsert", "true")
                    .contentType(MediaType.parseMediaType(contentType))
                    .bodyValue(bytes)
                    .retrieve()
                    .toBodilessEntity()
                    .block();
            log.info("Uploaded file to Supabase bucket '{}' at path '{}'", bucket, path);
        } catch (WebClientResponseException e) {
            log.error("Supabase upload failed for {}/{}: {} {}", bucket, path, e.getStatusCode(),
                    e.getResponseBodyAsString());
            throw new AppException(ErrorCode.FILE_UPLOAD_FAILED);
        }
    }

    /** Validate presence, content type and size before hitting the network. */
    private void validate(MultipartFile file, Set<String> allowedTypes, long maxSize) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.FILE_REQUIRED);
        }
        if (file.getContentType() == null || !allowedTypes.contains(file.getContentType().toLowerCase())) {
            throw new AppException(ErrorCode.INVALID_FILE_TYPE);
        }
        if (file.getSize() > maxSize) {
            throw new AppException(ErrorCode.FILE_TOO_LARGE);
        }
    }

    /** Build {userId}/{uuid}_{sanitizedOriginalName} to avoid collisions and path-traversal. */
    private String buildObjectPath(String userId, String originalFilename) {
        String cleaned = StringUtils.cleanPath(StringUtils.hasText(originalFilename) ? originalFilename : "file");
        // keep only the basename and strip characters Supabase paths dislike
        cleaned = cleaned.substring(cleaned.lastIndexOf('/') + 1).replaceAll("[^a-zA-Z0-9._-]", "_");
        return userId + "/" + UUID.randomUUID() + "_" + cleaned;
    }

    private String buildPublicUrl(String bucket, String path) {
        return supabaseProperties.url() + "/storage/v1/object/public/" + bucket + "/" + path;
    }

    /** Maps the {@code {"signedURL": "..."}} body returned by the sign endpoint. */
    private record SignedUrlResult(@JsonProperty("signedURL") String signedUrl) {
    }
}
