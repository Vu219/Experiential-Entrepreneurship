# UI_API.md — UI, API, Security, Integration (AIMA)

---

## UI Requirements

| ID | Page | Content |
|----|-------|----------|
| UI-01 | Landing Page | Hero, user pain points, the AIMA solution, key features, process, benefits, sign-up/trial CTA |
| UI-02 | Dashboard | Posts created / scheduled / published / failed; performance overview; new insights; setup progress bar (FR-86) |
| UI-03 | Brand Profile | Create/edit brand profiles |
| UI-04 | Content Strategy | Goals, frequency, platforms, posting schedule |
| UI-05 | Trend Research | List of trends + AI-suggested content ideas |
| UI-06 | Content Workspace | View/edit/approve/regenerate content |
| UI-07 | Calendar / Schedule | Posting calendar by day/week/month; create-schedule modal = the shared `SchedulePlanner` (also step 4 of the create wizard); `?day=YYYY-MM-DD` deep link; hold reasons shown on held schedules |
| UI-08 | Analytics | Performance data + insights |
| UI-09 | Social Account | Connect / status / disconnect |
| UI-10 | Admin Dashboard | Users, system errors, content awaiting review |

**UI/UX principles**: simple and usable for non-technical users; responsive (desktop/laptop/tablet); consistent, modern design; **AI transparency** — clearly mark which content is AI-generated / needs review / was auto-posted.

---

## API

- **API-01** Unified response format:
  ```json
  { "code": 200, "message": "Success", "result": {} }
  ```
- **API-02** Every user-data API requires authentication.
- **API-03** Authorization checks: users can only access their own data; admins have administrative rights.
- **API-04** Validate input before processing.
- **API-05** Return clear errors with frontend-friendly messages.

### Scheduling API (2026-09-30)

| Method | Path | Notes |
|---|---|---|
| PATCH | `/content-items/{id}/review` | Change `reviewStatus`; resending the current value is a no-op |
| GET/PUT | `/users/me/publishing-settings` | Timezone (IANA), require approval, conflict window, brand-voice blocking + threshold |
| POST | `/schedules` | One schedule; optional `Idempotency-Key` header; mode SCHEDULE/NOW |
| POST | `/schedules/batch` | Many rows, one transaction per row, per-row result (`code`/`message`/`schedule`/`jobId`/`warnings`) and per-row `idempotencyKey` (same key + same payload → replay, different payload → 2139) |
| POST | `/schedules/{id}/publish-now` | Same dispatch path as the scheduler; rejected when unapproved under require-approval (2138) or still held (2140) |
| GET | `/schedules/suggested-slots?accountId=&count=` | Golden-hour slots in the user's timezone, skipping the conflict window; nothing is reserved |
| PUT | `/schedules/{id}` | New time and/or `platformAccountId` of the same platform |
| GET/POST | `/admin/maintenance/content-status-repair` | ADMIN only. Dry-run report / apply with `planToken` (409/2144 when data changed). Never runs on boot |

Schedule responses carry `holdReasons`, `overdue`, `jobId`, `warnings`; content items carry `reviewStatus`, `needsAttention` and `versions[].scheduleStatus`. Times are ISO-8601 with an offset; responses are UTC instants.

---

## Security

| ID | Requirement |
|----|---------|
| SEC-01 | Passwords encrypted, never stored in plain text |
| SEC-02 | Authentication tokens protect the APIs |
| SEC-03 | Social access/refresh tokens stored securely, never exposed to the frontend |
| SEC-04 | Clear User / Admin role separation |
| SEC-05 | Users cannot access other users' data |
| SEC-06 | **Do not build a custom content filter** — only handle platform rejections properly; record errors clearly, never retry violation-type errors |

---

## Integration

| ID | Integration | Notes |
|----|----------|---------|
| INT-01 | Facebook | Connect, post, fetch analytics (where the API allows) |
| INT-02 | Instagram | Connect, post/Reels, analytics |
| INT-03 | Threads | Connect, post, analytics |
| INT-04 | AI Model | Research, generate, format, analyze, optimize |

> Platform rollout order: **Facebook → Instagram → Threads**. Design the integration layer as adapters/interfaces to easily add new platforms later (NFR-09).

---

## Key Technical Notes

- **Async (NFR-04)**: research, generate, format, auto-posting, analyze → background jobs + scheduler.
- **Scheduler**: checks the posting calendar and triggers on time; runs periodic research (2:00 AM).
- **Token refresh job** (FR-18a): auto-refresh when the token has < 24h remaining.
- **Retry job** (FR-56): 3 attempts, at 5/15/30 minutes, temporary errors only.
- **Logging** (NFR-11): log AI errors, posting errors, and platform API calls.
