"""Configurable LLM factory — selects Claude or Gemini behind one interface.

Both providers are exposed through LangChain chat models, so the agents stay
provider-agnostic and can use ``.with_structured_output(PydanticModel)`` to get
typed results regardless of which backend is configured (LLM_PROVIDER env var).

Per-request DB config (AI_CONFIG_FROM_DB): routes stash the request's ``LlmConfig``
in a ContextVar via :func:`use_llm_config`; :func:`get_llm` and
:func:`invoke_structured` pick it up transparently, so agent code never changes.
No config in context => the env-based default (rollback path).

Retry/fallback is OWNED HERE, not by the provider SDKs: every model is built with SDK
retries off (google-genai ``attempts=1``, Anthropic ``max_retries=0``) and
:func:`invoke_structured` walks the model chain, deciding per classified error
(``errors.classify_error``) whether to retry once, skip to the next model or stop —
all inside ``LLM_CHAIN_BUDGET_SECONDS``.

SECURITY: API keys are ``SecretStr`` and must never be logged. Log model/provider
names and error KINDS only — never exception messages that could carry request
context, and never a payload/spec repr.
"""

from __future__ import annotations

import logging
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, List, Optional, TypeVar

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel

from . import errors
from .config import get_settings
from .schemas import LlmAttempt, LlmConfig, LlmSpec, TokenUsage

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Per-request LLM config. FastAPI/Starlette copies the context per request (also for
# sync endpoints in the threadpool), so a set() here never leaks across requests.
_current_llm_config: ContextVar[Optional[LlmConfig]] = ContextVar(
    "current_llm_config", default=None
)

# Chain policy (see errors.py for the kinds).
RETRY_BACKOFF_SECONDS = 1.0        # overloaded / network: one quick retry
MAX_RATE_LIMIT_WAIT_SECONDS = 5.0  # 429 with a longer retryDelay => next model now
OVERLOAD_COOLDOWN_SECONDS = 60     # circuit-breaker hint for 5xx
RATE_LIMIT_COOLDOWN_SECONDS = 60   # hint for 429 without retryDelay
MIN_CALL_SECONDS = 2.0             # don't start a call with less budget than this

# Final error codes of a failed chain (mirrored by backend ErrorCode).
AI_PROVIDER_OVERLOADED = "AI_PROVIDER_OVERLOADED"
AI_QUOTA_EXHAUSTED = "AI_QUOTA_EXHAUSTED"
AI_TIMEOUT = "AI_TIMEOUT"
AI_BAD_REQUEST = "AI_BAD_REQUEST"
AI_UNAVAILABLE = "AI_UNAVAILABLE"

_QUOTA_KINDS = {errors.DAILY_QUOTA_EXHAUSTED, errors.RATE_LIMITED}


class LlmChainError(Exception):
    """Every model of the chain failed (or the chain ran out of budget)."""

    def __init__(self, error_code: str, attempts: List[LlmAttempt]):
        super().__init__(error_code)
        self.error_code = error_code
        self.attempts = attempts


def use_llm_config(config: Optional[LlmConfig]) -> None:
    """Stash the request's LLM config for this request context (called by routes)."""
    _current_llm_config.set(config)


def build_llm(spec: LlmSpec, timeout: Optional[float] = None) -> BaseChatModel:
    """Build a chat model for one explicit spec (per-request; construction is cheap).

    SDK-level retries are disabled — the chain in :func:`invoke_structured` decides.
    Raises ValueError on an empty key. Never logs the key.
    """
    settings = get_settings()
    api_key = spec.api_key.get_secret_value()
    if not api_key:
        raise ValueError(f"llm_config for provider {spec.provider!r} has an empty api_key.")
    max_tokens = spec.max_tokens or settings.llm_max_tokens
    timeout = timeout or settings.llm_call_timeout_seconds

    if spec.provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        kwargs: dict[str, Any] = {}
        if spec.temperature is not None:
            kwargs["temperature"] = spec.temperature
        return ChatAnthropic(
            model=spec.model,
            api_key=api_key,
            max_tokens=max_tokens,
            timeout=timeout,
            max_retries=0,
            **kwargs,
        )

    if spec.provider == "google":
        kwargs = {}
        if spec.temperature is not None:
            kwargs["temperature"] = spec.temperature
        return _GeminiChat(
            model=spec.model,
            google_api_key=api_key,
            max_output_tokens=max_tokens,
            timeout=timeout,
            max_retries=1,  # google-genai HttpRetryOptions(attempts=1) = no SDK retry
            **kwargs,
        )

    raise ValueError(f"Unknown llm_config provider: {spec.provider!r}")


class _GeminiChat(ChatGoogleGenerativeAI):
    """ChatGoogleGenerativeAI with Automatic Function Calling disabled.

    Agents never pass python callables as tools (structured output = json_schema), so
    AFC never loops — but it is on by default in google-genai; turn it off explicitly so
    a future tool binding can't silently multiply generateContent calls."""

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        kwargs.setdefault("automatic_function_calling", {"disable": True})
        return super()._generate(messages, stop=stop, run_manager=run_manager, **kwargs)


def _env_spec() -> LlmSpec:
    """Env-based default model as a spec (rollback path, AI_CONFIG_FROM_DB=false)."""
    settings = get_settings()

    if settings.llm_provider == "anthropic":
        if not settings.anthropic_api_key:
            raise ValueError(
                "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set."
            )
        return LlmSpec(provider="anthropic", model=settings.anthropic_model,
                       api_key=settings.anthropic_api_key)

    if settings.llm_provider == "google":
        if not settings.google_api_key:
            raise ValueError(
                "LLM_PROVIDER=google but GOOGLE_API_KEY is not set."
            )
        return LlmSpec(provider="google", model=settings.google_model,
                       api_key=settings.google_api_key)

    raise ValueError(f"Unknown LLM_PROVIDER: {settings.llm_provider!r}")


@lru_cache
def _env_llm() -> BaseChatModel:
    """Env-based default model (cached — env config is immutable for the process)."""
    spec = _env_spec()
    logger.info("Using %s model %s", spec.provider, spec.model)
    return build_llm(spec)


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
) -> tuple[T, TokenUsage]:
    """Run ``prompt`` through the model chain and return (typed result, token usage).

    Chain = per-request config (primary, fallback) or the env default alone. Per model:
    - bad_request            → stop (the request itself is wrong; no fallback)
    - invalid_key            → skip every remaining model of that provider
    - daily_quota_exhausted  → next model (cooldown hint until the Pacific-midnight reset)
    - rate_limited           → wait retryDelay once if ≤5s, else next model
    - provider_overloaded / network_error → one retry after ~1s, then next model
    - invalid_response       → next model
    The whole chain is bounded by LLM_CHAIN_BUDGET_SECONDS. Raises :class:`LlmChainError`
    when no model succeeds; the attempt trace is returned in ``TokenUsage.attempts``.
    """
    config = _current_llm_config.get()
    chain = config.chain() if config is not None else [_env_spec()]
    settings = get_settings()
    request_id = uuid.uuid4().hex[:8]
    started = time.monotonic()
    deadline = started + settings.llm_chain_budget_seconds
    attempts: List[LlmAttempt] = []
    dead_providers: set[str] = set()

    for i, spec in enumerate(chain):
        if spec.provider in dead_providers:
            continue
        retried = False
        while True:
            remaining = deadline - time.monotonic()
            if remaining < MIN_CALL_SECONDS:
                _log_step(request_id, spec, "budget_exhausted", None, started)
                raise LlmChainError(AI_TIMEOUT, attempts)

            t0 = time.monotonic()
            try:
                llm = build_llm(spec, timeout=min(settings.llm_call_timeout_seconds, remaining))
            except ValueError:  # empty key in this spec — unusable provider, not a model failure
                info = errors.ErrorInfo(errors.INVALID_KEY)
                attempts.append(_attempt(spec, info, t0))
                dead_providers.add(spec.provider)
                _log_step(request_id, spec, info.kind, "fallback", started,
                          _next_spec(chain, i, dead_providers))
                break
            try:
                parsed, usage = _invoke_with(llm, schema, prompt, variables)
            except Exception as e:  # noqa: BLE001 — every failure is classified below
                info = errors.classify_error(e)
                attempts.append(_attempt(spec, info, t0))
                action = _next_action(info, retried, deadline)
                nxt = _next_spec(chain, i, dead_providers | (
                    {spec.provider} if info.kind == errors.INVALID_KEY else set()))
                _log_step(request_id, spec, info.kind, action, started,
                          nxt if action == "fallback" else None)
                if action == "stop":
                    raise LlmChainError(AI_BAD_REQUEST, attempts) from e
                if action == "retry":
                    time.sleep(info.retry_after if info.kind == errors.RATE_LIMITED
                               else RETRY_BACKOFF_SECONDS)
                    retried = True
                    continue
                if info.kind == errors.INVALID_KEY:
                    dead_providers.add(spec.provider)
                break  # fallback to the next model
            else:
                attempts.append(LlmAttempt(
                    provider=spec.provider, model=spec.model, outcome="ok",
                    latency_ms=_ms_since(t0)))
                _log_step(request_id, spec, "ok", None, started)
                usage.attempts = attempts
                return parsed, usage

    raise LlmChainError(_final_error_code(attempts), attempts)


def _next_action(info: errors.ErrorInfo, retried: bool, deadline: float) -> str:
    """"stop" | "retry" | "fallback" for one classified failure."""
    if info.kind == errors.BAD_REQUEST:
        return "stop"
    if retried:
        return "fallback"
    if info.kind in (errors.PROVIDER_OVERLOADED, errors.NETWORK_ERROR):
        wait = RETRY_BACKOFF_SECONDS
    elif info.kind == errors.RATE_LIMITED and info.retry_after is not None \
            and info.retry_after <= MAX_RATE_LIMIT_WAIT_SECONDS:
        wait = info.retry_after
    else:
        return "fallback"
    # Only retry when the wait + a real call still fit in the budget.
    return "retry" if deadline - time.monotonic() > wait + MIN_CALL_SECONDS else "fallback"


def _attempt(spec: LlmSpec, info: errors.ErrorInfo, t0: float) -> LlmAttempt:
    return LlmAttempt(
        provider=spec.provider,
        model=spec.model,
        outcome=info.kind,
        http_status=info.http_status,
        retry_after_seconds=info.retry_after,
        cooldown_until=_cooldown_until(info),
        free_tier=info.free_tier,
        latency_ms=_ms_since(t0),
    )


def _cooldown_until(info: errors.ErrorInfo) -> Optional[datetime]:
    """How long the backend should skip this model (circuit breaker hint)."""
    now = datetime.now(timezone.utc)
    if info.kind == errors.DAILY_QUOTA_EXHAUSTED:
        return errors.next_quota_reset(now)
    if info.kind == errors.RATE_LIMITED:
        return now + timedelta(seconds=info.retry_after or RATE_LIMIT_COOLDOWN_SECONDS)
    if info.kind == errors.PROVIDER_OVERLOADED:
        return now + timedelta(seconds=OVERLOAD_COOLDOWN_SECONDS)
    return None


def _final_error_code(attempts: List[LlmAttempt]) -> str:
    """Summarize a fully failed chain by the LAST outcome of each model."""
    kinds = set({(a.provider, a.model): a.outcome for a in attempts}.values())
    if errors.PROVIDER_OVERLOADED in kinds:
        return AI_PROVIDER_OVERLOADED  # may recover in minutes — the friendlier message
    if kinds & _QUOTA_KINDS:
        return AI_QUOTA_EXHAUSTED
    if kinds and kinds <= {errors.NETWORK_ERROR}:
        return AI_TIMEOUT
    return AI_UNAVAILABLE


def _next_spec(chain: List[LlmSpec], i: int, dead: set[str]) -> Optional[LlmSpec]:
    return next((s for s in chain[i + 1:] if s.provider not in dead), None)


def _log_step(request_id: str, spec: LlmSpec, outcome: str, action: Optional[str],
              started: float, nxt: Optional[LlmSpec] = None) -> None:
    """One short line per step — never the provider's error body."""
    arrow = f" -> {nxt.provider}/{nxt.model}" if nxt else (" -> (end of chain)" if action == "fallback" else "")
    level = logging.INFO if outcome == "ok" else logging.WARNING
    logger.log(level, "llm[%s] %s/%s %s%s%s %dms", request_id, spec.provider, spec.model, outcome,
               f" {action}" if action else "", arrow, _ms_since(started))


def _ms_since(t0: float) -> int:
    return int((time.monotonic() - t0) * 1000)


def _invoke_with(
    llm: BaseChatModel,
    schema: type[T],
    prompt: ChatPromptTemplate,
    variables: dict[str, Any],
) -> tuple[T, TokenUsage]:
    """Uses ``include_raw=True`` so the raw message stays reachable for token accounting;
    providers that report no usage metadata yield all-zero usage."""
    chain = prompt | llm.with_structured_output(schema, include_raw=True)
    out = chain.invoke(variables)

    parsed = out["parsed"]
    if parsed is None:
        raise ValueError(
            f"Model returned no valid {schema.__name__}: {out.get('parsing_error')}"
        )

    usage = getattr(out["raw"], "usage_metadata", None) or {}
    input_details = usage.get("input_token_details") or {}
    return parsed, TokenUsage(
        total_tokens=usage.get("total_tokens", 0),
        input_tokens=usage.get("input_tokens", 0),
        output_tokens=usage.get("output_tokens", 0),
        cached_tokens=input_details.get("cache_read", 0),
    )
