"""Content Generator agent (FR-24..FR-30).

Generates one ContentItem (video script, caption, hashtags, CTA, media/image prompt)
from the brand profile + strategy + optional trend/idea + target platform, and
self-checks brand-voice alignment. Media/image prompts are TEXT ONLY (FR-29).
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

SCRIPT vs CAPTION — these are TWO DIFFERENT things; do not blur them together:
- script is the VIDEO SHOOTING GUIDE the user follows to FILM: a strong hook, main content \
broken into scenes, concrete shot suggestions, and a closing CTA (FR-25). It is spoken/shown \
on camera, not the text posted with the post.
- caption is the SHORT POSTED TEXT readers see next to the post (FR-26): 1-3 sentences, \
inviting and curiosity-driven. It is NOT the script and NOT a restatement of it — do NOT reuse \
the script's opening line or its CTA verbatim. On Threads keep it even shorter and conversational.

HASHTAGS:
- Put hashtags ONLY in the separate hashtags field (FR-27). The caption must contain NO \
hashtags and NO '#' character at all — never append hashtags to the end of the caption.

- cta is the standalone call-to-action for the post (FR-28).
- media_prompt is a TEXT DESCRIPTION of the VIDEO to film (scene, style, framing, mood) — you \
do NOT generate media (FR-29).
- image_prompt is a TEXT DESCRIPTION of ONE static image for the post — reserved for an \
upcoming image feature. Provide a short description when it fits, otherwise leave it empty. \
You do NOT generate the image (FR-29).
- Respect the brand guardrails in the brand profile: weave brand_keywords in naturally \
where relevant, follow brand_dos, and STRICTLY avoid everything listed in brand_donts.
- If a USER NOTE is provided, treat it as a direct instruction from the brand owner and \
follow it (unless it conflicts with brand_donts).
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

TOPIC (optional, user-provided):
{topic}

USER NOTE (optional, extra instruction from the brand owner):
{note}

PREVIOUS VERSION TO IMPROVE ON (optional, regenerate):
{regenerate_from}

Generate one complete content item for this platform."""


def build_prompt_vars(req: GenerateRequest) -> dict:
    """Map the request onto the USER_PROMPT placeholders (absent optionals -> '—')."""
    return {
        "platform": req.platform,
        "brand_profile": req.brand_profile.model_dump_json(indent=2),
        "strategy": req.strategy.model_dump_json(indent=2),
        "trend": req.trend.model_dump_json(indent=2) if req.trend else "—",
        "idea": req.idea.model_dump_json(indent=2) if req.idea else "—",
        "topic": req.topic or "—",
        "note": req.note or "—",
        "regenerate_from": req.regenerate_from or "—",
    }


def generate_content(req: GenerateRequest) -> ContentItem:
    """Run the generation chain and return a structured ContentItem."""
    llm = get_llm().with_structured_output(ContentItem)
    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("user", USER_PROMPT)]
    )
    chain = prompt | llm
    return chain.invoke(build_prompt_vars(req))
