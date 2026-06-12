# REQUIREMENTS.md — Functional Requirements (AIMA)

> FRs listed by feature group. Implementation status is tracked in [PLAN.md](./PLAN.md) — **whenever an FR is completed, check it off there in the same commit/PR.**
> Current platform scope: **Facebook → Instagram → Threads** (in that order).

---

## 1. Account Management
- **FR-01 Register**: sign up with full name, email, password, password confirmation.
- **FR-02 Login**: log in with email + password; invalid → show an error.
- **FR-03 Logout**.
- **FR-04 Profile**: view/update personal information.

## 2. Brand Profile
- **FR-05 Create**: brand name, industry, description, brand voice, target audience, content goals, platforms, frequency, preferred time slots.
- **FR-06 Update**, **FR-07 View**, **FR-08 Delete**.
- **FR-09 Validate**: name + industry + audience must not be empty; select ≥1 platform; frequency must be valid.

## 3. Content Strategy
- **FR-10 Create**: goals, content types, frequency, platforms, time slots, audience, style, desired CTA.
- **FR-11 Update**, **FR-12 List**.
- **FR-13 Activate/Pause**: when paused → the AI creates no new content & does not auto-schedule for that strategy.

## 4. Social Media Connection
- **FR-14 Connect**: Facebook → Instagram → Threads.
- **FR-15 List**: platform name, account name, connection status, connection date, token status.
- **FR-16 Disconnect**, **FR-17 Check connection** before posting.
- **FR-18a** Auto-refresh tokens while still active (token has < 24h remaining and a refresh token exists) → status stays Active.
- **FR-18b** Token fully expired → status `Expired`, prompt the user to reconnect; that platform's `Scheduled` posts → `On Hold`.

## 5. Trend Research (Agent AI)
- **FR-19 Research**: runs automatically on schedule (default **2:00 AM daily**) + a "Research now" button. Only runs if a Brand Profile exists and a Strategy is `Active`. Does not start a new session while the previous one is unfinished.
- **FR-20 Filter by industry** (cosmetics, education, fashion, F&B, technology, services...).
- **FR-21 Rate relevance**: High / Medium / Low.
- **FR-22 Create content ideas** from trends: trend name, suitable platform, relevance, description, execution suggestions, related goals.
- **FR-23 Save the research session**.

## 6. Content Generation (Agent AI)
- **FR-24** Generate content from brand profile + strategy + trend + idea + platform.
- **FR-25 Video script**: hook, main content, shot suggestions, CTA.
- **FR-26 Caption**, **FR-27 Hashtags**, **FR-28 CTA**.
- **FR-29 Media prompt**: ⚠️ the MVP only produces a **text prompt describing** the image/video; it does NOT generate media itself.
- **FR-30** Check brand voice.
- **FR-31** Save drafts (`Draft`/`Generated`).
- **FR-32 Regenerate**, **FR-33 Manual edit**, **FR-34 Review** before posting.

## 7. Policy Violation Handling (do NOT build a custom filter — SEC-06)
- **FR-35** Receive the platform's error response (HTTP 400/403 policy violation), classify it as a policy violation, **no retry**, store the original error code + message, set `Failed`, notify the user.
- **FR-36** Move the violating post to `Failed` + store the error.
- **FR-37** Distinguish policy violations from technical errors.
- **FR-38** Notification: which platform, the reason, and the next steps.
- **FR-39** Allow edit/regenerate then reschedule.

## 8. Platform Formatting
- **FR-40** Create a dedicated version for each selected platform.
- **FR-44 Facebook**: longer caption, clear CTA, shareable, combines image/video/link.
- **FR-42 Instagram**: vertical video / square-vertical image, emotive caption, brand hashtags, highly visual.
- **Threads**: (per the current scope — short, conversational format; details follow the Threads API).
- *(FR-41 TikTok, FR-43 YouTube Shorts, FR-45 LinkedIn — out of the current scope.)*
- **FR-46** Save each formatted `ContentVersion`.

## 9. Scheduling
- **FR-47 Create schedule**: content, platform, date, time, status.
- **FR-48 Golden hour suggestions**: based on platform, audience, historical data, preferred time slots.
  - Default time slots — Facebook: 8–9 AM, 1–2 PM, 8–9 PM. Instagram: 8–10 AM, 12–1 PM, 7–9 PM.
  - After **≥10 posts with analytics** → switch to data-driven suggestions.
- **FR-49 Queue**, **FR-50 Update schedule**, **FR-51 Cancel schedule** (unpublished posts only).

## 10. Auto-Posting
- **FR-52** Post on time, **FR-53** call the platform API, **FR-54** receive the result.
- **FR-55** Save the status (see the state machine in WORKFLOWS.md).
- **FR-56 Retry policy**: only retry temporary errors (timeout/rate limit/network), up to 3 times (at 5/15/30 minutes). Do not retry permanent errors.
- **FR-57** Notify on failure; **FR-58** the user resolves it (edit content/media/time, reconnect, repost).

## 11. Performance Analysis
- **FR-59** Collect: views, likes, comments, shares, saves, CTR, conversion, watch time.
- **FR-60** Store in the DB, **FR-61** display to the user, **FR-62** compare posts.
- **FR-63** Analyze success factors (hook, caption, hashtags, CTA, media, timing, platform).
- **FR-64** Produce optimization insights.

## 12. Strategy Optimization
- **FR-65** Propose strategy adjustments based on data.
- **FR-66** Propose improvements for future posts.
- **FR-67** Store the adjustment history.
- **FR-68** The user accepts/rejects proposals.

## 13. Error Management
- **FR-69** Detect unconnected social accounts → block posting + notify.
- **FR-70** Expired token → `Failed` + require reconnect/refresh.
- **FR-71** Invalid media format → notify + suggest a fix.
- **FR-72** Platform API error → log + retry where appropriate.
- **FR-73** Restricted account → stop posting + notify.
- **FR-74** Log system errors.

## 14. Notifications
- **FR-75** Post published, **FR-76** post failed, **FR-77** review needed, **FR-78** reconnection needed, **FR-79** new insight available.

## 15. Admin
- **FR-80** Manage users, **FR-81** system status, **FR-82** rejected content, **FR-83** posting errors, **FR-84** system logs.

## 16. Onboarding
- **FR-85 Wizard** (new users): Step 1 Brand Profile (required) → Step 2 connect ≥1 social account → Step 3 first Strategy → Step 4 quick tour (skippable). The wizard can be skipped but reappears when the user tries to create content without a Brand Profile.
- **FR-86** Setup progress bar on the dashboard; hidden once complete.

## 17. Content Library
- **FR-87** View all ContentItems (filter by status/platform/date/industry; search by keyword in caption/script).
- **FR-88** Reuse: regenerate from an old item → creates a new item, the original is untouched.
- **FR-89** Delete: only when `Draft`/`Generated`; deleting `Scheduled`/`Posting`/`Posted` is forbidden; deleting an item also deletes its related ContentVersions.

---

## Non-functional (summary)
Easy to use • responsive (desktop/laptop/tablet) • fast response times • **async AI processing** • account & token security • role-based access • data integrity • platform extensibility • maintainable (modular) • logging • retry • consistent UI/UX • AI transparency (mark content as AI-generated / needs review / auto-posted) • content safety.
