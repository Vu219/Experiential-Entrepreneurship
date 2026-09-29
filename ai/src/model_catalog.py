"""Provider model catalogs for the admin "Cấu hình AI" model-sync feature.

Fetches the list of available models (id + display name + token limits) straight
from each provider's REST API and normalizes them to the shared ``CatalogModel``
shape. Providers do NOT return pricing — prices live in the backend's
self-maintained ``ai_model_price_catalog`` table.

SECURITY: the API key is passed via request headers only (never in the URL) and
must never be logged. Callers redact provider error messages before exposing them.
"""

from __future__ import annotations

from typing import List, Optional

import requests

from .schemas import CatalogModel

ANTHROPIC_BASE_URL = "https://api.anthropic.com"
ANTHROPIC_VERSION = "2023-06-01"
GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com"

REQUEST_TIMEOUT_SECONDS = 20
# Both providers page at up to 1000 items; the cap only guards against a runaway loop.
MAX_PAGES = 10


def list_models(provider: str, api_key: str) -> List[CatalogModel]:
    """Return the provider's model catalog, newest-first as returned by the provider."""
    if provider == "anthropic":
        return _list_anthropic(api_key)
    if provider == "google":
        return _list_google(api_key)
    raise ValueError(f"Unknown provider for model listing: {provider!r}")


def probe(provider: str, api_key: str) -> None:
    """Cheapest authenticated call: ONE page of size 1 of the model list (no generation, no
    generateContent quota). Raises ``requests.HTTPError`` / transport errors for
    ``errors.classify_error`` — used by /test-connection."""
    if provider == "anthropic":
        resp = requests.get(
            f"{ANTHROPIC_BASE_URL}/v1/models",
            headers={"x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION},
            params={"limit": 1},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    elif provider == "google":
        resp = requests.get(
            f"{GOOGLE_BASE_URL}/v1beta/models",
            headers={"x-goog-api-key": api_key},
            params={"pageSize": 1},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    else:
        raise ValueError(f"Unknown provider for probe: {provider!r}")
    resp.raise_for_status()


def _positive_or_none(value) -> Optional[int]:
    """Anthropic documents 0 as 'unknown' for token limits — treat 0/missing as None."""
    return value if isinstance(value, int) and value > 0 else None


def _list_anthropic(api_key: str) -> List[CatalogModel]:
    """GET /v1/models — display_name and token limits come inline, newest first."""
    models: List[CatalogModel] = []
    after_id: Optional[str] = None
    for _ in range(MAX_PAGES):
        params = {"limit": 1000}
        if after_id:
            params["after_id"] = after_id
        resp = requests.get(
            f"{ANTHROPIC_BASE_URL}/v1/models",
            headers={"x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION},
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        body = resp.json()
        for item in body.get("data", []):
            model_id = item.get("id")
            if not model_id:
                continue
            models.append(CatalogModel(
                id=model_id,
                display_name=item.get("display_name") or None,
                max_input_tokens=_positive_or_none(item.get("max_input_tokens")),
                max_tokens=_positive_or_none(item.get("max_tokens")),
            ))
        if not body.get("has_more") or not body.get("last_id"):
            break
        after_id = body["last_id"]
    return models


def _list_google(api_key: str) -> List[CatalogModel]:
    """GET /v1beta/models — keep only generateContent-capable models, strip 'models/'."""
    models: List[CatalogModel] = []
    page_token: Optional[str] = None
    for _ in range(MAX_PAGES):
        params = {"pageSize": 1000}
        if page_token:
            params["pageToken"] = page_token
        resp = requests.get(
            f"{GOOGLE_BASE_URL}/v1beta/models",
            headers={"x-goog-api-key": api_key},
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        body = resp.json()
        for item in body.get("models", []):
            name = item.get("name") or ""
            model_id = name.removeprefix("models/")
            if not model_id:
                continue
            if "generateContent" not in (item.get("supportedGenerationMethods") or []):
                continue
            models.append(CatalogModel(
                id=model_id,
                display_name=item.get("displayName") or None,
                max_input_tokens=_positive_or_none(item.get("inputTokenLimit")),
                max_tokens=_positive_or_none(item.get("outputTokenLimit")),
            ))
        page_token = body.get("nextPageToken")
        if not page_token:
            break
    return models
