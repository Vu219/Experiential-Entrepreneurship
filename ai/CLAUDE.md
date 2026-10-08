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
    │   ├── trend_research.py    — FR-19..23: evidence-grounded research — web search +
    │   │                           Google Trends + calendar + platform search (parallel) →
    │   │                           LLM rates trends citing evidence ids; enforces the
    │   │                           session's TARGET platform on every trend/idea (see §4)
    │   ├── content_generator.py — FR-24..30, FR-32: one ContentItem (structured VideoScript
    │   │                           hook/steps/cta, caption, hashtags, media prompt)
    │   ├── content_regenerator.py — regenerate ONE script part (hook/body/cta × content/scene)
    │   ├── platform_formatter.py  — FR-40..46: one ContentVersion per requested platform
    │   └── optimizer.py         — /analyze (FR-63..64), /optimize (FR-65..66),
    │                               /golden-hours (FR-48: defaults until ≥10 posts)
    └── platform/            — REAL data sources for trend research (never mock; failure → [])
        ├── google_trends.py — "Trending now" RSS per country (free, no key): query, traffic, news
        ├── marketing_calendar.py — VN holidays / sale days / Tết & Trung thu in the next N days
        └── social_search.py — keyword search: YouTube (RapidAPI yt-api), Instagram hashtag
                                (RapidAPI, host swappable), Threads (official Meta API)
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

**Trend research pipeline — evidence-grounded (2026-10-08)** (`agents/trend_research.py`):
1. `_collect_signal` fetches ALL sources **in parallel** — every one real, none mocked:
   - **Web research** `llm.invoke_grounded(system, prompt)` — provider-NATIVE search through the
     SAME retry/fallback chain as `invoke_structured` (own budget `TREND_SEARCH_BUDGET_SECONDS`
     90 / per call `TREND_SEARCH_CALL_TIMEOUT_SECONDS` 75): Anthropic server tool `web_search`
     (`web_search_20260209` on Opus/Sonnet ≥ 4.6, else `web_search_20250305`; `max_uses` =
     `TREND_SEARCH_MAX_USES`, location VN; `pause_turn` resumed ≤ 3×) via the official `anthropic`
     SDK, Gemini `google_search` grounding via `google-genai` (SDK retries off). Returns a memo +
     the pages the provider actually used. Runs inside `contextvars.copy_context()` — pool threads
     don't inherit the request's `llm_config` otherwise. Failure → `grounded=false`, session goes on.
   - **Google Trends** "Trending now" for the market (`region` or `TRENDS_DEFAULT_REGION`).
   - **Marketing calendar** (next 45 days) and optional **platform keyword search** from
     `brand_keywords[:2] + industry` (credential-gated → `skipped`).
   - **`previous_trends`** sent by the backend (30 days, same brand + platform; `rejected` = the
     user deleted it) → momentum + no repeats.
2. Sources are numbered `[S1]…`; one structured LLM call (`_Synthesis`) returns trends citing
   `evidence_ids` + content ideas. Code maps ids → `Evidence{title,url,source}` (unknown ids dropped,
   so URLs can't be invented), computes `confidence` from independent origins (web domain / source
   kind: ≥2 High, 1 Medium, 0 Low), forces Low relevance (score < 0.4) when nothing is cited, fixes
   `momentum` New→Stable for already-shown trends, drops `act_by` outside [today, +90d], cleans hashtags.
3. Response adds `grounded`, `web_searches`, `sources_used[{name,status,items}]`; tokens of both
   calls are summed, `llm_attempts` = search attempts + synthesis attempts.
4. **Target platform (FR-19, fix 2026-07-19):** `ResearchRequest.platform` (backend sends the
   session's platform, e.g. `"FACEBOOK"`, normalized case-insensitively) is injected into the
   prompt AND enforced post-hoc — `platform` of every returned trend/idea is overwritten with
   the target. Payload without `platform` (old backend / daily scheduler pre-update) keeps the
   legacy behavior: model chooses among Facebook/Instagram/Threads.
5. `max_trends` / `max_ideas` (1–20) trim the result; backend maps `articleCount` → `max_ideas`.

**Source philosophy:** NO mock data in research, ever — the model must not reason over fabricated
posts. A missing credential → source `skipped`; a failing API → `[]` (logged); the UI shows
`sources_used` so thin results are visible. Web search costs extra (Anthropic bills per search,
Gemini grounding has its own quota) — `TREND_SEARCH_MAX_USES` caps it.

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
# Trend research — web search step (llm.invoke_grounded) + optional signal sources (§4):
TREND_SEARCH_CALL_TIMEOUT_SECONDS (75), TREND_SEARCH_BUDGET_SECONDS (90), TREND_SEARCH_MAX_USES (5)
# keep TREND_SEARCH_BUDGET + LLM_CHAIN_BUDGET < backend AI_RESEARCH_TIMEOUT_SECONDS (200)
RAPIDAPI_KEY                       # ONE key for all subscribed RapidAPI APIs
                                   # (TIKTOK_RAPIDAPI_KEY legacy, still read as fallback)
YOUTUBE_RAPIDAPI_HOST (yt-api.p.rapidapi.com)
INSTAGRAM_RAPIDAPI_HOST (instagram-social-api.p.rapidapi.com)   # swappable; unknown host →
INSTAGRAM_RAPIDAPI_PATH / INSTAGRAM_RAPIDAPI_PARAM              # declare these two as well
THREADS_ACCESS_TOKEN               # official Meta API, needs threads_keyword_search scope
THREADS_API_BASE (https://graph.threads.net/v1.0)
TRENDS_DEFAULT_REGION (VN)         # ISO region for Google Trends / search when request has none
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
