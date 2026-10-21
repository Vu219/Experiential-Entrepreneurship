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

import asyncio
import json
import logging
import time
import uuid
import re
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, AsyncIterator, Callable, List, Optional, TypeVar

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel

from . import errors
from .config import get_settings
from .schemas import LlmAttempt, LlmConfig, LlmSpec, TokenUsage

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)
R = TypeVar("R")

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
MODEL_NOT_FOUND_COOLDOWN_SECONDS = 6 * 3600  # 404: config error — bench until an admin fixes routing
MIN_CALL_SECONDS = 2.0             # don't start a call with less budget than this
MAX_BAD_REQUEST_FALLBACKS = 1      # 400 → at most one other model, then AI_BAD_REQUEST

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

    # Streaming path (/generate/stream) — same AFC guard as _generate.
    def _stream(self, messages, stop=None, run_manager=None, **kwargs):
        kwargs.setdefault("automatic_function_calling", {"disable": True})
        yield from super()._stream(messages, stop=stop, run_manager=run_manager, **kwargs)

    async def _astream(self, messages, stop=None, run_manager=None, **kwargs):
        kwargs.setdefault("automatic_function_calling", {"disable": True})
        async for chunk in super()._astream(messages, stop=stop, run_manager=run_manager, **kwargs):
            yield chunk


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
    - bad_request            → next model ONCE; a second 400 stops (AI_BAD_REQUEST)
    - invalid_key            → skip every remaining model of that provider
    - model_not_found (404)  → next model at once, no retry (config error, logged at ERROR)
    - daily_quota_exhausted  → next model (cooldown hint until the Pacific-midnight reset)
    - rate_limited           → wait retryDelay once if ≤5s, else next model
    - provider_overloaded / network_error → one retry after ~1s, then next model
    - invalid_response       → next model
    The whole chain is bounded by LLM_CHAIN_BUDGET_SECONDS. Raises :class:`LlmChainError`
    when no model succeeds; the attempt trace is returned in ``TokenUsage.attempts``.
    """
    settings = get_settings()
    return _run_chain(
        lambda spec, timeout: _invoke_with(build_llm(spec, timeout=timeout), schema, prompt, variables),
        budget_seconds=settings.llm_chain_budget_seconds,
        call_timeout_seconds=settings.llm_call_timeout_seconds,
    )


PROBE_MAX_TOKENS = 16           # enough for any model to answer "ping" — tokens are negligible
PROBE_TIMEOUT_SECONDS = 20.0


def probe_models(specs: List[LlmSpec]) -> List[LlmAttempt]:
    """One MINIMAL real generation per model (in parallel) → one :class:`LlmAttempt` each.

    Listing models is not enough: Google keeps gated models (e.g. gemini-2.5-*) in ListModels
    while generateContent answers 404 — only a real call proves the model is usable. Failures
    are classified like the chain (404 → ``model_not_found`` with its cooldown hint), so the
    backend can feed the result straight into its circuit breaker."""
    from concurrent.futures import ThreadPoolExecutor

    def one(spec: LlmSpec) -> LlmAttempt:
        t0 = time.monotonic()
        try:
            probe_spec = spec.model_copy(update={"max_tokens": PROBE_MAX_TOKENS, "temperature": None})
            build_llm(probe_spec, timeout=PROBE_TIMEOUT_SECONDS).invoke("ping")
        except Exception as e:  # noqa: BLE001 — every failure is classified, never raised
            info = errors.classify_error(e)
            attempt = _attempt(spec, info, t0)
        else:
            attempt = LlmAttempt(provider=spec.provider, model=spec.model, outcome="ok",
                                 latency_ms=_ms_since(t0))
        level = (logging.INFO if attempt.outcome == "ok"
                 else logging.ERROR if attempt.outcome == errors.MODEL_NOT_FOUND else logging.WARNING)
        logger.log(level, "probe %s/%s %s %dms", spec.provider, spec.model, attempt.outcome, attempt.latency_ms)
        return attempt

    if not specs:
        return []
    with ThreadPoolExecutor(max_workers=min(8, len(specs))) as pool:
        return list(pool.map(one, specs))


@dataclass
class GroundedResult:
    """Free-text answer of a web-grounded call + the web sources the provider actually used."""

    text: str
    sources: List[dict] = field(default_factory=list)  # [{"title", "url"}], deduped by url
    searches: int = 0                                  # web searches the provider ran


def invoke_grounded(system: str, prompt: str) -> tuple[GroundedResult, TokenUsage]:
    """Run ``prompt`` with the provider's NATIVE web search, through the same model chain.

    Anthropic → server tool ``web_search`` (results + citations come back in the message);
    Google → ``google_search`` grounding (sources in ``grounding_metadata``). Both run on
    the provider's side, so the SOURCES are real pages, never invented by the model.
    Same retry/fallback policy as :func:`invoke_structured`, with its own (longer) budget
    TREND_SEARCH_BUDGET_SECONDS since a search turn takes several round-trips.
    """
    settings = get_settings()
    return _run_chain(
        lambda spec, timeout: _ground_with(spec, timeout, system, prompt),
        budget_seconds=settings.trend_search_budget_seconds,
        call_timeout_seconds=settings.trend_search_call_timeout_seconds,
    )


def _run_chain(
    call: Callable[[LlmSpec, float], tuple[R, TokenUsage]],
    budget_seconds: float,
    call_timeout_seconds: float,
) -> tuple[R, TokenUsage]:
    """Walk the model chain with ``call(spec, timeout)`` — policy in :func:`invoke_structured`."""
    config = _current_llm_config.get()
    chain = config.chain() if config is not None else [_env_spec()]
    request_id = uuid.uuid4().hex[:8]
    started = time.monotonic()
    deadline = started + budget_seconds
    attempts: List[LlmAttempt] = []
    dead_providers: set[str] = set()
    bad_requests = 0

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
            if not spec.api_key.get_secret_value():
                # Empty key in this spec — unusable provider, not a model failure.
                info = errors.ErrorInfo(errors.INVALID_KEY)
                attempts.append(_attempt(spec, info, t0))
                dead_providers.add(spec.provider)
                _log_step(request_id, spec, info.kind, "fallback", started,
                          _next_spec(chain, i, dead_providers))
                break
            try:
                result, usage = call(spec, min(call_timeout_seconds, remaining))
            except Exception as e:  # noqa: BLE001 — every failure is classified below
                info = errors.classify_error(e)
                attempts.append(_attempt(spec, info, t0))
                action = _next_action(info, retried, deadline, bad_requests)
                if info.kind == errors.BAD_REQUEST:
                    bad_requests += 1
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
                return result, usage

    raise LlmChainError(_final_error_code(attempts), attempts)


def _next_action(info: errors.ErrorInfo, retried: bool, deadline: float, bad_requests: int) -> str:
    """"stop" | "retry" | "fallback" for one classified failure."""
    if info.kind == errors.BAD_REQUEST:
        # A 400 can be model-specific (unsupported schema/param) → try ONE other model;
        # a second 400 means the request itself is wrong.
        return "stop" if bad_requests >= MAX_BAD_REQUEST_FALLBACKS else "fallback"
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
    if info.kind == errors.MODEL_NOT_FOUND:
        return now + timedelta(seconds=MODEL_NOT_FOUND_COOLDOWN_SECONDS)
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
    if kinds == {errors.BAD_REQUEST}:
        return AI_BAD_REQUEST  # 400 then end of chain
    return AI_UNAVAILABLE


def _next_spec(chain: List[LlmSpec], i: int, dead: set[str]) -> Optional[LlmSpec]:
    return next((s for s in chain[i + 1:] if s.provider not in dead), None)


def _log_step(request_id: str, spec: LlmSpec, outcome: str, action: Optional[str],
              started: float, nxt: Optional[LlmSpec] = None) -> None:
    """One short line per step — never the provider's error body."""
    arrow = f" -> {nxt.provider}/{nxt.model}" if nxt else (" -> (end of chain)" if action == "fallback" else "")
    level = (logging.INFO if outcome == "ok"
             else logging.ERROR if outcome == errors.MODEL_NOT_FOUND else logging.WARNING)
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


# ============================================================
# Web-grounded calls (trend research) — provider-native search
# ============================================================

MAX_SEARCH_CONTINUATIONS = 3   # Anthropic pause_turn resumes per call
MAX_GROUNDED_SOURCES = 25
GROUNDED_MAX_TOKENS = 12000     # a research memo, not a long generation
_SEARCH_COUNTRY = "VN"
_SEARCH_TIMEZONE = "Asia/Ho_Chi_Minh"


def _ground_with(spec: LlmSpec, timeout: float, system: str, prompt: str) -> tuple[GroundedResult, TokenUsage]:
    if spec.provider == "anthropic":
        return _ground_anthropic(spec, timeout, system, prompt)
    if spec.provider == "google":
        return _ground_google(spec, timeout, system, prompt)
    raise ValueError(f"Unknown llm_config provider: {spec.provider!r}")


def anthropic_web_search_tool(model: str, max_uses: int) -> dict:
    """``web_search_20260209`` (dynamic filtering) on Opus/Sonnet ≥ 4.6, else the basic
    ``web_search_20250305`` that every web-search-capable Claude model accepts."""
    # Minor version is 1-2 digits so a dated id ("claude-opus-4-20250514") reads as 4.0.
    m = re.match(r"claude-(opus|sonnet)-(\d+)(?:-(\d{1,2}))?(?:$|-)", model)
    version = (int(m.group(2)), int(m.group(3) or 0)) if m else (0, 0)
    tool_type = "web_search_20260209" if version >= (4, 6) else "web_search_20250305"
    return {
        "type": tool_type,
        "name": "web_search",
        "max_uses": max_uses,
        "user_location": {"type": "approximate", "country": _SEARCH_COUNTRY, "timezone": _SEARCH_TIMEZONE},
    }


def _ground_anthropic(spec: LlmSpec, timeout: float, system: str, prompt: str) -> tuple[GroundedResult, TokenUsage]:
    import anthropic

    settings = get_settings()
    client = anthropic.Anthropic(
        api_key=spec.api_key.get_secret_value(), timeout=timeout, max_retries=0)
    tools = [anthropic_web_search_tool(spec.model, settings.trend_search_max_uses)]
    messages: List[dict] = [{"role": "user", "content": prompt}]
    usage = TokenUsage()
    searches = 0
    blocks: List[Any] = []
    deadline = time.monotonic() + timeout

    for _ in range(MAX_SEARCH_CONTINUATIONS + 1):
        response = client.messages.create(
            model=spec.model,
            max_tokens=min(spec.max_tokens or settings.llm_max_tokens, GROUNDED_MAX_TOKENS),
            system=system,
            messages=messages,
            tools=tools,
        )
        _add_anthropic_usage(usage, response.usage)
        server_use = getattr(response.usage, "server_tool_use", None)
        searches += getattr(server_use, "web_search_requests", 0) or 0
        blocks.extend(response.content)
        # pause_turn = the server-side search loop hit its iteration cap; re-send the
        # assistant turn as-is and the server resumes (no extra "continue" message).
        if response.stop_reason != "pause_turn" or time.monotonic() > deadline - MIN_CALL_SECONDS:
            break
        messages = [{"role": "user", "content": prompt},
                    {"role": "assistant", "content": response.content}]

    text = "".join(b.text for b in blocks if getattr(b, "type", None) == "text").strip()
    if not text:
        raise ValueError("Grounded call returned no text")
    return GroundedResult(text=text, sources=_anthropic_sources(blocks), searches=searches), usage


def _add_anthropic_usage(total: TokenUsage, u: Any) -> None:
    cache_read = getattr(u, "cache_read_input_tokens", 0) or 0
    cache_write = getattr(u, "cache_creation_input_tokens", 0) or 0
    input_tokens = (u.input_tokens or 0) + cache_read + cache_write
    total.input_tokens += input_tokens
    total.output_tokens += u.output_tokens or 0
    total.cached_tokens += cache_read
    total.total_tokens += input_tokens + (u.output_tokens or 0)


def _anthropic_sources(blocks: List[Any]) -> List[dict]:
    """Cited pages first (they back a claim in the answer), then the other search results."""
    cited: List[dict] = []
    found: List[dict] = []
    for b in blocks:
        kind = getattr(b, "type", None)
        if kind == "text":
            for c in getattr(b, "citations", None) or []:
                if getattr(c, "url", None):
                    cited.append({"title": getattr(c, "title", None) or "", "url": c.url})
        elif kind == "web_search_tool_result":
            content = getattr(b, "content", None)
            if isinstance(content, list):  # an error result is a single object, not a list
                for r in content:
                    if getattr(r, "url", None):
                        found.append({"title": getattr(r, "title", None) or "", "url": r.url})
    return _dedupe_sources(cited + found)


def _ground_google(spec: LlmSpec, timeout: float, system: str, prompt: str) -> tuple[GroundedResult, TokenUsage]:
    from google import genai
    from google.genai import types

    settings = get_settings()
    client = genai.Client(
        api_key=spec.api_key.get_secret_value(),
        http_options=types.HttpOptions(
            timeout=int(timeout * 1000),
            retry_options=types.HttpRetryOptions(attempts=1),  # the chain decides retries
        ),
    )
    config_kwargs: dict[str, Any] = {}
    if spec.temperature is not None:
        config_kwargs["temperature"] = spec.temperature
    response = client.models.generate_content(
        model=spec.model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            tools=[types.Tool(google_search=types.GoogleSearch())],
            max_output_tokens=min(spec.max_tokens or settings.llm_max_tokens, GROUNDED_MAX_TOKENS),
            **config_kwargs,
        ),
    )
    text = (response.text or "").strip()
    if not text:
        raise ValueError("Grounded call returned no text")

    sources: List[dict] = []
    searches = 0
    for cand in response.candidates or []:
        meta = cand.grounding_metadata
        if meta is None:
            continue
        searches += len(meta.web_search_queries or [])
        for chunk in meta.grounding_chunks or []:
            web = chunk.web
            if web is not None and web.uri:
                # Gemini returns redirect URIs; title is the publisher domain.
                sources.append({"title": web.title or web.domain or "", "url": web.uri})

    u = response.usage_metadata
    usage = TokenUsage(
        total_tokens=(u.total_token_count or 0) if u else 0,
        input_tokens=((u.prompt_token_count or 0) + (u.tool_use_prompt_token_count or 0)) if u else 0,
        output_tokens=((u.candidates_token_count or 0) + (u.thoughts_token_count or 0)) if u else 0,
        cached_tokens=(u.cached_content_token_count or 0) if u else 0,
    )
    return GroundedResult(text=text, sources=_dedupe_sources(sources), searches=searches), usage


def _dedupe_sources(sources: List[dict]) -> List[dict]:
    seen: set[str] = set()
    out: List[dict] = []
    for s in sources:
        if s["url"] not in seen:
            seen.add(s["url"])
            out.append(s)
    return out[:MAX_GROUNDED_SOURCES]


# ============================================================
# Streaming structured output (/generate/stream, NDJSON)
# ============================================================
#
# Same chain policy as invoke_structured (retry/fallback per classified error, one budget), but
# the model is STREAMED: raw JSON pieces (Anthropic tool-call args / Gemini JSON text) are
# accumulated, parsed leniently (langchain_core parse_partial_json) and every string field that
# grew is emitted as a delta. A failure BEFORE the first delta falls back silently; AFTER it, a
# ``reset`` event tells the client to clear its preview first. The final result is validated with
# the same pydantic schema as the non-stream path, so the stored content is identical.
#
# Events yielded (dicts): {"type":"start","provider","model","input_tokens"?} ·
# {"type":"delta","path","append"} (+ "replace": true when a field changed non-incrementally) ·
# {"type":"reset","reason"} · {"type":"result","parsed": <schema>, "usage": TokenUsage} (last).
# Raises LlmChainError when every model failed. Closing the iterator (client disconnect) closes
# the provider stream, so the provider stops generating.


async def _stream_chunks(spec: LlmSpec, timeout: float, schema: type[BaseModel],
                         messages: list) -> AsyncIterator[tuple[str, dict]]:
    """Provider stream -> (raw JSON piece, usage_metadata so far). Bound like with_structured_output."""
    model = build_llm(spec, timeout=timeout)
    if spec.provider == "anthropic":
        bound = model.bind_tools([schema], tool_choice=schema.__name__)
    else:
        bound = model.bind(response_mime_type="application/json",
                           response_json_schema=schema.model_json_schema())
    async for chunk in bound.astream(messages):
        piece = ""
        tool_chunks = getattr(chunk, "tool_call_chunks", None) or []
        if tool_chunks:
            piece = "".join(tc.get("args") or "" for tc in tool_chunks)
        elif isinstance(chunk.content, str):
            piece = chunk.content
        elif isinstance(chunk.content, list):
            piece = "".join(p.get("text", "") for p in chunk.content
                            if isinstance(p, dict) and p.get("type") == "text")
        yield piece, (getattr(chunk, "usage_metadata", None) or {})


def string_leaves(value: Any, prefix: str = "") -> dict[str, str]:
    """Flatten a (partial) JSON object to {"script.steps[1].content": "..."} — string leaves only."""
    out: dict[str, str] = {}
    if isinstance(value, dict):
        for k, v in value.items():
            out.update(string_leaves(v, f"{prefix}.{k}" if prefix else str(k)))
    elif isinstance(value, list):
        for i, v in enumerate(value):
            out.update(string_leaves(v, f"{prefix}[{i}]"))
    elif isinstance(value, str):
        out[prefix] = value
    return out


def diff_deltas(previous: dict[str, str], current: dict[str, str]) -> List[dict]:
    """Delta events turning ``previous`` into ``current`` (appends; ``replace`` when not a prefix)."""
    deltas = []
    for path, text in current.items():
        old = previous.get(path, "")
        if text == old:
            continue
        if text.startswith(old):
            deltas.append({"type": "delta", "path": path, "append": text[len(old):]})
        else:
            deltas.append({"type": "delta", "path": path, "append": text, "replace": True})
    return deltas


def _merge_usage(total: dict, part: dict) -> dict:
    """Providers report usage either once (final chunk) or split (input first, output last)."""
    if not part:
        return total
    merged = dict(total)
    for key in ("input_tokens", "output_tokens", "total_tokens"):
        if part.get(key):
            merged[key] = max(merged.get(key, 0), part[key])
    details = part.get("input_token_details") or {}
    if details.get("cache_read"):
        merged["cache_read"] = details["cache_read"]
    return merged


async def astream_structured(schema: type[T], prompt: ChatPromptTemplate,
                             variables: dict[str, Any]) -> AsyncIterator[dict]:
    """Streamed :func:`invoke_structured` — see the section comment above for the event protocol."""
    from langchain_core.utils.json import parse_partial_json

    settings = get_settings()
    config = _current_llm_config.get()
    chain = config.chain() if config is not None else [_env_spec()]
    messages = prompt.format_messages(**variables)
    request_id = uuid.uuid4().hex[:8]
    started = time.monotonic()
    deadline = started + settings.llm_chain_budget_seconds
    attempts: List[LlmAttempt] = []
    dead_providers: set[str] = set()
    bad_requests = 0
    emitted_any = False

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
            if not spec.api_key.get_secret_value():
                info = errors.ErrorInfo(errors.INVALID_KEY)
                attempts.append(_attempt(spec, info, t0))
                dead_providers.add(spec.provider)
                _log_step(request_id, spec, info.kind, "fallback", started, _next_spec(chain, i, dead_providers))
                break
            raw = ""
            shown: dict[str, str] = {}
            usage: dict = {}
            started_event = False
            try:
                async for piece, part in _stream_chunks(spec, min(settings.llm_call_timeout_seconds, remaining),
                                                        schema, messages):
                    if time.monotonic() > deadline:
                        raise TimeoutError("chain budget exhausted mid-stream")
                    usage = _merge_usage(usage, part)
                    if not started_event:
                        started_event = True
                        event = {"type": "start", "provider": spec.provider, "model": spec.model}
                        if usage.get("input_tokens"):
                            event["input_tokens"] = usage["input_tokens"]
                        yield event
                    if not piece:
                        continue
                    raw += piece
                    partial = parse_partial_json(raw)
                    if isinstance(partial, dict):
                        current = string_leaves(partial)
                        for delta in diff_deltas(shown, current):
                            emitted_any = True
                            yield delta
                        shown = current
                if not raw.strip():
                    raise ValueError(f"Model returned no {schema.__name__} JSON")
                parsed = schema.model_validate(json.loads(raw))
            except Exception as e:  # noqa: BLE001 — classified exactly like the non-stream chain
                info = errors.classify_error(e)
                attempts.append(_attempt(spec, info, t0))
                action = _next_action(info, retried, deadline, bad_requests)
                if info.kind == errors.BAD_REQUEST:
                    bad_requests += 1
                nxt = _next_spec(chain, i, dead_providers | (
                    {spec.provider} if info.kind == errors.INVALID_KEY else set()))
                _log_step(request_id, spec, info.kind, action, started, nxt if action == "fallback" else None)
                if action == "stop":
                    raise LlmChainError(AI_BAD_REQUEST, attempts) from e
                if emitted_any:
                    # The client already shows partial text from this attempt — clear it first.
                    yield {"type": "reset", "reason": "retry" if action == "retry" else "fallback"}
                    emitted_any = False
                if action == "retry":
                    await asyncio.sleep(info.retry_after if info.kind == errors.RATE_LIMITED
                                        else RETRY_BACKOFF_SECONDS)
                    retried = True
                    continue
                if info.kind == errors.INVALID_KEY:
                    dead_providers.add(spec.provider)
                break
            else:
                attempts.append(LlmAttempt(provider=spec.provider, model=spec.model, outcome="ok",
                                           latency_ms=_ms_since(t0)))
                _log_step(request_id, spec, "ok", None, started)
                yield {"type": "result", "parsed": parsed, "usage": TokenUsage(
                    total_tokens=usage.get("total_tokens")
                    or usage.get("input_tokens", 0) + usage.get("output_tokens", 0),
                    input_tokens=usage.get("input_tokens", 0),
                    output_tokens=usage.get("output_tokens", 0),
                    cached_tokens=usage.get("cache_read", 0),
                    attempts=attempts)}
                return

    raise LlmChainError(_final_error_code(attempts), attempts)
