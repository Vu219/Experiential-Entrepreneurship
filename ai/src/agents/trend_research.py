"""Trend Research agent (FR-19..FR-23) — evidence-grounded.

Pipeline for one session (scheduling, the no-overlap guard and persistence are owned by
the backend):

1. Collect signal IN PARALLEL — every source is real, none is mocked:
   - **Live web research** (``llm.invoke_grounded``): the model searches the web itself
     (Claude ``web_search`` / Gemini Google Search grounding) for what is trending in the
     brand's niche in the target market over the last ~2 weeks, and returns a research
     memo + the pages it actually used.
   - **Google Trends "Trending now"** for the market (free RSS): dated search spikes.
   - **Marketing calendar**: holidays / sale days in the coming weeks (deterministic).
   - **Platform keyword search** (optional, credential-gated): real YouTube / Instagram /
     Threads posts for the brand keywords.
   - **Previous sessions** (sent by the backend): trends already surfaced, for momentum.
2. One structured LLM call turns the numbered evidence into rated trends (FR-20/21) and
   content ideas (FR-22). Trends cite evidence by id ([S3]) — URLs are attached by code
   from the collected list, so the model cannot invent a source.
3. Post-processing: confidence from the number of independent sources, momentum checked
   against previous sessions, target platform enforced, limits applied.

If the web search step fails (provider/key without search, quota…) the session still
completes on the other sources and reports ``grounded=false`` so the UI can say so.
"""

from __future__ import annotations

import contextvars
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus, urlparse
from zoneinfo import ZoneInfo

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from ..config import get_settings
from ..llm import GroundedResult, LlmChainError, invoke_grounded, invoke_structured
from ..platform import google_trends, marketing_calendar
from ..platform.social_search import SocialSearch
from ..schemas import (
    ContentIdea,
    Evidence,
    Momentum,
    Relevance,
    ResearchRequest,
    ResearchResult,
    SourceStatus,
    TokenUsage,
    Trend,
    TrendType,
)

logger = logging.getLogger(__name__)

_MARKET_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
_CALENDAR_DAYS_AHEAD = 45
_GOOGLE_TRENDS_LIMIT = 20
_MAX_HASHTAGS = 5
_MAX_ACT_BY_DAYS = 90

# Canonical platform names as the schemas/prompt expect them (FR-19 target platform).
_CANONICAL_PLATFORMS = {"facebook": "Facebook", "instagram": "Instagram", "threads": "Threads"}


# ------------------------------------------------------------------
# Structured output of the synthesis call (what the MODEL fills in)
# ------------------------------------------------------------------

class _TrendDraft(BaseModel):
    trend_name: str
    platform: str
    trend_type: TrendType
    momentum: Momentum
    relevance: Relevance
    relevance_score: float = Field(..., ge=0.0, le=1.0)
    description: str = Field(..., description="What the trend is, why it is hot now, why it fits the brand")
    act_by: Optional[date] = Field(default=None, description="Latest date to publish to ride the trend (ISO)")
    hashtags: List[str] = Field(default_factory=list)
    evidence_ids: List[str] = Field(default_factory=list, description='Source ids backing it, e.g. ["S1","S4"]')


class _Synthesis(BaseModel):
    trends: List[_TrendDraft]
    content_ideas: List[ContentIdea]
    summary: str


# ------------------------------------------------------------------
# Signal collection
# ------------------------------------------------------------------

class _Signal:
    def __init__(self) -> None:
        self.sources: List[Dict[str, str]] = []   # numbered evidence: id, kind, title, url, detail
        self.memo: Optional[str] = None           # web research memo (grounded)
        self.statuses: List[SourceStatus] = []
        self.grounded = False
        self.web_searches = 0
        self.usage = TokenUsage()                 # tokens of the grounded call

    def add(self, kind: str, title: str, url: str = "", detail: str = "") -> None:
        self.sources.append({"id": f"S{len(self.sources) + 1}", "kind": kind,
                             "title": title.strip()[:200], "url": url, "detail": detail.strip()[:240]})


def _search_keywords(req: ResearchRequest) -> List[str]:
    keywords: List[str] = []
    for kw in [*req.brand_profile.brand_keywords[:2], req.brand_profile.industry]:
        kw = (kw or "").strip()
        if kw and kw.lower() not in {k.lower() for k in keywords}:
            keywords.append(kw)
    return keywords[:3]


def _collect_signal(req: ResearchRequest, region: str, today: date, target: Optional[str]) -> _Signal:
    signal = _Signal()
    social = SocialSearch()
    keywords = _search_keywords(req)
    # ThreadPoolExecutor threads do not inherit contextvars — the grounded call must see
    # this request's llm_config, so run it inside a copy of the current context.
    ctx = contextvars.copy_context()

    with ThreadPoolExecutor(max_workers=8) as pool:
        web_future = pool.submit(ctx.run, _web_research, req, region, today, target, keywords)
        gt_future = pool.submit(google_trends.fetch_trending_searches, region, _GOOGLE_TRENDS_LIMIT)
        social_futures = {
            "youtube": [pool.submit(social.youtube, kw, region, 5) for kw in keywords]
            if social.has_rapidapi_key else None,
            "instagram": [pool.submit(social.instagram_hashtag, kw, 5) for kw in keywords]
            if social.has_rapidapi_key else None,
            "threads": [pool.submit(social.threads, kw, 5) for kw in keywords]
            if social.has_threads_token else None,
        }

        # 1. Web research (the core evidence).
        try:
            grounded, usage = web_future.result()
            signal.memo, signal.grounded, signal.web_searches = grounded.text, True, grounded.searches
            signal.usage = usage
            for s in grounded.sources:
                signal.add("web", s["title"] or _domain(s["url"]), s["url"])
            signal.statuses.append(SourceStatus(name="web_search", status="ok" if grounded.sources else "empty",
                                                items=len(grounded.sources)))
        except LlmChainError as e:
            logger.warning("trend research: web search unavailable (%s) — continuing without it", e.error_code)
            signal.usage = TokenUsage(attempts=e.attempts)  # failed attempts still feed model health
            signal.statuses.append(SourceStatus(name="web_search", status="failed"))
        except ValueError as e:  # no model configured at all
            logger.warning("trend research: web search skipped: %s", type(e).__name__)
            signal.statuses.append(SourceStatus(name="web_search", status="failed"))

        # 2. Google Trends — what the market searches right now.
        trending = gt_future.result()
        for t in trending:
            news = t["news"][0] if t["news"] else None
            url = news["url"] if news else (
                f"https://trends.google.com/trends/explore?geo={region}&q={quote_plus(t['query'])}")
            detail = f"{t['traffic']} lượt tìm; {t['published'][:10]}" + (f"; tin: {news['title']}" if news else "")
            signal.add("google_trends", f"Google Trends {region}: {t['query']}", url, detail)
        signal.statuses.append(SourceStatus(name="google_trends", status="ok" if trending else "empty",
                                            items=len(trending)))

        # 3. Platform samples (optional).
        for name, futures in social_futures.items():
            if futures is None:
                signal.statuses.append(SourceStatus(name=name, status="skipped"))
                continue
            items = [item for f in futures for item in f.result()]
            for item in items:
                metrics = ", ".join(f"{k}={item[k]}" for k in ("views", "likes", "comments") if item[k])
                signal.add(name, item["text"].replace("\n", " "), item["url"], metrics)
            signal.statuses.append(SourceStatus(name=name, status="ok" if items else "empty", items=len(items)))

    # 4. Marketing calendar (deterministic, no I/O).
    moments = marketing_calendar.upcoming_moments(today, _CALENDAR_DAYS_AHEAD)
    for m in moments:
        signal.add("calendar", f"{m['name']} — {m['date']} (còn {m['days_until']} ngày)", "", str(m["note"]))
    signal.statuses.append(SourceStatus(name="calendar", status="ok" if moments else "empty", items=len(moments)))
    return signal


WEB_SYSTEM_PROMPT = """You are a social-media trend researcher for small businesses. Use web \
search to find what is trending RIGHT NOW (last ~14 days, plus clearly upcoming moments) \
that a brand in the given niche could turn into content. Search in the market's language \
(Vietnamese for Vietnam) and in English when useful. Prefer recent, dated sources: news, \
platform trend reports, creator/marketing communities, viral posts and formats.

Report only what your sources support, with dates. Skip tragedies, disasters, accidents, \
deaths, politics, religion and other sensitive topics — they are not safe to market on."""

WEB_USER_PROMPT = """Today is {today}. Market: {region}. Target platform: {platform}.
Brand: {brand_name} — industry: {industry}.
Keywords: {keywords}. Audience: {audience}.

Find 5-10 candidate trends for this brand: niche topics gaining interest, viral content \
formats/challenges/memes on {platform} and similar platforms, news people in the niche are \
talking about, and seasonal moments in the next weeks. For each candidate write:
- name
- type: Event | News | Format | Niche
- what it is and why it is hot now (with dates / numbers from the sources)
- where it is happening (platforms) and how long it is likely to last
- how this brand could use it
Be concise."""


def _web_research(req: ResearchRequest, region: str, today: date, target: Optional[str],
                  keywords: List[str]) -> tuple[GroundedResult, TokenUsage]:
    bp = req.brand_profile
    prompt = WEB_USER_PROMPT.format(
        today=today.isoformat(), region=region, platform=target or "Facebook / Instagram / Threads",
        brand_name=bp.brand_name, industry=bp.industry, keywords=", ".join(keywords) or bp.industry,
        audience=bp.target_audience,
    )
    return invoke_grounded(WEB_SYSTEM_PROMPT, prompt)


# ------------------------------------------------------------------
# Synthesis
# ------------------------------------------------------------------

SYSTEM_PROMPT = """You are the Trend Research analyst for AIMA, a marketing assistant for \
small businesses. You receive a brand, its content strategy, and NUMBERED EVIDENCE collected \
today: a live web-research memo with its sources, Google Trends search spikes for the market, \
upcoming marketing-calendar moments, optional real platform posts, and the trends already \
shown to this brand in earlier sessions.

Your job:
1. Select real, current trends this brand can credibly use (FR-20). Discard noise, generic \
engagement bait and anything unrelated to the industry or audience. Trending searches \
unrelated to the niche are only worth it if there is a natural, tasteful angle.
2. For each trend: type (Event/News/Format/Niche), momentum (New/Rising/Stable/Fading), \
relevance to THIS brand as High/Medium/Low with a 0.0-1.0 relevance_score (FR-21), the \
latest date to publish (act_by) when timing matters, 2-5 hashtags people actually use, and \
evidence_ids citing the source ids ([S#]) that support it.
3. Turn the most promising trends into concrete content ideas: title, description, platform, \
suitability, execution suggestions (hook, format, angle), and the brand goals served (FR-22). \
Every idea's trend_name must equal the trend_name of a returned trend.

Rules:
- Ground every trend in the evidence. Cite only ids that exist in the list; never invent \
sources, numbers or dates. A trend with no supporting id must be rated Low.
- Momentum: New = not among previous trends; Stable/Rising = continues a previous trend (say \
what changed); Fading = past its peak. Do not repeat a previous trend unless it is still \
clearly current, and never repeat its ideas.
- Brand safety: never exploit tragedies, accidents, deaths, disasters, politics or religion; \
respect the brand's don'ts.
- Description: what it is, why it is hot now, and why it fits the brand — 2-4 sentences.
- Write in the audience's language (Vietnamese for a Vietnamese audience)."""

USER_PROMPT = """TODAY: {today} — MARKET: {region}

BRAND PROFILE:
{brand_profile}

CONTENT STRATEGY:
{strategy}
{platform_instruction}
{data_quality}
WEB RESEARCH MEMO:
{memo}

EVIDENCE (cite by id):
{evidence}

PREVIOUS TRENDS SHOWN TO THIS BRAND:
{previous}

Return at most {max_trends} trends and at most {max_ideas} content ideas, best first, and a \
2-3 sentence summary of the landscape."""


def _target_platform(req: ResearchRequest) -> str | None:
    """Normalize the requested platform ("FACEBOOK" from the backend, any case) or None."""
    return _CANONICAL_PLATFORMS.get((req.platform or "").strip().lower())


def research_trends(req: ResearchRequest) -> ResearchResult:
    """Run a single trend-research session and return trends + ideas (+ token usage)."""
    settings = get_settings()
    today = datetime.now(_MARKET_TZ).date()
    region = (req.region or settings.trends_default_region or "VN").strip().upper()
    target = _target_platform(req)
    signal = _collect_signal(req, region, today, target)

    platform_instruction = (
        f"\nTARGET PLATFORM OF THIS SESSION: {target}. Focus on what works on {target}; the "
        f'`platform` of EVERY trend and EVERY content idea must be exactly "{target}", and '
        f"idea formats must suit {target}.\n"
        if target else
        '\nThe `platform` of every trend and idea must be exactly "Facebook", "Instagram" or "Threads".\n'
    )
    data_quality = "" if signal.grounded else (
        "DATA QUALITY: live web search was unavailable for this session. Rely on the evidence "
        "list only, keep relevance modest, and say in the summary that results are limited.\n")

    prompt = ChatPromptTemplate.from_messages([("system", SYSTEM_PROMPT), ("user", USER_PROMPT)])
    draft, usage = invoke_structured(
        _Synthesis,
        prompt,
        {
            "today": today.isoformat(),
            "region": region,
            "brand_profile": req.brand_profile.model_dump_json(indent=2),
            "strategy": req.strategy.model_dump_json(indent=2),
            "platform_instruction": platform_instruction,
            "data_quality": data_quality,
            "memo": signal.memo or "(none)",
            "evidence": _format_evidence(signal.sources),
            "previous": _format_previous(req, today),
            "max_trends": req.max_trends,
            "max_ideas": req.max_ideas,
        },
    )

    trends = [_finalize_trend(t, signal, req, target, today) for t in draft.trends[: req.max_trends]]
    ideas = draft.content_ideas[: req.max_ideas]
    if target:  # belt-and-braces (FR-19): structured output may still stray
        for idea in ideas:
            idea.platform = target

    return ResearchResult(
        industry=req.brand_profile.industry,
        trends=trends,
        content_ideas=ideas,
        summary=draft.summary,
        grounded=signal.grounded,
        web_searches=signal.web_searches,
        sources_used=signal.statuses,
        **_merge_usage(signal.usage, usage).response_fields(),
    )


def _finalize_trend(t: _TrendDraft, signal: _Signal, req: ResearchRequest,
                    target: Optional[str], today: date) -> Trend:
    by_id = {s["id"]: s for s in signal.sources}
    cited = [by_id[i.strip().strip("[]").upper()] for i in t.evidence_ids
             if i.strip().strip("[]").upper() in by_id]
    cited = list({s["id"]: s for s in cited}.values())  # dedupe, keep order
    evidence = [Evidence(title=s["title"], url=s["url"], source=s["kind"]) for s in cited]

    momentum = t.momentum
    if momentum == Momentum.NEW and _norm(t.trend_name) in {
            _norm(p.trend_name) for p in req.previous_trends if not p.rejected}:
        momentum = Momentum.STABLE  # the model missed that it was already shown before

    act_by = t.act_by if t.act_by and today <= t.act_by <= today + timedelta(days=_MAX_ACT_BY_DAYS) else None
    relevance = t.relevance if evidence else Relevance.LOW
    return Trend(
        trend_name=t.trend_name.strip(),
        platform=target or t.platform,
        relevance=relevance,
        relevance_score=t.relevance_score if evidence else min(t.relevance_score, 0.39),
        description=t.description.strip(),
        trend_type=t.trend_type,
        momentum=momentum,
        act_by=act_by,
        hashtags=_clean_hashtags(t.hashtags),
        evidence=evidence,
        confidence=_confidence(cited),
    )


def _confidence(cited: List[Dict[str, str]]) -> Relevance:
    """Independent origins: each web domain counts once, other source kinds count once each."""
    origins = {_domain(s["url"]) if s["kind"] == "web" else s["kind"] for s in cited}
    return Relevance.HIGH if len(origins) >= 2 else Relevance.MEDIUM if origins else Relevance.LOW


def _clean_hashtags(tags: List[str]) -> List[str]:
    out: List[str] = []
    for tag in tags:
        tag = "#" + re.sub(r"[^\w]", "", tag.lstrip("#"))
        if len(tag) > 1 and tag.lower() not in {t.lower() for t in out}:
            out.append(tag)
    return out[:_MAX_HASHTAGS]


def _merge_usage(a: TokenUsage, b: TokenUsage) -> TokenUsage:
    """Both calls are billed; the backend bills the LAST ok attempt's model (synthesis)."""
    return TokenUsage(
        total_tokens=a.total_tokens + b.total_tokens,
        input_tokens=a.input_tokens + b.input_tokens,
        output_tokens=a.output_tokens + b.output_tokens,
        cached_tokens=a.cached_tokens + b.cached_tokens,
        attempts=[*a.attempts, *b.attempts],
    )


def _format_evidence(sources: List[Dict[str, str]]) -> str:
    if not sources:
        return "(no evidence collected)"
    lines = []
    for s in sources:
        line = f"[{s['id']}] ({s['kind']}) {s['title']}"
        if s["detail"]:
            line += f" — {s['detail']}"
        if s["url"]:
            line += f" <{s['url']}>"
        lines.append(line)
    return "\n".join(lines)


def _format_previous(req: ResearchRequest, today: date) -> str:
    if not req.previous_trends:
        return "(none — first session)"
    return "\n".join(
        f"- {p.trend_name} (shown {(today - p.researched_at).days} days ago"
        + ("; REJECTED by the user as unsuitable — do not suggest it again)" if p.rejected else ")")
        for p in req.previous_trends)


def _norm(name: str) -> str:
    return re.sub(r"\s+", " ", name).strip().casefold()


def _domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host
