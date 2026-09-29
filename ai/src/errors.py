"""Provider error classification — ONE shared function for the LLM chain and test-connection.

``classify_error`` walks the exception chain (LangChain wraps google-genai ``ClientError``
in ``ChatGoogleGenerativeAIError`` via ``raise ... from e``) and maps whatever it finds
— google-genai ``APIError``, Anthropic SDK errors, httpx/requests transport errors — onto
a small set of kinds that drive retry/fallback decisions:

| kind                    | source                                  | chain behavior                |
|-------------------------|-----------------------------------------|-------------------------------|
| bad_request             | 400                                     | next model once, 2nd 400 stop |
| invalid_key             | 401/403, Google 400 API_KEY_INVALID     | skip every model of provider  |
| daily_quota_exhausted   | 429 + QuotaFailure quotaId "PerDay"     | next model, cooldown to reset |
| rate_limited            | 429 otherwise (RetryInfo.retryDelay)    | wait ≤5s once, else next      |
| provider_overloaded     | 500/502/503/504/529                     | retry once (~1s), then next   |
| network_error           | timeout / connection error              | retry once, then next         |
| invalid_response        | anything else (parse failure, 404…)     | next model                    |

SECURITY: never keep or log ``str(exc)`` here — only codes, quota ids and delays.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

BAD_REQUEST = "bad_request"
INVALID_KEY = "invalid_key"
DAILY_QUOTA_EXHAUSTED = "daily_quota_exhausted"
RATE_LIMITED = "rate_limited"
PROVIDER_OVERLOADED = "provider_overloaded"
NETWORK_ERROR = "network_error"
INVALID_RESPONSE = "invalid_response"

_OVERLOADED_CODES = {500, 502, 503, 504, 529}  # 529 = Anthropic "overloaded_error"
_INVALID_KEY_REASONS = {"API_KEY_INVALID", "API_KEY_EXPIRED"}  # google.rpc.ErrorInfo.reason
# Google daily quotas reset at midnight Pacific time.
_QUOTA_RESET_TZ = ZoneInfo("America/Los_Angeles")


@dataclass(frozen=True)
class ErrorInfo:
    """Classified provider failure. ``retry_after`` in seconds (RetryInfo / Retry-After)."""

    kind: str
    http_status: Optional[int] = None
    retry_after: Optional[float] = None
    free_tier: bool = False


def classify_error(exc: BaseException) -> ErrorInfo:
    """Classify a provider failure (see module docstring for the table)."""
    for e in _chain(exc):
        info = _classify_one(e)
        if info is not None:
            return info
    return ErrorInfo(INVALID_RESPONSE)


def next_quota_reset(now: Optional[datetime] = None) -> datetime:
    """Next midnight America/Los_Angeles (Google daily-quota reset), as an aware UTC datetime."""
    now = now or datetime.now(timezone.utc)
    local = now.astimezone(_QUOTA_RESET_TZ)
    midnight = datetime.combine(local.date() + timedelta(days=1), datetime.min.time(), _QUOTA_RESET_TZ)
    return midnight.astimezone(timezone.utc)


def _chain(exc: BaseException):
    """exc, then its __cause__/__context__ ancestors (cycle-safe, bounded)."""
    seen: set[int] = set()
    cur: Optional[BaseException] = exc
    while cur is not None and id(cur) not in seen and len(seen) < 10:
        seen.add(id(cur))
        yield cur
        cur = cur.__cause__ or cur.__context__


def _classify_one(e: BaseException) -> Optional[ErrorInfo]:
    # google-genai: APIError(code, details=response_json)
    try:
        from google.genai import errors as genai_errors

        if isinstance(e, genai_errors.APIError):
            return from_http(e.code, e.details)
    except ImportError:  # pragma: no cover — dependency always installed
        pass

    # Anthropic SDK
    try:
        import anthropic

        if isinstance(e, anthropic.APIConnectionError):  # includes APITimeoutError
            return ErrorInfo(NETWORK_ERROR)
        if isinstance(e, anthropic.APIStatusError):
            return from_http(e.status_code, e.body, _retry_after_header(e.response))
    except ImportError:  # pragma: no cover
        pass

    # Raw transports (google-genai uses httpx; model_catalog uses requests)
    import httpx
    import requests

    if isinstance(e, (httpx.TimeoutException, httpx.NetworkError, TimeoutError, ConnectionError)):
        return ErrorInfo(NETWORK_ERROR)
    if isinstance(e, (requests.Timeout, requests.ConnectionError)):
        return ErrorInfo(NETWORK_ERROR)
    if isinstance(e, requests.HTTPError) and e.response is not None:
        try:
            body = e.response.json()
        except ValueError:
            body = None
        return from_http(e.response.status_code, body, _retry_after_header(e.response))
    return None


def from_http(status: Any, body: Any = None, retry_after_header: Optional[float] = None) -> ErrorInfo:
    """Classify from an HTTP status + (Google-style) error body."""
    try:
        code = int(status)
    except (TypeError, ValueError):
        return ErrorInfo(INVALID_RESPONSE)

    if code == 400:
        # Google reports a wrong/revoked key as 400 INVALID_ARGUMENT + ErrorInfo.reason.
        if _google_error_reasons(body) & _INVALID_KEY_REASONS:
            return ErrorInfo(INVALID_KEY, code)
        return ErrorInfo(BAD_REQUEST, code)
    if code in (401, 403):
        return ErrorInfo(INVALID_KEY, code)
    if code == 429:
        quota_ids, retry_delay = _google_quota_details(body)
        free_tier = any("FreeTier" in q for q in quota_ids)
        retry_after = retry_delay if retry_delay is not None else retry_after_header
        if any("PerDay" in q for q in quota_ids):
            return ErrorInfo(DAILY_QUOTA_EXHAUSTED, code, retry_after, free_tier)
        return ErrorInfo(RATE_LIMITED, code, retry_after, free_tier)
    if code in _OVERLOADED_CODES:
        return ErrorInfo(PROVIDER_OVERLOADED, code)
    return ErrorInfo(INVALID_RESPONSE, code)


def _google_quota_details(body: Any) -> tuple[list[str], Optional[float]]:
    """(quotaIds from QuotaFailure, retryDelay seconds from RetryInfo) of a Google error body."""
    if not isinstance(body, dict):
        return [], None
    err = body.get("error", body)
    details = err.get("details") if isinstance(err, dict) else None
    quota_ids: list[str] = []
    retry_delay: Optional[float] = None
    for d in details or []:
        if not isinstance(d, dict):
            continue
        type_url = d.get("@type", "")
        if type_url.endswith("QuotaFailure"):
            for v in d.get("violations") or []:
                if isinstance(v, dict) and v.get("quotaId"):
                    quota_ids.append(str(v["quotaId"]))
        elif type_url.endswith("RetryInfo"):
            retry_delay = _parse_duration(d.get("retryDelay"))
    return quota_ids, retry_delay


def _google_error_reasons(body: Any) -> set[str]:
    """``reason`` values of the google.rpc.ErrorInfo details of a Google error body."""
    if not isinstance(body, dict):
        return set()
    err = body.get("error", body)
    details = err.get("details") if isinstance(err, dict) else None
    return {str(d["reason"]) for d in details or []
            if isinstance(d, dict) and str(d.get("@type", "")).endswith("ErrorInfo") and d.get("reason")}


def _parse_duration(value: Any) -> Optional[float]:
    """google.protobuf.Duration JSON ("27s", "27.5s") → seconds."""
    if not isinstance(value, str):
        return None
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)s\s*", value)
    return float(m.group(1)) if m else None


def _retry_after_header(response: Any) -> Optional[float]:
    headers = getattr(response, "headers", None)
    if not headers:
        return None
    try:
        return float(headers.get("retry-after"))
    except (TypeError, ValueError):
        return None
