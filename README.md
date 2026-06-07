# AIMA — AI-powered Social Media Management

AIMA automates social media content generation, scheduling, and analytics through a coordinated AI agent system connected to a full-stack web platform.

> Vietnamese version: [README.vi.md](README.vi.md)

---

## Repository Structure

```
repo/
├── frontend/          # React + TypeScript web app
├── backend/           # Java 21 + Spring Boot REST API
├── ai/                # Python 3.14 AI agent backend
└── docs/              # Project documentation
```

---

## Services

### Frontend (`frontend/`)
React 18 single-page application built with TypeScript, Tailwind CSS, and React Router. Communicates with the backend via RESTful APIs through Axios.

**Stack:** TypeScript · React · Tailwind CSS · React Router DOM · Axios · Vite

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
npm run build     # production build → dist/
```

---

### Backend (`backend/`)
Spring Boot 3 REST API handling business logic, authentication, scheduling, and database operations.

**Stack:** Java 21 · Spring Boot · Spring Security + JWT · OAuth2 · PostgreSQL · Spring Data JPA · Hibernate · Lombok · MapStruct · Validation · Email Service

```bash
cd backend
./mvnw spring-boot:run    # http://localhost:8080
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

**Stack:** Python 3.14 · uv · LangChain · Antigravity SDK · Requests

```bash
cd ai
uv python install 3.14
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
