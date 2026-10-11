"""Policy assistant (mocked LLM — no network): normalized reasons only, hashtag cleanup, check downgrade."""

from __future__ import annotations

import pytest

from src.agents import policy_assistant
from src.schemas import (
    BrandProfileInput,
    PolicyAssessment,
    PolicyCheckRequest,
    PolicyFixRequest,
    PolicyFixSuggestion,
    PolicyIssue,
    RuleHit,
)


class _Usage:
    def response_fields(self) -> dict:
        return {"tokens_used": 1200, "input_tokens": 900, "output_tokens": 300}


@pytest.fixture
def llm(monkeypatch):
    """Replace invoke_structured; ``llm.reply`` is returned, ``llm.vars`` captures the prompt variables."""

    class _Fake:
        reply = None
        vars: dict = {}

        def __call__(self, schema, prompt, variables):
            _Fake.vars = variables
            assert isinstance(self.reply, schema)
            return self.reply, _Usage()

    fake = _Fake()
    monkeypatch.setattr(policy_assistant, "invoke_structured", fake)
    return fake


def _brand() -> BrandProfileInput:
    return BrandProfileInput(brand_name="AIMA Skincare", industry="Beauty", brand_voice="friendly",
                             target_audience="women 20-35", brand_donts=["no medical claims"])


def test_fix_sends_normalized_reason_and_brand(llm):
    llm.reply = PolicyFixSuggestion(caption="Dưỡng ẩm dịu nhẹ cho làn da mùa thu", hashtags=["skincare"],
                                    changes=["Bỏ cam kết 100%"])
    result = policy_assistant.fix_post(PolicyFixRequest(
        brand_profile=_brand(), platform="Facebook", caption="Trị mụn 100% sau 3 ngày!",
        hashtags=["skincare"], error_code="POLICY_VIOLATION",
        rule_hits=[RuleHit(category="HEALTH_CLAIM", severity="HIGH", excerpt="Trị mụn")]))

    assert result.caption == "Dưỡng ẩm dịu nhẹ cho làn da mùa thu"
    assert result.tokens_used == 1200
    assert "Community Standards" in llm.vars["problems"]
    assert "medical or health claims" in llm.vars["problems"]
    assert "AIMA Skincare" in llm.vars["brand"]


def test_fix_cleans_hashtags_and_strips_tags_from_caption(llm):
    llm.reply = PolicyFixSuggestion(caption="Ưu đãi mùa thu #sale #autumn",
                                    hashtags=["#Sale", "sale", " skin care ", ""] + [f"t{i}" for i in range(40)],
                                    changes=["a", "", "b", "c", "d", "e", "f"])
    result = policy_assistant.fix_post(PolicyFixRequest(platform="Instagram", caption="x"))

    assert result.caption == "Ưu đãi mùa thu"
    assert result.hashtags[:2] == ["Sale", "skincare"]
    assert len(result.hashtags) == 30
    assert result.changes == ["a", "b", "c", "d", "e"]


def test_unknown_error_code_gets_generic_reason(llm):
    llm.reply = PolicyFixSuggestion(caption="ok")
    policy_assistant.fix_post(PolicyFixRequest(platform="Threads", caption="x", error_code="SOMETHING_NEW"))
    assert "because of its content" in llm.vars["problems"]
    assert "500 characters" in llm.vars["limits"]


def test_check_returns_issues_and_downgrades_empty_risk(llm):
    llm.reply = PolicyAssessment(risk_level="high", summary="Có cam kết hoàn tiền",
                                 issues=[PolicyIssue(excerpt="hoàn tiền 100%", reason="refund", suggestion="bỏ")])
    result = policy_assistant.check_policy(PolicyCheckRequest(
        platform="Facebook", caption="Cam kết hoàn tiền 100%", hashtags=["sale"],
        rule_hits=[RuleHit(category="REFUND_GUARANTEE", excerpt="hoàn tiền")]))
    assert result.risk_level == "high"
    assert len(result.issues) == 1
    assert "#sale" in llm.vars["content"]
    assert "refunds" in llm.vars["flags"]

    llm.reply = PolicyAssessment(risk_level="medium", summary="?", issues=[])
    assert policy_assistant.check_policy(PolicyCheckRequest(platform="Facebook", caption="x")).risk_level == "low"
