"""/generate/stream — streamed structured output with a FAKE streaming LLM (no network, no quota).

Covers: deltas from partial JSON, silent fallback before the first delta, ``reset`` after it, validation of the
final result with the same schema, client disconnect closing the provider stream, NDJSON route framing."""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient
from langchain_core.prompts import ChatPromptTemplate

from src import llm
from src.agents import content_generator
from src.schemas import ContentItem, LlmConfig, LlmSpec

ITEM = {
    "script": {
        "hook": {"content": "Bạn có biết?", "scene_suggestion": "Cận mặt", "timing": "0-3s"},
        "steps": [{"index": 1, "content": "Bước một", "scene_suggestion": "Toàn cảnh"},
                  {"index": 2, "content": "Bước hai", "scene_suggestion": "B-roll"}],
        "cta": {"content": "Theo dõi ngay", "scene_suggestion": "Logo", "timing": "25-30s"},
    },
    "caption": "Da khô mùa lạnh? Đây là bí quyết.",
    "hashtags": ["#skincare", "#damua"],
    "cta": "Mua ngay",
    "media_prompt": "Video ánh sáng tự nhiên",
    "image_prompt": "",
    "brand_voice_check": {"aligned": True, "score": 88, "notes": "Đúng giọng"},
}
RAW = json.dumps(ITEM, ensure_ascii=False)
PROMPT = ChatPromptTemplate.from_messages([("user", "{q}")])


def _pieces(raw: str, size: int = 7) -> list[str]:
    return [raw[i:i + size] for i in range(0, len(raw), size)]


def _spec(model: str) -> LlmSpec:
    return LlmSpec(provider="google", model=model, api_key="k-" + model)


@pytest.fixture
def fake_stream(monkeypatch):
    """plan[model] = list of ("ok") / ("fail_before", exc) / ("fail_after", exc, n_pieces); records closes."""
    plan: dict[str, list] = {}
    closed: list[str] = []

    async def fake(spec, timeout, schema, messages):
        step = plan.get(spec.model, ["ok"]).pop(0) if plan.get(spec.model) else "ok"
        try:
            if isinstance(step, tuple) and step[0] == "fail_before":
                raise step[1]
            yield "", {"input_tokens": 120}
            pieces = _pieces(RAW)
            limit = step[2] if isinstance(step, tuple) else len(pieces)
            for p in pieces[:limit]:
                yield p, {}
            if isinstance(step, tuple):
                raise step[1]
            yield "", {"input_tokens": 120, "output_tokens": 300, "total_tokens": 420}
        finally:
            closed.append(spec.model)

    monkeypatch.setattr(llm, "_stream_chunks", fake)
    real_sleep = asyncio.sleep
    monkeypatch.setattr(llm.asyncio, "sleep", lambda s: real_sleep(0))
    return plan, closed


def _collect(chain: list[LlmSpec]) -> list[dict]:
    async def run():
        llm.use_llm_config(LlmConfig(primary=chain[0], fallbacks=chain[1:]))
        try:
            return [e async for e in llm.astream_structured(ContentItem, PROMPT, {"q": "x"})]
        finally:
            llm.use_llm_config(None)
    return asyncio.run(run())


def _rebuild(events: list[dict]) -> dict[str, str]:
    """What a client preview shows after applying start/delta/reset events in order."""
    shown: dict[str, str] = {}
    for e in events:
        if e["type"] == "reset":
            shown = {}
        elif e["type"] == "delta":
            shown[e["path"]] = e["append"] if e.get("replace") else shown.get(e["path"], "") + e["append"]
    return shown


def test_deltas_rebuild_every_string_field_and_result_is_validated(fake_stream):
    events = _collect([_spec("m1")])
    assert events[0] == {"type": "start", "provider": "google", "model": "m1", "input_tokens": 120}
    shown = _rebuild(events)
    assert shown["caption"] == ITEM["caption"]
    assert shown["script.steps[1].content"] == "Bước hai"
    assert shown["hashtags[0]"] == "#skincare"
    result = events[-1]
    assert result["type"] == "result"
    assert result["parsed"] == ContentItem.model_validate(ITEM)
    assert (result["usage"].input_tokens, result["usage"].output_tokens, result["usage"].total_tokens) == (120, 300, 420)
    assert [a.outcome for a in result["usage"].attempts] == ["ok"]
    assert sum(1 for e in events if e["type"] == "delta") > 10, "streamed in many small deltas"


def test_failure_before_first_delta_falls_back_silently(fake_stream):
    plan, _ = fake_stream
    # network_error: one quick retry on the same model, then the next model — all before any delta.
    plan["m1"] = [("fail_before", ConnectionError("down")), ("fail_before", ConnectionError("down"))]
    events = _collect([_spec("m1"), _spec("m2")])
    assert not any(e["type"] == "reset" for e in events)
    assert [e["model"] for e in events if e["type"] == "start"] == ["m2"]
    assert [a.outcome for a in events[-1]["usage"].attempts][-1] == "ok"


def test_failure_after_deltas_emits_reset_then_fallback_result(fake_stream):
    plan, _ = fake_stream
    plan["m1"] = [("fail_after", ValueError("broken stream"), 20)]  # invalid_response → next model
    events = _collect([_spec("m1"), _spec("m2")])
    resets = [i for i, e in enumerate(events) if e["type"] == "reset"]
    assert len(resets) == 1
    assert events[resets[0]]["reason"] == "fallback"
    assert any(e["type"] == "delta" for e in events[:resets[0]])
    assert _rebuild(events)["caption"] == ITEM["caption"], "preview after reset = only the fallback model's text"
    assert events[-1]["type"] == "result"


def test_every_model_failing_raises_chain_error(fake_stream):
    plan, _ = fake_stream
    plan["m1"] = [("fail_before", ValueError("bad"))]
    plan["m2"] = [("fail_before", ValueError("bad"))]
    with pytest.raises(llm.LlmChainError) as info:
        _collect([_spec("m1"), _spec("m2")])
    assert info.value.error_code == llm.AI_UNAVAILABLE


def test_client_disconnect_closes_the_provider_stream(fake_stream):
    _, closed = fake_stream

    async def run():
        llm.use_llm_config(LlmConfig(primary=_spec("m1")))
        try:
            gen = llm.astream_structured(ContentItem, PROMPT, {"q": "x"})
            async for event in gen:
                if event["type"] == "delta":
                    break
            await gen.aclose()  # what Starlette does when the backend hangs up
        finally:
            llm.use_llm_config(None)
    asyncio.run(run())
    assert closed == ["m1"]


def test_route_streams_ndjson_done_and_error_events(fake_stream, monkeypatch):
    import main
    monkeypatch.setattr(main.get_settings(), "ai_internal_token", None, raising=False)
    client = TestClient(main.app)
    body = {"brand_profile": {"brand_name": "B", "industry": "beauty", "brand_voice": "warm", "target_audience": "women"},
            "strategy": {}, "platform": "FACEBOOK",
            "llm_config": {"primary": {"provider": "google", "model": "m1", "api_key": "k"}}}
    with client.stream("POST", "/generate/stream", json=body, headers={"X-Internal-Token": "test"}) as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/x-ndjson")
        lines = [json.loads(line) for line in r.iter_lines() if line]
    assert lines[0]["type"] == "start"
    done = lines[-1]
    assert done["type"] == "done"
    assert done["result"]["caption"] == ITEM["caption"]
    assert done["result"]["tokens_used"] == 420

    plan, _ = fake_stream
    plan["m1"] = [("fail_before", ValueError("bad"))]
    with client.stream("POST", "/generate/stream", json=body, headers={"X-Internal-Token": "test"}) as r:
        lines = [json.loads(line) for line in r.iter_lines() if line]
    assert lines[-1]["type"] == "error"
    assert lines[-1]["error_code"] == "AI_UNAVAILABLE"
