"""Pydantic schemas — request/response contracts for the AI service.

These mirror the entities in docs/DATA_MODEL.md. The backend (Spring Boot) owns
persistence; the AI service is stateless and exchanges these JSON shapes over HTTP.
Field names use snake_case; map to the DB columns on the backend side.
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

# ============================================================
# Shared enums
# ============================================================


class Relevance(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


# ============================================================
# Context inputs (provided by the backend on each request)
# ============================================================


class BrandProfileInput(BaseModel):
    """Brand configuration the agents need for grounding (subset of FR-05)."""

    brand_name: str
    industry: str
    description: Optional[str] = None
    brand_voice: str = Field(..., description="e.g. friendly, professional, witty")
    target_audience: str
    content_goals: List[str] = Field(default_factory=list)
    platforms: List[str] = Field(default_factory=list, description="Facebook, Instagram, Threads")


class ContentStrategyInput(BaseModel):
    """Active content strategy (FR-10). Agents only run for Active strategies."""

    goals: List[str] = Field(default_factory=list)
    content_types: List[str] = Field(default_factory=list)
    frequency: Optional[str] = None
    platforms: List[str] = Field(default_factory=list)
    audience: Optional[str] = None
    content_style: Optional[str] = None
    cta_type: Optional[str] = None


# ============================================================
# Trend Research (FR-19..FR-23)
# ============================================================


class TrendSource(BaseModel):
    """Facebook pages/groups to mine for trends (empty list -> mock fallback),
    plus options for the cross-platform trend sources."""

    page_ids: List[str] = Field(default_factory=list)
    group_ids: List[str] = Field(default_factory=list)
    youtube_region: Optional[str] = Field(
        default=None,
        description="ISO region code for YouTube trending (e.g. 'VN'); None = global",
    )


class ResearchRequest(BaseModel):
    brand_profile: BrandProfileInput
    strategy: ContentStrategyInput
    sources: TrendSource = Field(default_factory=TrendSource)
    max_trends: int = Field(default=8, ge=1, le=20)
    max_ideas: int = Field(default=5, ge=1, le=20)


class ContentIdea(BaseModel):
    """Actionable idea derived from a trend (FR-22)."""

    idea_title: str
    idea_description: str
    trend_name: Optional[str] = Field(
        default=None, description="trend_name of the trend this idea derives from"
    )
    platform: str = Field(..., description="Most suitable platform for this idea")
    suitability_level: Relevance
    execution_suggestions: List[str] = Field(default_factory=list)
    related_goals: List[str] = Field(default_factory=list)


class Trend(BaseModel):
    """A detected trend rated by industry relevance (FR-20, FR-21)."""

    trend_name: str
    platform: str
    relevance: Relevance
    relevance_score: float = Field(..., ge=0.0, le=1.0)
    description: str


class ResearchResponse(BaseModel):
    industry: str
    trends: List[Trend]
    content_ideas: List[ContentIdea]
    summary: str


# ============================================================
# Content Generation (FR-24..FR-30)
# ============================================================


class VideoScript(BaseModel):
    """Structured video script (FR-25)."""

    hook: str = Field(..., description="Attention-grabbing opening line")
    main_content: str
    shot_suggestions: List[str] = Field(default_factory=list)
    cta: str


class BrandVoiceCheck(BaseModel):
    """Self-assessment of brand-voice alignment (FR-30)."""

    aligned: bool
    score: int = Field(..., ge=0, le=100)
    notes: str


class GenerateRequest(BaseModel):
    brand_profile: BrandProfileInput
    strategy: ContentStrategyInput
    platform: str = Field(..., description="Target platform for the draft")
    trend: Optional[Trend] = None
    idea: Optional[ContentIdea] = None
    # Free-text topic from the user (Create.tsx has no structured idea/trend input yet).
    topic: Optional[str] = None
    # FR-32: when regenerating, prior text the user wants improved/varied.
    regenerate_from: Optional[str] = None


class ContentItem(BaseModel):
    """Original generated content before platform formatting (FR-24..FR-31)."""

    script: VideoScript
    caption: str
    hashtags: List[str] = Field(default_factory=list)
    cta: str
    media_prompt: str = Field(
        ..., description="TEXT description of the image/video only — no media is generated (FR-29)"
    )
    brand_voice_check: BrandVoiceCheck


# ============================================================
# Platform Formatting (FR-40, FR-42, FR-44, Threads, FR-46)
# ============================================================


class FormatContentInput(BaseModel):
    """Original content as persisted by the backend (script flattened to text,
    no brand_voice_check) — the formatter only needs the raw material."""

    script: str = ""
    caption: str
    hashtags: List[str] = Field(default_factory=list)
    cta: str = ""
    media_prompt: str = ""


class FormatRequest(BaseModel):
    brand_profile: BrandProfileInput
    content: FormatContentInput
    platforms: List[str] = Field(..., description="One ContentVersion produced per platform")


class ContentVersion(BaseModel):
    """Platform-specific formatted version (FR-40, FR-46)."""

    platform_name: str
    formatted_caption: str
    formatted_hashtags: List[str] = Field(default_factory=list)
    media_format: str = Field(..., description="e.g. vertical video, square image, link post")
    notes: Optional[str] = None


class FormatResponse(BaseModel):
    versions: List[ContentVersion]


# ============================================================
# Performance Analysis & Optimization (FR-48, FR-63..FR-66)
# ============================================================


class PostMetrics(BaseModel):
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    saves: int = 0
    ctr: float = 0.0
    conversion_rate: float = 0.0
    watch_time: int = 0  # seconds


class AnalyzedPost(BaseModel):
    """A published post plus the content features that may explain its result."""

    post_id: str
    platform: str
    scheduled_hour: Optional[int] = Field(default=None, ge=0, le=23)
    hook: Optional[str] = None
    caption: Optional[str] = None
    hashtags: List[str] = Field(default_factory=list)
    cta: Optional[str] = None
    media_format: Optional[str] = None
    metrics: PostMetrics


class AnalyzeRequest(BaseModel):
    brand_profile: BrandProfileInput
    posts: List[AnalyzedPost]


class SuccessFactor(BaseModel):
    """What drove performance, with evidence (FR-63)."""

    factor: str = Field(..., description="hook | caption | hashtags | cta | media | timing | platform")
    finding: str
    confidence: Relevance


class OptimizationInsight(BaseModel):
    """An actionable insight (FR-64)."""

    insight_content: str
    recommendation: str


class AnalyzeResponse(BaseModel):
    success_factors: List[SuccessFactor]
    insights: List[OptimizationInsight]


class OptimizeRequest(BaseModel):
    brand_profile: BrandProfileInput
    strategy: ContentStrategyInput
    insights: List[OptimizationInsight]


class StrategyAdjustment(BaseModel):
    """Proposed strategy change for the user to accept/reject (FR-65, FR-68)."""

    adjustment_content: str
    rationale: str


class OptimizeResponse(BaseModel):
    strategy_adjustments: List[StrategyAdjustment]
    future_improvements: List[str] = Field(default_factory=list)  # FR-66


# ============================================================
# Golden-hour suggestions (FR-48)
# ============================================================


class GoldenHourRequest(BaseModel):
    platform: str
    # Backend passes analytics once available; <10 entries => platform defaults used.
    posts: List[AnalyzedPost] = Field(default_factory=list)


class GoldenHourResponse(BaseModel):
    platform: str
    data_driven: bool = Field(..., description="False = platform defaults, True = derived from >=10 posts")
    suggested_hours: List[str]
    rationale: str
