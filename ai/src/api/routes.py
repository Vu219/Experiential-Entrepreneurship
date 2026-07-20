"""FastAPI routes — one endpoint per AI capability.

The Spring Boot backend dispatches async jobs to these endpoints (architecture in
docs/Implementation_Strategy.md §1). The AI service is stateless; all persistence
(sessions, drafts, versions, insights) happens on the backend.

SECURITY:
- Every endpoint EXCEPT ``GET /health`` requires the internal token header
  ``X-Internal-Token`` (shared secret AI_INTERNAL_TOKEN with the backend). Enforcement is
  GLOBAL — see the ``enforce_internal_token`` middleware in ``main.py`` — so routes never
  check the token themselves (no double check). Token unset on this service (dev/local)
  => the guard is disabled and all requests pass.
- Never log request bodies here: llm_config carries an API key (SecretStr masks repr,
  but the rule stands — log labels and exception types only).
"""

from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import APIRouter, HTTPException

from ..agents import (
    content_generator,
    content_regenerator,
    optimizer,
    platform_formatter,
    trend_research,
)
from ..config import get_settings
from ..llm import build_llm, use_llm_config
from ..model_catalog import list_models
from ..schemas import (
    AnalyzeRequest,
    AnalyzeResult,
    FormatRequest,
    FormatResult,
    GenerateRequest,
    GenerateResult,
    GoldenHourRequest,
    GoldenHourResponse,
    ListModelsRequest,
    ListModelsResult,
    LlmConfig,
    LlmSpec,
    OptimizeRequest,
    OptimizeResult,
    RegeneratePartRequest,
    RegeneratePartResult,
    ResearchRequest,
    ResearchResult,
    TestConnectionRequest,
    TestConnectionResult,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Header name shared with the backend's aiServiceWebClient.
INTERNAL_TOKEN_HEADER = "X-Internal-Token"


def _apply_llm_config(config: Optional[LlmConfig]) -> None:
    """Route the request through the DB-managed LLM config. Authentication is enforced
    globally by the ``enforce_internal_token`` middleware (main.py) — not here."""
    if config is None:
        return
    use_llm_config(config)


def _run(label: str, fn, arg):
    """Invoke an agent, mapping config/LLM failures to clean HTTP errors."""
    try:
        return fn(arg)
    except ValueError as e:  # missing API key / bad config
        logger.error("%s config error: %s", label, e)
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # noqa: BLE001 — surface upstream LLM/parse failures
        logger.exception("%s failed", label)
        raise HTTPException(status_code=502, detail=f"{label} failed: {e}")


@router.get("/health")
def health() -> dict:
    s = get_settings()
    return {"status": "ok", "provider": s.llm_provider}


@router.post("/research", response_model=ResearchResult)
def research(
    req: ResearchRequest,
) -> ResearchResult:
    """FR-19..FR-23 — trend research for one session (+ tokens_used)."""
    _apply_llm_config(req.llm_config)
    return _run("trend research", trend_research.research_trends, req)


@router.post("/generate", response_model=GenerateResult)
def generate(
    req: GenerateRequest,
) -> GenerateResult:
    """FR-24..FR-30, FR-32 — generate one content item (+ tokens_used)."""
    _apply_llm_config(req.llm_config)
    return _run("content generation", content_generator.generate_content, req)


@router.post("/format", response_model=FormatResult)
def format_versions(
    req: FormatRequest,
) -> FormatResult:
    """FR-40, FR-42, FR-44, Threads, FR-46 — one version per platform (+ tokens_used)."""
    _apply_llm_config(req.llm_config)
    return _run("platform formatting", platform_formatter.format_content, req)


@router.post("/regenerate-part", response_model=RegeneratePartResult)
def regenerate_part(
    req: RegeneratePartRequest,
) -> RegeneratePartResult:
    """Regenerate ONE part of a video script (hook/body/cta × content/scene) — FR-32."""
    _apply_llm_config(req.llm_config)
    return _run("partial regeneration", content_regenerator.regenerate_part, req)


@router.post("/analyze", response_model=AnalyzeResult)
def analyze(
    req: AnalyzeRequest,
) -> AnalyzeResult:
    """FR-63, FR-64 — success factors + insights (+ tokens_used)."""
    _apply_llm_config(req.llm_config)
    return _run("performance analysis", optimizer.analyze_performance, req)


@router.post("/optimize", response_model=OptimizeResult)
def optimize(
    req: OptimizeRequest,
) -> OptimizeResult:
    """FR-65, FR-66 — strategy adjustment + future-post proposals (+ tokens_used)."""
    _apply_llm_config(req.llm_config)
    return _run("optimization", optimizer.propose_optimizations, req)


@router.post("/golden-hours", response_model=GoldenHourResponse)
def golden_hours(
    req: GoldenHourRequest,
) -> GoldenHourResponse:
    """FR-48 — golden-hour suggestions (defaults -> data-driven)."""
    _apply_llm_config(req.llm_config)
    return _run("golden-hour suggestion", optimizer.suggest_golden_hours, req)


@router.post("/test-connection", response_model=TestConnectionResult)
def test_connection(
    req: TestConnectionRequest,
) -> TestConnectionResult:
    """Admin "Cấu hình AI": verify a provider API key with one minimal model call.

    A wrong/expired key is a RESULT (success=False + redacted message), not a 5xx.
    """

    spec = LlmSpec(
        provider=req.provider,
        model=req.model,
        api_key=req.api_key,
        max_tokens=16,  # minimal probe — keep the test call as cheap as possible
    )
    start = time.perf_counter()
    try:
        build_llm(spec).invoke("ping")
        latency_ms = int((time.perf_counter() - start) * 1000)
        return TestConnectionResult(success=True, latency_ms=latency_ms)
    except Exception as e:  # noqa: BLE001 — every provider failure becomes a result
        latency_ms = int((time.perf_counter() - start) * 1000)
        logger.warning("test-connection %s/%s failed: %s", req.provider, req.model, type(e).__name__)
        return TestConnectionResult(
            success=False,
            message=_redact(str(e), req.api_key.get_secret_value()),
            latency_ms=latency_ms,
        )


def _redact(message: str, api_key: str) -> str:
    """Defence in depth: strip the key if a provider SDK ever echoes it, and truncate."""
    if api_key:
        message = message.replace(api_key, "••••")
    return message[:300]


@router.post("/list-models", response_model=ListModelsResult)
def list_provider_models(
    req: ListModelsRequest,
) -> ListModelsResult:
    """Admin "Cấu hình AI" model sync: fetch the provider's model catalog (id +
    display name + token limits — providers return NO pricing). Provider order is
    preserved (Anthropic: newest first)."""

    try:
        models = list_models(req.provider, req.api_key.get_secret_value())
        return ListModelsResult(models=models)
    except Exception as e:  # noqa: BLE001 — surface provider/HTTP failures as one clean 502
        logger.warning("list-models %s failed: %s", req.provider, type(e).__name__)
        raise HTTPException(
            status_code=502,
            detail=f"list-models failed: {_redact(str(e), req.api_key.get_secret_value())}",
        )
