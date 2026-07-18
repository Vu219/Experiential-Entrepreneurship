"""Platform Formatter agent (FR-40, FR-42, FR-44, Threads, FR-46).

Takes one original ContentItem and produces a tailored ContentVersion per
selected platform. Per-platform formatting rules are injected into the prompt;
TikTok / YouTube Shorts / LinkedIn are intentionally out of scope.
"""

from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from ..llm import invoke_structured
from ..schemas import ContentVersion, FormatRequest, FormatResponse, FormatResult

# Platform-specific ADAPTATION guidance (REQUIREMENTS.md §8). These describe HOW to
# re-present the SAME approved content — not what new content to invent. Each rule covers both
# WORDING (length, tone, phrasing) and LAYOUT (line breaks, spacing, rhythm), because the source
# baseline from the Content Generator is deliberately platform-neutral on both counts.
PLATFORM_RULES = {
    "facebook": (
        "Wording: caption may be somewhat longer and more descriptive; shareable framing; keep a "
        "clear, explicit CTA. "
        "Layout: airy line spacing — blank lines BETWEEN paragraphs, paragraphs may run a few "
        "sentences long. Reads like a short post, not a list of fragments. "
        "A few relevant hashtags are fine. media_format is typically 'image', 'video', or 'link post'."
    ),
    "instagram": (
        "Wording: emotive, concise, visual-first — the caption supports the image rather than "
        "carrying all the information. CTA phrased for IG (e.g. 'Lưu lại', 'Nhắn tin đặt hàng'). "
        "Layout: open and scannable — short paragraphs separated by blank lines, the hook on its "
        "own opening line. "
        "Use a richer set of relevant hashtags (they render after the caption — see the hashtag "
        "rule below). media_format is 'vertical video' or 'square image'."
    ),
    "threads": (
        "Wording: short, natural, conversational sentences with a fast rhythm that invites replies. "
        "CTA phrased as a light conversational nudge. "
        "Layout: tight — single line breaks, lines sitting close together, NO blank-line padding. "
        "If the message is genuinely too long for one post, it may be split into a short thread "
        "(separate the parts with a blank line). "
        "Few or NO hashtags. media_format is usually 'text' or a single 'image'."
    ),
}

SYSTEM_PROMPT = """You are the Platform Formatter for AIMA. You ADAPT one already-approved \
content item into platform-native versions — one version per requested platform. You RE-EXPRESS \
the same message in each platform's own voice and shape: same meaning, new words. This is NOT \
content invention — you never start from a blank page and never add ideas that are not in the \
source.

THE BOUNDARY — keep the MEANING, change the WORDING:
- KEEP: the core message, the product/offer and every concrete fact (names, numbers, prices, \
promos, dates, links) from the ORIGINAL CONTENT ITEM. Do NOT invent, add or drop facts, and do \
NOT introduce a new selling point or a new topic.
- KEEP: the CTA INTENT — what the reader is asked to DO. Output the `cta` field as the source CTA \
rewritten to suit the platform: it MUST be present and non-empty. Never leave the CTA blank and \
never change the action being requested (only how it is phrased).
- KEEP: the brand voice and the source LANGUAGE of the original content.
- CHANGE FREELY (this is the point of the task): the actual sentences — wording, length, tone, \
phrasing, sentence and paragraph structure, the hashtag set, and the LAYOUT (line breaks, blank \
lines, spacing, emoji, the order of blocks). The source is a deliberately platform-neutral \
baseline, so real rewriting is expected here — a version that is merely the original text with \
different line breaks has NOT been adapted.

Also:
- The caption carries NO hashtags and no '#' character — hashtags go in `formatted_hashtags` only \
(they are rendered after the caption).
- Use emoji at the density the platform's norms call for, never as filler.

Stay faithful and proportionate: rewrite as much as the platform genuinely calls for, but do not \
balloon a short caption into a long essay to fill space, and do not pad with hype adjectives."""

USER_PROMPT = """BRAND PROFILE (voice/context only — do NOT pull new facts from here):
{brand_profile}

ORIGINAL CONTENT ITEM (the single source of truth to adapt — caption, hashtags and CTA):
{content}

Produce exactly one ADAPTED version for EACH of these platforms: {platforms}
For each: adapt the caption, adapt the hashtags, rewrite the CTA to fit the platform (never empty),
and set media_format.

Per-platform presentation rules:
{rules}"""


def format_content(req: FormatRequest) -> FormatResult:
    """Generate one ContentVersion per requested platform (+ LLM token usage)."""
    rules_text = "\n".join(
        f"- {p}: {PLATFORM_RULES.get(p.lower(), 'Use sensible native defaults for this platform.')}"
        for p in req.platforms
    )

    # Structured output as a list wrapper so the model returns all versions at once.
    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("user", USER_PROMPT)]
    )
    result, usage = invoke_structured(
        FormatResponse,
        prompt,
        {
            "brand_profile": req.brand_profile.model_dump_json(indent=2),
            "content": req.content.model_dump_json(indent=2),
            "platforms": ", ".join(req.platforms),
            "rules": rules_text,
        },
    )

    # Guard: keep only requested platforms, dedupe, and ensure each is covered.
    wanted = {p.lower() for p in req.platforms}
    seen: set[str] = set()
    versions: list[ContentVersion] = []
    for v in result.versions:
        key = v.platform_name.lower()
        if key in wanted and key not in seen:
            versions.append(v)
            seen.add(key)
    return FormatResult(versions=versions, **usage.response_fields())
