"""Trend Research agent (FR-19..FR-23).

Collects raw public social signal (via the Facebook connector plus the
cross-platform Trends-MCP connector — YouTube / TikTok / Instagram Reels —
each with a mock fallback), then uses the LLM to: filter trends by industry
(FR-20), rate each trend's relevance High/Medium/Low (FR-21), and turn
promising trends into actionable content ideas (FR-22).

Scheduling (2:00 AM daily / "Research now" trigger) and the no-overlapping-session
guarantee (FR-19) and session persistence (FR-23) are owned by the backend; this
agent performs the analysis for a single session.
"""

from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from ..llm import invoke_structured
from concurrent.futures import ThreadPoolExecutor

from ..platform.facebook import FacebookTrendAnalyzer
from ..platform.trends_mcp import TrendsMCPConnector
from ..schemas import ResearchRequest, ResearchResponse, ResearchResult


def _collect_signal(req: ResearchRequest) -> dict:
    """Gather and aggregate raw engagement signal for the LLM to reason over.

    Falls back to mock data when no Facebook token / source ids are configured,
    so research is demoable without live credentials. The independent sources
    (Facebook, YouTube, TikTok, Reels roundup) are fetched IN PARALLEL so a slow
    or failing external API (unregistered key, network error...) only costs the
    time of the slowest source, not the sum of all of them.
    """
    analyzer = FacebookTrendAnalyzer(use_mock_fallback=True)
    trends_connector = TrendsMCPConnector(use_mock_fallback=True)

    page_ids = req.sources.page_ids or ["industry_public_page"]
    group_ids = req.sources.group_ids or ["industry_public_group"]
    region = req.sources.youtube_region  # None → connector dùng TRENDS_DEFAULT_REGION

    def fetch_facebook() -> list[dict]:
        items: list[dict] = []
        for pid in page_ids:
            items.extend(analyzer.fetch_public_page_posts(pid, limit=25))
            items.extend(analyzer.fetch_reels(pid, limit=15))
        for gid in group_ids:
            items.extend(analyzer.fetch_public_group_feed(gid, limit=25))
        return items

    def fetch_youtube() -> list[dict]:
        return trends_connector.fetch_youtube_trending(region=region, limit=10)

    # FR-20: ngoài trending chung, search thẳng theo từ khóa thương hiệu + ngành để signal
    # bám sát brand thay vì chỉ xu hướng đại chúng (từ khóa tiếng Việt → nội dung VN).
    # Từng nguồn tự gate theo credential của nó: YouTube/Instagram cần RapidAPI key,
    # Threads cần THREADS_ACCESS_TOKEN — thiếu thì trả [] (không mock, tránh nhân nhiễu).
    search_keywords: list[str] = []
    seen = set()
    for kw in [*req.brand_profile.brand_keywords[:2], req.brand_profile.industry]:
        normalized = (kw or "").strip()
        if normalized and normalized.lower() not in seen:
            seen.add(normalized.lower())
            search_keywords.append(normalized)
    search_keywords = search_keywords[:3]

    with ThreadPoolExecutor(max_workers=4) as pool:
        fb_future = pool.submit(fetch_facebook)
        yt_future = pool.submit(fetch_youtube)
        tiktok_future = pool.submit(trends_connector.fetch_tiktok_trending, 10, region)
        reels_future = pool.submit(trends_connector.fetch_reels_trends)
        search_futures = []
        if trends_connector.has_rapidapi_key:
            search_futures += [
                pool.submit(trends_connector.fetch_youtube_search, kw, region, 5)
                for kw in search_keywords
            ]
            search_futures += [
                pool.submit(trends_connector.fetch_instagram_hashtag, kw, 5)
                for kw in search_keywords
            ]
        if trends_connector.has_threads_token:
            search_futures += [
                pool.submit(trends_connector.fetch_threads_keyword, kw, 5)
                for kw in search_keywords
            ]

        fb_items = fb_future.result()
        youtube_items = yt_future.result()

        comment_futures = {
            item["id"]: pool.submit(analyzer.fetch_comments, item["id"], 10)
            for item in fb_items[:5]
        }
        # Comments for mock video ids don't exist on YouTube — skip the doomed live calls.
        comment_futures.update({
            item["id"]: pool.submit(
                trends_connector.fetch_youtube_comments, item["video_id"], 10
            )
            for item in youtube_items[:2]
            if not str(item["video_id"]).startswith("mock_")
        })

        content = fb_items + youtube_items + tiktok_future.result()
        for future in search_futures:
            content.extend(future.result())  # lỗi search đã được nuốt trong connector ([]).
        comments_map = {item_id: f.result() for item_id, f in comment_futures.items()}
        curated_reels = reels_future.result()

    signal = analyzer.analyze_trends(content, comments=comments_map, top_n=15)
    signal["curated_reels_trends"] = curated_reels
    return signal


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

The signal may include cross-platform trending content (YouTube, TikTok, curated \
Instagram Reels trends). Items whose source starts with "youtube_search:", \
"instagram_hashtag:" or "threads_search:" were fetched by searching the brand's OWN \
keywords — treat them as strong evidence of what currently performs in the brand's \
niche (instagram_hashtag and threads_search items come from platforms the brand \
publishes to). Use all of it to spot trends early and note a trend's origin platform \
in its description, but the `platform` field of every trend and content idea must be \
exactly one of "Facebook", "Instagram", or "Threads" (platforms the brand actually uses).

Every content idea must set `trend_name` to the exact trend_name of the returned trend \
it derives from.

Be specific and grounded in the supplied signal — do not invent metrics. Respond in the \
audience's language where natural."""

USER_PROMPT = """BRAND PROFILE:
{brand_profile}

CONTENT STRATEGY:
{strategy}

RAW SOCIAL SIGNAL (aggregated):
{signal}

Return at most {max_trends} trends and at most {max_ideas} content ideas."""


def research_trends(req: ResearchRequest) -> ResearchResult:
    """Run a single trend-research session and return trends + ideas (+ token usage)."""
    signal = _collect_signal(req)

    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("user", USER_PROMPT)]
    )
    result, usage = invoke_structured(
        ResearchResponse,
        prompt,
        {
            "brand_profile": req.brand_profile.model_dump_json(indent=2),
            "strategy": req.strategy.model_dump_json(indent=2),
            "signal": _format_signal(signal),
            "max_trends": req.max_trends,
            "max_ideas": req.max_ideas,
        },
    )
    # Enforce the industry on the response and trim to requested limits.
    result.industry = req.brand_profile.industry
    result.trends = result.trends[: req.max_trends]
    result.content_ideas = result.content_ideas[: req.max_ideas]
    return ResearchResult(**result.model_dump(), **usage.response_fields())


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
    reels_trends = signal.get("curated_reels_trends", [])
    if reels_trends:
        lines.append("This week's Instagram Reels trends (curated):")
        for t in reels_trends[:6]:
            lines.append(f"  - [{t.get('date')}] {t.get('trend')}: {t.get('description')}")
    return "\n".join(lines)
