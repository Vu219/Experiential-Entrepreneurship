"""Policy assistant (failed-posts round 2).

Two small, token-cheap calls — both go through ``invoke_structured`` (routing, fallback chain,
token accounting) and NEVER see the platform's raw error message, only normalized reasons:

- ``fix_post``     — rewrite ONE platform version that was rejected (or flagged) so it is likely to
                     pass the platform policy, keeping the brand voice and the post's intent. Only
                     runs when the user clicks "AI sửa nội dung"; the user reviews a diff and applies it.
- ``check_policy`` — tier-2 review of a post BEFORE publishing; the backend only calls it when its
                     free rule/keyword filter (tier 1) already found something suspicious.

Media is never generated (FR-29) and nothing is stored here (stateless).
"""

from __future__ import annotations

import re
from typing import List

from langchain_core.prompts import ChatPromptTemplate

from ..llm import invoke_structured
from ..schemas import (
    PolicyAssessment,
    PolicyCheckRequest,
    PolicyCheckResult,
    PolicyFixRequest,
    PolicyFixResult,
    PolicyFixSuggestion,
    RuleHit,
)

# Normalized reason per AIMA error code (backend enum PublishErrorCode) — the ONLY description of the
# rejection the model gets. Keep in sync with the AI-fixable codes (PublishErrorCode.isAiFixable).
ERROR_REASONS = {
    "POLICY_VIOLATION": "The platform rejected the post for breaking its Community Standards or advertising "
    "policies (typical causes: exaggerated or absolute claims, guaranteed results, unverified health or "
    "financial promises, refund guarantees, misleading discounts).",
    "CONTENT_TOO_LONG": "The published text (caption + hashtags) exceeds the platform limit.",
    "CONTENT_DUPLICATE": "The platform rejected it as a duplicate of a recently published post — the wording "
    "must be meaningfully different while keeping the same message.",
    "CONTENT_INVALID": "The platform rejected the text as invalid (e.g. a link that cannot be fetched, "
    "unsupported characters or broken formatting).",
}

# What each backend rule group (policy-check-rules.json) means — keeps the prompt short and precise.
RULE_HINTS = {
    "REFUND_GUARANTEE": "promises of refunds / money-back guarantees",
    "HEALTH_CLAIM": "medical or health claims (cures, treats, prevents disease, guaranteed body results)",
    "EXAGGERATED_DISCOUNT": "exaggerated or misleading discounts / prices",
    "ABSOLUTE_CLAIM": "absolute or superlative claims (100%, best, number one, guaranteed)",
    "FINANCIAL_PROMISE": "promises of income, profit or financial gain",
    "BEFORE_AFTER": "before/after or personal-attribute statements",
    "ENGAGEMENT_BAIT": "engagement bait (asking for likes/shares/tags to win)",
}

# Published-text limits (same numbers as backend util/PlatformTextLimits and platform_formatter).
LIMITS = {
    "facebook": "Facebook allows long posts; keep it concise.",
    "instagram": "Instagram: caption + hashtags at most 2200 characters, at most 30 hashtags.",
    "threads": "Threads: caption + hashtags at most 500 characters in total.",
}
_MAX_IG_HASHTAGS = 30

FIX_SYSTEM = """You are the Policy Fixer of AIMA, a social-media assistant for small brands.
Rewrite the given post so it is very likely to pass the platform's policies while keeping its intent,
offer facts (product, price, dates) and the brand voice. Rules:
- Remove or soften every problematic claim listed in the problems; never add new claims, prices or promises.
- No absolute/guaranteed results, no medical/health cure claims, no refund guarantees, no exaggerated discounts.
- Write in the SAME language as the original caption. Keep a similar length and structure.
- `caption` must not contain hashtags; return hashtags separately without '#', keep the useful ones.
- `changes`: 1-5 short bullet points in the caption's language explaining what you changed.
- Respect brand guardrails: follow brand_dos, strictly avoid brand_donts."""

FIX_USER = """Platform: {platform}
Platform limits: {limits}

BRAND:
{brand}

WHY IT NEEDS FIXING:
{problems}

ORIGINAL CAPTION:
{caption}

ORIGINAL HASHTAGS: {hashtags}"""

CHECK_SYSTEM = """You are the Policy Reviewer of AIMA. A free keyword filter flagged possible policy problems in a
social-media post. Judge whether the post is likely to be rejected or restricted by the platform's
Community Standards / advertising policies. Be precise and do not over-flag: a flagged keyword used in a
harmless way is NOT a problem. For each real issue, quote the exact excerpt, explain the risk briefly
and suggest a compliant rephrasing. Write `summary`, `reason` and `suggestion` in the SAME language as the
post. risk_level: none (no real issue) / low / medium / high (likely rejection)."""

CHECK_USER = """Platform: {platform}

FLAGGED BY THE KEYWORD FILTER:
{flags}

POST:
{content}"""


def _platform_key(platform: str) -> str:
    return (platform or "").strip().lower()


def _flags(hits: List[RuleHit]) -> str:
    if not hits:
        return "- (none)"
    lines = []
    for hit in hits[:20]:
        hint = RULE_HINTS.get(hit.category.upper(), hit.category)
        excerpt = f' — "{hit.excerpt}"' if hit.excerpt else ""
        lines.append(f"- {hint} [{hit.severity}]{excerpt}")
    return "\n".join(lines)


def _clean_hashtags(tags: List[str], platform: str) -> List[str]:
    """'#' stripped, spaces removed, duplicates dropped (case-insensitive), Instagram capped at 30."""
    seen: set[str] = set()
    out: List[str] = []
    for tag in tags:
        value = re.sub(r"\s+", "", (tag or "").lstrip("#"))
        if value and value.lower() not in seen:
            seen.add(value.lower())
            out.append(value)
    if _platform_key(platform) == "instagram":
        out = out[:_MAX_IG_HASHTAGS]
    return out


def fix_post(req: PolicyFixRequest) -> PolicyFixResult:
    """Rewrite one rejected/flagged platform version. Returns the suggestion only — never applies it."""
    problems = []
    if req.error_code:
        problems.append("- " + ERROR_REASONS.get(req.error_code.upper(),
                                                 "The platform rejected the post because of its content."))
    if req.rule_hits:
        problems.append(_flags(req.rule_hits))
    prompt = ChatPromptTemplate.from_messages([("system", FIX_SYSTEM), ("user", FIX_USER)])
    out, usage = invoke_structured(
        PolicyFixSuggestion,
        prompt,
        {
            "platform": req.platform,
            "limits": LIMITS.get(_platform_key(req.platform), ""),
            "brand": req.brand_profile.model_dump_json(indent=2) if req.brand_profile else "(not provided)",
            "problems": "\n".join(problems) or "- The post may break the platform's policies.",
            "caption": req.caption,
            "hashtags": ", ".join(req.hashtags) or "(none)",
        },
    )
    # A caption that still carries trailing hashtags would publish them twice (backend appends hashtags).
    caption = re.sub(r"(\s+#[^\s#]+)+\s*$", "", (out.caption or "").strip())
    return PolicyFixResult(
        caption=caption,
        hashtags=_clean_hashtags(out.hashtags, req.platform),
        changes=[c.strip() for c in out.changes if c and c.strip()][:5],
        **usage.response_fields(),
    )


def check_policy(req: PolicyCheckRequest) -> PolicyCheckResult:
    """Tier-2 policy review (warning only — the backend never blocks publishing on it)."""
    content = req.caption.strip()
    if req.hashtags:
        content += "\n\n" + " ".join("#" + t.lstrip("#") for t in req.hashtags)
    prompt = ChatPromptTemplate.from_messages([("system", CHECK_SYSTEM), ("user", CHECK_USER)])
    out, usage = invoke_structured(
        PolicyAssessment,
        prompt,
        {"platform": req.platform, "flags": _flags(req.rule_hits), "content": content},
    )
    issues = list(out.issues)[:10]
    risk = out.risk_level
    if risk != "none" and not issues:
        risk = "low"  # a risk without a single concrete issue is not actionable — downgrade
    return PolicyCheckResult(risk_level=risk, summary=out.summary, issues=issues, **usage.response_fields())
