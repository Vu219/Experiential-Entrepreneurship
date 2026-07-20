"""AIMA AI service entry point.

Run (dev):   uv run uvicorn main:app --reload
Run (prod):  uv run uvicorn main:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

import logging
import secrets

from fastapi import FastAPI
from starlette.requests import Request
from starlette.responses import JSONResponse

from src.api.routes import INTERNAL_TOKEN_HEADER, router
from src.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app = FastAPI(
    title="AIMA AI Service",
    version="0.1.0",
    description="LangChain agents: trend research, content generation, platform formatting, optimization.",
)
app.include_router(router)

# Paths that stay public (no internal token) — only the liveness probe.
_PUBLIC_PATHS = {"/health"}


@app.middleware("http")
async def enforce_internal_token(request: Request, call_next):
    """Global fail-closed guard: every path except /health requires the shared
    ``X-Internal-Token`` header (== AI_INTERNAL_TOKEN) when a token is configured.

    - AI_INTERNAL_TOKEN set + header missing/wrong  -> 403 (outsiders can't call).
    - AI_INTERNAL_TOKEN unset (dev/local)           -> guard disabled, all requests pass.

    The backend attaches this header on every AI call via its aiServiceWebClient
    default header, so all server-to-server traffic keeps working transparently.
    """
    if request.url.path not in _PUBLIC_PATHS:
        expected = get_settings().ai_internal_token
        if expected:
            provided = request.headers.get(INTERNAL_TOKEN_HEADER)
            if provided is None or not secrets.compare_digest(provided, expected):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Missing or invalid internal token"},
                )
    return await call_next(request)


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(app, host=settings.ai_service_host, port=settings.ai_service_port)
