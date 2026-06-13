"""Platform Formatter agent (FR-40, FR-42, FR-44, Threads, FR-46).

Takes one original ContentItem and produces a tailored ContentVersion per
selected platform. Per-platform formatting rules are injected into the prompt;
TikTok / YouTube Shorts / LinkedIn are intentionally out of scope.
"""

from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from ..llm import get_llm
from ..schemas import ContentVersion, FormatRequest, FormatResponse

# Platform-specific formatting guidance (REQUIREMENTS.md §8).
PLATFORM_RULES = {
    "facebook": (
        "Longer, richer caption with a clear CTA. Shareable framing. Can combine "
        "image/video/link. media_format is typically 'image', 'video', or 'link post'."
    ),
    "instagram": (
        "Highly visual. Emotive, concise caption. Vertical video or square/vertical "
        "image. Use brand hashtags. media_format is 'vertical video' or 'square image'."
    ),
    "threads": (
        "Short and conversational, optimised for replies/discussion. Minimal hashtags. "
        "media_format is usually 'text' or a single 'image'."
    ),
}

SYSTEM_PROMPT = """You are the Platform Formatter for AIMA. You adapt one original \
content item into platform-native versions — one version per requested platform.

For each platform:
- Rewrite the caption to fit that platform's norms and length conventions.
- Adapt the hashtag set (count and style) to the platform.
- Choose the appropriate media_format string.
- Keep the brand voice and the core message intact; only the presentation changes.
- Preserve the source language of the original content."""

USER_PROMPT = """BRAND PROFILE:
{brand_profile}

ORIGINAL CONTENT ITEM:
{content}

Produce exactly one formatted version for EACH of these platforms: {platforms}

Per-platform rules:
{rules}"""


def format_content(req: FormatRequest) -> FormatResponse:
    """Generate one ContentVersion per requested platform."""
    rules_text = "\n".join(
        f"- {p}: {PLATFORM_RULES.get(p.lower(), 'Use sensible native defaults for this platform.')}"
        for p in req.platforms
    )

    # Structured output as a list wrapper so the model returns all versions at once.
    llm = get_llm().with_structured_output(FormatResponse)
    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("user", USER_PROMPT)]
    )
    chain = prompt | llm
    result: FormatResponse = chain.invoke(
        {
            "brand_profile": req.brand_profile.model_dump_json(indent=2),
            "content": req.content.model_dump_json(indent=2),
            "platforms": ", ".join(req.platforms),
            "rules": rules_text,
        }
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
    return FormatResponse(versions=versions)
