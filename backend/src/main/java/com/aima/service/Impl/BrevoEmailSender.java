package com.aima.service.Impl;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;

/**
 * Gửi email qua Brevo Transactional Email API (HTTP, cổng 443) thay cho SMTP —
 * Render free tier chặn các cổng SMTP 25/465/587.
 */
@Service
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BrevoEmailSender {


    String senderEmail;
    String senderName;
    RestClient restClient;

    public BrevoEmailSender(
            @Value("${brevo.api-url:https://api.brevo.com/v3/smtp/email}") String apiUrl,
            @Value("${brevo.api-key}") String apiKey,
            @Value("${brevo.sender.email}") String senderEmail,
            @Value("${brevo.sender.name}") String senderName) {
        this.senderEmail = senderEmail;
        this.senderName = senderName;
        this.restClient = RestClient.builder()
                .baseUrl(apiUrl)
                .defaultHeader("api-key", apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("accept", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public void sendHtml(String toEmail, String subject, String htmlContent) {
        sendHtml(toEmail, subject, htmlContent, null);
    }

    /** {@code headers}: header email tuỳ ý Brevo chuyển nguyên (vd List-Unsubscribe); null/rỗng = không gửi. */
    public void sendHtml(String toEmail, String subject, String htmlContent, Map<String, String> headers) {
        try {
            BrevoEmailRequest body = new BrevoEmailRequest(
                    new Sender(senderName, senderEmail),
                    List.of(new Recipient(toEmail)),
                    subject,
                    htmlContent,
                    headers == null || headers.isEmpty() ? null : headers);

            restClient.post()
                    .body(body)
                    .retrieve()          // ném RestClientResponseException khi status non-2xx
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            throw new RuntimeException("Lỗi khi gửi email: " + e.getStatusCode() + " "
                    + e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new RuntimeException("Lỗi khi gửi email: " + e.getMessage());
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private record BrevoEmailRequest(Sender sender, List<Recipient> to, String subject, String htmlContent,
                                     Map<String, String> headers) {
    }

    private record Sender(String name, String email) {
    }

    private record Recipient(String email) {
    }
}
