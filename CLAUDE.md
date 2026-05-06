# CLAUDE.md — Huddledin Developer Guidelines

**Last updated:** May 4, 2026

Read this file first before any Huddledin task. Also check for relevant skills:
- `C:/Users/eytan/.claude/skills/huddledin-web-design/SKILL.md` — for any web UI work
- `C:/Users/eytan/.claude/skills/ios-pwa-css/SKILL.md` — for iOS CSS work

---

## Session continuity

Past session handovers live in `handovers/` (gitignored). Each marks the end of a multi-session work day with: commits shipped, decisions locked, deferred queue, and how to start the next chat. The most recent file is the relevant starting context for ongoing work — read it before assuming the prior session ended cleanly or that all queued tasks are still queued.

---

## 🏛️ App Architecture

### Stack
- **Frontend:** Single `index.html` (~18,750 lines) with vanilla JS
- **Module system:** esbuild bundles `src/` into `public/` on Vercel build
  - `src/app.js` is entry point
  - `window.HUD` bridge exposes helpers from index.html to modules
  - Report Builder is a module (first feature built outside index.html, fully migrated)
- **Backend:** Supabase (DB, auth, storage, edge functions, realtime)
- **Hosting:** Vercel (Hobby plan — 12 serverless functions max, AT LIMIT)
- **Payments:** Paddle (live, Merchant of Record)
- **AI:** Anthropic API (Claude Sonnet 4) via `api/report-ai.mjs` + `api/ai-summary.mjs`
- **Monitoring:** Sentry
- **Analytics:** Plausible (configured but not actively used)
- **Policy:** Termly (privacy, terms, cookies pages)

### Repository
- Git: `https://github.com/eytanmoriah/Huddledin.git`
- Working directory: `C:/Users/eytan/OneDrive/Apps/Huddledin`
- Production branch: `main`
- Auto-deploys on push: Vercel (frontend) + Supabase Edge Functions
- **DB migrations are MANUAL.** Paste SQL into Supabase SQL editor. Files in `supabase/migrations/` are documentation/source-of-truth, not auto-applied. No `supabase_migrations.schema_migrations` table exists in this project.

### Preview environment
- Feature branches create preview deployments via Vercel
- Supabase branches created for DB changes (sometimes needs manual migration)

---

## 🧱 Core Database / Code Constraints

### GOLDEN RULES — never break these

1. **DB is a Proxy over localStorage.** Direct mutation silently fails. Use full array read-mutate-write cycles:
   ```js
   const arr = [...DB.children];
   arr.push(newChild);
   DB.children = arr;  // triggers LS.set
   ```

2. **Always destructure `{data, error}` from Supabase calls.** Never swallow errors. Use try/catch with `console.error`.
   ```js
   const { data, error } = await _supa.from('x').select('*');
   if (error) { console.error('❌ x lookup:', error); throw error; }
   ```

3. **Never use `.maybeSingle()`.** Use `.single()` or unconstrained queries.

4. **`household_id` type is INCONSISTENT across tables.** Verify before assuming:
   - **UUID:** profiles, children, homework_tasks, homework_exercises, homework_completions_v2, chats
   - **TEXT:** specialist_requests, subscriptions, parent_tasks
   - In JS: always pass through `String(hhId)` before `.eq()` — works for both types because Postgres accepts canonical UUID strings as UUID input.
   - In SQL/RLS: for UUID-on-UUID comparisons, NO cast needed. For TEXT-on-UUID, cast UUID to text (e.g., `get_my_household_id()::text`). When creating new tables, default to UUID.
   - Common bug: adding `::text` casts to UUID-on-UUID comparisons → `operator does not exist: uuid = text`.

5. **`notifications.id` has no default.** Generate manually: `id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)`.

6. **`specialist_requests.role` stores SPECIALTY** (e.g., "Speech-Language Therapist"), NOT the user role. User role is in `profiles.role`.

7. **`specialist_requests.household_id` is TEXT** but `get_my_household_id()` returns UUID. Use two-query merge pattern.

8. **Supabase Realtime has ~7-8 listener limit.** Silent drops when exceeded. Don't add random new subscriptions without checking.

9. **`onAuthStateChange` can corrupt profiles.** Check existing DB profile before writes (learned from specialist invite acceptance bug).

10. **Service-role Edge Functions bypass RLS.** Only use for trusted operations (webhooks, account deletion).

11. **Vercel Hobby: 12 serverless functions max — AT LIMIT.** Helpers in `lib/*.mjs` bundle into API functions (don't count). Only files in `api/` at root count as serverless functions. Adding new endpoints requires consolidating into existing ones (e.g., new actions in `report-ai.mjs`).

12. **API files use `.mjs` extension** for ESM support. Update `vercel.json` if adding new ones.

13. **Avoid `re()` when possible.** It rebuilds the entire DOM via `root.replaceChildren()`. Use:
    - In-place DOM updates for small changes (e.g., calendar day swap)
    - CSS `display` toggle for expand/collapse states
    - Only `re()` when navigation or major state change
    - `document.startViewTransition` is wrapped around nav `re()` calls for smooth crossfade

14. **`el()` helper applies styles via `Object.assign(e.style, {...})`:**
    - Style properties must be camelCase: `paddingInlineEnd` not `'padding-inline-end'`
    - Properties must be SEPARATE object keys, NOT concatenated strings
    - Setting one bad value (e.g., `position: 'relative;padding-inline-end:42px'`) makes the browser reject the entire style assignment, leaving the element with NEITHER property
    - Always pass styles as `{ position: 'relative', paddingInlineEnd: '42px' }`

15. **Replacing `className` with `style.cssText` orphans CSS rules.** If a parent class has descendant selectors (e.g., `.tiptap-gate-toolbar button { ... }`), removing the class breaks the children's styling. Either keep the class or also restyle the children inline.

16. **Progressive loading pattern:**
    - `refreshPhase1()` — children + notifications + seen_timestamps (~300ms)
    - `refreshPhase2()` — everything else (background)
    - Boot awaits Phase 1, fires Phase 2 + chat preload in background

17. **Never block navigation on network calls.** Fire-and-forget updates, navigate immediately. Show skeleton/spinner for data-dependent sections only.

18. **Debounce realtime events.** Use `_debouncedRefresh()` or `_debouncedChatRefresh()` (500ms trailing) to avoid re() thrashing.

19. **Log Supabase errors with ❌ prefix** for easy log filtering:
    ```js
    console.error('❌ [what failed]:', error);
    ```

20. **Foreign key checks before bulk DELETE.** `reports.template_id` references `report_templates.id`. When deleting both, delete reports FIRST then templates.

21. **Soft delete on past appointments.** Past appointments (date + end_time < now()) use soft delete via `deleted_at TIMESTAMPTZ`. Future appointments hard delete. All appointment SELECT queries must filter `WHERE deleted_at IS NULL`. The partial index `idx_appointments_date_household` already enforces this on the index side.

---

## 🔐 Security & Privacy

### RLS policies deployed
- `chats` — participant-scoped + household-scoped SELECT/INSERT/UPDATE/DELETE
- `subscriptions` — user can SELECT own; only service_role (Paddle webhook) can UPDATE
- `notifications` — `upsert_notification` SECURITY DEFINER function handles cross-user ops
- `folder_permissions` — household + specialist scoping
- `reports` + `report_templates` + `specialist_phrases` — specialist-scoped (own data only)
- Legacy tables (homework, milestones, progress, todos*, todo_reminders*) — deny-all except own user scope where applicable. (* JS references removed May 2026; table drop pending HIPAA pre-launch pass.)
- `messages` — currently open (Phase B2 will add RLS for delete feature)

### Server-side auth on AI endpoints
- `api/report-ai.mjs` and `api/ai-summary.mjs` verify JWT + `_hasSpecAiAccess()` before processing
- Rate limiting: 20 calls/hour per user via `ai_usage` table
- Shared helper: `lib/rate-limit.mjs`

### CSP headers enforced
See `vercel.json` for full policy. Includes:
- `'unsafe-inline'` + `'unsafe-eval'` for Termly + Paddle
- Whitelisted CDNs: jsdelivr, paddle, sentry-cdn, plausible, profitwell
- Supabase domains (https + wss)
- `frame-ancestors 'none'`, `upgrade-insecure-requests`

### PHI scrubber (Phase A complete)
Strips sensitive content from localStorage before write:
- `appointments[].notes`
- `homework[].task/category`
- `homeworkTasks[].description`
- `specTasks[].notes`
- `vaultNotes[].content` (fetch on editor open)

Phase B (chat messages in LS) deferred until HIPAA compliance push.

### Privacy Policy (Termly)
Covers: Anthropic (AI), Paddle (payments), Supabase (storage), Vercel (hosting), Google (OAuth), push notifications, account deletion, HIPAA BAA process, microphone access. Updated April 16, 2026.

---

## 📦 Deployment Workflow

### Branch policy
- Sole developer + no real users yet → push directly to main is OK
- Feature branches for risky changes (RLS, schema migrations, major refactors)
- Preview deployments available via Vercel + Supabase branching

### Git workflow
```bash
git add [files]
git commit -m "descriptive message"
git push origin main
```

### Syntax check before pushing (Claude Code pattern)
```bash
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const scripts=html.match(/<script.*?>[\s\S]*?<\/script>/g)||[];scripts.forEach((s,i)=>{try{new Function(s.replace(/<\/?script.*?>/g,''));}catch(e){console.error('Script',i,':',e.message);process.exit(1);}});console.log('✅ Syntax OK');"
```

### After deploy
- Wait 30-60s for Vercel build
- Hard refresh browser (Ctrl+Shift+R) or unregister service worker
- Test on mobile too (PWA users may have cached old version)

### Verify-before-next-commit pattern (Phase 4 lesson)
- After each commit, hard-refresh + manually verify in browser before queueing next prompt
- Caught real regressions multiple times in Phase 4 (button styling, trash position, drafts disappearing)
- Skip this only when commits are atomically scoped to non-visible changes

---

## 🔔 Push Notifications

Full implementation live:
- VAPID keys stored as Supabase Edge Function secrets
- `push_subscriptions` table with RLS
- `sw.js` handles push + notificationclick events
- `send-push` Edge Function triggered by DB webhook on notifications INSERT/UPDATE
- `_ensurePushSubscribed()` auto-subscribes on login/page load
- `notif_prefs JSONB` on profiles controls push (not in-app — in-app always shows)
- Smart suppression: focused+visible app suppresses OS notification, sends `push-received` to page
- `notificationclick` prefers visible clients, falls through to `openWindow`
- iOS: works only from installed PWA (Apple restriction)
- Android: works from PWA + badge support (iOS doesn't support badges for PWAs)

---

## 💳 Payments (Paddle)

- Two products live:
  - Huddledin Parents: $5/month annual or $7/month monthly (14-day trial)
  - Specialist AI: $9/month annual or $11/month monthly (7-day trial)
- `paddle-webhook` Edge Function (JWT verification disabled in Supabase config)
- `subscription.activated` + `transaction.completed` both return 200
- `cancel_url TEXT` on subscriptions table stores `data.management_urls.cancel`
- Subscription management card in both parent + specialist settings
- Demo account exempt via `exempt: true` boolean

### Trial trigger
- First tap on locked feature → 7-day trial starts (specialist AI)
- Parent trial: auto-created on signup via Supabase trigger
- `create_trial_subscription()` RPC with `ON CONFLICT (user_id, plan)`

### Subscription state model
- `null` row → never tried (eligible for trial)
- `status='trial'` with `daysRemaining > 0` → active trial
- `status='trial'` with `daysRemaining <= 0` → trial just ended
- `status='expired'` → trial used and expired
- `status='active'` → paid (annual or monthly)
- `status='past_due'` → payment failed
- `exempt=true` → demo/dev account bypass

`_hasSpecAiAccess()` returns true for active/trial/exempt.
`_showSpecAiUpgradeModal()` adapts UI per state — hides trial button for ineligible users.

---

## 📋 Report Builder System

Major feature, fully Tiptap-based as of Phase 4 (April 25, 2026).

### Files
```
src/features/reports/
├── index.js              # Hub + patient-tab + templates list rendering, navigation
├── tiptap-gate.js        # Editor: mountGateEditor, save/load, autosave, toolbar
├── pdf-util.js           # PDF generation via jsPDF, font/header settings honored
├── phrases.js            # Phrase CRUD + reverse substitution heuristic
├── phrase-suggestion.js  # Tiptap @ trigger extension (suggestion v3)
├── file-parser.js        # PDF/DOCX upload parsing (separate bundle)
└── styles.js             # CSS rules for toolbar, badges, cards

api/
└── report-ai.mjs         # Single Vercel function: 'import-to-tiptap' action only
```

### Editor modes
- **Draft mode** — editing draft report; autosaves every ~2s when dirty
- **Read-only mode** — viewing finalized report; toolbar shows Download / Share, no editing
- **Template mode** — editing a template (not a report); explicit Save button, no autosave

### Key data
- `reports.name` (TEXT, nullable, 1-100 char check) — specialist-set title; empty = "Untitled"
- `reports.content` (JSONB) — Tiptap doc; NULL meant "old-style form-based" (all such rows deleted)
- `report_templates.content` (JSONB) — template structure with placeholders like `[NAME]`, `[DOB]`, `[AGE]`, `[DATE]`, `[PRONOUN_*]`
- `children.pronouns` — `'he'` | `'she'` | `'they'` for placeholder substitution
- `report_settings` — per-specialist branding (practice name, logo, color, font_style, header_style, footer)
- `specialist_phrases` — phrase library

### Substitution flow
- Templates contain placeholders → opening from template runs `substitutePlaceholders(content, child)`
- Reverse substitution (saving content as template) is heuristic — known limits: `'her'` ambiguity, common-word names

### Cleanup invariants
- Old form-flow code deleted in Phase 4 (1635 lines)
- `BETA_NEW_EDITOR_TESTERS` constant removed; reintroduce only if a new beta program needs gating
- Legacy columns `form_data`, `generated_text`, `sections_included` on reports table — unused, can drop in future migration

### See full reference (gitignored)
`REPORT_SYSTEM_REFERENCE.md` in project root has complete architectural documentation.

---

## 🎨 Design Language

### Core Huddledin palette
- Teal: `#0d9488` (primary), `#0d6b63` (darker), `#ccfbf1` (tint)
- Mint/cream backgrounds: `#f0fdf9`, `#edf5f4`, `#e8f4f2`
- Amber accent: `#f59e0b`
- Charcoal text: `#1a2e2b`

### Fonts
- Serif headings: Fraunces (display)
- Sans body: Nunito
- RTL: Heebo

### Typography
- Headings: Fraunces at 20-28px weight 500
- Body: Nunito 13-15px
- Labels: 11-12px uppercase for section headers

### Mobile-first but desktop-aware
- `window.innerWidth >= 1024` = desktop breakpoint
- Specialist has separate `renderSpecDesktop()` function
- Parent desktop view exists but NOT redesigned yet (mobile view stretches wide)

### Web design skill
For any desktop UI work, load:
`C:/Users/eytan/.claude/skills/huddledin-web-design/SKILL.md`

Contains full design token system + component patterns + layout examples.

### iOS PWA skill
For iOS CSS fixes, load:
`C:/Users/eytan/.claude/skills/ios-pwa-css/SKILL.md`

Covers: safe areas, 100dvh, `-webkit-overflow-scrolling`, tap targets, input zoom prevention, rubber band scroll, notification handling, standalone mode detection.

---

## 🧪 Testing Accounts

- **Parent:** eytanmoriah@gmail.com (user `b3ab6d4e`, household `f30f3da4`)
- **Co-parent:** laurimoriah@gmail.com (user `f1d4d485`, household `f30f3da4`)
- **Specialist Lauri:** lauri@hamakortherapy.com (user `0a58f99f`, display_name "Lauri Moriah")
- **Specialist Eytan:** eytan760@gmail.com (user `43342d4f`, display_name "Eytan Moria")
- **Demo (Paddle):** demo@huddledin.com / HuddledinDemo2026!

---

## 💬 Chat Features

### Reply (Phase B1, live)
- `reply_to_id UUID` on messages table
- Swipe right or long-press → Reply
- Quote preview bar above input
- Quoted block above bubble
- Tap quoted block → scroll to original with highlight

### Multi-photo send
- Gallery picker has `multiple` attribute
- Thumbnail strip with per-item remove
- Sends N separate messages

### Photo caption
- Can add caption when sending photo

### Lightbox gallery
- Tap any chat image → full-screen lightbox
- Swipe left/right or arrow keys to navigate
- Counter shows "3 / 7"
- ESC to close

### Action menu
- Long-press (mobile) or hover ⋮ (desktop)
- Copy (text), View/Download (photos), Reply (all)
- Delete deferred to Phase B2 (needs RLS)

### Consultation chats
- Specialist+specialist+parents = "Consult: [Child]" (always on specialist side)
- Private specialist↔specialist = "Specialist Consult"
- Parents can rename group chats via ✏️ pencil icon

---

## ⚡ Performance Optimizations (live)

### Progressive loading
- Phase 1 (blocking): 300-500ms boot
- Phase 2 (background): everything else

### Tap latency
- Notification tap: fire-and-forget update + navigate
- Chat realtime: 500ms debounce
- Tab switch: navigate first, refresh passively
- Renders: shell-first with skeletons

### UI thrashing fixes
- Visibility-change: one coalesced pipeline
- `document.startViewTransition` on nav changes
- In-place calendar day swap (no `re()`)

---

## 🎯 Specialist Desktop (Active redesign — see SPECIALIST_WEB_REDESIGN_STATUS.md)

### Current state (April 16, 2026, commit 2b98ff9)
- Collapsible sidebar ✅
- 5 bubble grid (Patients, Chat, Notifications, Reports, Storage) ✅
- Calendar widget + Today's Tasks (home-only) ✅
- Patients page with search/filter ✅
- Persistent greeting banner across pages ✅
- AI trial pill in greeting banner ✅
- Lock states for Reports/Storage when AI access revoked ✅

### To verify / complete
- Upgrade button → Paddle flow (not verified end-to-end)
- Sidebar collapsed icon polish
- Mobile specialist view untouched (still old design)
- Parent desktop view untouched (still mobile-on-desktop)

---

## 🛠️ Effective Prompt Patterns (for Claude Code)

### Always start with
```
Read CLAUDE.md first.
```

### For changes that might break
```
Do NOT fix yet. Investigate and propose.
```

### To prevent rewrites when you want edits
```
EDIT the existing [function name]. Do NOT rewrite.
Preserve [specific things].
```

### End with verification
```
npm run build and syntax check after.
```

### For sensitive DB changes
```
Show me the migration SQL before implementing.
Show me the RLS policies.
```

### Goal-oriented, not prescriptive
✅ "The calendar day tap should feel instant"
❌ "Change line 12076 from `re()` to `sec._rebuildEvtPanel()`"

(Let Claude Code find the solution — just specify the outcome.)

### Inspection before destructive commits
For deletion or refactor work, run an inspection-only prompt first to inventory what's old vs shared:
```
Investigation only, do NOT modify anything.
Task: [list what to find, e.g., "all callers of X function"]
Report file + line range, confidence shared vs scoped.
```

This caught regressions during Phase 4's 1635-line cleanup that would have broken shared code.

### Verify-before-next-commit
After Claude Code commits:
1. Wait ~90s for Vercel
2. Hard-refresh
3. Manually verify in browser
4. THEN queue the next prompt

Catches regressions early when isolating the cause is cheap.

---

## 🔄 Process Rules (multi-session push lessons, May 2-4 2026)

These emerged from the Session B → Session 3.2 push. Apply on any non-trivial Huddledin work.

### 1. Investigation before code
Every non-trivial change goes through: audit prompt → agent investigates → user reviews → user greenlights → agent applies. Skip only for one-line trivial changes.

The "investigate-only" prompt yields a numbered findings deliverable with sections (current behavior / proposed fix / risks / open questions). User answers the open questions and pastes them back as the "Greenlight on X" prompt. That prompt becomes the locked decision record — the diff must match.

### 2. Sub-commit splits
Commits over ~150 lines OR touching multiple files OR including migrations should split into sub-commits. Each sub-commit independently shippable and testable.

Suggested rhythm:
- Sub-commit 1 of N — schema or foundational change.
- Sub-commit 2 — code consuming the new schema.
- Sub-commit 3+ — polish, indicators, edge cases.

Session 1 split into 4 sub-commits + a Sub-commit 2.5 inserted mid-stream. Each shipped clean and was verifiable in isolation.

### 3. Test between sub-commits
Never pile sub-commits without testing each. Architectural fixes especially deserve "soak time" — let users hit the new code for a day before changing more.

This caught two regressions in Session 1 that would have been buried under Sub-commit 4 if the chain ran without verification.

### 4. The "5b principle" — broader fix when cheap
When the agent surfaces a related bug during investigation, prefer the broader fix over the scoped one if it costs ~2 extra lines. Single commits closing two bugs are cleaner than two commits with overlapping context.

Example: Session 3.2 was scoped to 2-day buffer once-off markability. Investigation surfaced that Completed-view edit was also broken. Broadening the condition (drop the `< 2 days` check from buffer detection) fixed both in one change. Named after Q5 option (5a scoped vs 5b broader) in the investigation deliverable format.

### 5. Greenlight prompts as decision artifacts
The user-side confirmation includes the answers to all open questions, NOT just "yes proceed." This locks decisions in writing — for the agent applying the change AND the future reader piecing together history.

Format:
```
Greenlight on [task] with these answers to your N open questions:
1. [answer to Q1]
2. [answer to Q2]
...
[any architectural clarifications]
[apply instructions]
[commit message body]
Push.
```

The greenlight is the contract — the diff must match the answers. If something looks wrong post-merge, the greenlight prompt is the spec to compare against.

---

## 📊 Key SQL & Edge Functions

### Recent migrations
- `20260415_ai_rate_limit.sql` — ai_usage table + index
- `20260416_add_reply_to_messages.sql` — reply_to_id column
- `20260425_add_reports_name.sql` — reports.name column with 1-100 char check (manual via Supabase SQL editor)
- `20260429_calendar_v2_schema.sql` — series + attendance + soft delete columns for calendar v2
- `20260502_homework_attached_file_paths.sql` — `attached_file_paths TEXT[]` on `homework_tasks` and `homework_exercises` (path-based storage alongside legacy URL columns; foundation for storage picker)
- `20260503_homework_completions_v2_parent_update.sql` — parents_update + parents_delete RLS policies on `homework_completions_v2` (enables parent edit/delete of own completions)
- `20260503_homework_completions_v2_photo_path.sql` — `photo_path TEXT` on `homework_completions_v2` (path-based render replaces expired-URL photo_url for completion photos)

### Edge Functions
- `paddle-webhook` — stores subscription + cancel_url
- `delete-account` — CORS + Paddle cancel + Storage cleanup + auth deletion
- `send-push` — VAPID push sender triggered by DB webhook

### Environment variables
**Vercel:**
- `SUPABASE_SERVICE_KEY`, `SUPABASE_URL`
- `ANTHROPIC_API_KEY`, `PADDLE_API_KEY`

**Supabase Edge Function secrets:**
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `SUPABASE_SERVICE_ROLE_KEY`, `PADDLE_API_KEY`

---

## 🚨 Sentry Monitoring

Active issues to review:
- "Can't find variable: supabase" — slow network race condition
- "Cannot access '_miniUpcoming'" — may be resolved
- "_supa.from(...).update(...).eq(...).catch" — pre-session, likely resolved

**Routine:** Check Sentry daily for new issues. Resolve old ones once confirmed fixed.

---

## 📱 iOS Limitations

- PWA push only works from installed Home Screen icon (not Safari tab)
- iOS 16.4+ required for web push
- No badge counts on PWA app icon (native-only)
- Service worker can cache stale CSP — needs manual unregister for CSP changes
- Viewport quirks: use `dvh` not `vh`, `inset-inline-start` not `transform` for slides

---

## 🔮 Next Features / Priorities

### Near-term
1. Hebrew i18n for new editor UI (Lauri's daily friction)
2. Mobile / iPad polish for editor (adoption depends on this)
3. Verify Paddle upgrade flow from specialist web
4. Sidebar polish (collapsed icon sizing)

### Pre-launch (HIPAA-related, blocking)
1. BAAs with Vercel, Anthropic, Supabase
2. Lawyer review of Privacy Policy + Terms
3. Sentry verification in production
4. `support@huddledin.com` email deliverability
5. Rate limiting on AI endpoints (currently 20/hr per user — adequate?)

### Roadmap
- Pro tier business decision + feature gating (Pro vs AI)
- Per-section regenerate (V2 spec, never built)
- Default settings UI (template, frequency, duration, referrer, language)
- PDF appearance: CONFIDENTIAL watermark, font size, margins
- Signature block customization
- Print CSS / print button
- Phase 3.1 (AI phrase extraction from past reports — design doc exists)
- Mobile specialist redesign (apply web learnings)
- Parent desktop redesign (currently mobile stretched)
- App store wrapping via Capacitor
- Automated testing

---

## Architectural patterns (apply when relevant)

### Pattern: Realtime + modals
**When this applies:** Adding a feature where the user stays in a modal AND that modal writes to `appointments`, `homework_tasks`, or `parent_tasks` (realtime-subscribed tables).
**Symptom if missed:** Modal closes by itself ~1-2s after the write because `_debouncedRefresh` triggers `re()` which strips overlays at line 19885.
**Pattern to apply:** Use the suppress counter (`S._suppressRefreshCount`). Increment before openModal, decrement on modal close, run deferred `re()` when count hits 0. Reference: `showAptDetailModal` (commit 9878e16).

### Pattern: Bulk per-row updates with different values
**When this applies:** Updating N rows of the same table where each row needs a different value (e.g., date shift, sequential numbering).
**Symptom if missed:** Sequential JS for-loop with awaits saturates PostgREST/PgBouncer connection pool around row 19, statements time out at code 57014 'canceling statement due to statement timeout'.
**Pattern to apply:** Use a Postgres function with SECURITY DEFINER that does all updates server-side in one round-trip. Reference: `day_shift_series` Postgres function (supabase/migrations/20260429_day_shift_function.sql, commit f37745b).

### Pattern: Hybrid hard/soft delete for past vs future
**When this applies:** Building a delete flow for records where past entries should preserve clinical history but future entries can be cleanly removed.
**Symptom if missed:** Either accumulating dead rows (hard-delete only loses past records) or accumulating soft-deleted rows that bloat the table (soft-delete only).
**Pattern to apply:** Past rows soft-delete via `UPDATE deleted_at = NOW()`. Future rows hard-delete via `DELETE WHERE id = X`. For bulk operations on mixed ranges, split into pastIds + futureIds arrays, run separate bulk UPDATE / DELETE. All SELECTs filter `deleted_at IS NULL`. Reference: `_showSeriesDeleteChoice` (commit d22a8d6).

### Pattern: Diagnosing hung Supabase writes
**When this applies:** A series of UPDATEs from JS suddenly start failing with 500 errors and code 57014 'canceling statement due to statement timeout'.
**Symptom if missed:** Spending an hour assuming the issue is in JS code when the actual cause is connection pool saturation in PostgREST/PgBouncer.
**Pattern to apply:** Run `SELECT pid, now() - query_start AS duration, state FROM pg_stat_activity WHERE state = 'idle in transaction'` in Supabase SQL editor. Kill leaked connections with `SELECT pg_terminate_backend(pid)`. The actual fix is consolidating writes — see Pattern 2.

### Pattern: Audit-then-greenlight before implementation
**When this applies:** Implementing any non-trivial feature change (more than ~30 lines or any branching logic).
**Symptom if missed:** Subtle bugs ship that the audit would have caught — D2b's date-collapse, D5's modal auto-close, etc.
**Pattern to apply:** First prompt to Claude Code says "Investigation only first. Don't change anything until I confirm scope." Read findings, refine scope, then greenlight. The audit phase costs minutes; skipping it can cost hours.

---

## Architectural gotchas from sessions

### HUD bridge `_supa` gotcha

There are TWO patterns for accessing the Supabase client. Mixing them up causes silent failures.

**Pattern 1 — Local wrapper function (used in some modules):**
```js
function _supa() { return window.HUD?._supa; }
const { data } = await _supa().from('...');
```

**Pattern 2 — Direct HUD bridge access:**
```js
const H = window.HUD;
const supa = H._supa;        // ✅ correct — object directly
const supa = H._supa();      // ❌ wrong — TypeError, often caught silently
```

`HUD._supa` is the Supabase client object directly, NOT a function. The TypeError gets swallowed by surrounding try/catch and masked by fallback paths. Real example: Session B storage picker shipped with `H._supa && H._supa()` — chip clicks silently failed for path-only attachments because they had no legacy URL fallback.

**Rule:** when accessing the Supabase client through the HUD bridge, write `H._supa` (no parens). The local-wrapper convention (`function _supa()` returning the bridge property) exists in `data.js`, `templates.js`, `tiptap-gate.js` — calling THOSE is correct because they're functions that unwrap the property.

### Vercel deploy verification protocol

After every push to main, verify the deploy actually shipped before testing behavior:

```js
fetch('/public/app.bundle.js?bust=' + Date.now())
  .then(r => r.text())
  .then(t => console.log('Has new code:', t.indexOf('expectedString') > -1));
```

Or for index.html changes:
```js
fetch('/index.html?bust=' + Date.now())
  .then(r => r.text())
  .then(t => console.log('Has new code:', t.indexOf('expectedString') > -1));
```

If push reaches GitHub but Vercel doesn't pick it up, force the webhook with an empty commit:
```bash
git commit --allow-empty -m "chore: force vercel rebuild"
git push
```

### Don't pre-blame the agent

When something looks wrong post-deploy, gather diagnostic data first (Network tab, Console output, Supabase row inspection) before assuming the code is broken. Often the issue is environment-specific or transient (Vercel cache, Supabase 544s, expired session, etc.). Yesterday's "Eytan's image won't load" turned out to be three specific files with intermittent 544s, not a code bug.

### Folder + permission model (current state)

- `folders` table: flat per child (no `parent_folder_id` today). Adding nesting requires schema + render refactor across ~6 sites.
- `folder_permissions`: granular, persistent, real DB rows. Format `(specialist_id, child_id, folder_key)`. Realtime-synced.
- `DB.specialistVaults.authorizedSpecialistIds`: parallel LS-only system, not persisted to Supabase. Looks abandoned/half-built. Pending: investigate-or-delete decision.
- Specialist approval auto-creates a folder `key='spec_'+specialistId` AND a folder_permissions row at `index.html:6335-6349`.
- Patient files link to folders via string match: `files.category === folders.key`. NOT a foreign key. Renaming a folder's key would silently strand files.
- Open RLS on folders/files pre-launch — flagged for HIPAA hardening.

### Lazy-sign pattern for storage URLs

Storage URLs (signed via `createSignedUrl`) expire after their TTL — default 15 min. NEVER eagerly sign URLs at hydration time and store them in `DB.folders` or any cache. The cache outlives the URL.

**Pattern:** store `storage_path` in the data structure. Sign at render or click time via `SB.signFile(path, opts)`. For thumbnail-heavy views, use the `_signFilePool` concurrency limiter (max 4 parallel) so a 30-thumbnail grid doesn't fan out to 30 simultaneous Supabase requests.

**Centralized helper:** `SB.signFile(path, { download, ttl })` handles all signed-URL generation, hardcoded to `huddledin-files` bucket. Live since Session B (May 2026).

Real example: storage picker shipped with eager-signing in `_copyFile`; refactored to path-only in Sub-commit 2.5. Specialist photo loads later relied on this pattern to avoid the parent's "photo broken" report 15 minutes after a completion.

### Path-based render for completion photos

`homework_completions_v2.photo_path` is the canonical source for completion photos. `photo_url` is preserved as a fallback for legacy rows but NOT trusted for active rendering — when stored at write-time, the URL is already expiring and will be dead by the time the specialist opens detail-view.

**Pattern:** read `photo_path` first; sign at render via `SB.signFile`. Fall back to `photo_url` only when `photo_path` is null. Same applies to any new photo or file column added in the future. Thumbnails-beside-text and lightbox both follow this pattern in `detail-view.js`.

### "Tasks" is two concepts in user-facing strings

Internal naming:
- `homework` / `homework_tasks` / `homework_completions_v2` — the homework system
- `spec_tasks` / `parent_tasks` — per-user todo lists

User-facing labels:
- `homework` → "Home Exercises" (specialist side) or "Homework" (parent side)
- `spec_tasks` → "Tasks" (specialist personal todos)

**Rule:** never global find-replace "Tasks" in user-facing strings. Internal symbol names (`homework_tasks`, `_hhHwTasksChannel`, etc.) stay as-is — the rename is display-only and varies by viewer role.

### Activity feed item shape (specialist detail-view)

Shape: `{ scheduledDate, loggedAt, isRetroactive, photoPath, photoUrl, ... }`.
- `scheduledDate` — the day the parent meant. DISPLAY date.
- `loggedAt` — when the row was inserted into `homework_completions_v2`. SORT key.
- `isRetroactive` — boolean, derived when `scheduledDate !== loggedAt-as-date`. Drives the "⏱" indicator on the row.

v1 dual-write items always have `isRetroactive=false` (no separate scheduled_date column on the v1 schema). When merging v1+v2 in detail-view, v2 wins on display.

Watch out: any rename of `item.date` to the new tuple needs an exhaustive grep — Session 1 Sub-commit 4 caught 3 references at lines 161-173 of detail-view.js that all needed updating.

### Filter chip + state pattern (parent homework view)

`S._hwActiveFilter` ('all' | 'missed' | 'completed') controls which homework cards render. Pair with `S._hwActiveDateForChild` ledger so navigating between children resets stale filter/date state.

**Rules:**
- Auto-revert to 'all' when active filter's count drops to 0 — no UX trap where user is stuck on empty Missed view.
- Cross-child reset: when `S._hwActiveDateForChild !== currentChildId`, clear `_hwActiveDate` and reset `_hwActiveFilter` to 'all'.
- Backward-compat read for legacy boolean state: `S._hwMissedFilter` (boolean) → `S._hwActiveFilter` (string), then delete the legacy key after first read.

Reference: `src/features/homework/parent-view.js:33-43` (migration), `:113-127` (auto-revert), `:300-324` (chip render). Same pattern is reusable for any feature that combines a date strip with mutually-exclusive filter chips.

### Manual migrations enforcement

Golden Rule #11 says migrations are MANUAL via Supabase SQL editor. The enforcement protocol:

1. Agent commits the migration file under `supabase/migrations/`.
2. Agent **STOPS**. Posts the SQL block plus an `information_schema` verify query.
3. User pastes SQL into Supabase SQL editor → runs.
4. User pastes the verify query result back as confirmation.
5. Only THEN does the agent push code that depends on the schema change.

Skipping the gate causes silent runtime failures — the JS shipped expecting a column that doesn't exist. Sub-commit 1 of Session 1 + Session 2 followed this protocol; both shipped clean as a result.

---

## 📚 Documentation Files

### Committed
- `CLAUDE.md` — this file, main dev guidelines
- `SPECIALIST_WEB_REDESIGN_STATUS.md` — detailed specialist desktop status
- Design doc for Report Builder at: `C:\Users\eytan\OneDrive\Apps\Huddledin\Huddledin Report Feature\design-doc-report-builder-01042026`
- Phase 3 design doc (deferred): `phase3-design-doc.docx` in same folder
- Skills at `C:/Users/eytan/.claude/skills/`

### Gitignored (private project notes)
- `REPORT_SYSTEM_REFERENCE.md` — Tiptap-based report system architectural reference
- `HUDDLEDIN_HANDOVER.md` — chat-to-chat handover doc with current state, decisions, backlog
- `calendar-v2-design.md` — Calendar v2 design doc (recurring appointments, day view, attendance tracking)

These are kept locally but not committed. Useful for onboarding new Claude sessions.