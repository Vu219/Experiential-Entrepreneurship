"""Platform formatter post-processing (mocked LLM — no network): platform-name matching,
hashtags left in the caption, and the published-text limits (Threads 500, IG 2200 / 30 tags)."""

from __future__ import annotations

import pytest

from src.agents import platform_formatter
from src.schemas import (
    BrandProfileInput,
    ContentVersion,
    FormatContentInput,
    FormatRequest,
    FormatResponse,
)


class _Usage:
    def response_fields(self) -> dict:
        return {}


def _version(platform: str, caption: str = "Xin chào", tags: list[str] | None = None) -> ContentVersion:
    return ContentVersion(platform_name=platform, formatted_caption=caption,
                          formatted_hashtags=tags or [], cta="Mua ngay", media_format="text")


@pytest.fixture
def run(monkeypatch):
    """Format with the LLM returning ``versions`` for the requested ``platforms``."""
    captured: dict = {}

    def _run(platforms: list[str], versions: list[ContentVersion]):
        def fake_invoke(schema, prompt, variables):
            captured.update(variables)
            return FormatResponse(versions=versions), _Usage()

        monkeypatch.setattr(platform_formatter, "invoke_structured", fake_invoke)
        req = FormatRequest(
            brand_profile=BrandProfileInput(brand_name="B", industry="I", brand_voice="v",
                                            target_audience="a"),
            content=FormatContentInput(caption="c"),
            platforms=platforms,
        )
        return platform_formatter.format_content(req)

    _run.captured = captured
    return _run


def test_platform_alias_is_normalized_not_dropped(run):
    result = run(["Facebook", "Instagram", "Threads"],
                 [_version("fb"), _version("Instagram Business"), _version("threads.net")])
    assert [v.platform_name for v in result.versions] == ["Facebook", "Instagram", "Threads"]


def test_unrequested_and_duplicate_platforms_are_dropped(run):
    result = run(["Facebook"], [_version("Facebook Page"), _version("facebook"), _version("Threads")])
    assert [v.platform_name for v in result.versions] == ["Facebook"]


def test_hashtags_in_caption_move_to_hashtag_list_without_duplicates(run):
    result = run(["Instagram"], [_version("instagram", "Ưu đãi #SaleTet hôm nay\n\n#saletet #mới top #1",
                                          ["SaleTet"])])
    v = result.versions[0]
    assert "#" not in v.formatted_caption.replace("#1", "")
    assert "#1" in v.formatted_caption, "'#1' is not a hashtag"
    assert v.formatted_hashtags == ["SaleTet", "#mới"]


def test_threads_limit_trims_hashtags_first_then_caption_at_word(run):
    caption = " ".join(["chữ"] * 200)  # 799 chars
    result = run(["Threads"], [_version("Threads", caption, ["a", "b"])])
    v = result.versions[0]
    published = platform_formatter._compose(v.formatted_caption, v.formatted_hashtags)
    assert len(published) <= 500
    assert v.formatted_hashtags == []
    assert v.formatted_caption.endswith("chữ…")


def test_threads_short_caption_keeps_hashtags_that_fit(run):
    caption = "x" * 480
    result = run(["Threads"], [_version("Threads", caption, ["aa", "bb", "cc", "dd", "ee", "ff"])])
    v = result.versions[0]
    assert v.formatted_caption == caption
    assert len(platform_formatter._compose(v.formatted_caption, v.formatted_hashtags)) <= 500
    assert v.formatted_hashtags == ["aa", "bb", "cc", "dd"]  # 480 + 2 + "#aa #bb #cc #dd" = 497


def test_instagram_caps_hashtags_at_30(run):
    result = run(["Instagram"], [_version("Instagram", "Caption", [f"tag{i}" for i in range(40)])])
    assert len(result.versions[0].formatted_hashtags) == 30


def test_prompt_states_limits_and_no_thread_split(run):
    run(["Threads", "Instagram"], [])
    assert "500 characters" in run.captured["limits"]
    assert "30 hashtags" in run.captured["limits"]
    assert "split into a short thread" not in platform_formatter.PLATFORM_RULES["threads"]
