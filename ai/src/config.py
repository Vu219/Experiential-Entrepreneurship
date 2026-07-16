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
