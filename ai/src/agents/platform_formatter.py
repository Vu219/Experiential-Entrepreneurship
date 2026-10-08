"""Platform Formatter agent (FR-40, FR-42, FR-44, Threads, FR-46).

Takes one original ContentItem and produces a tailored ContentVersion per
selected platform. Per-platform formatting rules are injected into the prompt;
TikTok / YouTube Shorts / LinkedIn are intentionally out of scope.
"""

from __future__ import annotations

import re

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
        "It is published as ONE single post (never a thread): condense rather than split. "
        "Few or NO hashtags. media_format is usually 'text' or a single 'image'."
    ),
}

# Hard limits of what is actually published: caption + "\n\n" + "#a #b" (backend
# PlatformTextLimits / PlatformPublisher.buildMessage). (max characters, max hashtags or None).
PLATFORM_LIMITS: dict[str, tuple[int, int | None]] = {
    "facebook": (63206, None),
    "instagram": (2200, 30),
    "threads": (500, None),
}

# Spellings the LLM may echo back for a requested platform (compared lowercase, letters only).
PLATFORM_ALIASES = {
    "fb": "facebook",
    "facebookpage": "facebook",
    "ig": "instagram",
    "insta": "instagram",
    "thread": "threads",
}

# '#tag' starting a word, with at least one letter ("#1" is not a hashtag) — Unicode, so
# Vietnamese tags match. Same rule as backend PlatformTextLimits.HASHTAG.
_HASHTAG_RE = re.compile(r"(?<![\w#])#[\d_]*[^\W\d_]\w*")

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
{rules}

HARD LIMITS (count characters of caption + a blank line + the hashtags rendered as "#a #b"):
{limits}
Stay well inside them — anything over the limit is cut automatically."""


def format_content(req: FormatRequest) -> FormatResult:
    """Generate one ContentVersion per requested platform (+ LLM token usage)."""
    rules_text = "\n".join(
        f"- {p}: {PLATFORM_RULES.get(p.lower(), 'Use sensible native defaults for this platform.')}"
        for p in req.platforms
    )

    limits_text = "\n".join(
        f"- {p}: {_limit_text(p.lower())}" for p in req.platforms if p.lower() in PLATFORM_LIMITS
    ) or "- (none)"

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
            "limits": limits_text,
        },
    )

    # Guard: map each version back to a requested platform (the LLM may answer "fb" or
    # "Facebook Page"), dedupe, then enforce the hard limits on what will be published.
    seen: set[str] = set()
    versions: list[ContentVersion] = []
    for v in result.versions:
        requested = _match_platform(v.platform_name, req.platforms)
        if requested is None or requested.lower() in seen:
            continue
        v.platform_name = requested
        _clean_hashtags(v)
        _enforce_limits(v, requested.lower())
        versions.append(v)
        seen.add(requested.lower())
    return FormatResult(versions=versions, **usage.response_fields())


def _limit_text(key: str) -> str:
    max_chars, max_tags = PLATFORM_LIMITS[key]
    text = f"at most {max_chars} characters in total"
    if max_tags is not None:
        text += f", at most {max_tags} hashtags"
    return text


def _match_platform(name: str, requested: list[str]) -> str | None:
    """Requested platform (its original spelling) that ``name`` refers to, or None."""
    key = re.sub(r"[^a-z]", "", (name or "").lower())
    key = PLATFORM_ALIASES.get(key, key)
    for platform in requested:
        canonical = re.sub(r"[^a-z]", "", platform.lower())
        if key == canonical or (canonical and canonical in key):
            return platform
    return None


def _tag_key(tag: str) -> str:
    return tag.strip().lstrip("#").lower()


def _clean_hashtags(v: ContentVersion) -> None:
    """Move '#tag' tokens left in the caption into formatted_hashtags (buildMessage appends the
    hashtags after the caption, so leaving them in would publish them twice); dedupe tags."""
    found = _HASHTAG_RE.findall(v.formatted_caption)
    caption = _HASHTAG_RE.sub("", v.formatted_caption)
    caption = re.sub(r"[ \t]{2,}", " ", caption)
    caption = re.sub(r"[ \t]+(?=\n|$)", "", caption)
    v.formatted_caption = re.sub(r"\n{3,}", "\n\n", caption).strip()

    tags: list[str] = []
    keys: set[str] = set()
    for tag in [*v.formatted_hashtags, *found]:
        key = _tag_key(tag)
        if key and key not in keys:
            tags.append(tag.strip())
            keys.add(key)
    v.formatted_hashtags = tags


def _compose(caption: str, tags: list[str]) -> str:
    """Mirror of backend PlatformTextLimits.compose (caption + blank line + "#a #b")."""
    rendered = " ".join(t if t.startswith("#") else f"#{t}" for t in (t.strip() for t in tags) if t)
    caption = caption.strip()
    return f"{caption}\n\n{rendered}" if rendered else caption


def _enforce_limits(v: ContentVersion, key: str) -> None:
    """Fit the published message into the platform limits: drop hashtags first (from the end),
    then cut the caption at a word boundary."""
    if key not in PLATFORM_LIMITS:
        return
    max_chars, max_tags = PLATFORM_LIMITS[key]
    tags = v.formatted_hashtags[:max_tags] if max_tags is not None else list(v.formatted_hashtags)
    while tags and len(_compose(v.formatted_caption, tags)) > max_chars:
        tags.pop()
    v.formatted_hashtags = tags
    if len(_compose(v.formatted_caption, tags)) > max_chars:
        v.formatted_caption = _truncate(v.formatted_caption.strip(), max_chars)


def _truncate(text: str, max_chars: int) -> str:
    """Cut to at most ``max_chars`` (ellipsis included), at the last whitespace when possible."""
    budget = max_chars - 1  # room for the ellipsis
    cut = text[:budget]
    space = max(cut.rfind(" "), cut.rfind("\n"))
    if space > budget // 2:
        cut = cut[:space]
    return cut.rstrip(" \n\t,.;:-–—") + "…"
