"""Evidence-grounded trend research (mocked providers and sources — no network, no quota)."""

from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from src import llm
from src.agents import trend_research as tr
from src.platform import google_trends, marketing_calendar
from src.schemas import (
    BrandProfileInput,
    ContentIdea,
    ContentStrategyInput,
    LlmAttempt,
    LlmConfig,
    LlmSpec,
    Momentum,
    PreviousTrend,
    Relevance,
    ResearchRequest,
    TokenUsage,
    TrendType,
)

TODAY = date(2026, 10, 8)


def _req(**kw) -> ResearchRequest:
    return ResearchRequest(
        brand_profile=BrandProfileInput(
            brand_name="Mộc Spa", industry="spa", brand_voice="ấm áp",
            target_audience="nữ 25-35", brand_keywords=["chăm sóc da", "thư giãn"]),
        strategy=ContentStrategyInput(goals=["awareness"]),
        platform="FACEBOOK",
        **kw,
    )


def _draft(**kw) -> tr._TrendDraft:
    base = dict(trend_name="Skincare mùa thu", platform="Instagram", trend_type=TrendType.NICHE,
                momentum=Momentum.NEW, relevance=Relevance.HIGH, relevance_score=0.9,
                description="d", act_by=None, hashtags=[], evidence_ids=[])
    base.update(kw)
    return tr._TrendDraft(**base)


@pytest.fixture
def pipeline(monkeypatch):
    """Scripted sources + LLM. state['web'] = GroundedResult | Exception; state['draft'] = _Synthesis."""
    state: dict = {
        "web": llm.GroundedResult(
            text="memo", searches=3,
            sources=[{"title": "Báo A", "url": "https://www.baoa.vn/x"},
                     {"title": "Báo B", "url": "https://baob.vn/y"}]),
        "trending": [{"query": "trung thu", "traffic": "2000+", "published": "2026-10-08T01:00:00",
                      "news": [{"title": "t", "url": "https://n.vn/1", "source": "N"}]}],
        "draft": None,
        "prompt_vars": None,
    }

    def fake_grounded(system, prompt):
        if isinstance(state["web"], Exception):
            raise state["web"]
        return state["web"], TokenUsage(total_tokens=100, input_tokens=80, output_tokens=20,
                                        attempts=[LlmAttempt(provider="google", model="g", outcome="ok")])

    def fake_structured(schema, prompt, variables):
        state["prompt_vars"] = variables
        return state["draft"], TokenUsage(total_tokens=50, input_tokens=40, output_tokens=10,
                                          attempts=[LlmAttempt(provider="google", model="g", outcome="ok")])

    monkeypatch.setattr(tr, "invoke_grounded", fake_grounded)
    monkeypatch.setattr(tr, "invoke_structured", fake_structured)
    monkeypatch.setattr(tr.google_trends, "fetch_trending_searches", lambda geo, limit: state["trending"])
    monkeypatch.setattr(tr, "SocialSearch", lambda: SimpleNamespace(has_rapidapi_key=False, has_threads_token=False))
    monkeypatch.setattr(tr, "datetime", SimpleNamespace(now=lambda tz=None: SimpleNamespace(date=lambda: TODAY)))
    return state


def test_evidence_ids_map_to_collected_sources_and_confidence(pipeline):
    # S1/S2 = web (2 domains), S3 = google trends, then calendar moments.
    pipeline["draft"] = tr._Synthesis(
        trends=[_draft(evidence_ids=["S1", "[s2]", "S99"]),
                _draft(trend_name="Không nguồn", evidence_ids=["S404"], relevance_score=0.8)],
        content_ideas=[ContentIdea(idea_title="i", idea_description="d", trend_name="Skincare mùa thu",
                                   platform="Threads", suitability_level=Relevance.HIGH)],
        summary="s")
    out = tr.research_trends(_req())

    first, second = out.trends
    assert [e.url for e in first.evidence] == ["https://www.baoa.vn/x", "https://baob.vn/y"]
    assert first.confidence == Relevance.HIGH
    assert first.platform == "Facebook"  # target platform enforced
    assert out.content_ideas[0].platform == "Facebook"
    # Unknown ids are dropped; no evidence → Low, score capped.
    assert second.evidence == [] and second.relevance == Relevance.LOW
    assert second.relevance_score < 0.4 and second.confidence == Relevance.LOW
    assert out.grounded and out.web_searches == 3
    assert out.tokens_used == 150 and len(out.llm_attempts) == 2
    statuses = {s.name: s.status for s in out.sources_used}
    assert statuses == {"web_search": "ok", "google_trends": "ok", "youtube": "skipped",
                        "instagram": "skipped", "threads": "skipped", "calendar": "ok"}
    assert "[S3] (google_trends) Google Trends VN: trung thu" in pipeline["prompt_vars"]["evidence"]


def test_web_search_failure_degrades_instead_of_failing(pipeline):
    failed = [LlmAttempt(provider="anthropic", model="c", outcome="bad_request")]
    pipeline["web"] = llm.LlmChainError(llm.AI_BAD_REQUEST, failed)
    pipeline["draft"] = tr._Synthesis(trends=[_draft(evidence_ids=["S1"])], content_ideas=[], summary="s")
    out = tr.research_trends(_req())

    assert out.grounded is False
    assert {s.name: s.status for s in out.sources_used}["web_search"] == "failed"
    assert "web search was unavailable" in pipeline["prompt_vars"]["data_quality"]
    # S1 is now the Google Trends item — still real evidence.
    assert out.trends[0].evidence[0].source == "google_trends"
    assert out.llm_attempts[0].outcome == "bad_request"  # fed to backend model health


def test_momentum_act_by_and_hashtags_post_processing(pipeline):
    pipeline["draft"] = tr._Synthesis(trends=[
        _draft(trend_name="  Skincare MÙA thu ", evidence_ids=["S1"], act_by=TODAY + timedelta(days=12),
               hashtags=["skincare", "#Skin Care!", "#skincare", "#a", "#b", "#c", "#d"]),
        _draft(trend_name="Cũ", evidence_ids=["S1"], act_by=TODAY - timedelta(days=1)),
    ], content_ideas=[], summary="s")
    out = tr.research_trends(_req(previous_trends=[
        PreviousTrend(trend_name="skincare mùa thu", researched_at=TODAY - timedelta(days=3)),
        PreviousTrend(trend_name="Bị loại", researched_at=TODAY - timedelta(days=1), rejected=True)]))

    first, second = out.trends
    assert first.momentum == Momentum.STABLE  # already shown 3 days ago
    assert first.act_by == TODAY + timedelta(days=12)
    assert first.hashtags == ["#skincare", "#a", "#b", "#c", "#d"]  # case-insensitive dedupe
    assert second.act_by is None  # in the past
    assert "shown 3 days ago)" in pipeline["prompt_vars"]["previous"]
    assert "Bị loại (shown 1 days ago; REJECTED" in pipeline["prompt_vars"]["previous"]


def test_grounded_call_sees_request_llm_config_inside_worker_thread(pipeline, monkeypatch):
    seen = []

    def grounded(system, prompt):
        seen.append(llm._current_llm_config.get())
        return pipeline["web"], TokenUsage()

    monkeypatch.setattr(tr, "invoke_grounded", grounded)
    pipeline["draft"] = tr._Synthesis(trends=[], content_ideas=[], summary="s")
    config = LlmConfig(primary=LlmSpec(provider="google", model="g", api_key="k"))
    llm.use_llm_config(config)
    try:
        tr.research_trends(_req())
    finally:
        llm.use_llm_config(None)
    assert seen == [config]


# ---------- sources ----------

def test_calendar_lists_upcoming_vn_moments():
    names = {m["name"]: m["days_until"] for m in marketing_calendar.upcoming_moments(TODAY, 45)}
    assert names["Sale 10.10"] == 2
    assert names["Phụ nữ Việt Nam 20/10"] == 12
    assert names["Nhà giáo Việt Nam 20/11"] == 43
    assert "Black Friday" not in names  # 2026-11-27 is 50 days away
    assert "Trung thu" not in names     # 2026-09-25 already passed
    bf = marketing_calendar.upcoming_moments(date(2026, 11, 1), 30)
    assert any(m["name"] == "Black Friday" and m["date"] == "2026-11-27" for m in bf)


def test_google_trends_rss_parsing():
    xml = b"""<?xml version="1.0"?><rss xmlns:ht="https://trends.google.com/trending/rss"><channel>
      <item><title>cau long</title><ht:approx_traffic>200+</ht:approx_traffic>
        <pubDate>Thu, 8 Oct 2026 01:50:00 -0700</pubDate>
        <ht:news_item><ht:news_item_title>T</ht:news_item_title>
          <ht:news_item_url>https://k.vn/a</ht:news_item_url><ht:news_item_source>K</ht:news_item_source></ht:news_item>
      </item><item><title></title></item></channel></rss>"""
    items = google_trends.parse_rss(xml, 10)
    assert items == [{"query": "cau long", "traffic": "200+", "published": "2026-10-08T01:50:00-07:00",
                      "news": [{"title": "T", "url": "https://k.vn/a", "source": "K"}]}]


@pytest.mark.parametrize("model,tool", [
    ("claude-sonnet-4-6", "web_search_20260209"),
    ("claude-opus-5-5", "web_search_20260209"),
    ("claude-sonnet-4-5-20250929", "web_search_20250305"),
    ("claude-opus-4-20250514", "web_search_20250305"),
    ("claude-haiku-4-5", "web_search_20250305"),
])
def test_anthropic_web_search_tool_version(model, tool):
    t = llm.anthropic_web_search_tool(model, 5)
    assert t["type"] == tool and t["max_uses"] == 5 and t["user_location"]["country"] == "VN"


def test_anthropic_sources_cited_first_deduped_and_error_result_ignored():
    blocks = [
        SimpleNamespace(type="web_search_tool_result", content=[
            SimpleNamespace(url="https://a.vn", title="A"), SimpleNamespace(url="https://b.vn", title="B")]),
        SimpleNamespace(type="web_search_tool_result", content=SimpleNamespace(error_code="max_uses_exceeded")),
        SimpleNamespace(type="text", text="x", citations=[SimpleNamespace(url="https://b.vn", title="B")]),
    ]
    assert [s["url"] for s in llm._anthropic_sources(blocks)] == ["https://b.vn", "https://a.vn"]


def test_grounded_chain_falls_back_to_next_model(monkeypatch):
    calls = []

    def fake_ground(spec, timeout, system, prompt):
        calls.append(spec.model)
        if spec.model == "a":
            from google.genai import errors as genai_errors
            raise genai_errors.ServerError(503, {"error": {"code": 503}})
        return llm.GroundedResult(text="ok"), TokenUsage(total_tokens=1)

    monkeypatch.setattr(llm, "_ground_with", fake_ground)
    monkeypatch.setattr(llm.time, "sleep", lambda s: None)
    llm.use_llm_config(LlmConfig(primary=LlmSpec(provider="google", model="a", api_key="k"),
                                 fallbacks=[LlmSpec(provider="google", model="b", api_key="k")]))
    try:
        result, usage = llm.invoke_grounded("s", "p")
    finally:
        llm.use_llm_config(None)
    assert result.text == "ok" and calls == ["a", "a", "b"]
    assert [a.outcome for a in usage.attempts] == ["provider_overloaded", "provider_overloaded", "ok"]
