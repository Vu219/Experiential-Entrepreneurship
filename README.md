# AIMA — AI-powered Social Media Management

AIMA automates social media content generation, scheduling, and analytics through a coordinated AI agent system connected to a full-stack web platform.

> Vietnamese version: [README.vi.md](README.vi.md)

---

## Repository Structure

```
repo/
├── frontend/          # React + TypeScript web app
├── backend/           # Java 21 + Spring Boot REST API
├── ai/                # Python 3.10 AI agent backend
└── docs/              # Project documentation
```

---

## Services

### Frontend (`frontend/`)
React 18 single-page application built with TypeScript, Tailwind CSS, and React Router. Communicates with the backend via RESTful APIs through Axios.

**Stack:** TypeScript · React · Tailwind CSS · React Router DOM · Axios · Vite

**Docs:** [`frontend/README.md`](frontend/README.md) (setup) · [`frontend/CLAUDE.md`](frontend/CLAUDE.md) (architecture) · [`frontend/rule.md`](frontend/rule.md) (UI rules)

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL (backend URL); restart dev after changes
npm run dev       # http://localhost:3000
npm run build     # production build → dist/
```

> The backend address is configured via `VITE_API_BASE_URL` in `frontend/.env` (e.g.
> `http://localhost:8082/api/aima`) — it is never hardcoded in source.

---

### Backend (`backend/`)
Spring Boot 3 REST API handling business logic, authentication, scheduling, and database operations.

**Stack:** Java 21 · Spring Boot · Spring Security + JWT · OAuth2 · PostgreSQL · Spring Data JPA · Hibernate · Lombok · MapStruct · Validation · Email Service

**Docs:** [`backend/README.md`](backend/README.md) (setup) · [`backend/CLAUDE.md`](backend/CLAUDE.md) (architecture & rules)

```bash
cd backend
./mvnw spring-boot:run    # http://localhost:8082/api/aima
./mvnw package            # build → target/*.jar
```

Configure secrets in `backend/src/main/resources/application.yml` or via environment variables:

| Variable | Description |
|---|---|
| `DB_USERNAME` / `DB_PASSWORD` | PostgreSQL credentials |
| `JWT_SECRET` | JWT signing key |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth2 |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | SMTP credentials |

---

### AI Backend (`ai/`)
Python AI agent system that fetches social platform data, runs trend analysis, and generates content using LangChain and the Antigravity SDK.

**Stack:** Python 3.10 · uv · LangChain · Antigravity SDK · Requests

```bash
cd ai
uv python install 3.10
uv sync
uv run main.py
```

Copy `ai/.env.example` to `ai/.env` and fill in credentials:

| Variable | Description |
|---|---|
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Meta Graph API token |
| `FACEBOOK_PAGE_ID` | Target Facebook Page ID |
| `TIKTOK_ACCESS_TOKEN` | TikTok API token |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram API token |

---

## Documentation

| File | Description |
|---|---|
| [`docs/Technical.md`](docs/Technical.md) | Technology stack details |
| [`docs/Business_Analysis.md`](docs/Business_Analysis.md) | Business context and requirements |
| [`docs/Implementation_Strategy.md`](docs/Implementation_Strategy.md) | Implementation roadmap |
