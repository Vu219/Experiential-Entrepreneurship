"""AIMA AI service entry point.

Run (dev):   uv run uvicorn main:app --reload
Run (prod):  uv run python main.py
"""

from __future__ import annotations

import logging

from fastapi import FastAPI

from src.api.routes import router
from src.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app = FastAPI(
    title="AIMA AI Service",
    version="0.1.0",
    description="LangChain agents: trend research, content generation, platform formatting, optimization.",
)
app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(app, host=settings.ai_service_host, port=settings.ai_service_port)
