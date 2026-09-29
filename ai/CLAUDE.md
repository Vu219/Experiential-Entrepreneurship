# CLAUDE.md — AIMA AI Service

> AI module of the **AIMA – AI Marketing Assistant** project.
> Read the root [`../CLAUDE.md`](../CLAUDE.md) first for product scope, business rules (BR-xx)
> and the post-status state machine. Setup/run details: [`README.md`](README.md).

## 1. Overview

| Field | Value |
|---|---|
| **Name** | `aima-ai` `0.1.0` |
| **Stack** | Python ≥ 3.10 + FastAPI + LangChain (pydantic v2) |
| **Package manager** | `uv` (`uv sync`, `uv run`) |
| **Port** | `:8000` (`AI_SERVICE_HOST`/`AI_SERVICE_PORT`) |
| **LLM providers** | Anthropic Claude (default) hoặc Google Gemini — chọn qua `LLM_PROVIDER` |
| **Role** | **Stateless** HTTP service hosting the LangChain agents. The Spring backend calls it from async workers (NFR-04) and owns ALL persistence — sessions, drafts, versions, insights live in Postgres, not here. |

## 2. Structure

```
ai/
├── main.py                  — FastAPI entry (uv run uvicorn main:app --reload)
├── pyproject.toml / uv.lock — deps (langchain-anthropic, langchain-google-genai, fastapi…)
├── .env / .env.example      — all runtime config (see §6)
└── src/
    ├── config.py            — pydantic-settings Settings (cached get_settings())
    ├── schemas.py            — ALL request/response contracts (pydantic, snake_case).
    │                           Backend's dto/ai/*Payload mirror these 1-1 — change here
    │                           ⇒ change the Java payload (and vice versa).
    ├── llm.py               — LLM factory + routing: env default (cached) vs per-request
    │                           llm_config (ContextVar); invoke_structured() = the ONLY
    │                           way agents call the model (structured output + token usage
    │                           + app-owned retry/fallback chain, SDK retries OFF)
    ├── errors.py            — classify_error(): ONE provider-error classifier shared by the
    │                           chain and test-connection (kinds → retry/fallback decisions)
    ├── model_catalog.py     — list provider models for admin "Cấu hình AI" sync
    ├── api/routes.py        — one endpoint per capability; internal-token guard
    ├── agents/
    │   ├── trend_research.py    — FR-19..23: collect signal (parallel) → LLM filters/rates
    │   │                           trends + creates ideas; enforces the session's TARGET
    │   │                           platform on every trend/idea (see §4)
    │   ├── content_generator.py — FR-24..30, FR-32: one ContentItem (structured VideoScript
    │   │                           hook/steps/cta, caption, hashtags, media prompt)
    │   ├── content_regenerator.py — regenerate ONE script part (hook/body/cta × content/scene)
    │   ├── platform_formatter.py  — FR-40..46: one ContentVersion per requested platform
    │   └── optimizer.py         — /analyze (FR-63..64), /optimize (FR-65..66),
    │                               /golden-hours (FR-48: defaults until ≥10 posts)
    └── platform/            — data connectors for trend research (each with graceful fallback)
        ├── facebook.py      — FacebookTrendAnalyzer: public page/group posts, reels, comments
        │                       (Graph API; no token → mock data) + analyze_trends() aggregation
        │                       (VN-aware keywords: bigram phrases, stopwords)
        └── trends_mcp.py    — TrendsMCPConnector (adapted from Trends-MCP): YouTube trending/
                                search (RapidAPI yt-api), TikTok trending, Instagram hashtag
                                (RapidAPI, host swappable), Threads keyword search (official
                                Meta API), curated IG-Reels list
```

## 3. Endpoints

All are `POST` with pydantic bodies from `src/schemas.py` unless noted. The `*Result`
response = the domain response **plus `TokenAccounting`** fields (`tokens_used`,
`input_tokens`, `output_tokens`, `cached_tokens`) for backend quota/usage logging.

| Endpoint | Agent / purpose |
|---|---|
| `GET /health` | liveness + active env provider |
| `/research` | Trend research for one session (FR-19..23) |
| `/generate` | Generate one content item (FR-24..30; `regenerate_from` = FR-32) |
| `/regenerate-part` | Regenerate one video-script part, rest untouched |
| `/format` | One `ContentVersion` per platform (FR-40..46) |
| `/analyze` | Success factors + insights from post metrics (FR-63..64) |
| `/optimize` | Strategy adjustments + future improvements (FR-65..66) |
| `/golden-hours` | Posting-hour suggestions (FR-48; `data_driven=false` under 10 posts) |
| `/test-connection` | Admin "Cấu hình AI": probe a provider key by LISTING models (Gemini `GET /v1beta/models`, Anthropic `GET /v1/models`, 1 item — never generateContent, no quota); returns `status` from `classify_error` (OK / INVALID_KEY / RATE_LIMITED / DAILY_QUOTA_EXHAUSTED / PROVIDER_OVERLOADED / NETWORK_ERROR / FAILED) + `free_tier`; wrong key = result, not 5xx |
| `/list-models` | Admin model sync: provider catalog (id + limits, no pricing) |

## 4. LLM routing & trend research — how it works

**Model selection (two paths, per request):**
- **Env default** — `LLM_PROVIDER` + `ANTHROPIC_*`/`GOOGLE_*`; cached for the process. The
  rollback path when the backend runs with `AI_CONFIG_FROM_DB=false`.
- **DB-managed `llm_config`** — the backend injects `{primary, fallbacks[], fallback}` specs
  (provider, model, api_key…) per request from its `ai_task_routing` + `ai_task_routing_fallback`
  tables (ordered by `position`, models that are disabled / missing a key / resting in the
  backend circuit breaker already removed). `fallback` is the LEGACY single fallback (older
  backends send only that; the new backend sends it = `fallbacks[0]`) — `LlmConfig.chain()` uses
  `fallbacks` when non-empty, else `fallback`, and drops duplicates. Routes stash it in a
  ContextVar (`use_llm_config`) so agent code never changes. `invoke_structured` walks the
  chain (primary → fallbacks in order) itself — see **Retry/fallback chain** below.
- **Security (fail-closed):** any request carrying `llm_config`, plus `/test-connection` and
  `/list-models`, REQUIRES header `X-Internal-Token` == `AI_INTERNAL_TOKEN` (shared secret
  with the backend, compared with `secrets.compare_digest`). Token unset on this service ⇒
  those requests are refused (503); env-based requests keep working.

**`invoke_structured(schema, prompt, vars)`** is the single agent→LLM gateway: LangChain
`with_structured_output(include_raw=True)` returns the typed pydantic result AND real token
usage (`usage_metadata`, incl. cache reads) for the `TokenAccounting` response fields.

**Retry/fallback chain (2026-09-29).** SDK retries are OFF (google-genai `attempts=1`,
Anthropic `max_retries=0`; AFC disabled via `_GeminiChat`) — never re-enable them, they
multiply calls (default was 6/model) and blow the backend timeout. Per `errors.classify_error`
kind: `bad_request` next model once, a 2nd 400 stops (AI_BAD_REQUEST) · `invalid_key` skip the whole provider · `daily_quota_exhausted`
next model (cooldown to 0:00 America/Los_Angeles) · `rate_limited` wait ≤5s once else next ·
`provider_overloaded`/`network_error` one retry after ~1s then next · `invalid_response` next.
Bounded by `LLM_CHAIN_BUDGET_SECONDS` (80) with `LLM_CALL_TIMEOUT_SECONDS` (40) per call —
keep the budget below the backend's `AI_SERVICE_TIMEOUT_SECONDS` (100). Every step logs one
line `llm[<req>] provider/model outcome action -> next <ms>`. Success responses carry
`llm_attempts` (TokenAccounting — the backend bills the LAST `"ok"` attempt's provider/model, not
the configured primary); a failed chain → 502 `detail = {error_code, message,
attempts}` with `error_code` ∈ AI_PROVIDER_OVERLOADED / AI_QUOTA_EXHAUSTED / AI_TIMEOUT /
AI_BAD_REQUEST / AI_UNAVAILABLE. Model health (circuit breaker) is the BACKEND's job (Redis),
fed by `attempts[].cooldown_until` — this service stays stateless.

**Trend research pipeline** (`agents/trend_research.py`):
1. `_collect_signal` fetches ALL sources **in parallel** (ThreadPoolExecutor): Facebook
   pages/groups/reels + comments, YouTube trending, TikTok trending, curated Reels trends,
   and per-keyword searches (YouTube/Instagram-hashtag/Threads) built from
   `brand_keywords[:2] + industry` (max 3 keywords).
2. `analyze_trends` aggregates to top hashtags/keywords/most-engaging posts (VN-aware).
3. One structured LLM call → trends (rated High/Medium/Low, FR-20/21) + content ideas (FR-22).
4. **Target platform (FR-19, fix 2026-07-19):** `ResearchRequest.platform` (backend sends the
   session's platform, e.g. `"FACEBOOK"`, normalized case-insensitively) is injected into the
   prompt AND enforced post-hoc — `platform` of every returned trend/idea is overwritten with
   the target. Payload without `platform` (old backend / daily scheduler pre-update) keeps the
   legacy behavior: model chooses among Facebook/Instagram/Threads.
5. `max_trends` / `max_ideas` (1–20) trim the result; backend maps `articleCount` → `max_ideas`.

**Fallback philosophy per source:** core sources (Facebook, YouTube trending, TikTok) return
**mock data** when credentials are missing so research stays demoable; keyword-search sources
(YouTube search, Instagram hashtag, Threads) return **`[]`** instead — never mock — to avoid
amplifying noise. A failing/unsubscribed API is swallowed inside the connector (logged, `[]`).

## 5. Rules (binding)

1. **Schemas are a cross-language contract.** `src/schemas.py` mirrors the backend's
   `dto/ai/*Payload` classes. Any field change must be applied on BOTH sides; new fields must
   be optional-with-default so older payloads stay valid (see `platform`, `image_prompt`).
2. **Stateless — no DB, no files.** Persistence, retry policy, scheduling and session guards
   belong to the backend. Do not add storage here.
3. **Never log secrets or request bodies.** API keys are `SecretStr`; log provider/model names
   and exception TYPES only. `/test-connection` redacts the key from provider error messages.
4. **All model calls go through `invoke_structured`** (or `build_llm` for probes) — never
   instantiate a LangChain chat model inside an agent, or fallback routing and token
   accounting silently break.
5. **Platform scope:** only Facebook → Instagram → Threads. The `platform` field of any
   trend/idea/version must be exactly `"Facebook"`, `"Instagram"` or `"Threads"` (backend
   `parsePlatform` normalizes case; unknown values degrade to FACEBOOK).
6. **No media generation (FR-29).** Agents produce media/image PROMPTS (text) only.
7. **Errors:** raise/propagate inside agents; `routes._run` maps config errors → 503 and other
   failures → 502 with a clean label. A wrong provider key in `/test-connection` is a
   `success=false` RESULT, not an HTTP error; its `status` comes from the SAME `classify_error`
   as the chain (Google reports a bad key as 400 + `ErrorInfo.reason=API_KEY_INVALID` →
   `invalid_key`, not `bad_request`). Never switch the probe back to a generation call.
8. **External fetches must stay resilient** (connector pattern): per-source try/except, log +
   fallback (mock or `[]`), parallel fetch so one slow source doesn't serialize the session.

## 6. Configuration (.env — see `.env.example` for full comments)

```
LLM_PROVIDER (anthropic|google), LLM_MAX_TOKENS (16000)
LLM_CALL_TIMEOUT_SECONDS (40), LLM_CHAIN_BUDGET_SECONDS (80)   # chain limits, see §4
ANTHROPIC_API_KEY, ANTHROPIC_MODEL (claude-sonnet-4-6)
GOOGLE_API_KEY, GOOGLE_MODEL (gemini-2.5-pro)
AI_SERVICE_HOST (0.0.0.0), AI_SERVICE_PORT (8000)
AI_INTERNAL_TOKEN                  # shared secret with backend/.env — REQUIRED for llm_config,
                                   # /test-connection, /list-models (fail-closed when unset)
# Trend-research signal sources (all optional — see fallback philosophy in §4):
FACEBOOK_PAGE_ACCESS_TOKEN / FACEBOOK_USER_ACCESS_TOKEN
RAPIDAPI_KEY                       # ONE key for all subscribed RapidAPI APIs
                                   # (TIKTOK_RAPIDAPI_KEY legacy, still read as fallback)
YOUTUBE_RAPIDAPI_HOST (yt-api.p.rapidapi.com)
INSTAGRAM_RAPIDAPI_HOST (instagram-social-api.p.rapidapi.com)   # swappable; unknown host →
INSTAGRAM_RAPIDAPI_PATH / INSTAGRAM_RAPIDAPI_PARAM              # declare these two as well
THREADS_ACCESS_TOKEN               # official Meta API, needs threads_keyword_search scope
THREADS_API_BASE (https://graph.threads.net/v1.0)
TRENDS_DEFAULT_REGION (VN)         # ISO region for trending/search when request has none
```

## 7. Commands

```bash
cd ai
uv sync                                # install deps
uv run uvicorn main:app --reload       # dev server on :8000 (hot reload)
uv run python main.py                  # run (host/port from .env)
uv run main.py                         # demo workflow (root CLAUDE.md)
uv run pytest -q tests                 # unit tests (mocked providers, no network)
```

**Backend integration.** The Spring backend reaches this service via `AI_SERVICE_BASE_URL`
(default `http://localhost:8000`) + `AI_SERVICE_TIMEOUT_SECONDS` in `backend/.env`, through
its single `AiServiceClient` wrapper. Restart this service after changing `src/schemas.py`
or agent code — the backend only sees the running process.
