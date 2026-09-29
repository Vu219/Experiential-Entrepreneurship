"""/test-connection probes the model LIST (never generateContent) and classifies failures (D)."""

from __future__ import annotations

import json

import pytest
import requests

from src import model_catalog
from src.api.routes import test_connection as run_test_connection
from src import schemas

KEY = "AIza-secret-key-123"


def _response(status: int, body: dict | None = None, headers: dict | None = None) -> requests.Response:
    resp = requests.Response()
    resp.status_code = status
    resp._content = json.dumps(body or {}).encode()
    resp.headers.update(headers or {})
    resp.url = "https://example.test"
    return resp


def _quota_body(quota_id: str) -> dict:
    return {"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "message": "quota",
                      "details": [{"@type": "type.googleapis.com/google.rpc.QuotaFailure",
                                   "violations": [{"quotaId": quota_id}]}]}}


@pytest.fixture
def http(monkeypatch):
    """Scripted requests.get: set holder["next"] to a Response or an exception."""
    holder: dict = {"calls": []}

    def fake_get(url, headers=None, params=None, timeout=None):
        holder["calls"].append((url, headers, params))
        nxt = holder["next"]
        if isinstance(nxt, BaseException):
            raise nxt
        return nxt

    monkeypatch.setattr(model_catalog.requests, "get", fake_get)
    return holder


def _run(provider: str = "google"):
    return run_test_connection(schemas.TestConnectionRequest(provider=provider, model="gemini-3.5-flash", api_key=KEY))


def test_ok_uses_models_list_not_generate(http):
    http["next"] = _response(200, {"models": []})
    result = _run()
    assert (result.success, result.status) == (True, "OK")
    url, headers, params = http["calls"][0]
    assert url.endswith("/v1beta/models") and params == {"pageSize": 1}
    assert headers == {"x-goog-api-key": KEY}  # key in header, never in the URL


def test_anthropic_uses_v1_models(http):
    http["next"] = _response(200, {"data": []})
    assert _run("anthropic").status == "OK"
    assert http["calls"][0][0].endswith("/v1/models")


@pytest.mark.parametrize("resp,status,free_tier", [
    (_response(401, {"error": {"type": "authentication_error"}}), "INVALID_KEY", False),
    (_response(400, {"error": {"code": 400, "details": [
        {"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "API_KEY_INVALID"}]}}), "INVALID_KEY", False),
    (_response(429, _quota_body("GenerateRequestsPerDayPerProjectPerModel-FreeTier")), "DAILY_QUOTA_EXHAUSTED", True),
    (_response(429, _quota_body("GenerateRequestsPerMinutePerProjectPerModel")), "RATE_LIMITED", False),
    (_response(503, {"error": {"code": 503}}), "PROVIDER_OVERLOADED", False),
    (requests.ConnectionError("dns"), "NETWORK_ERROR", False),
    (requests.Timeout("slow"), "NETWORK_ERROR", False),
    (_response(404, {}), "FAILED", False),
])
def test_failure_status_follows_classify_error(http, resp, status, free_tier):
    http["next"] = resp
    result = _run()
    assert result.success is False
    assert result.status == status
    assert result.free_tier is free_tier


def test_message_never_contains_the_key(http):
    http["next"] = requests.ConnectionError(f"failed for key={KEY}")
    result = _run()
    assert KEY not in (result.message or "")
