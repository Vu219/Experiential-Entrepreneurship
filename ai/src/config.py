"""Runtime configuration loaded from environment variables (.env)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """AI service settings. Values come from the environment / .env file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # LLM provider selection
    llm_provider: Literal["anthropic", "google"] = "anthropic"
    llm_max_tokens: int = 16000
    # Fallback chain (llm.invoke_structured): per-HTTP-call timeout and the total budget
    # of the whole chain. Keep the budget < backend AI_SERVICE_TIMEOUT_SECONDS.
    llm_call_timeout_seconds: float = 40
    llm_chain_budget_seconds: float = 80

    # Trend research — web-grounded search step (llm.invoke_grounded). A search turn makes
    # several round-trips, so it has its own limits; search budget + llm_chain_budget must
    # stay < backend AI_RESEARCH_TIMEOUT_SECONDS (200). max_uses caps Claude web searches
    # per session (each search is billed by Anthropic on top of tokens).
    trend_search_call_timeout_seconds: float = 75
    trend_search_budget_seconds: float = 90
    trend_search_max_uses: int = 5
    # ISO 3166 region for Google Trends / platform search when the request has none.
    trends_default_region: str = "VN"

    # Anthropic (Claude)
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-6"

    # Google (Gemini)
    google_api_key: str | None = None
    google_model: str = "gemini-2.5-pro"

    # Service
    ai_service_host: str = "0.0.0.0"
    ai_service_port: int = 8000

    # Shared secret with the Spring backend (header X-Internal-Token). Requests carrying
    # llm_config (API key inside) and /test-connection are REJECTED unless it matches.
    # Unset => those requests are refused (fail-closed); env-based requests still work.
    ai_internal_token: str | None = None


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
