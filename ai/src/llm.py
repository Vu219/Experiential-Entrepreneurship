"""Configurable LLM factory — selects Claude or Gemini behind one interface.

Both providers are exposed through LangChain chat models, so the agents stay
provider-agnostic and can use ``.with_structured_output(PydanticModel)`` to get
typed results regardless of which backend is configured (LLM_PROVIDER env var).

Per-request DB config (AI_CONFIG_FROM_DB): routes stash the request's ``LlmConfig``
in a ContextVar via :func:`use_llm_config`; :func:`get_llm` and
:func:`invoke_structured` pick it up transparently, so agent code never changes.
No config in context => the cached env-based default (rollback path).

SECURITY: API keys are ``SecretStr`` and must never be logged. Log model/provider
names and exception TYPES only — never exception messages that could carry request
context, and never a payload/spec repr.
"""

from __future__ import annotations

import logging
from contextvars import ContextVar
from functools import lru_cache
from typing import Any, Optional, TypeVar

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from .config import get_settings
from .schemas import LlmConfig, LlmSpec

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Per-request LLM config. FastAPI/Starlette copies the context per request (also for
# sync endpoints in the threadpool), so a set() here never leaks across requests.
_current_llm_config: ContextVar[Optional[LlmConfig]] = ContextVar(
    "current_llm_config", default=None
)


def use_llm_config(config: Optional[LlmConfig]) -> None:
    """Stash the request's LLM config for this request context (called by routes)."""
    _current_llm_config.set(config)


def build_llm(spec: LlmSpec) -> BaseChatModel:
    """Build a chat model for one explicit spec (per-request; construction is cheap).

    Raises ValueError on an empty key. Never logs the key.
    """
    settings = get_settings()
    api_key = spec.api_key.get_secret_value()
    if not api_key:
        raise ValueError(f"llm_config for provider {spec.provider!r} has an empty api_key.")
    max_tokens = spec.max_tokens or settings.llm_max_tokens

    if spec.provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        kwargs: dict[str, Any] = {}
        if spec.temperature is not None:
            kwargs["temperature"] = spec.temperature
        return ChatAnthropic(
            model=spec.model,
            api_key=api_key,
            max_tokens=max_tokens,
            timeout=120,
            **kwargs,
        )

    if spec.provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        kwargs = {}
        if spec.temperature is not None:
            kwargs["temperature"] = spec.temperature
        return ChatGoogleGenerativeAI(
            model=spec.model,
            google_api_key=api_key,
            max_output_tokens=max_tokens,
            **kwargs,
        )

    raise ValueError(f"Unknown llm_config provider: {spec.provider!r}")


@lru_cache
def _env_llm() -> BaseChatModel:
    """Env-based default model (cached — env config is immutable for the process)."""
    settings = get_settings()

    if settings.llm_provider == "anthropic":
        if not settings.anthropic_api_key:
            raise ValueError(
                "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set."
            )
        from langchain_anthropic import ChatAnthropic

        logger.info("Using Anthropic model %s", settings.anthropic_model)
        return ChatAnthropic(
            model=settings.anthropic_model,
            api_key=settings.anthropic_api_key,
            max_tokens=settings.llm_max_tokens,
            timeout=120,
        )

    if settings.llm_provider == "google":
        if not settings.google_api_key:
            raise ValueError(
                "LLM_PROVIDER=google but GOOGLE_API_KEY is not set."
            )
        from langchain_google_genai import ChatGoogleGenerativeAI

        logger.info("Using Google model %s", settings.google_model)
        return ChatGoogleGenerativeAI(
            model=settings.google_model,
            google_api_key=settings.google_api_key,
            max_output_tokens=settings.llm_max_tokens,
        )

    raise ValueError(f"Unknown LLM_PROVIDER: {settings.llm_provider!r}")


def get_llm() -> BaseChatModel:
    """Chat model for the current request: per-request primary spec if one was
    injected (agents calling this directly get routing but no fallback), else the
    cached env default."""
    config = _current_llm_config.get()
    if config is not None:
        return build_llm(config.primary)
    return _env_llm()


def invoke_structured(
    schema: type[T], prompt: ChatPromptTemplate, variables: dict[str, Any]
) -> tuple[T, int]:
    """Run ``prompt`` through the routed model and return (typed result, tokens used).

    With a per-request config: try the primary spec; on failure retry ONCE with the
    fallback spec (if any). Without config: env default, previous behavior.
    """
    config = _current_llm_config.get()
    if config is None:
        return _invoke_with(_env_llm(), schema, prompt, variables)

    try:
        return _invoke_with(build_llm(config.primary), schema, prompt, variables)
    except Exception as e:  # noqa: BLE001 — any provider failure triggers the fallback
        if config.fallback is None:
            raise
        # Log types/models only — never str(e), which may embed request context.
        logger.warning(
            "Primary model %s/%s failed (%s) — retrying with fallback %s/%s",
            config.primary.provider,
            config.primary.model,
            type(e).__name__,
            config.fallback.provider,
            config.fallback.model,
        )
        return _invoke_with(build_llm(config.fallback), schema, prompt, variables)


def _invoke_with(
    llm: BaseChatModel,
    schema: type[T],
    prompt: ChatPromptTemplate,
    variables: dict[str, Any],
) -> tuple[T, int]:
    """Uses ``include_raw=True`` so the raw message stays reachable for token accounting;
    providers that report no usage metadata yield 0."""
    chain = prompt | llm.with_structured_output(schema, include_raw=True)
    out = chain.invoke(variables)

    parsed = out["parsed"]
    if parsed is None:
        raise ValueError(
            f"Model returned no valid {schema.__name__}: {out.get('parsing_error')}"
        )

    usage = getattr(out["raw"], "usage_metadata", None) or {}
    return parsed, usage.get("total_tokens", 0)
