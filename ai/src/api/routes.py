"""FastAPI routes — one endpoint per AI capability.

The Spring Boot backend dispatches async jobs to these endpoints (architecture in
docs/Implementation_Strategy.md §1). The AI service is stateless; all persistence
(sessions, drafts, versions, insights) happens on the backend.

SECURITY (DB-managed LLM config):
- Requests carrying ``llm_config`` (API key inside) and ``/test-connection`` REQUIRE the
  internal token header ``X-Internal-Token`` (shared secret AI_INTERNAL_TOKEN with the
  backend). Token unset on this service => such requests are refused (fail-closed).
  Requests WITHOUT llm_config keep working as before (env-based, rollback path).
- Never log request bodies here: llm_config carries an API key (SecretStr masks repr,
  but the rule stands — log labels and exception types only).
"""

from __future__ import annotations

import logging
import secrets
import time
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from ..agents import (
    content_generator,
    content_regenerator,
    optimizer,
    platform_formatter,
    trend_research,
)
from ..config import get_settings
from ..llm import build_llm, use_llm_config
from ..schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    FormatRequest,
    FormatResult,
    GenerateRequest,
    GenerateResult,
    GoldenHourRequest,
    GoldenHourResponse,
    LlmConfig,
    LlmSpec,
    OptimizeRequest,
    OptimizeResponse,
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


def _require_internal_token(token: Optional[str]) -> None:
    """Reject unless the caller presents the shared internal token (fail-closed)."""
    expected = get_settings().ai_internal_token
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="AI_INTERNAL_TOKEN is not configured on the AI service; "
                   "requests carrying llm_config are refused.",
        )
    if token is None or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Invalid internal token")


def _apply_llm_config(config: Optional[LlmConfig], token: Optional[str]) -> None:
    """Requests carrying llm_config (API key inside) must be authenticated first."""
    if config is None:
        return
    _require_internal_token(token)
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
    x_internal_token: Optional[str] = Header(default=None, alias=INTERNAL_TOKEN_HEADER),
) -> ResearchResult:
    """FR-19..FR-23 — trend research for one session (+ tokens_used)."""
    _apply_llm_config(req.llm_config, x_internal_token)
    return _run("trend research", trend_research.research_trends, req)


@router.post("/generate", response_model=GenerateResult)
def generate(
    req: GenerateRequest,
    x_internal_token: Optional[str] = Header(default=None, alias=INTERNAL_TOKEN_HEADER),
) -> GenerateResult:
    """FR-24..FR-30, FR-32 — generate one content item (+ tokens_used)."""
    _apply_llm_config(req.llm_config, x_internal_token)
    return _run("content generation", content_generator.generate_content, req)


@router.post("/format", response_model=FormatResult)
def format_versions(
    req: FormatRequest,
    x_internal_token: Optional[str] = Header(default=None, alias=INTERNAL_TOKEN_HEADER),
) -> FormatResult:
    """FR-40, FR-42, FR-44, Threads, FR-46 — one version per platform (+ tokens_used)."""
    _apply_llm_config(req.llm_config, x_internal_token)
    return _run("platform formatting", platform_formatter.format_content, req)


@router.post("/regenerate-part", response_model=RegeneratePartResult)
def regenerate_part(
    req: RegeneratePartRequest,
    x_internal_token: Optional[str] = Header(default=None, alias=INTERNAL_TOKEN_HEADER),
) -> RegeneratePartResult:
    """Regenerate ONE part of a video script (hook/body/cta × content/scene) — FR-32."""
    _apply_llm_config(req.llm_config, x_internal_token)
    return _run("partial regeneration", content_regenerator.regenerate_part, req)


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    req: AnalyzeRequest,
    x_internal_token: Optional[str] = Header(default=None, alias=INTERNAL_TOKEN_HEADER),
) -> AnalyzeResponse:
    """FR-63, FR-64 — success factors + insights."""
    _apply_llm_config(req.llm_config, x_internal_token)
    return _run("performance analysis", optimizer.analyze_performance, req)


@router.post("/optimize", response_model=OptimizeResponse)
def optimize(
    req: OptimizeRequest,
    x_internal_token: Optional[str] = Header(default=None, alias=INTERNAL_TOKEN_HEADER),
) -> OptimizeResponse:
    """FR-65, FR-66 — strategy adjustment + future-post proposals."""
    _apply_llm_config(req.llm_config, x_internal_token)
    return _run("optimization", optimizer.propose_optimizations, req)


@router.post("/golden-hours", response_model=GoldenHourResponse)
def golden_hours(
    req: GoldenHourRequest,
    x_internal_token: Optional[str] = Header(default=None, alias=INTERNAL_TOKEN_HEADER),
) -> GoldenHourResponse:
    """FR-48 — golden-hour suggestions (defaults -> data-driven)."""
    _apply_llm_config(req.llm_config, x_internal_token)
    return _run("golden-hour suggestion", optimizer.suggest_golden_hours, req)


@router.post("/test-connection", response_model=TestConnectionResult)
def test_connection(
    req: TestConnectionRequest,
    x_internal_token: Optional[str] = Header(default=None, alias=INTERNAL_TOKEN_HEADER),
) -> TestConnectionResult:
    """Admin "Cấu hình AI": verify a provider API key with one minimal model call.

    A wrong/expired key is a RESULT (success=False + redacted message), not a 5xx.
    """
    _require_internal_token(x_internal_token)

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
