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
