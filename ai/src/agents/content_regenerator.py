"""Partial script regenerator (tạo lại từng phần kịch bản).

Regenerates ONE part of an existing video script — the hook, the body steps, or the CTA,
and within that either the spoken content or the scene suggestion — WITHOUT touching the
other parts. Used by the per-section / per-scene / per-step "Tạo lại" buttons. Media is
never generated; scene suggestions are TEXT filming directions only (FR-29).
"""

from __future__ import annotations

from typing import List

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from ..llm import invoke_structured
from ..schemas import (
    RegeneratedSection,
    RegeneratedStep,
    RegeneratePartRequest,
    RegeneratePartResult,
)

SYSTEM_PROMPT = """You are the Content Regenerator for AIMA, an AI social-media content \
assistant. You improve short-form VIDEO SCRIPTS for small brands.

You are given the FULL current script for context and asked to regenerate ONLY ONE specific \
part. Rules:
- Regenerate ONLY the requested part. Do NOT rewrite or return any other part.
- Produce a meaningfully DIFFERENT, better take on that part — not a paraphrase (FR-32).
- Stay consistent with the rest of the script, the brand voice, and the target platform.
- Write in the audience's language (Vietnamese audiences => Vietnamese copy).
- content = the exact words/action ON CAMERA for that part (spoken/shown). For a hook or CTA, \
also give an appropriate `timing` range (e.g. hook "0-3s", cta "25-30s").
- scene_suggestion = a concrete FILMING direction for that part only (framing, b-roll, \
transition, on-screen text) — never the spoken words. You do NOT generate media (FR-29).
- Respect brand guardrails: weave in brand_keywords naturally, follow brand_dos, strictly \
avoid brand_donts."""

USER_PROMPT = """Target platform: {platform}

BRAND PROFILE:
{brand_profile}

CURRENT FULL SCRIPT (for context — do NOT rewrite parts you are not asked to):
{current_script}

TASK: {task}"""


class _BodyStepsOut(BaseModel):
    """Structured-output wrapper for regenerating one or more body steps."""

    steps: List[RegeneratedStep] = Field(default_factory=list)


def _prompt(req: RegeneratePartRequest, task: str, schema):
    """Returns (typed result, TokenUsage) — routed model with fallback + token accounting."""
    prompt = ChatPromptTemplate.from_messages([("system", SYSTEM_PROMPT), ("user", USER_PROMPT)])
    return invoke_structured(
        schema,
        prompt,
        {
            "platform": req.platform,
            "brand_profile": req.brand_profile.model_dump_json(indent=2),
            "current_script": req.current_script.model_dump_json(indent=2),
            "task": task,
        },
    )


def regenerate_part(req: RegeneratePartRequest) -> RegeneratePartResult:
    """Regenerate the requested part only and return just that fragment."""
    section = (req.section or "").lower()
    field = (req.field or "").lower()

    if section in ("hook", "cta"):
        label = "opening hook" if section == "hook" else "closing CTA"
        if field == "scene":
            task = (
                f"Regenerate ONLY the scene_suggestion (filming direction) of the {label}. "
                "Keep the spoken content unchanged; return only scene_suggestion."
            )
            out, usage = _prompt(req, task, RegeneratedSection)
            return RegeneratePartResult(
                section=RegeneratedSection(scene_suggestion=out.scene_suggestion or ""),
                **usage.response_fields(),
            )
        task = (
            f"Regenerate ONLY the {label}: its spoken content and an appropriate timing range. "
            "Do not change its scene suggestion; return content and timing only."
        )
        out, usage = _prompt(req, task, RegeneratedSection)
        return RegeneratePartResult(
            section=RegeneratedSection(content=out.content or "", timing=out.timing),
            **usage.response_fields(),
        )

    # section == "body"
    if req.step_index is not None:
        scope = f"ONLY body step index {req.step_index}"
        indices = f"exactly one step with index {req.step_index}"
    else:
        scope = "EVERY body step"
        indices = "one entry per existing step, keeping the same index for each"

    if field == "scene":
        task = (
            f"Regenerate the scene_suggestion (filming direction) of {scope}. Return {indices}; "
            "each entry must set index and scene_suggestion only (leave content null)."
        )
    else:
        task = (
            f"Regenerate the spoken content of {scope}. Return {indices}; "
            "each entry must set index and content only (leave scene_suggestion null)."
        )
    out, usage = _prompt(req, task, _BodyStepsOut)
    return RegeneratePartResult(steps=list(out.steps), **usage.response_fields())
