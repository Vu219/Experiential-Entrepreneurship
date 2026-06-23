package com.aima.service.Impl;

import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;

/**
 * Gửi email qua Brevo Transactional Email API (HTTP, cổng 443) thay cho SMTP —
 * Render free tier chặn các cổng SMTP 25/465/587.
 */
@Service
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BrevoEmailSender {

    static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

    String senderEmail;
    String senderName;
    RestClient restClient;

    public BrevoEmailSender(
            @Value("${brevo.api-key}") String apiKey,
            @Value("${brevo.sender.email}") String senderEmail,
            @Value("${brevo.sender.name}") String senderName) {
        this.senderEmail = senderEmail;
        this.senderName = senderName;
        this.restClient = RestClient.builder()
                .baseUrl(BREVO_API_URL)
                .defaultHeader("api-key", apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("accept", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public void sendHtml(String toEmail, String subject, String htmlContent) {
        try {
            BrevoEmailRequest body = new BrevoEmailRequest(
                    new Sender(senderName, senderEmail),
                    List.of(new Recipient(toEmail)),
                    subject,
                    htmlContent);

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

    private record BrevoEmailRequest(Sender sender, List<Recipient> to, String subject, String htmlContent) {
    }

    private record Sender(String name, String email) {
    }

    private record Recipient(String email) {
    }
}
