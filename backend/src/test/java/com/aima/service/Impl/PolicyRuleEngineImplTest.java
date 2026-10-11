package com.aima.service.Impl;

import com.aima.enums.PolicyRiskLevel;
import com.aima.service.PolicyRuleEngine;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Tầng 1 kiểm tra chính sách: luật từ file cấu hình, tiếng Việt có/không dấu, không báo nhầm câu vô hại. */
class PolicyRuleEngineImplTest {

    static final PolicyRuleEngine ENGINE = new PolicyRuleEngineImpl(new DefaultResourceLoader(), new ObjectMapper(),
            "classpath:policy/policy-check-rules.json");

    private static List<String> categories(String text) {
        return ENGINE.check(text).stream().map(PolicyRuleEngine.Hit::category).toList();
    }

    @Test
    void foldKeepsLengthSoExcerptsComeFromTheOriginalText() {
        String text = "Đặc trị MỤN tận gốc";
        assertEquals(text.length(), PolicyRuleEngineImpl.fold(text).length());
        assertEquals("dac tri mun tan goc", PolicyRuleEngineImpl.fold(text));
        PolicyRuleEngine.Hit hit = ENGINE.check("Kem này " + text + " chỉ sau 3 ngày").getFirst();
        assertEquals("HEALTH_CLAIM", hit.category());
        assertTrue(hit.excerpt().startsWith("Đặc trị"), hit.excerpt());
    }

    @Test
    void flagsTypicalViolations_withAndWithoutDiacritics() {
        assertTrue(categories("Cam kết hoàn tiền nếu không hài lòng").contains("REFUND_GUARANTEE"));
        assertTrue(categories("cam ket hoan tien 100%").contains("REFUND_GUARANTEE"));
        assertTrue(categories("Giảm cân cấp tốc, giảm 10kg trong 1 tuần").contains("HEALTH_CLAIM"));
        assertTrue(categories("SALE OFF 90% toàn bộ cửa hàng").contains("EXAGGERATED_DISCOUNT"));
        assertTrue(categories("Sản phẩm 100% hiệu quả, tốt nhất thị trường").contains("ABSOLUTE_CLAIM"));
        assertTrue(categories("Thu nhập 50 triệu mỗi tháng, việc nhẹ lương cao").contains("FINANCIAL_PROMISE"));
        assertTrue(categories("Like và share để nhận quà").contains("ENGAGEMENT_BAIT"));
        assertTrue(categories("Money-back guarantee on every order").contains("REFUND_GUARANTEE"));
    }

    @Test
    void harmlessContent_hasNoHits() {
        for (String ok : List.of("Chào buổi sáng! Cùng AIMA Skincare khám phá 5 bước dưỡng ẩm mùa thu.",
                "Giảm 10% cho đơn đầu tiên", "Cotton 100% thoáng mát", "Hỗ trợ đổi size trong 7 ngày", "", "   ")) {
            assertTrue(ENGINE.check(ok).isEmpty(), ok + " → " + ENGINE.check(ok));
        }
        assertTrue(ENGINE.check(null).isEmpty());
    }

    @Test
    void maxSeverity_andOneHitPerRule() {
        List<PolicyRuleEngine.Hit> hits = ENGINE.check("Cam kết hoàn tiền, hoàn tiền 100%, like và share để nhận quà");
        assertEquals(1, hits.stream().filter(h -> h.category().equals("REFUND_GUARANTEE")).count());
        assertEquals(PolicyRiskLevel.HIGH, PolicyRuleEngine.maxSeverity(hits));
        assertEquals(PolicyRiskLevel.NONE, PolicyRuleEngine.maxSeverity(List.of()));
    }

    @Test
    void missingRulesFile_disablesTierOneWithoutCrashing() {
        PolicyRuleEngine broken = new PolicyRuleEngineImpl(new DefaultResourceLoader(), new ObjectMapper(),
                "classpath:policy/does-not-exist.json");
        assertTrue(broken.check("Cam kết hoàn tiền").isEmpty());
    }
}
