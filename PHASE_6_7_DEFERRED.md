# Homework Redesign — Phase 6 & 7 Deferred Work

**Status:** Phases 1-5 shipped April 26, 2026. Functionally complete.
**Pause reason:** Real-user testing first; technical-debt cleanup deferred.

## Where we left off

Last commit on the redesign: `2b9c9cf` (Phase 5 — dead UI deletion).

Before this, the homework system underwent a full v1 → v2 schema migration:
- New tables: `homework_exercises`, `homework_completions_v2`
- Specialist surfaces (list, detail, create) fully on v2 schema
- Parent surface fully on v2 (after one mid-flight UX redesign)
- Dual-write to old `homework_completions` and `homework_occurrences` STILL ACTIVE — feeds specialist's read paths

## Current dependency state (the v1 leftovers)

These code paths still depend on v1 tables:

1. **logExerciseCompletion in src/features/homework/data.js (~line 386)**
   - v2 INSERT to homework_completions_v2 (primary, source of truth)
   - v1 dual-write to homework_completions + homework_occurrences (kept for specialist view stats)
   - Removing: requires Phase 6 read-side cutover first

2. **loadHomeworkDetail in src/features/homework/data.js (~line 216)**
   - Reads homework_completions (v1) for the activity feed
   - Reads homework_occurrences (v1) for the week strip
   - Replacement target: homework_completions_v2 with derived occurrence-on-the-fly logic

3. **computeWeekStats in src/features/homework/list-view.js (~line 71)**
   - Reads DB.homeworkOccurrences cache (populated from v1 occurrences table)
   - Used for "X/Y this week" stat on specialist cards
   - Replacement target: derived from homework_completions_v2 + schedule resolution helpers

4. **_generateOccurrences in index.html (called from create-modal.js:321)**
   - Pre-generates 90 days of v1 occurrence rows on every homework create
   - Sole purpose: feed the v1 read paths above
   - Removable when (1), (2), (3) are converted

5. **DB.homeworkOccurrences refresh pipeline (index.html ~line 2247)**
   - Loads occurrences into runtime cache
   - Removable with above

## Phase 6 — Specialist v2 cutover + drop legacy

Goal: Move specialist surfaces from v1 reads to v2 reads, drop dual-write, drop legacy tables.

**Order:**
- 6a: Rewrite computeWeekStats to compute from homework_completions_v2 + schedule resolution helpers (isExerciseScheduledOn, exerciseSlotsOn). Aggregate "scheduled this week" from rules, "done" from v2 INSERTs.
- 6b: Rewrite loadHomeworkDetail to fetch only homework_completions_v2 (not v1 tables). Activity feed uses v2 only. Week strip uses computeDayPillState pattern from parent-view.
- 6c: Verify specialist surfaces still render correctly with v2-only reads (test on Lauri's account, with real history).
- 6d: Remove v1 dual-write block in logExerciseCompletion (lines ~377-405).
- 6e: Remove _generateOccurrences call site in create-modal.js. Remove the function from index.html.
- 6f: Remove the homework_occurrences fetch from refresh pipeline. Remove DB.homeworkOccurrences cache.
- 6g: After 1 week of stable operation, drop legacy DB tables:
  - DROP TABLE homework CASCADE; (5 rows of v0 relic data)
  - DROP TABLE homework_completions CASCADE; (33 rows of v1 history — accept loss)
  - DROP TABLE homework_occurrences CASCADE; (578 rows of pure scheduling state — disposable)
  - DROP TABLE todos CASCADE; (0 rows)
  - DROP TABLE todo_reminders CASCADE; (0 rows)

**Risks:**
- Specialist sees regression in week strip / activity feed during cutover window
- Old completion history (33 rows) becomes inaccessible after table drop unless migrated
- 90-day pre-generated occurrences for existing homework disappear — acceptable since v2 derives on the fly

**Estimated effort:** 4-6 hours, split into multiple commits (6a-f as one push, 6g as separate later commit).

## Phase 7 — Realtime channel consolidation

Goal: Reduce parent worst-case channel count from 10+ (3-child household) to 4-5.

**Current channel inventory** (from Phase 5 audit):
- Parent: household:{hid}, hh_notifs:{uid}, hh_hw_tasks:{hid}, hh_parent_tasks:{hid}, plus 3 per-child (hh_vnotes, hh_files, hh_msgs), plus sub:{uid}
- Specialist: spec_sync:{specId}, plus 3 per-child (spec_apts, spec_msgs, spec_child_data), plus spec_sub:{uid}

**Approach:**
- Consolidate per-child subscriptions into one channel per child (not three)
- OR more aggressively: household-wide channel with JS-side child_id filtering
- The aggressive version requires schema additions: vault_notes, files, messages need household_id columns to filter at the listener
- Alternative: keep per-child channels, but consolidate by table type (one channel for all messages across all children, etc.)

**Risks:**
- Touches non-homework features (chat, vault notes, files)
- Requires careful regression testing of every realtime-driven UI
- Schema migrations on tables we haven't touched

**Estimated effort:** 6-10 hours including testing across all features.

## When to revisit

**Phase 6:** When Lauri reports specialist stats look correct after a week of real use, AND you've used the system enough to trust v2 as source of truth.

**Phase 7:** When the first parent-with-3-children user reports realtime sync feels slow or events get dropped. Or when adding a new realtime feature pushes channels past the limit.

## Lessons from this build (don't lose these)

- Always mockup parent-facing UI before coding (we skipped this, redesigned mid-flight)
- After Claude Code says "committed," verify "and pushed?" — caught twice in this build
- Manually test write paths end-to-end before approving commits — the column-name bug shipped because we reviewed code, not behavior
- Cleanup phases need full dependency audits before scoping — Phase 5's original scope was wrong before A1 of the audit caught it

## Row counts captured April 26, 2026 (for Phase 6g planning)

| Table | Rows |
|-------|------|
| homework | 5 |
| homework_completions | 33 |
| homework_occurrences | 578 |
| todos | 0 |
| todo_reminders | 0 |
