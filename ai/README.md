# AIMA AI Service

Python 3.10 + FastAPI + LangChain. Hosts the four AIMA agents and exposes them as
HTTP endpoints that the Spring Boot backend calls as async jobs.

## Agents → endpoints

| Endpoint | Agent | Requirements |
| --- | --- | --- |
| `POST /research` | Trend Research | FR-20, FR-21, FR-22 (analysis half of FR-19/23) |
| `POST /generate` | Content Generator | FR-24–FR-30, FR-32 (`regenerate_from`) |
| `POST /format` | Platform Formatter | FR-40, FR-42, FR-44, Threads |
| `POST /analyze` | Optimizer — performance | FR-63, FR-64 |
| `POST /optimize` | Optimizer — proposals | FR-65, FR-66 |
| `POST /golden-hours` | Optimizer — scheduling | FR-48 (defaults → data-driven ≥10 posts) |
| `GET /health` | — | liveness + active provider |

Request/response shapes are defined in `src/schemas.py` (mirrors `docs/DATA_MODEL.md`).
The service is **stateless** — all persistence (sessions, drafts, versions, insights)
lives on the backend.

## Configuration

Copy `.env.example` → `.env`. Key settings:

- `LLM_PROVIDER` — `anthropic` (default) or `google`. The agents are provider-agnostic
  (LangChain `with_structured_output`), so either backend returns the same typed JSON.
- `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`)
- `GOOGLE_API_KEY` + `GOOGLE_MODEL` (default `gemini-2.5-pro`)
- `FACEBOOK_PAGE_ACCESS_TOKEN` — optional; trend research falls back to mock data without it.

## Run

```bash
cd ai
uv sync                                   # install deps
uv run uvicorn main:app --reload          # dev server on :8000
uv run python main.py                      # prod-style run
```

Interactive API docs: http://localhost:8000/docs

## Smoke test (no API key needed)

```bash
uv run python -c "from fastapi.testclient import TestClient; import main; \
print(TestClient(main.app).get('/health').json())"
```

The LLM-backed endpoints require a valid `ANTHROPIC_API_KEY` (or `GOOGLE_API_KEY`).
Without a key they return HTTP 503 with a clear message. `/golden-hours` is deterministic
and works without any key.
