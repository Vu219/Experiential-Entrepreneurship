"""Content Generator agent (FR-24..FR-30).

Generates one ContentItem (video script, caption, hashtags, CTA, media prompt)
from the brand profile + strategy + optional trend/idea + target platform, and
self-checks brand-voice alignment. Media prompts are TEXT ONLY (FR-29).
"""

from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from ..llm import get_llm
from ..schemas import ContentItem, GenerateRequest

SYSTEM_PROMPT = """You are the Content Generator for AIMA, an AI social-media content \
assistant. You write short-form social content for small brands.

Rules:
- Write in the brand's voice and the language of the target audience (Vietnamese \
audiences => Vietnamese copy).
- Ground every piece in the brand profile, strategy, and (if given) the trend and idea.
- The video script must have: a strong hook, main content, concrete shot suggestions, \
and a closing CTA (FR-25).
- Produce a caption (FR-26), relevant hashtags without the leading '#' duplicated \
inconsistently (FR-27), and a clear CTA (FR-28).
- media_prompt is a TEXT DESCRIPTION of the image/video to create — you do NOT generate \
media (FR-29). Describe scene, style, framing, mood.
- Finish with an honest brand_voice_check: does the content match the brand voice, a \
0-100 score, and short notes (FR-30).
- If regenerate_from is provided, produce a meaningfully different take, not a paraphrase \
(FR-32)."""

USER_PROMPT = """Target platform: {platform}

BRAND PROFILE:
{brand_profile}

CONTENT STRATEGY:
{strategy}

TREND (optional):
{trend}

CONTENT IDEA (optional):
{idea}

PREVIOUS VERSION TO IMPROVE ON (optional, regenerate):
{regenerate_from}

Generate one complete content item for this platform."""


def generate_content(req: GenerateRequest) -> ContentItem:
    """Run the generation chain and return a structured ContentItem."""
    llm = get_llm().with_structured_output(ContentItem)
    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("user", USER_PROMPT)]
    )
    chain = prompt | llm
    return chain.invoke(
        {
            "platform": req.platform,
            "brand_profile": req.brand_profile.model_dump_json(indent=2),
            "strategy": req.strategy.model_dump_json(indent=2),
            "trend": req.trend.model_dump_json(indent=2) if req.trend else "—",
            "idea": req.idea.model_dump_json(indent=2) if req.idea else "—",
            "regenerate_from": req.regenerate_from or "—",
        }
    )
