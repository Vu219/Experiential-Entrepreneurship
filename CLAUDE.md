# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

## 🛠️ Project Structure

```
repo/
├── frontend/   # React + TypeScript (Vite, Tailwind, React Router)
├── backend/    # Java 21 + Spring Boot (PostgreSQL, JWT, OAuth2)
├── ai/         # Python 3.10 AI backend (LangChain, platform connectors)
└── docs/       # Project documentation
```

## 🛠️ Project Commands

### AI backend (uv)
```bash
cd ai
uv run main.py        # Run demo workflow
uv sync               # Install dependencies
uv python install 3.10
```

### Frontend (Node)
```bash
cd frontend
npm install           # Install dependencies
npm run dev           # Dev server on http://localhost:3000
npm run build         # Production build
```

### Backend (Maven)
```bash
cd backend
./mvnw spring-boot:run   # Run on http://localhost:8080
./mvnw package           # Build JAR
```

## 📋 Progress Tracking (MANDATORY)

`docs/PLAN.md` is the implementation checklist for the whole project.

- **Whenever any function/feature is completed (implemented + verified), update `docs/PLAN.md` in the same commit/PR**: change its `[ ]` to `[x]` and append the completion date.
- Checklist items can be done in **any order** — there is no required sequence.
- If scope changes, update `docs/PLAN.md` together with the related doc (REQUIREMENTS.md, etc.).

## 🧠 Behavioral Guidelines

These principles help ensure clean code, surgical changes, and effective problem-solving.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

---

# AIMA Project Guide

> This section is for Claude Code. Read it carefully before writing or editing code.
> Goal: help the AI quickly understand the context, architecture, conventions, and scope of the AIMA project.

---

## 1. What is the project?

**AIMA – AI Marketing Assistant** is an AI platform that supports **automated multi-platform content marketing** for individual content creators, micro-businesses, and small businesses (SMEs).

The system runs through the entire pipeline:

```
Brand Profile → Content Strategy → Trend Research → Generate Content
→ Format per platform → Schedule → Auto Publish → Analytics → Optimize Strategy
```

AIMA acts as an intelligent marketing assistant: the user configures their brand once, and the AI handles the rest (research, creation, publishing, analysis).

---

## 2. ⚠️ Important scope (READ BEFORE CODING)

### Platforms — only build in this order
**Facebook → Instagram → Threads** (finish one before moving to the next).

> Other platforms (TikTok, YouTube Shorts, LinkedIn) **are in the original requirements but are NOT in the current scope**. Do not build integrations for them unless explicitly requested. However, the code must be designed to be **easily extensible** to add more platforms (NFR-09).

### MVP scope — limits to remember
- **Do not auto-generate images/videos.** The AI only creates **media prompts** (text descriptions) for the user to produce themselves (FR-29).
- **Do not build a custom content filter.** The system only **handles violation responses** when a platform rejects a post (SEC-06, FR-35).
- **Soft delete** by default (mark `deleted_at`), except for account deletion under GDPR.

---

## 3. Actors (roles in the system)

| Actor | Main role |
|-------|-----------|
| **User / Business Owner** | Create brand profile, strategy, connect social accounts, review/edit content, handle failed posts |
| **AI Agent** | Research trends, generate content, format per platform, suggest prime time, analyze, optimize strategy |
| **Social Platforms** | API connections, receive posts, return results, provide analytics |
| **Analytics System** | Collect views/likes/comments/shares/saves/CTR/conversion/watch time |
| **Admin** | Manage users, monitor the system, handle violating/failed posts, view logs |

---

## 4. Architecture & technical principles

### Asynchronous (NFR-04) — VERY IMPORTANT
Time-consuming AI tasks **must run async / as background jobs** and must not block the UI:
- Trend research
- Content generation
- Content formatting
- Auto posting
- Performance analysis

→ Requires a **job queue + scheduler/worker**. When coding, every AI/posting task should return a job immediately and process in the background.

### General principles
- **Unified API response** (API-01): `{ "code": 200, "message": "Success", "result": {} }`
- **Auth required** for every API involving user data (API-02, SEC-02).
- **Authorization**: Users only see their own data; Admin has administrative rights (API-03, SEC-04/05).
- **Validate input** before processing (API-04).
- **Clear errors**, with friendly messages for the frontend (API-05).
- **Hash passwords** — never store plain text (SEC-01).
- **Keep social tokens secure**, never exposed to the user (SEC-03, NFR-06).
- **Full logging** for debugging (NFR-11, FR-74).
- **Clear modularization** for maintainability & extensibility (NFR-09/10).

---

## 5. Core business rules

| Code | Rule |
|------|------|
| BR-01 | A Brand Profile must exist before the AI generates content |
| BR-02 | One brand can have multiple Content Strategies |
| BR-03 | The AI generates content **based on** brand profile + strategy, not randomly |
| BR-04 | Content must be formatted specifically for each platform |
| BR-05 | Only publish to connected platforms |
| BR-06 | Posts must have a clear status (see section 6) |
| BR-07 | Platform rejection due to violation → **stop retrying**, store the error, notify the user |
| BR-08 | Posting failure → store the error + notify the user |
| BR-09 | After a successful post → collect analytics |
| BR-10 | The AI uses past analytics to optimize future strategy |

---

## 6. Post status

**Normal flow:**
`Draft → Generated → Formatted → Scheduled → Posting → Posted → Analyzing → Optimized`

**Review-required flow:**
`Generated → Need Review → Approved → Scheduled`

**Error flow:**
`Posting → Failed → Retrying → Posted`

Special status: `On Hold` (when a platform token expires, a Scheduled post is held back — FR-18b).

---

## 7. Retry & error policy (FR-56) — don't get this wrong

**RETRY** (temporary errors): API timeout, rate limit, network error.
- Up to **3 times**: 1st after **5 minutes**, 2nd after **15 minutes**, 3rd after **30 minutes**.
- After 3 failures → `Failed` + notify the user.

**DO NOT RETRY** (permanent errors): expired token, invalid media format, locked account, **policy-violating content**.

---

## 8. Documentation structure in the repo

Read the files in `docs/` for details:

- `docs/REQUIREMENTS.md` — all Functional Requirements (FR), grouped.
- `docs/DATA_MODEL.md` — entities, attributes, relationships, deletion rules.
- `docs/WORKFLOWS.md` — main business flows (BF) + exception flows (EX).
- `docs/UI_API.md` — UI, API, security, integration requirements.
- `docs/GLOSSARY.md` — terminology + assumptions + constraints.

---

## 9. When working, Claude Code should:

1. **Always respect the scope**: only Facebook → Instagram → Threads; no image/video generation; no content filter.
2. **Every AI/posting task → async job**, never block the request.
3. **Follow the post status state machine**; do not invent new statuses.
4. **Apply the correct retry policy** from section 7.
5. **Comply with the unified API response format** and authorization rules.
6. **Soft delete + cascade rules** per `docs/DATA_MODEL.md`.
7. When information is missing → ask, don't guess business values.
