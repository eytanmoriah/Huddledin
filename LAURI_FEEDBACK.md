# Lauri Feedback Tracker

**Created:** April 27, 2026
**Last updated:** April 29, 2026 (post calendar v2 + D6 ship; 11 items closed)
**Source:** Triage session with Eytan + Claude on April 27, 2026 (Lauri's first day testing Huddledin post homework v2 launch). Updated April 29 after the calendar v2 + D6 build closed 11 of the original 21 items plus added 6 new items discovered during the build.

**Companion docs:**
- `LAURI_FEEDBACK_EXECUTION_PLAN.md` — batch-by-batch execution plan
- `CLAUDE.md` — codebase rules and standing invariants
- `HANDOVER.md` — homework v2 architecture and Phase 6/7 deferred work

---

## How to read this file

Each entry has an ID, classification, severity, surface, description, and (where relevant) open questions, implementation notes, and code path hints.

**Classes:**
- **B** = Bug (broken behavior — must fix)
- **C** = Change (works as designed but design needs to shift)
- **A** = Add-on (new functionality)
- **D** = Deferred / phase-watch (real observation, action is "wait and see")
- **N** = New (added April 29 from calendar v2 work — not part of original 21)

**Severity:** High / Medium / Low

Entries marked "investigation" require an audit-first step before any code changes.

---

## Status summary

### Open (12 items)

| ID | Sev | Area | Status | Title |
|---|---|---|---|---|
| B-01 | High | Auth | Open | Google OAuth shows raw Supabase URL |
| C-04 | High | Homework | Open (pair w/ A-08) | Move attachments from homework-level to per-exercise |
| A-05 | High | Strategic | Open (HIPAA-blocked for shipping) | Create homework tasks from progress notes |
| A-06 | High | Homework | Open | "My Exercises" library |
| A-08 | Med | Storage | Open | Pick from My Storage in any file picker (global) |
| N-01 | High | Infra | Open | Realtime channel saturation (~20 channels vs ~7-8 limit) |
| N-02 | Low | Calendar | Open | Auto-scroll into view after drag-drop |
| N-03 | Med | Calendar | Open | Mobile drag-to-create via long-press |
| N-04 | Low | Calendar | Open | Personal block "Patient cancelled" attendance label |
| N-05 | Med | Calendar | Open | Patient search in create modal dropdown |
| N-06 | Low | Storage | Open (intermittent, pre-existing) | Storage 544 errors |
| N-07 | Low | Reports | Open (data integrity) | vault_notes report-builder upserts write NULL household_id |
| D-01 | Low | Homework | Watch (Phase 6) | Activity feed shows duplicated completions |

### Closed today (April 29, 2026) — 11 items

| ID | Sev | Area | Resolution |
|---|---|---|---|
| B-02 | High | Calendar | Closed by calendar v2 (D2a series generation, commit affb791) |
| B-03 | Med | Homework | Schedule pills no longer collapse panel |
| B-04 | Med | Notifications | "(+N more)" suffix investigated and resolved |
| B-05 | High | Notifications | Parent task notifications fixed |
| B-06 | High | Homework | Therapist notes now appear on parent view |
| C-01 | Low | Specialist UI | Reports bubble subtitle removed |
| C-02 | Med | Specialist UI | Global Chat bubble removed (paired with A-01) |
| C-03 | Med | Cleanup | Demo mode removed (3 lingering guard checks remain as harmless dead code) |
| C-05 | Low | Homework | "Cadence" → "Frequency" |
| C-06 | Low | Homework | "Reset to homework schedule" link removed |
| A-01 | Med | Specialist UI | Replacement tile shipped |
| A-02 | Med | Storage | Inline file preview shipped |
| A-03 | Med | Calendar | Closed by calendar v2 (D1 schema + D2a) |
| A-04 | High | Calendar | Closed by calendar v2 D4 (Day view Stage 1 + Week view Stage 2) |
| A-07 | High | Calendar | Closed by calendar v2 D5 attendance tracking |

---

# OPEN BUGS

---

## B-01 — Google OAuth shows raw Supabase URL instead of "Huddledin"

**Type:** Bug (infra/config, not source code)
**Severity:** High (trust/conversion issue on sign-up flow — every new user sees this)
**Surface:** Google "Sign in with Google" account picker, "to continue to" line. Affects all users signing in via Google, both parent and specialist.

**Description:** During Google OAuth sign-in, the account picker shows "to continue to **smgbojgrdezasxciloll.supabase.co**" — the raw Supabase project URL. Should show "Huddledin" or `huddledin.com` for trust and brand consistency. Looks phishy to a cautious user.

**Root cause:** OAuth redirect URI domain is the Supabase project URL by default. Google shows that domain in the consent screen until either (a) a custom auth domain is configured on Supabase, or (b) the OAuth app is fully verified on Google with App name + verified domain.

**Fix paths:**
1. **Custom Supabase auth domain** (faster): Add `auth.huddledin.com` CNAME → Supabase auth endpoint. Update Google Cloud Console OAuth client authorized redirect URIs. Update Supabase auth settings to use the custom domain. Test sign-in. Needs Supabase Pro (active) + DNS access.
2. **Full OAuth consent screen verification** (required eventually): Google Cloud Console → OAuth consent screen → set App name = "Huddledin", App domain = `huddledin.com`, support email, privacy policy URL, terms URL. Submit for verification. Wait days-to-weeks for Google review.

**Recommended:** Do path 1 now (immediate fix, ~1 hour of config work). Path 2 is required pre-launch anyway (HIPAA + going public on app stores).

**Code path:** N/A — infra/config only. No source changes in Huddledin repo. Possibly update environment variables / `vercel.json` if redirect URLs hardcoded anywhere; audit during fix.

**Notes:**
- Touches authentication. Test with a non-production account first; OAuth misconfiguration locks users out.
- Worth coordinating with the pre-launch HIPAA work (BAAs, lawyer review).
- This is operations, not coding. Don't hand to Claude Code — do manually with the docs.

---

# OPEN CHANGES

---

## C-04 — Move file attachments from homework-level to per-exercise (multiple files each)

**Type:** Change (homework v2 architecture — schema + UI)
**Severity:** Medium-High (clinical workflow — multi-exercise homeworks need per-exercise demos/worksheets)
**Surface:** Homework v2 — create/edit modal (specialist), parent view, complete modal (parent)

**Description:** The "Attach file" button currently sits at the homework level. Move it entirely to each exercise. Each exercise can have **multiple** files attached. The homework-level Attach button is removed entirely (no homework-level attachments).

**Why:** A homework with multiple exercises often needs per-exercise media (demo video for "tip to spot," worksheet PDF for a different exercise, etc.). One bucket at homework level makes parents guess which file goes with which exercise.

**Schema changes required:**
- Add attachment storage to `homework_exercises`. Recommended: `attachments` JSONB column (array of `{filename, storage_path, size, mime_type, uploaded_at}`). Simpler than separate table.
- Remove attachment columns from `homework_tasks` (or stop reading/writing them — drop later).
- RLS: same scope as parent homework. Inherit, don't duplicate policies.

**UI changes required:**
1. **`create-modal.js`:** Remove homework-level "Attach file" button.
2. **`exercises.js`:** Add "Attach files" control to each exercise row. In expanded "Less/More" area alongside Optional details, measure buttons, Customize schedule. Multi-upload, list with remove (×) per file.
3. **`parent-view.js`:** Render attached files next to/under each exercise. Tap = view (uses A-02's preview when shipped, or download fallback).
4. **`complete-modal.js`:** Show attachments for that exercise when parent opens slide-up modal.
5. **`detail-view.js`:** Specialist detail view shows per-exercise attachments in each exercise card.

**Migration:**
- Lauri is first real tester — minimal or no production data with homework-level attachments.
- If any exist, attach to first exercise. If zero, no migration needed.

**Open questions:**
- File size / count limits per exercise? Cap N files (5?) and total size (50MB?)
- Storage path naming: existing uses `homework_id`. New paths should use `homework_exercise_id`.
- Reordering: when drag-reorder changes exercise order, attachments must travel with their exercise. Should be automatic if stored on `homework_exercises`.
- **Templates with attachments:** Do `homework_templates.exercises_json` need to support per-exercise attachments? Recommend v1 of C-04 supports attachments on real homework only, NOT on templates. Track separately if needed.

**Implementation plan:**
- **Step 0:** Audit current attachment code path, schema columns, UI handlers, parent display.
- **Step 1:** Schema migration via Supabase SQL editor.
- **Step 2:** Update `exercises.js` for per-exercise attachment UI. Update `create-modal.js` to remove homework-level button.
- **Step 3:** Update parent-view + complete-modal.
- **Step 4:** Update detail-view.
- **Step 5:** Migrate existing homework-level attachments (likely none).
- **Step 6:** Drop deprecated columns (later cleanup).

**Code path:** All in `src/features/homework/`. Schema in Supabase. No new API endpoints (uses Supabase Storage directly).

**Notes:**
- Multi-surface change — benefits from sub-phase splitting with verification gates.
- Don't ship without verifying parent view too.
- **Pair with A-08 Tier 1** (storage picker integration) — design together.

---

# OPEN ADD-ONS

---

## A-05 — Create homework tasks from progress notes

**Type:** Add-on (strategic feature — biggest design lift)
**Severity:** High strategic value. Medium urgency. **HIPAA-blocked for shipping** — design proceeds, build waits on Anthropic BAA.
**Surface:** Wherever progress notes live today (audit needed), homework create modal

**Description:** Specialist writes progress notes during/after a session. App turns those notes into a draft homework task — exercises pre-filled with reps, duration, and schedule suggestions. Specialist reviews, edits, and saves.

**Three possible flavors:**
1. **Manual:** "Create homework from this" button on notes → opens homework modal pre-filled with notes content. Lowest cost.
2. **AI-suggested:** AI reads notes, generates exercises with reps/duration/schedule. Specialist reviews, edits, accepts. Highest value, highest cost.
3. **Hybrid:** AI suggests structure; specialist fills details manually.

Recommended: design for Flavor 2, with Flavor 1 as fallback if AI quality isn't good enough at first.

**Anthropic API integration:**
- Reuse `api/report-ai.mjs` pattern. New action: `notes-to-homework`.
- Vercel Hobby at 12-function limit — must consolidate, not add new endpoint.
- Rate limit: existing `ai_usage` (20/hr per user) probably sufficient.
- Auth gate: behind `_hasSpecAiAccess()`.

**Open design questions:**
1. Where do progress notes live today? (Audit first.)
2. Manual / AI / hybrid?
3. Pre-fill format: full draft or just title + description?
4. Does AI suggest schedules, or specialist sets them after seeing exercises?
5. Auto-attach to child the notes are for?
6. Should AI match suggestions to specialist's existing template/exercise library? (Strong synergy with A-06.)
7. Output review: full draft first, or fills modal directly?
8. Multi-child notes: how does it branch?
9. **Privacy/PHI:** notes contain heavy PHI. Sending to Anthropic requires Anthropic BAA. **Feature is HIPAA-blocked until BAAs in place.** Design can proceed; shipping cannot.

**Suggested design session prompt:**
```
Time to design A-05 (homework from progress notes).
Read CLAUDE.md, LAURI_FEEDBACK.md, and the homework v2 module structure
in src/features/homework/.

First step: audit-only — find where "progress notes" or session
documentation lives in Huddledin today. Report findings before any design.
Then we design the full feature together.
```

**Code path (likely):** Progress notes surface (TBD), `create-modal.js`, `api/report-ai.mjs` (new action). DB-wise: probably no new tables; uses homework_tasks + homework_exercises.

**Notes:**
- Defines a clinical-workflow product. Worth doing well.
- Mockup-first essential — AI feature UX is hard without seeing it.
- High-leverage for specialist AI subscription value prop.
- Strong design synergy with A-06 (AI could route through library).

---

## A-06 — "My Exercises" library — save individual exercises and add to homework from library

**Type:** Add-on (homework v2 expansion)
**Severity:** High strategic value (saves significant clinical re-typing). Medium urgency.
**Surface:** Homework v2 — create/edit modal (specialist), new library management UI

**Description:** Today only whole homework structures can be saved as templates. Add individual exercise reusability. New "My Exercises" library — specialist saves exercises one by one, picks from library when building any homework. Homework templates continue to exist independently.

**Naming:** "My Exercises" matches existing "My Templates" (homework templates) and "My Phrases" (report builder).

**Architectural decision:** Option A — parallel stores. Add `specialist_exercises` table alongside existing `homework_templates`. Templates continue to embed exercises as JSON in `exercises_json`. If duplication painful later, refactor.

**Schema changes required:**
- New table: `specialist_exercises`
  - `id UUID PRIMARY KEY`
  - `specialist_user_id UUID` (FK to profiles, owner)
  - `title TEXT NOT NULL`
  - `details TEXT NULL`
  - `measure_type TEXT NULL` (`'none'` | `'sets_reps'` | `'minutes'`)
  - `measure_value JSONB NULL`
  - `created_at`, `updated_at`
  - **NO schedule fields** — schedule comes from homework, exercise inherits/overrides per v2 model.
  - **NO attachments in v1** — defer until C-04 ships and patterns clearer.
- RLS: specialist owns own library. Mirror `specialist_phrases`.

**UI changes required:**
1. **Save to library — `exercises.js`:** Icon/button on each exercise row near X delete. Tap → save title + details + measure to `specialist_exercises`. Disabled if title empty.
2. **Pick from library — `create-modal.js` or `exercises.js`:** Below exercises list, add "+ From library" button. Tap → picker modal with search + multi-select. "Add selected" injects into homework.
3. **Library management:** New surface (specialist settings). List view, edit modal, delete. v1 minimum. No categories/tags.
4. **New module:** `src/features/homework/exercise-library.js`

**Schedule handling:** When picking from library, exercises inherit homework's schedule. Per-exercise overrides start NULL. Library entries don't carry schedule data.

**Open questions:**
- "+ From library" when library empty: show disabled with helper text, or hide? Recommend: disabled with helper.
- Edit existing library entry vs. save new copy: always save as new from homework modal. Updates happen in library UI.
- Measure value storage format: mirror `homework_exercises` exactly.
- Future hooks: A-05 might generate AI-suggested exercises. Should they route through library? Probably directly to homework — library is for *user-curated* reusables.

**Implementation plan:**
- **Step 0:** Audit "Save as template" code path, `specialist_phrases` patterns, exercise row rendering.
- **Step 1:** Schema migration. Mirror `specialist_phrases` patterns + RLS.
- **Step 2:** New module `exercise-library.js` with CRUD + picker. Wire to `window.HUD_HOMEWORK.exerciseLibrary`.
- **Step 3:** "Save to library" button on exercise rows.
- **Step 4:** "+ From library" button on create-modal.
- **Step 5:** Library management UI in specialist settings.
- **Step 6:** Manual end-to-end test.

**Code path:** New module `src/features/homework/exercise-library.js`. Edits to `create-modal.js` and `exercises.js`. New table `specialist_exercises`. Library management UI location TBD.

**Notes:**
- Mirror `specialist_phrases` patterns where possible.
- Sub-phase splitting: schema → save → pick → manage.
- Mockup of picker recommended before building.
- **Strong synergy with A-08 picker component** — reuse the same picker for "+ From library" and file storage selection.

---

## A-08 — Pick from My Storage in any file picker (global pattern)

**Type:** Add-on (cross-cutting — affects every file/photo picker)
**Severity:** Medium (workflow friction — currently forces re-upload, creates duplicates). Highest impact paired with C-04.
**Surface:** All file pickers — homework attachments, chat photos/files, report builder images, profile/branding. Both specialist and parent sides.

**Description:** Whenever app prompts for file/photo upload, in addition to device file picker, give option to pick from files already in app storage. No re-upload — reference existing storage path.

**Storage sources visible in picker:**
- **My Storage** (specialist) OR **Household Storage** (parent) depending on role
- **Patient/child-specific files** when picker is in child-scoped context
- Clear visual sectioning ("Files for Shalev" / "My Storage")

**Tiered implementation:**
- **Tier 1 — Homework attachments.** Highest impact, especially after C-04. Pair tightly with C-04.
- **Tier 2 — Chat photos/files.** Common, high frequency.
- **Tier 3 — Report Builder images.** Moderate frequency.
- **Tier 4 — Profile/branding images.** Low frequency, low priority.

**UX design:**

Tap any "Attach file" / "Add photo" / etc.:
- Chooser sheet with two options:
  - **Upload from device** → native file picker (existing)
  - **Pick from My Storage** → in-app file browser modal
- Browser modal:
  - Top: child-specific files (when child-scoped context)
  - Below: My Storage (general)
  - Search field
  - List or grid view (thumbnails for images, icons for other types)
  - Tap file → selected, returned to original picker context
  - Multi-select when context supports it (per-exercise multi-attachment from C-04)

**Implementation considerations:**
- Build **reusable "file picker with storage source" component** — don't duplicate per surface.
- File reference vs. upload distinction at data layer:
  - Picked-from-storage = reference existing path (small DB write, no upload)
  - Upload from device = existing flow
- Backend doesn't change. Storage paths are paths.
- HIPAA-friendly: no third-party integrations.

**Open questions:**
- Picker UX: chooser sheet vs. combined picker. Recommend chooser sheet.
- File browser layout: list with thumbnails vs. grid?
- Search scope: just visible folder, or full library? Recommend full library by filename.
- Empty state: "No files in your storage yet. Upload from device."
- File-type filtering: hide non-image files when context expects images? Recommend yes (mirror `accept` attribute).
- Permissions: specialist all their storage, parent household-shared. RLS applies.
- **Cross-feature:** When C-04 ships per-exercise multi-attachment, picker used N times per homework. Multi-select per picker session valuable.

**Implementation plan:**
- **Step 0:** Audit every `<input type="file">` and file picker code path. Inventory surfaces.
- **Step 1:** Build reusable file picker component.
- **Step 2 (Tier 1):** Wire into homework. Pair with C-04.
- **Step 3 (Tier 2):** Wire into chat composer.
- **Step 4 (Tier 3):** Wire into report builder.
- **Step 5 (Tier 4):** Wire into profile/branding.

**Code path (likely):**
- New shared component, e.g., `src/features/file-picker/`
- Per-surface wire-ups across homework modules, chat composer, report builder, settings
- No backend changes

**Notes:**
- **Strong synergy with C-04** — design C-04's attachment UI with A-08's picker in mind, even if A-08 full implementation comes after.
- **Strong synergy with A-06** — same picker pattern for "+ From library."
- Reusable component pays back across many surfaces.
- Mockup-first for picker UI.
- Future: "save attached file from chat to My Storage" (inverse direction) easy with same infrastructure.

---

# NEW ITEMS (discovered during calendar v2 build, April 29 2026)

---

## N-01 — Realtime channel saturation: parents with many children exceed Supabase listener limit

**Type:** Architectural debt (infra-level)
**Severity:** High (silent failure mode — affects every parent with 5+ children, causes 3-10s delay in new appointment / message visibility)
**Surface:** Parent realtime updates across appointments, messages, vault notes, files. Any household with multiple children.

**Description:** A parent with 5+ children currently runs ~20 active realtime channels (per-child subscriptions for vault notes / files / messages, plus household-level channels). Supabase enforces a soft listener limit of ~7-8 channels per client. Excess channels are silently dropped — no error, no log — meaning realtime updates simply don't fire for some surfaces.

**Symptom Lauri (or any multi-child parent) would experience:** 3-10 second delay before new appointments, messages, or vault notes appear without manual refresh. Inconsistent across surfaces — some children update, others don't. Hard to diagnose because nothing fails visibly.

**Fix:** Consolidate per-child channels (vnotes/files/msgs) into household-level channels with client-side `child_id` filtering. One household channel for vault notes (filter by child), one for files, one for messages — instead of N channels per child.

**Estimated effort:** 2-3 hours.

**Why it surfaced now:** Calendar v2 added more channels for series/attendance updates. Pushed total channel count from "uncomfortably close to limit" to "actively exceeding for multi-child households."

**Code path (likely):**
- `index.html` household + child realtime subscription setup
- `src/features/homework/data.js` realtime listeners
- Calendar v2 realtime subscriptions (from D2-D5 commits)

**Notes:**
- CLAUDE.md rule #8 already flags the limit. This is the rule biting in production for the first time.
- **Test scope:** verify with Lauri's actual household after fix. Lauri may have only 2-3 patients; may not hit limit personally. Real test is a parent with 5+ children — synthetic test recommended before declaring fixed.
- Worth doing before A-06 / A-08 ship — those add more potential subscriptions if not careful.

---

## N-02 — Auto-scroll into view after drag-drop reschedule

**Type:** Add-on (UX polish)
**Severity:** Low
**Surface:** Calendar v2 day/week view, drag-to-reschedule (D6 Feature 2)

**Description:** When specialist drags an appointment to a new time that's outside the current scroll viewport, the dropped appointment lands offscreen and "disappears" from the user's perspective. After a successful drop, the calendar should scroll the new position into view.

**Investigation finding (from D6 build):** "Drag-B disappeared" was logged as a UX issue during the drag-to-reschedule build. Polish, not a blocker.

**Implementation:** After drop completes successfully, compute scroll target for the new time slot. Scroll to that position with smooth animation. Probably in the drag-drop handler in calendar v2 day/week view code.

**Notes:**
- Bundle with N-04 and any other small calendar polish items in a single batch.
- Don't fix in isolation — wait for at least 2-3 polish items to batch together.

---

## N-03 — Mobile drag-to-create via long-press

**Type:** Add-on (UX gap)
**Severity:** Medium (gap, not bug — mobile users currently can't access D6 Feature 3)
**Surface:** Calendar v2 day/week view on mobile

**Description:** Click-drag-to-create with custom duration (D6 Feature 3, commit 4221a3c) currently works only with mouse/pen input. On touch devices, there's no equivalent gesture, so mobile users can't use the click-drag-to-create flow at all.

**Fix:** Long-press to start drag would enable touch-equivalent. Standard mobile pattern.

**Estimated effort:** Small. Add `touchstart` + timer → enter drag mode → existing drag handler takes over.

**Why it matters:** If Lauri uses Huddledin from her phone (commute, between sessions), drag-to-create is unreachable. Real UX gap, not just polish.

**Open question:** Is there a long-press handler already in the codebase to reuse (chat reply uses long-press)? Worth checking during fix.

**Code path (likely):** Calendar v2 day/week view drag handlers.

**Notes:**
- Bundle with other calendar polish items if a batch is queued.

---

## N-04 — Personal block "Patient cancelled" attendance label is semantically wrong

**Type:** Bug (cosmetic — incorrect label option for entity type)
**Severity:** Low (~10 min fix)
**Surface:** Calendar v2 — appointment detail modal, attendance pills, when appointment is a personal block (no `child_id`)

**Description:** Personal blocks (anonymous calendar entries with no patient) currently show all four attendance options including "Patient cancelled." That option is meaningless on a personal block — there's no patient. Should be hidden when `child_id IS NULL`.

**Fix:** In attendance pill rendering, conditionally hide "Patient cancelled" (and possibly "No-show" — debatable) when appointment is a personal block.

**Estimated effort:** ~10 minutes.

**Code path (likely):** Calendar v2 detail modal attendance section. Search where attendance pills are rendered.

**Notes:**
- Smallest item on the list. Bundle with N-02 / N-03 in a single calendar polish batch.

---

## N-05 — Patient search in appointment create modal dropdown

**Type:** Add-on (scaling)
**Severity:** Medium (becomes friction at ~20+ patients; minor at current scale)
**Surface:** Calendar v2 — Add Appointment modal, patient selector dropdown

**Description:** When specialist has 20+ patients, the patient dropdown in the create-appointment modal becomes unwieldy. Need typeahead / search-the-list to find a patient quickly.

**Why it surfaced now:** Lauri's testing volume is small, but real specialists have 30-50 active patients. Calendar v2 will hit this scaling issue first.

**Open questions:**
- Threshold for showing the search field — always, or only when N > 10?
- Search scope — patient name only, or also display name / nickname?
- Fuzzy match acceptable?

**Implementation:** Add search input above the dropdown options. Filter list as user types. Probably reuse the patterns from "+ From library" picker once A-06 ships.

**Code path (likely):** Calendar v2 create modal patient selector.

**Notes:**
- Defer until Lauri actually hits the friction (or specialist with larger patient list joins).
- Consider whether the same pattern should apply elsewhere (homework create modal child selector, report builder child selector). If yes, build once, apply broadly.

---

## N-06 — Storage 544 errors (intermittent, pre-existing)

**Type:** Bug (intermittent)
**Severity:** Low (pre-existing, predates D6, no reproducible pattern)
**Surface:** Storage uploads/fetches — intermittent failures returning HTTP 544.

**Description:** Sentry / observation surfaced intermittent 544 errors on storage operations during the D6 build investigation. Root cause unknown. Errors predate D6 — they were in the system before calendar v2 work started.

**Status:** Watch-and-log. Don't chase until there's a reproducible pattern or user-visible impact.

**Investigation candidates if pattern emerges:**
- Supabase edge gateway timeouts under specific conditions
- Large file uploads near size limit
- Specific MIME types
- Geographic / network correlation

**Notes:**
- Logged during D6 investigation, not introduced by it.
- Worth a Sentry filter setup to count occurrences and detect pattern shifts.

---

## N-07 — vault_notes report-builder upserts write NULL household_id

**Type:** Data integrity (cleanup)
**Severity:** Low (no user-visible symptom; flagged during N-01 channel consolidation)
**Surface:** Report builder save / lock / publish paths — vault_notes rows persisted with `household_id: null`.

**Description:** Four upsert paths in `index.html` set `household_id: null` when writing vault_notes:
- Line 15701 — autosave/draft upsert
- Line 15764 — lock-on-finalize upsert
- Line 15783 — second lock path
- Line 15857 — publish upsert

Only line 15325 (initial draft create) sets `household_id` correctly via `DB.children.find(c=>c.id===nn.childId)?.householdId||null`. Subsequent saves blank it out.

**Why this matters:** During N-01 work, this forced the household-level realtime channel for `vault_notes` to use a client-side `child_id` filter instead of the cleaner server-side `household_id=eq.{hid}` filter. That works, but is more code. Future RLS or analytics work that assumes `household_id` is populated on every row will hit edge cases.

**Fix:** In each of the 4 upsert call sites, replace the literal `household_id: null` with a lookup matching line 15325:
```js
household_id: DB.children.find(c=>c.id===note.childId)?.householdId||null
```
Plus a one-time backfill SQL on existing rows:
```sql
UPDATE vault_notes vn
SET household_id = c.household_id
FROM children c
WHERE vn.child_id = c.id AND vn.household_id IS NULL;
```

**Estimated effort:** 30 min (4 line edits + backfill SQL + verification).

**Notes:**
- Separate from N-01 — N-01's consolidation is robust to this (client-side gate). N-07 is the cleanup of the underlying data integrity issue.
- Discovered during N-01 plan review (April 29, 2026).

---

# DEFERRED

---

## D-01 — Activity feed shows duplicated completions (Phase 6 watch)

**Type:** Deferred — likely resolves with Phase 6 (v1/v2 read consolidation)
**Severity:** Low (cosmetic during transition; not blocking workflow)
**Surface:** Specialist patient detail → Tasks → activity feed (per-homework or per-exercise view)

**Description:** Activity feed shows what appear to be duplicate completions (e.g., two "Done · Side to side · evening" entries when only one was marked). Suspected cause: feed merges v1 + v2 completions ("v2 preferred" per handover), and dedupe logic isn't catching every case during the dual-write transition.

**Decision:** Don't fix now. Re-check after Phase 6 reads cut over to v2-only and v1 tables are dropped. Expected: duplicates disappear on their own.

**Watch criteria:** If duplicates **persist** after Phase 6 ships, reopen as a real bug (something other than the v1/v2 merge is causing it).

---

# RESOLVED (April 29, 2026)

The following 14 items shipped today as part of the calendar v2 + D6 build and the homework/specialist-UI batch.

## B-02 — Calendar appointment "Repeat = Weekly" doesn't create recurring events ✅

**Resolution:** Closed by calendar v2 (D2a series generation, commit affb791). Series are now created on appointment save and rolling-extended (D2d, commit e9a31c7) so future weeks always have visible occurrences. `day_shift_series` Postgres function deployed for bulk series edits.

## B-03 — Schedule pills collapse the override panel on every tap ✅

**Resolution:** Pill click handlers refactored to in-place DOM updates per CLAUDE.md rule #13. Panel state preserved across taps.

## B-04 — Investigate "(+N more)" suffix on notifications ✅

**Resolution:** Investigation completed. Suffix removed / reframed (specifics in commit history).

## B-05 — Parent did not receive notification when new task was created ✅

**Resolution:** Parent task notifications fixed. Likely root cause: missing notification fire in v2 task-creation flow (one of the suspect causes from triage).

## B-06 — Therapist-authored notes in homework task don't appear on parent view ✅

**Resolution:** Therapist notes now render correctly on parent view. Bundled with B-05 fix as same family.

## C-01 — Remove subtitle text from Reports bubble on specialist home ✅

**Resolution:** Reports bubble subtitle removed.

## C-02 — Remove global Chat bubble from specialist desktop home ✅

**Resolution:** Global Chat bubble removed. Paired with A-01 replacement tile.

## C-03 — Remove user-facing demo mode and demo data seeding ✅

**Resolution:** Demo mode UI and seed code removed. **Note:** 3 lingering guard checks remain in the codebase as harmless dead code — flagged during D6 investigation. Cleanup-when-convenient.

## C-05 — Rename "Cadence" label to "Frequency" ✅

**Resolution:** Label renamed across schedule controls.

## C-06 — Remove "Reset to homework schedule" link from per-exercise override panel ✅

**Resolution:** Link removed. "Custom" badge remains as the override indicator. Watch for confusion in future feedback.

## A-01 — Add new tile to fill removed Chat bubble slot on specialist home ✅

**Resolution:** Replacement tile shipped alongside C-02.

## A-02 — Inline file preview in My Storage ✅

**Resolution:** Inline previews shipped.

## A-03 — Add "repeat until" end date to recurring appointments ✅

**Resolution:** Closed by calendar v2 D1 schema + D2a series generation. End date supported on series creation.

## A-04 — Google Calendar–style day view to specialist calendar ✅

**Resolution:** Closed by calendar v2 D4 — Day view (Stage 1, commits 22aa277 → c6905f2) and Week view (Stage 2, commit 7d2800e). Plus D6 enhancements: drag-to-reschedule, click-drag-to-create, RSVP visual fill, default-to-week, scroll preservation, now line, today indicator.

## A-07 — Per-appointment attendance tracking + attendance rate metrics ✅

**Resolution:** Closed by calendar v2 D5 (commits 3ef451b → 9878e16). Attendance pills on past appointments, suppress refresh counter pattern documented in CLAUDE.md.

---

## End of file

**Last updated:** April 29, 2026

**Closure summary today:**
- 11 items from Lauri's original 21 closed (B-03, B-04, B-05, B-06, C-01, C-02, C-03, C-05, C-06, A-01, A-02)
- 3 items closed by calendar v2 build (B-02, A-03, A-04, A-07)
- 6 new items added from calendar v2 work (N-01 through N-06)
- 6 items remain open from original list (B-01, C-04, A-05, A-06, A-08, D-01)

**Open total:** 12 items (6 inherited + 6 new)

When adding new feedback during work batches:
1. Triage in fresh conversation
2. Classify B / C / A / D / N and add entry here
3. Decide bundle-in vs. save-for-next-batch
4. Default: save for next batch, don't expand current scope
