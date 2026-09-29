"""Fallback chain + error classification (mocked providers — no network, no quota)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import pytest
from google.genai import errors as genai_errors
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from src import errors, llm
from src.schemas import LlmConfig, LlmSpec


class Out(BaseModel):
    text: str


PROMPT = ChatPromptTemplate.from_messages([("user", "{q}")])


def _spec(model: str, provider: str = "google") -> LlmSpec:
    return LlmSpec(provider=provider, model=model, api_key="k-" + model)


def _google_error(code: int, quota_id: str | None = None, retry_delay: str | None = None):
    details = []
    if quota_id:
        details.append({"@type": "type.googleapis.com/google.rpc.QuotaFailure",
                        "violations": [{"quotaId": quota_id, "quotaValue": "20"}]})
    if retry_delay:
        details.append({"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": retry_delay})
    body = {"error": {"code": code, "message": "x", "status": "S", "details": details}}
    cls = genai_errors.ServerError if code >= 500 else genai_errors.ClientError
    return cls(code, body)


GEMINI_DAILY = "GenerateRequestsPerDayPerProjectPerModel-FreeTier"
GEMINI_MINUTE = "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"


@pytest.fixture
def script(monkeypatch):
    """Scripted models: {model: [exc-or-'ok', ...]} consumed per call; records calls + sleeps."""
    calls: list[str] = []
    sleeps: list[float] = []
    plan: dict[str, list] = {}

    def fake_invoke(model_obj, schema, prompt, variables):
        name = model_obj.model.removeprefix("models/")
        calls.append(name)
        step = plan[name].pop(0) if plan.get(name) else "ok"
        if step == "ok":
            return schema(text=name), llm.TokenUsage(total_tokens=1)
        raise step

    monkeypatch.setattr(llm, "_invoke_with", fake_invoke)
    monkeypatch.setattr(llm.time, "sleep", lambda s: sleeps.append(s))
    return plan, calls, sleeps


def _run(chain: list[LlmSpec]):
    llm.use_llm_config(LlmConfig(primary=chain[0], fallback=chain[1] if len(chain) > 1 else None))
    try:
        return llm.invoke_structured(Out, PROMPT, {"q": "hi"})
    finally:
        llm.use_llm_config(None)


# ---------- classify_error ----------

def test_classify_daily_quota_through_langchain_wrapper():
    inner = _google_error(429, GEMINI_DAILY, "27s")
    try:
        try:
            raise inner
        except genai_errors.ClientError as e:
            raise RuntimeError("Error calling model (RESOURCE_EXHAUSTED)") from e
    except RuntimeError as wrapped:
        info = errors.classify_error(wrapped)
    assert info.kind == errors.DAILY_QUOTA_EXHAUSTED
    assert info.free_tier is True
    assert info.retry_after == 27.0


@pytest.mark.parametrize("code,kind", [
    (400, errors.BAD_REQUEST), (401, errors.INVALID_KEY), (403, errors.INVALID_KEY),
    (500, errors.PROVIDER_OVERLOADED), (503, errors.PROVIDER_OVERLOADED), (404, errors.INVALID_RESPONSE),
])
def test_classify_status_codes(code, kind):
    assert errors.classify_error(_google_error(code)).kind == kind


def test_classify_per_minute_and_unknown_quota_is_rate_limited():
    assert errors.classify_error(_google_error(429, GEMINI_MINUTE, "3s")).kind == errors.RATE_LIMITED
    assert errors.classify_error(_google_error(429)).kind == errors.RATE_LIMITED


def test_classify_network():
    import httpx
    assert errors.classify_error(httpx.ReadTimeout("t")).kind == errors.NETWORK_ERROR


def test_next_quota_reset_is_pacific_midnight():
    # 2026-09-29 20:00 UTC = 13:00 PDT → reset 2026-09-30 00:00 PDT = 07:00 UTC
    reset = errors.next_quota_reset(datetime(2026, 9, 29, 20, 0, tzinfo=timezone.utc))
    assert reset == datetime(2026, 9, 30, 7, 0, tzinfo=timezone.utc)


# ---------- chain ----------

def test_503_retries_once_then_falls_back(script):
    plan, calls, sleeps = script
    plan["gemini-3.5-flash"] = [_google_error(503), _google_error(503)]
    out, usage = _run([_spec("gemini-3.5-flash"), _spec("gemini-2.5-flash")])
    assert out.text == "gemini-2.5-flash"
    assert calls == ["gemini-3.5-flash", "gemini-3.5-flash", "gemini-2.5-flash"]
    assert sleeps == [llm.RETRY_BACKOFF_SECONDS]
    first = usage.attempts[0]
    assert first.outcome == errors.PROVIDER_OVERLOADED and first.cooldown_until is not None
    assert usage.attempts[-1].outcome == "ok"


def test_429_per_day_no_retry_and_cooldown_until_reset(script):
    plan, calls, sleeps = script
    plan["gemini-3.5-flash"] = [_google_error(429, GEMINI_DAILY, "27s")]
    _, usage = _run([_spec("gemini-3.5-flash"), _spec("gemini-3.1-flash-lite")])
    assert calls == ["gemini-3.5-flash", "gemini-3.1-flash-lite"]
    assert sleeps == []
    a = usage.attempts[0]
    assert a.outcome == errors.DAILY_QUOTA_EXHAUSTED
    local_reset = a.cooldown_until.astimezone(errors._QUOTA_RESET_TZ)
    assert (local_reset.hour, local_reset.minute) == (0, 0)
    assert a.cooldown_until > datetime.now(timezone.utc)
    assert a.free_tier is True


def test_429_per_minute_long_delay_falls_back_immediately(script):
    plan, calls, sleeps = script
    plan["gemini-3.5-flash"] = [_google_error(429, GEMINI_MINUTE, "30s")]
    _, usage = _run([_spec("gemini-3.5-flash"), _spec("gemini-2.5-flash")])
    assert calls == ["gemini-3.5-flash", "gemini-2.5-flash"]
    assert sleeps == []
    a = usage.attempts[0]
    assert a.outcome == errors.RATE_LIMITED and a.retry_after_seconds == 30.0


def test_429_per_minute_short_delay_waits_and_retries_same_model(script):
    plan, calls, sleeps = script
    plan["gemini-3.5-flash"] = [_google_error(429, GEMINI_MINUTE, "2s")]
    out, _ = _run([_spec("gemini-3.5-flash"), _spec("gemini-2.5-flash")])
    assert out.text == "gemini-3.5-flash"
    assert calls == ["gemini-3.5-flash", "gemini-3.5-flash"]
    assert sleeps == [2.0]


def test_401_skips_same_provider_but_uses_other_provider(script, monkeypatch):
    plan, calls, _ = script
    plan["gemini-3.5-flash"] = [_google_error(401)]
    chain = [_spec("gemini-3.5-flash"), _spec("gemini-2.5-flash"), _spec("claude-sonnet-4-6", "anthropic")]
    monkeypatch.setattr(LlmConfig, "chain", lambda self: chain)
    out, _ = _run(chain[:1])
    assert out.text == "claude-sonnet-4-6"
    assert calls == ["gemini-3.5-flash", "claude-sonnet-4-6"]  # gemini-2.5-flash never tried


def test_401_without_other_provider_fails(script):
    plan, calls, _ = script
    plan["gemini-3.5-flash"] = [_google_error(401)]
    with pytest.raises(llm.LlmChainError) as ei:
        _run([_spec("gemini-3.5-flash"), _spec("gemini-2.5-flash")])
    assert calls == ["gemini-3.5-flash"]
    assert ei.value.error_code == llm.AI_UNAVAILABLE


def test_400_falls_back_once_then_next_model_succeeds(script):
    plan, calls, sleeps = script
    plan["gemini-3.5-flash"] = [_google_error(400)]
    out, usage = _run([_spec("gemini-3.5-flash"), _spec("gemini-2.5-flash")])
    assert out.text == "gemini-2.5-flash"
    assert calls == ["gemini-3.5-flash", "gemini-2.5-flash"]  # no retry of the same model
    assert sleeps == []
    assert usage.attempts[0].outcome == errors.BAD_REQUEST


def test_second_400_stops_with_bad_request(script, monkeypatch):
    plan, calls, _ = script
    plan["a"] = [_google_error(400)]
    plan["b"] = [_google_error(400)]
    chain = [_spec("a"), _spec("b"), _spec("c")]
    monkeypatch.setattr(LlmConfig, "chain", lambda self: chain)
    with pytest.raises(llm.LlmChainError) as ei:
        _run(chain[:1])
    assert calls == ["a", "b"]  # "c" never tried
    assert ei.value.error_code == llm.AI_BAD_REQUEST


def test_400_on_last_model_reports_bad_request(script):
    plan, calls, _ = script
    plan["a"] = [_google_error(400)]
    with pytest.raises(llm.LlmChainError) as ei:
        _run([_spec("a")])
    assert calls == ["a"]
    assert ei.value.error_code == llm.AI_BAD_REQUEST


def test_all_quota_exhausted_error_code(script):
    plan, _, _ = script
    plan["a"] = [_google_error(429, GEMINI_DAILY)]
    plan["b"] = [_google_error(429, GEMINI_MINUTE, "40s")]
    with pytest.raises(llm.LlmChainError) as ei:
        _run([_spec("a"), _spec("b")])
    assert ei.value.error_code == llm.AI_QUOTA_EXHAUSTED


def test_quota_then_overloaded_reports_overloaded(script):
    """The observed incident: 3.5-flash daily 429, 3.1-flash-lite 503 twice."""
    plan, calls, _ = script
    plan["gemini-3.5-flash"] = [_google_error(429, GEMINI_DAILY)]
    plan["gemini-3.1-flash-lite"] = [_google_error(503), _google_error(503)]
    with pytest.raises(llm.LlmChainError) as ei:
        _run([_spec("gemini-3.5-flash"), _spec("gemini-3.1-flash-lite")])
    assert ei.value.error_code == llm.AI_PROVIDER_OVERLOADED
    assert len(calls) == 3


def test_chain_budget_exhausted_raises_timeout(script, monkeypatch):
    plan, _, _ = script
    clock = iter([0.0] + [1000.0] * 50)  # started=0, then every check is past the 80s budget
    monkeypatch.setattr(llm.time, "monotonic", lambda: next(clock))
    with pytest.raises(llm.LlmChainError) as ei:
        _run([_spec("a"), _spec("b")])
    assert ei.value.error_code == llm.AI_TIMEOUT


# ---------- real SDK path: SDK retries off, AFC off ----------

def test_gemini_sdk_makes_exactly_one_http_call_and_afc_disabled(monkeypatch, caplog):
    from google.genai import _api_client

    http_calls = []

    def fake_request_once(self, http_request, stream=False):
        http_calls.append(http_request.url)
        raise _google_error(503)

    monkeypatch.setattr(_api_client.BaseApiClient, "_request_once", fake_request_once)
    model = llm.build_llm(_spec("gemini-3.5-flash"))
    caplog.set_level(logging.INFO)
    with pytest.raises(Exception) as ei:
        model.with_structured_output(Out).invoke("hi")
    assert errors.classify_error(ei.value).kind == errors.PROVIDER_OVERLOADED
    assert len(http_calls) == 1, "google-genai must not retry on its own"
    assert "AFC is enabled" not in caplog.text


# ---------- timeout ordering across tiers ----------

def test_timeout_tiers_are_ordered():
    """per-call < chain budget < backend AI_SERVICE_TIMEOUT_SECONDS < FE poll cap."""
    import re
    from pathlib import Path

    from src.config import Settings

    root = Path(__file__).resolve().parents[2]
    s = Settings(_env_file=None)
    yml = (root / "backend/src/main/resources/application.yml").read_text(encoding="utf-8")
    backend = int(re.search(r"AI_SERVICE_TIMEOUT_SECONDS:(\d+)", yml).group(1))
    fe = (root / "frontend/src/api/contentCreationService.ts").read_text(encoding="utf-8")
    fe_poll = int(re.search(r"GENERATION_POLL_LIMIT_MS = (\d+) \* 60_000", fe).group(1)) * 60

    assert (s.llm_call_timeout_seconds, s.llm_chain_budget_seconds, backend) == (40, 80, 100)
    assert s.llm_call_timeout_seconds < s.llm_chain_budget_seconds < backend < fe_poll


# ---------- multi-model fallback chain (C) ----------

def test_multi_model_chain_walks_fallbacks_in_order(script):
    """primary daily-quota → fb1 503 twice → fb2 answers; fb3 is never called."""
    plan, calls, _ = script
    plan["gemini-3.5-flash"] = [_google_error(429, GEMINI_DAILY)]
    plan["gemini-3.1-flash-lite"] = [_google_error(503), _google_error(503)]
    config = LlmConfig(primary=_spec("gemini-3.5-flash"),
                       fallbacks=[_spec("gemini-3.1-flash-lite"), _spec("gemini-2.5-flash"),
                                  _spec("claude-sonnet-4-6", "anthropic")])
    llm.use_llm_config(config)
    try:
        out, usage = llm.invoke_structured(Out, PROMPT, {"q": "hi"})
    finally:
        llm.use_llm_config(None)
    assert out.text == "gemini-2.5-flash"
    assert calls == ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash"]
    assert [a.model for a in usage.attempts if a.outcome == "ok"] == ["gemini-2.5-flash"]


def test_chain_prefers_fallbacks_over_legacy_fallback_and_dedupes():
    a, b, c = _spec("a"), _spec("b"), _spec("c")
    # new backend sends both: fallback == fallbacks[0]
    assert [s.model for s in LlmConfig(primary=a, fallback=b, fallbacks=[b, c]).chain()] == ["a", "b", "c"]
    # a model listed twice (or equal to primary) is tried once
    assert [s.model for s in LlmConfig(primary=a, fallbacks=[b, a, b, c]).chain()] == ["a", "b", "c"]


def test_legacy_payload_with_single_fallback_still_works():
    """Old backend: {primary, fallback} only — no `fallbacks` key."""
    config = LlmConfig.model_validate({
        "primary": {"provider": "google", "model": "a", "api_key": "k"},
        "fallback": {"provider": "anthropic", "model": "b", "api_key": "k"},
    })
    assert [s.model for s in config.chain()] == ["a", "b"]
    assert [s.model for s in LlmConfig(primary=_spec("a")).chain()] == ["a"]


def test_classify_google_400_api_key_invalid_is_invalid_key():
    body = {"error": {"code": 400, "message": "API key not valid.", "status": "INVALID_ARGUMENT",
                      "details": [{"@type": "type.googleapis.com/google.rpc.ErrorInfo",
                                   "reason": "API_KEY_INVALID", "domain": "googleapis.com"}]}}
    assert errors.classify_error(genai_errors.ClientError(400, body)).kind == errors.INVALID_KEY
    assert errors.classify_error(_google_error(400)).kind == errors.BAD_REQUEST
