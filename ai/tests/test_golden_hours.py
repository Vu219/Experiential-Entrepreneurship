"""FR-48: golden hours — platform defaults until >=10 posts OF THAT PLATFORM, then data-driven."""

from src.agents.optimizer import suggest_golden_hours
from src.schemas import AnalyzedPost, GoldenHourRequest, PostMetrics


def _post(i: int, platform: str, hour: int, likes: int) -> AnalyzedPost:
    return AnalyzedPost(post_id=str(i), platform=platform, scheduled_hour=hour, metrics=PostMetrics(likes=likes))


def test_other_platform_posts_are_ignored():
    posts = [_post(i, "THREADS", 8, 100) for i in range(12)]
    res = suggest_golden_hours(GoldenHourRequest(platform="FACEBOOK", posts=posts))
    assert res.data_driven is False


def test_data_driven_uses_only_requested_platform():
    fb = [_post(i, "FACEBOOK", 20, 50) for i in range(10)]
    threads = [_post(100 + i, "THREADS", 7, 10_000) for i in range(10)]
    res = suggest_golden_hours(GoldenHourRequest(platform="FACEBOOK", posts=fb + threads))
    assert res.data_driven is True
    assert res.suggested_hours == ["20:00-21:00"]
