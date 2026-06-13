"""FastAPI routes — one endpoint per AI capability.

The Spring Boot backend dispatches async jobs to these endpoints (architecture in
docs/Implementation_Strategy.md §1). The AI service is stateless; all persistence
(sessions, drafts, versions, insights) happens on the backend.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from ..agents import content_generator, optimizer, platform_formatter, trend_research
from ..config import get_settings
from ..schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ContentItem,
    FormatRequest,
    FormatResponse,
    GenerateRequest,
    GoldenHourRequest,
    GoldenHourResponse,
    OptimizeRequest,
    OptimizeResponse,
    ResearchRequest,
    ResearchResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


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


@router.post("/research", response_model=ResearchResponse)
def research(req: ResearchRequest) -> ResearchResponse:
    """FR-19..FR-23 — trend research for one session."""
    return _run("trend research", trend_research.research_trends, req)


@router.post("/generate", response_model=ContentItem)
def generate(req: GenerateRequest) -> ContentItem:
    """FR-24..FR-30, FR-32 — generate one content item."""
    return _run("content generation", content_generator.generate_content, req)


@router.post("/format", response_model=FormatResponse)
def format_versions(req: FormatRequest) -> FormatResponse:
    """FR-40, FR-42, FR-44, Threads, FR-46 — one version per platform."""
    return _run("platform formatting", platform_formatter.format_content, req)


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """FR-63, FR-64 — success factors + insights."""
    return _run("performance analysis", optimizer.analyze_performance, req)


@router.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest) -> OptimizeResponse:
    """FR-65, FR-66 — strategy adjustment + future-post proposals."""
    return _run("optimization", optimizer.propose_optimizations, req)


@router.post("/golden-hours", response_model=GoldenHourResponse)
def golden_hours(req: GoldenHourRequest) -> GoldenHourResponse:
    """FR-48 — golden-hour suggestions (defaults -> data-driven)."""
    return _run("golden-hour suggestion", optimizer.suggest_golden_hours, req)
