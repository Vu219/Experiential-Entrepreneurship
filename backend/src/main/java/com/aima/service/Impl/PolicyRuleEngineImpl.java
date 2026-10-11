package com.aima.service.Impl;

import com.aima.enums.PolicyRiskLevel;
import com.aima.service.PolicyRuleEngine;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Bộ luật nạp MỘT lần lúc khởi động. Nội dung được "gấp" (bỏ dấu tiếng Việt, đ→d, chữ thường) theo từng ký tự
 * nên độ dài không đổi → vị trí khớp trên chuỗi gấp cắt đúng đoạn trích trên chuỗi GỐC (còn dấu) cho người dùng.
 * File lỗi / luật có regex sai → log ERROR và bỏ luật đó (kiểm tra chính sách chỉ là cảnh báo, không được làm sập app).
 */
@Service
@Slf4j
public class PolicyRuleEngineImpl implements PolicyRuleEngine {

    static final int MAX_EXCERPT = 80;

    private record Rule(String id, String category, PolicyRiskLevel severity, List<Pattern> patterns) {
    }

    private final List<Rule> rules;

    public PolicyRuleEngineImpl(ResourceLoader resourceLoader, ObjectMapper objectMapper,
                                @Value("${aima.ai-assist.policy-check.rules-location:classpath:policy/policy-check-rules.json}")
                                String location) {
        this.rules = load(resourceLoader.getResource(location), objectMapper, location);
        log.info("[PolicyRules] Đã nạp {} luật kiểm tra chính sách từ {}", rules.size(), location);
    }

    @Override
    public List<Hit> check(String text) {
        List<Hit> hits = new ArrayList<>();
        if (text == null || text.isBlank()) {
            return hits;
        }
        String folded = fold(text);
        for (Rule rule : rules) {
            for (Pattern pattern : rule.patterns()) {
                Matcher matcher = pattern.matcher(folded);
                if (matcher.find()) {
                    hits.add(new Hit(rule.id(), rule.category(), rule.severity(),
                            excerpt(text, matcher.start(), matcher.end())));
                    break;
                }
            }
        }
        return hits;
    }

    /** Bỏ dấu theo TỪNG ký tự (giữ nguyên độ dài chuỗi), đ/Đ → d, chữ thường. */
    static String fold(String text) {
        StringBuilder out = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == 'đ' || c == 'Đ') {
                out.append('d');
                continue;
            }
            if (c < 128) {
                out.append(Character.toLowerCase(c));
                continue;
            }
            String decomposed = Normalizer.normalize(String.valueOf(c), Normalizer.Form.NFD);
            out.append(Character.toLowerCase(decomposed.charAt(0)));
        }
        return out.toString();
    }

    private static String excerpt(String text, int start, int end) {
        String value = text.substring(start, Math.min(end, text.length())).strip();
        return value.length() > MAX_EXCERPT ? value.substring(0, MAX_EXCERPT) + "…" : value;
    }

    private static List<Rule> load(Resource resource, ObjectMapper objectMapper, String location) {
        List<Rule> loaded = new ArrayList<>();
        try (InputStream in = resource.getInputStream()) {
            JsonNode root = objectMapper.readTree(in);
            for (JsonNode node : root.path("rules")) {
                String id = node.path("id").asText("");
                try {
                    PolicyRiskLevel severity = PolicyRiskLevel.valueOf(
                            node.path("severity").asText("MEDIUM").toUpperCase(Locale.ROOT));
                    List<Pattern> patterns = new ArrayList<>();
                    for (JsonNode p : node.path("patterns")) {
                        patterns.add(Pattern.compile(p.asText(), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE));
                    }
                    if (!id.isBlank() && !patterns.isEmpty()) {
                        loaded.add(new Rule(id, node.path("category").asText(id).toUpperCase(Locale.ROOT), severity,
                                List.copyOf(patterns)));
                    }
                } catch (RuntimeException e) {
                    log.error("[PolicyRules] Bỏ luật '{}' trong {}: {}", id, location, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("[PolicyRules] Không đọc được file luật {} — kiểm tra chính sách tầng 1 tắt", location, e);
        }
        return List.copyOf(loaded);
    }
}
