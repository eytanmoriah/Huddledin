# Huddledin Homework Feedback Tracker

Active feedback from real-user testing of the v2 homework redesign (shipped April 26, 2026).

**Primary tester:** Lauri (specialist) — also testing parent flow on her own household account.

**How to use this file:** Paste WhatsApp messages and screenshots into your Claude chat. Claude will help you triage, classify, and add entries here. Each entry gets a unique ID for cross-referencing in commits and discussion.

---

## Schema

Each entry has:
- **ID** — unique identifier (B-01 = Bug 1, C-01 = Change 1, A-01 = Add-on 1)
- **Status** — `open` / `in progress` / `done` / `wont-fix` / `duplicate`
- **Area** — `parent` / `specialist` / `both` / `infra` (realtime, schema, build system)
- **Reported** — date Lauri sent it
- **Title** — short description (~10 words)
- **Detail** — what Lauri actually said + screenshot description if relevant
- **Reproduction** — steps to reproduce (filled in during triage)
- **Resolution** — commit hash + brief note when done

---

## Active

### Bugs

*Things that don't work as intended. Highest priority.*

<!-- Template:
#### B-01: [Title]
- **Status:** open
- **Area:** parent | specialist | both | infra
- **Reported:** 2026-04-27
- **Detail:** [Lauri's message verbatim. Screenshot description: "[what's visible — labels, what's tapped, what's broken]"]
- **Reproduction:** [TBD during triage]
- **Resolution:** [filled when fixed]
-->

*(none yet)*

### Changes

*Things that work but feel wrong. Layout, wording, prominence. Collect before reacting.*

*(none yet)*

### Add-ons

*New feature requests. Don't promise; collect.*

*(none yet)*

---

## Resolved

*Items that have shipped fixes or design changes. Kept for history — useful when Lauri's intuition matches a future report.*

*(none yet)*

---

## Won't fix / By design

*Items that were reported but reflect intentional design. Keep with reasoning so we don't relitigate.*

*(none yet)*

---

## Triage notes

*Patterns or themes that emerge across multiple items. Useful for spotting "this is one root issue, not five separate bugs."*

*(none yet)*

---

## Reference: where things live in the codebase

For Claude/me when triaging — quick lookup of which file owns which surface:

| Surface | File |
|---------|------|
| Parent homework view | `src/features/homework/parent-view.js` |
| Complete-modal (mark done) | `src/features/homework/complete-modal.js` |
| Specialist list view | `src/features/homework/list-view.js` |
| Specialist detail view | `src/features/homework/detail-view.js` |
| Create/edit homework modal | `src/features/homework/create-modal.js` |
| Templates picker | `src/features/homework/templates.js` |
| Schedule controls | `src/features/homework/schedule.js` |
| Per-exercise rows in create modal | `src/features/homework/exercises.js` |
| Data layer (DB reads/writes) | `src/features/homework/data.js` |
| Schedule resolution helpers | `src/features/homework/data.js` (resolveExerciseSchedule, isExerciseScheduledOn, exerciseSlotsOn) |
| i18n keys (English) | `index.html` ~line 3700 area, search `hw_` and `hw3_` and `hw4_` prefixes |
| i18n keys (Hebrew) | `index.html` ~line 5000 area, same prefixes |

Deferred work that may surface here as bugs masquerading as expected behavior:

| Issue | Where | Phase |
|-------|-------|-------|
| Specialist week strip / activity feed reads from v1 tables (dual-write keeps it fed) | data.js loadHomeworkDetail | 6b |
| Specialist list "X/Y this week" reads from v1 occurrences cache | list-view.js computeWeekStats | 6a |
| Realtime channel pressure for multi-child parents | index.html household channel | 7 |

If Lauri reports something that looks like one of these (e.g., specialist sees stale stats during dual-write transition), note it but don't treat as a bug — it's deferred work.

---

## Conversation handoff template

When starting a new Claude conversation to triage, paste this prompt to get oriented quickly:

```
I'm working through the homework feedback tracker (HOMEWORK_FEEDBACK.md in the Huddledin repo).
Read it for context.
Today's session: [bug triage / working through changes / planning next fix-batch].
[Then paste Lauri's WhatsApp messages and attach any screenshots.]
```
