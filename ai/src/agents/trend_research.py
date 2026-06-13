"""Trend Research agent (FR-19..FR-23).

Collects raw public social signal (via the Facebook connector, with a mock
fallback), then uses the LLM to: filter trends by industry (FR-20), rate each
trend's relevance High/Medium/Low (FR-21), and turn promising trends into
actionable content ideas (FR-22).

Scheduling (2:00 AM daily / "Research now" trigger) and the no-overlapping-session
guarantee (FR-19) and session persistence (FR-23) are owned by the backend; this
agent performs the analysis for a single session.
"""

from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from ..llm import get_llm
from ..platform.facebook import FacebookTrendAnalyzer
from ..schemas import ResearchRequest, ResearchResponse


def _collect_signal(req: ResearchRequest) -> dict:
    """Gather and aggregate raw engagement signal for the LLM to reason over.

    Falls back to mock data when no Facebook token / source ids are configured,
    so research is demoable without live credentials.
    """
    analyzer = FacebookTrendAnalyzer(use_mock_fallback=True)

    page_ids = req.sources.page_ids or ["industry_public_page"]
    group_ids = req.sources.group_ids or ["industry_public_group"]

    content: list[dict] = []
    for pid in page_ids:
        content.extend(analyzer.fetch_public_page_posts(pid, limit=25))
        content.extend(analyzer.fetch_reels(pid, limit=15))
    for gid in group_ids:
        content.extend(analyzer.fetch_public_group_feed(gid, limit=25))

    comments_map: dict[str, list] = {}
    for item in content[:5]:
        comments_map[item["id"]] = analyzer.fetch_comments(item["id"], limit=10)

    return analyzer.analyze_trends(content, comments=comments_map, top_n=15)


SYSTEM_PROMPT = """You are the Trend Research analyst for AIMA. You are given raw \
engagement statistics (top hashtags, keywords, most-engaging posts) mined from public \
social media, plus a brand's industry and strategy.

Your job:
1. Identify real, current trends relevant to the brand's industry. Filter out noise and \
generic engagement bait that does not fit the industry (FR-20).
2. Rate each trend's relevance to THIS brand as High / Medium / Low, with a 0.0-1.0 \
relevance_score (FR-21).
3. Convert the most promising trends into concrete content ideas: a title, a description, \
the most suitable platform, suitability level, execution suggestions, and which brand \
goals it serves (FR-22).

Be specific and grounded in the supplied signal — do not invent metrics. Respond in the \
audience's language where natural."""

USER_PROMPT = """BRAND PROFILE:
{brand_profile}

CONTENT STRATEGY:
{strategy}

RAW SOCIAL SIGNAL (aggregated):
{signal}

Return at most {max_trends} trends and at most {max_ideas} content ideas."""


def research_trends(req: ResearchRequest) -> ResearchResponse:
    """Run a single trend-research session and return trends + ideas."""
    signal = _collect_signal(req)

    llm = get_llm().with_structured_output(ResearchResponse)
    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("user", USER_PROMPT)]
    )
    chain = prompt | llm
    result: ResearchResponse = chain.invoke(
        {
            "brand_profile": req.brand_profile.model_dump_json(indent=2),
            "strategy": req.strategy.model_dump_json(indent=2),
            "signal": _format_signal(signal),
            "max_trends": req.max_trends,
            "max_ideas": req.max_ideas,
        }
    )
    # Enforce the industry on the response and trim to requested limits.
    result.industry = req.brand_profile.industry
    result.trends = result.trends[: req.max_trends]
    result.content_ideas = result.content_ideas[: req.max_ideas]
    return result


def _format_signal(signal: dict) -> str:
    """Compact the analyzer output into a readable block for the prompt."""
    lines = []
    summary = signal.get("summary", {})
    lines.append(
        f"Posts analyzed: {summary.get('total_posts_analyzed', 0)}, "
        f"comments: {summary.get('total_comments_analyzed', 0)}, "
        f"aggregate likes: {summary.get('aggregate_likes', 0)}, "
        f"comments: {summary.get('aggregate_comments', 0)}, "
        f"shares: {summary.get('aggregate_shares', 0)}"
    )
    lines.append("Top hashtags: " + ", ".join(
        f"{h['hashtag']}({h['count']})" for h in signal.get("top_hashtags", [])
    ))
    lines.append("Top keywords: " + ", ".join(
        f"{k['keyword']}({k['count']})" for k in signal.get("top_keywords", [])
    ))
    lines.append("Most engaging posts:")
    for c in signal.get("most_engaging_content", [])[:8]:
        lines.append(
            f"  - [{c.get('type')}/{c.get('source')}] score={c.get('engagement_score', 0):.0f} :: {c.get('text', '')}"
        )
    return "\n".join(lines)
