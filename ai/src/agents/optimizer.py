"""Optimizer agent (FR-48, FR-63..FR-66).

- analyze_performance: find success factors (FR-63) and optimization insights (FR-64)
  from published posts + their metrics.
- propose_optimizations: turn insights into strategy adjustments (FR-65) and
  future-post improvements (FR-66) for the user to accept/reject (FR-68).
- suggest_golden_hours: platform defaults, switching to data-driven slots once
  >=10 analyzed posts exist (FR-48).
"""

from __future__ import annotations

from collections import defaultdict

from langchain_core.prompts import ChatPromptTemplate

from ..llm import invoke_structured
from ..schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalyzeResult,
    GoldenHourRequest,
    GoldenHourResponse,
    OptimizeRequest,
    OptimizeResponse,
    OptimizeResult,
)

# Platform default golden hours (REQUIREMENTS.md FR-48).
DEFAULT_GOLDEN_HOURS = {
    "facebook": ["08:00-09:00", "13:00-14:00", "20:00-21:00"],
    "instagram": ["08:00-10:00", "12:00-13:00", "19:00-21:00"],
    "threads": ["07:00-09:00", "12:00-13:00", "20:00-22:00"],
}

# Engagement weighting reused from the trend analyzer.
_MIN_POSTS_FOR_DATA_DRIVEN = 10


# ------------------------------------------------------------
# FR-63 / FR-64 — performance analysis
# ------------------------------------------------------------

_ANALYZE_SYSTEM = """You are the Performance Optimizer for AIMA. Given a set of published \
posts with their content features (hook, caption, hashtags, CTA, media format, posting \
hour, platform) and real metrics, determine WHICH factors drove the best results.

- Produce success_factors covering the relevant dimensions: hook, caption, hashtags, cta, \
media, timing, platform. Each names the factor, a concrete finding backed by the data, and \
your confidence (High/Medium/Low) (FR-63).
- Produce actionable optimization insights with a clear recommendation (FR-64).
- Base findings on the supplied metrics only — do not fabricate numbers."""

_ANALYZE_USER = """BRAND PROFILE:
{brand_profile}

PUBLISHED POSTS WITH METRICS:
{posts}

Analyze what worked and why."""


def analyze_performance(req: AnalyzeRequest) -> AnalyzeResult:
    prompt = ChatPromptTemplate.from_messages(
        [("system", _ANALYZE_SYSTEM), ("user", _ANALYZE_USER)]
    )
    posts_json = "[\n" + ",\n".join(p.model_dump_json() for p in req.posts) + "\n]"
    result, usage = invoke_structured(
        AnalyzeResponse,
        prompt,
        {
            "brand_profile": req.brand_profile.model_dump_json(indent=2),
            "posts": posts_json,
        },
    )
    return AnalyzeResult(**result.model_dump(), **usage.response_fields())


# ------------------------------------------------------------
# FR-65 / FR-66 — optimization proposals
# ------------------------------------------------------------

_OPTIMIZE_SYSTEM = """You are the Strategy Optimizer for AIMA. Given the current brand \
strategy and a set of optimization insights drawn from real performance, propose:
- strategy_adjustments: concrete changes to the content strategy, each with a rationale, \
for the user to accept or reject (FR-65, FR-68).
- future_improvements: specific tips to apply to the next round of content (FR-66).

Keep proposals practical and tied to the insights. Do not propose changes the data does \
not support."""

_OPTIMIZE_USER = """BRAND PROFILE:
{brand_profile}

CURRENT STRATEGY:
{strategy}

INSIGHTS:
{insights}

Propose strategy adjustments and future improvements."""


def propose_optimizations(req: OptimizeRequest) -> OptimizeResult:
    prompt = ChatPromptTemplate.from_messages(
        [("system", _OPTIMIZE_SYSTEM), ("user", _OPTIMIZE_USER)]
    )
    insights_json = "[\n" + ",\n".join(i.model_dump_json() for i in req.insights) + "\n]"
    result, usage = invoke_structured(
        OptimizeResponse,
        prompt,
        {
            "brand_profile": req.brand_profile.model_dump_json(indent=2),
            "strategy": req.strategy.model_dump_json(indent=2),
            "insights": insights_json,
        },
    )
    return OptimizeResult(**result.model_dump(), **usage.response_fields())


# ------------------------------------------------------------
# FR-48 — golden-hour suggestions
# ------------------------------------------------------------


def suggest_golden_hours(req: GoldenHourRequest) -> GoldenHourResponse:
    """Platform defaults until >=10 analyzed posts, then data-driven slots."""
    platform = req.platform.lower()
    defaults = DEFAULT_GOLDEN_HOURS.get(platform, ["09:00-10:00", "12:00-13:00", "19:00-21:00"])

    posts_with_hour = [p for p in req.posts if p.scheduled_hour is not None]
    if len(posts_with_hour) < _MIN_POSTS_FOR_DATA_DRIVEN:
        return GoldenHourResponse(
            platform=req.platform,
            data_driven=False,
            suggested_hours=defaults,
            rationale=(
                f"Using {req.platform} platform defaults — only {len(posts_with_hour)} "
                f"analyzed posts (need {_MIN_POSTS_FOR_DATA_DRIVEN})."
            ),
        )

    # Aggregate weighted engagement per hour, then pick the top 3 hours.
    by_hour: dict[int, float] = defaultdict(float)
    counts: dict[int, int] = defaultdict(int)
    for p in posts_with_hour:
        m = p.metrics
        score = m.likes + 2 * m.comments + 4 * m.shares + 3 * m.saves + 0.1 * m.views
        by_hour[p.scheduled_hour] += score
        counts[p.scheduled_hour] += 1

    avg_by_hour = {h: by_hour[h] / counts[h] for h in by_hour}
    top_hours = sorted(avg_by_hour, key=avg_by_hour.get, reverse=True)[:3]
    top_hours.sort()
    suggested = [f"{h:02d}:00-{(h + 1) % 24:02d}:00" for h in top_hours]

    return GoldenHourResponse(
        platform=req.platform,
        data_driven=True,
        suggested_hours=suggested,
        rationale=(
            f"Derived from {len(posts_with_hour)} analyzed posts by average weighted "
            f"engagement per posting hour."
        ),
    )
