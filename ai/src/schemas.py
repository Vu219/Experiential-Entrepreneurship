"""Pydantic schemas — request/response contracts for the AI service.

These mirror the entities in docs/DATA_MODEL.md. The backend (Spring Boot) owns
persistence; the AI service is stateless and exchanges these JSON shapes over HTTP.
Field names use snake_case; map to the DB columns on the backend side.
"""

from __future__ import annotations

from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, SecretStr

# ============================================================
# Shared enums
# ============================================================


class Relevance(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


# ============================================================
# LLM runtime config (DB-managed, injected per request by the backend)
# ============================================================


class LlmSpec(BaseModel):
    """One concrete model choice.

    ``api_key`` is a SecretStr: pydantic masks it in repr/str/exceptions, so the key
    can never leak through logging. Use ``.get_secret_value()`` only at client-build time.
    """

    provider: Literal["anthropic", "google"]
    model: str
    api_key: SecretStr
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class LlmConfig(BaseModel):
    """Per-request model routing from the backend's ai_task_routing table.

    Present only when the backend runs with AI_CONFIG_FROM_DB=true; absent = use the
    env-based default (rollback path). Requests carrying this MUST be authenticated
    with the internal token (X-Internal-Token) — enforced in routes.
    """

    primary: LlmSpec
    fallback: Optional[LlmSpec] = None


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
    # Brand guardrails (FR-05): keywords to weave in, do's to follow, don'ts to avoid.
    # Defaults keep older backend payloads (without these fields) valid.
    brand_keywords: List[str] = Field(default_factory=list)
    brand_dos: List[str] = Field(default_factory=list)
    brand_donts: List[str] = Field(default_factory=list)


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
    llm_config: Optional[LlmConfig] = None


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


class ResearchResult(ResearchResponse):
    """HTTP response of /research — adds real LLM token usage for backend quota
    accounting. Kept OUT of ResearchResponse so the structured-output schema sent
    to the model never asks it to fill an accounting field."""

    tokens_used: int = 0


# ============================================================
# Content Generation (FR-24..FR-30)
# ============================================================


class ScriptSection(BaseModel):
    """One timed section of the video script (hook or closing CTA)."""

    content: str = Field(..., description="What the creator says/shows on camera in this section")
    scene_suggestion: str = Field(
        ..., description="Concrete filming direction for THIS section (framing, b-roll, transition)"
    )
    timing: str = Field(..., description="Time range in the video, e.g. '0-3s' or '25-30s'")


class ScriptStep(BaseModel):
    """One numbered step of the video body."""

    index: int = Field(..., ge=1, description="1-based step number ('Bước 1', 'Bước 2', ...)")
    content: str = Field(..., description="What the creator says/shows on camera in this step")
    scene_suggestion: str = Field(
        ..., description="Concrete filming direction for THIS step (framing, b-roll, transition)"
    )


class VideoScript(BaseModel):
    """Structured video script the USER FOLLOWS TO FILM (FR-25) — NOT the posted text.

    Structure: timed hook -> body as numbered steps -> timed closing CTA. Every part keeps
    its spoken content and its scene suggestion SEPARATE so the UI can render them apart.
    """

    hook: ScriptSection = Field(..., description="Attention-grabbing opening (first seconds)")
    steps: List[ScriptStep] = Field(
        default_factory=list, description="Body of the video as ordered, numbered steps"
    )
    cta: ScriptSection = Field(..., description="Closing call-to-action at the end of the video")


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
    # Extra instruction typed by the user in the wizard's source step (e.g. "nhấn mạnh
    # khuyến mãi tháng này") — distinct from topic, which names the subject itself.
    note: Optional[str] = None
    # FR-32: when regenerating, prior text the user wants improved/varied.
    regenerate_from: Optional[str] = None
    llm_config: Optional[LlmConfig] = None


class ContentItem(BaseModel):
    """Original generated content before platform formatting (FR-24..FR-31).

    script vs caption are DIFFERENT things: script is the shooting guide (what to film),
    caption is the short posted text readers see. Hashtags live in their own field only.
    """

    script: VideoScript
    caption: str = Field(
        ...,
        description="Short posted text (1-3 sentences) readers see next to the post. NOT the script, "
        "not a restatement of it. Contains NO hashtags and NO '#' character.",
    )
    hashtags: List[str] = Field(
        default_factory=list,
        description="Hashtags as a separate list (leading '#' optional) — never embedded in the caption",
    )
    cta: str
    media_prompt: str = Field(
        ..., description="TEXT description of the VIDEO to film (scene, style, framing, mood) — no media is generated (FR-29)"
    )
    # Reserved for the upcoming static-image feature — a TEXT prompt describing one still
    # image for the post. Optional/default so current payloads (script/video only) stay valid;
    # backend/FE can wire it in later without changing this structure.
    image_prompt: str = Field(
        default="",
        description="TEXT prompt describing ONE static image for the post (reserved for the image "
        "feature; may be empty). No image is generated here.",
    )
    brand_voice_check: BrandVoiceCheck


class GenerateResult(ContentItem):
    """HTTP response of /generate — ContentItem plus real LLM token usage
    (same subclass pattern as ResearchResult)."""

    tokens_used: int = 0


# ============================================================
# Partial script regeneration (tạo lại từng phần kịch bản)
# ============================================================


class RegeneratePartRequest(BaseModel):
    """Regenerate ONE part of an existing video script, leaving the rest untouched.

    section: which part — "hook" | "body" | "cta".
    field:   which branch — "content" (spoken text, +timing for hook/cta) | "scene" (filming direction).
    step_index: only for section="body" — regenerate just that 1-based step; None = all steps.
    current_script is passed for consistency/context; only the requested branch is returned.
    """

    brand_profile: BrandProfileInput
    platform: str
    section: str = Field(..., description='"hook" | "body" | "cta"')
    field: str = Field(..., description='"content" | "scene"')
    step_index: Optional[int] = Field(default=None, ge=1)
    current_script: VideoScript
    llm_config: Optional[LlmConfig] = None


class RegeneratedSection(BaseModel):
    """Regenerated hook/CTA fragment — only the requested field is filled."""

    content: Optional[str] = None
    scene_suggestion: Optional[str] = None
    timing: Optional[str] = None


class RegeneratedStep(BaseModel):
    """Regenerated body step — only the requested field is filled."""

    index: int = Field(..., ge=1)
    content: Optional[str] = None
    scene_suggestion: Optional[str] = None


class RegeneratePartResult(BaseModel):
    """Response contains ONLY the regenerated part: `section` for hook/cta, `steps` for body."""

    section: Optional[RegeneratedSection] = None
    steps: List[RegeneratedStep] = Field(default_factory=list)


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
    llm_config: Optional[LlmConfig] = None


class ContentVersion(BaseModel):
    """Platform-specific formatted version (FR-40, FR-46).

    This is an ADAPTATION of the source content — the core message, product/offer
    facts and CTA intent are preserved; only presentation (length, tone, hashtags,
    structure, phrasing) changes per platform.
    """

    platform_name: str
    formatted_caption: str
    formatted_hashtags: List[str] = Field(default_factory=list)
    cta: str = Field(
        ...,
        description="The source CTA rewritten to fit this platform — MUST be present, never empty.",
    )
    media_format: str = Field(..., description="e.g. vertical video, square image, link post")
    notes: Optional[str] = None


class FormatResponse(BaseModel):
    versions: List[ContentVersion]


class FormatResult(FormatResponse):
    """HTTP response of /format — adds real LLM token usage
    (same subclass pattern as ResearchResult)."""

    tokens_used: int = 0


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
    llm_config: Optional[LlmConfig] = None


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
    llm_config: Optional[LlmConfig] = None


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
    llm_config: Optional[LlmConfig] = None


class GoldenHourResponse(BaseModel):
    platform: str
    data_driven: bool = Field(..., description="False = platform defaults, True = derived from >=10 posts")
    suggested_hours: List[str]
    rationale: str


# ============================================================
# Provider connection test (admin "Cấu hình AI" page)
# ============================================================


class TestConnectionRequest(BaseModel):
    """Mirrors backend dto/ai/TestConnectionPayload. Always requires the internal token."""

    provider: Literal["anthropic", "google"]
    model: str
    api_key: SecretStr


class TestConnectionResult(BaseModel):
    """A wrong/expired key is a RESULT (success=False + redacted message), not an HTTP error."""

    success: bool
    message: Optional[str] = None
    latency_ms: Optional[int] = None
