# Huddledin — CLAUDE.md

## What This Is

Care coordination platform for families managing children with multiple therapists/specialists. Single-file PWA (`index.html`, ~19,000+ lines) + esbuild module system for new features. Vanilla JS, Supabase JS v2, Vercel, GitHub auto-deploy.

**Live:** huddledin.com
**Local:** `C:\Users\eytan\OneDrive\Apps\Huddledin`

---

## Golden Rules

1. **Supabase is the only source of truth.** `DB`/`LS` = display cache. Write Supabase first, then update cache.
2. **Always `{ data, error }` from ALL Supabase calls.** Use `try/catch` with `console.error`. Never swallow errors.
3. **Never `.maybeSingle()`** — use `.limit(1)`.
4. **Never `ignoreDuplicates: true`** on profile upserts — silently drops role writes.
5. **DB Proxy pattern** — `DB` is a Proxy over localStorage. `DB.x[0].y = z` does nothing. Always: read full array → mutate → write back.
6. **`notifications.id` has NO default** — always provide: `'n_op_' + Date.now() + '_' + userId`.
7. **Never DELETE `specialist_requests`** — UPDATE status only.
8. **Never write `household_id` or `role` to specialist profiles.**
9. **`specialist_requests.household_id` and `folder_permissions.specialist_id` are TEXT** — always `String()`.
10. **i18n is mandatory.** All new user-facing strings: `T('key')`, add to both `_STRINGS.en` and `_STRINGS.he`.
11. **Never use "special needs"** — Huddledin is for all children.
12. **Demo mode:** `session.id === 'demo'` — skip all Supabase writes.
13. **Avoid re() when possible.** For in-view updates (calendar months, chat messages, list filters), update the DOM in-place.
14. **Double-tap protection on all async buttons.** `btn.disabled=true` before async work, re-enable in catch.
15. **Deduplicate specialist lists.** `DB.specialists` has one entry per specialist per child. Always deduplicate by specialist_id with `Set`.
16. **Never add EXISTS subqueries to RLS policies on `specialist_requests`** — causes recursive RLS. Use security definer functions instead.
17. **Never use empty `.catch(() => {})`** — always `catch(e => console.error('❌ context:', e))`.
18. **Use `_getFileActionDefs()` for file actions** — single source of truth. Never add actions directly to `_fileActions` or `_mkFileActions`.
19. **Use `_upsertNotif()` for all notifications** — handles stacking, counting, and dedup. Never insert notifications directly.
20. **Store all realtime channel refs** — every channel must be stored in a variable and unsubscribed in `doLogout()`.
21. **Use specific SELECT columns** — never `select('*')`. Only query columns the code actually uses.

---

## Architecture

### State & Render
- **`S`** — single UI state object. Mutate → call `re()`. Never mutate DOM directly.
- **`re()`** — uses `root.replaceChildren()` for atomic swap (no white flash). Preserves scroll position unless navigation changed.
- **`_supa`** — Supabase client. Module-level, never recreate.
- **`DB`** — Proxy over localStorage. Read cache only. See Golden Rule #5.
- **`refreshFromSupabase()`** — pulls all remote data into cache after auth/realtime.
- **`_debouncedRefresh()`** — debounced wrapper. **Always use this in realtime callbacks**.
- **`SB`** — async Supabase CRUD helpers per table. All have error handling.

### re() Behavior
- **Atomic swap:** `root.replaceChildren(newContent)` — no white flash.
- **Scroll preservation:** Tracks `_reLastTab`, `_reLastNav`, `_reLastChild`, `_reLastFs`. Navigation changed → scroll top. Unchanged → save/restore `window.scrollY`.
- **Chat cleanup:** When `S.activeTab !== 'chat'` → clears `S.activeChatId`, `S.activeChatChildId`, search state.

### In-Place DOM Updates (avoid re())
- **Calendar month change:** `_calNav()` swaps grid in-place with slide animation.
- **Chat message send:** Append bubble directly to `#msg-area`, clear input without destroying it.
- **Chat message receive:** Append incoming bubble in-place via per-chat subscription.
- **Chat search navigation:** Scroll to match with highlight.

### Navigation (Parent)
- `S.navLevel === 0` → Family Home (no child selected)
- `S.navLevel === 1` → Child profile. `S.activeChild` = child ID, `S.activeTab` = section
- Use `switchTab(id)` to navigate — handles cleanup.
- Bottom bar buttons MUST set `S.activeTab` (Home→'dashboard', Calendar→'calendar') to trigger cleanup in re().

### Session Object
```javascript
session = {
  id, role, householdId, email, displayName, isPrimary, profession, specialistId
}
```
`session.specialistId` = same as `session.id`. Use `session.profession` for display, never `session.role`.

### UI Primitives
`openModal(title, buildFn, maxW)`, `openConfirm(title, msg, danger, onOk)`, `el(tag, attrs, kids)`, `mkBtn(label, cls, onClick)`, `toast(msg, type, ms)`

---

## Mobile Swipe Navigation

### Tab Swipe
`_initSwipeNav()` on `#main`. Horizontal swipe (min 60px, 1.5x ratio) navigates between bottom bar sections.
- **Parents:** Home → Calendar → Chats → Notifications
- **Specialists:** Home → Patients → To-Do → Notifications
- Blocked when: modal open, inside child profile, inside chat conversation

### Calendar Swipe
`_addCalSwipe(calEl, monthKey)` on calendar grid. Uses `e.stopPropagation()` to prevent tab swipe. Calls `_calNav()` for smooth in-place swap.

---

## Module System (esbuild)

New features in `src/features/` — NOT in index.html. Bridge via `window.HUD` / `window.HUD_*`.

```bash
npm run build    # esbuild bundles → public/app.bundle.js
```

---

## Supabase Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `profiles` | `id`, `role`, `display_name`, `profession`, `household_id`, `is_primary`, `phone`, `address_*`, `city`, `zip`, `country` | Specialists: `household_id = null`. |
| `children` | `id`, `household_id`, `name`, `dob`, `avatar_emoji`, `color`, `tz_number` | |
| `specialist_requests` | `id`, `specialist_id`, `child_id`, `parent_id`, `household_id` (TEXT), `status`, `request_type`, `specialist_name`, `role`, `parent_email_hint`, `child_name_hint`, `parent_seen_at` | UNIQUE INDEX on (specialist_id, child_id) WHERE status='approved' AND request_type='join'. |
| `specialists` | | **LEGACY — do NOT use.** |
| `chats` | `id`, `participants` (jsonb), `household_id`, `child_id`, `name`, `type` | Dedupe participants. 'Consult' = never show to parents. |
| `messages` | `id`, `chat_id`, `child_id`, `sender_id`, `text`, `image_path`, `created_at` | `image_path` for chat images. Generate signed URLs on load. |
| `appointments` | `id`, `household_id`, `child_id`, `date`, `title`, `specialist_id` | Both roles see `title`, not `type`. |
| `vault_notes` | `id`, `child_id`, `specialist_id` (TEXT), `title`, `summary`, `published` | Published summary is READ-ONLY. Cannot be deleted. |
| `homework_tasks` | `id`, `child_id`, `specialist_id`, `household_id`, `title`, `status`, `recurrence`, `duration_type`, `end_date`, `time_of_day`, `difficulty` | |
| `folders` | `id`, `child_id`, `key`, `name`, `icon` | Key = `'spec_' + specialistId`. |
| `files` | `id`, `child_id` (NULLABLE), `uploaded_by`, `name`, `storage_path`, `mime_type`, `size_bytes`, `category`, `shared_with`, `created_at` | `child_id = NULL` for inbox. `category = 'inbox'` for unsorted. |
| `folder_permissions` | `specialist_id` (TEXT), `child_id`, `folder_key`, `granted_at` | No `id` column. |
| `notifications` | `id` (TEXT, NO DEFAULT), `user_id`, `child_id`, `type`, `message`, `read`, `link_tab`, `link_data`, `created_at`, `meta_count` | `meta_count` for stacking. Always use `_upsertNotif()`. |
| `subscriptions` | `id`, `user_id`, `status`, `plan`, `billing_cycle`, `exempt`, `household_id` | **UNIQUE(user_id, plan).** Parent: `.eq('plan','family')`. Specialist: `plan:'specialist_ai'`. |
| `parent_tasks` | `id` (TEXT), `household_id` (TEXT), `created_by`, `assigned_to`, `child_id`, `title`, etc. | DB Proxy pattern. |
| `spec_vault_folders` / `spec_vault_files` | | Specialist personal storage. |
| `reports` / `report_templates` / `report_settings` | | Report Builder. |

**Storage buckets:** `huddledin-files` (private), `specialist-storage` (private). Inbox: `inbox/{userId}/{timestamp}_{filename}`. Chat images: `chat/{chatId}/{timestamp}_{filename}`.

---

## RLS

### Security Definer Functions
- **`get_child_specialists(p_child_id uuid)`** — returns specialists for a child, bypassing RLS. Used by `loadChildSpecialists()` via `_supa.rpc()`. NEVER use EXISTS subqueries on specialist_requests RLS instead.

### Key Policies
- `files` — inbox files via `uploaded_by = auth.uid()` where `child_id IS NULL`
- `profiles` — `specialists_read_connected_parents` for specialist access to parent contact info

---

## Realtime

### CRITICAL: Max ~7-8 listeners per channel

### All channels must be stored and cleaned up in doLogout()

### Parent Channels
| Channel | Variable | Table |
|---------|----------|-------|
| `household:{hid}` | `_householdChannel` | children, specialists, specialist_requests, invites, appointments, homework (6 listeners) |
| `hh_notifs:{uid}` | `_hhNotifsChannel` | notifications — skips message notifs when in active chat |
| `hh_hw_tasks:{hid}` | `_hhHwTasksChannel` | homework_tasks |
| `hh_parent_tasks:{hid}` | `_hhParentTasksChannel` | parent_tasks |
| `hh_vnotes:{cid}` | `_hhChildChannels[]` | vault_notes per child |
| `hh_files:{cid}` | `_hhChildChannels[]` | files per child |
| `hh_msgs:{cid}` | `_hhChildChannels[]` | messages per child — skips sender's own |

### Specialist Channels
| Channel | Variable | Notes |
|---------|----------|-------|
| `spec_sync:{specId}` | `_specPermsChannel` | folder_permissions, specialist_requests, notifications INSERT/UPDATE, homework_tasks |
| `spec_apts:{cid}` | `_specChildChannels[]` | appointments per patient |
| `spec_msgs:{cid}` | `_specChildChannels[]` | messages — skips sender's own |
| `spec_child_data:{cid}` | `_specChildChannels[]` | vault_notes + files per patient |
| `spec_sub:{uid}` | `_specSubChannel` | subscription changes |

### Realtime Sender Filtering
Both `hh_msgs` and `spec_msgs` skip `sender_id === session.id`. Notification channels skip message notifications when `S.activeTab === 'chat' && S.activeChatId` — auto-marks read silently.

### Specialist Channel Recreation
`setupSpecialistSync` is called from `refreshFromSupabase`. It unsubscribes `_specChildChannels[]` before recreating to avoid "cannot add callbacks after subscribe()" errors.

---

## Notification System

### Always use `_upsertNotif(uid, opts)`
- Finds existing unread notification for same user + type + child
- If found: increments `meta_count`, updates message with count, bumps `created_at`
- If not found: inserts fresh with `meta_count: 1`
- Supports `stackMessage` template with `{n}` placeholder for clean counted format
- Updates `link_data` to point to the latest context

### Message notification format
- Count 1: "💬 New message from Erez Moriah's Speech-Language Therapist - Eytan Moria"
- Count 2+: "💬 3 new messages from Erez Moriah's Speech-Language Therapist - Eytan Moria"

### markChatRead
- Marks notifications as read scoped by **chat_id** (from `link_data`), not child_id
- Updates both local cache AND Supabase directly (catches notifications not yet in cache)
- Resets the counter for `_upsertNotif`

---

## Chat System

### Chat Images
`image_path` column on messages. Upload to `chat/{chatId}/{timestamp}_{filename}`. Camera + Gallery popup (📷). Optimistic display from local blob URL. Signed URLs on load.

### Chat Member List
Tap chat header → modal. Cache-first lookup with Supabase fallback.

### Message Search
Search bar at top of chat list. Client-side across `DB.chats[].messages[]`. Results grouped by chat (deduped). Navigate between matches (▲ ▼). All matches highlighted with `<mark>`.

### Message Send (In-Place, No re())
`_sending` flag → optimistic cache push → in-place DOM append → input clear (keyboard stays) → Supabase insert in background → error: rollback.

### Message Receive (In-Place, No re())
Per-chat subscription appends incoming bubble directly. `hh_msgs`/`spec_msgs` skip re() when `S.activeChatId` set. Notification channel auto-marks read when in active chat.

---

## File System

### File Actions — Single Source of Truth
`_getFileActionDefs(f, folder, isParent, opts)` returns action definitions. Both `_fileActions` (inline) and `_mkFileActions` (modal) consume this. Add new actions to `_getFileActionDefs` ONLY.

### File Inbox (Persistent)
Upload to Supabase immediately. `child_id = NULL, category = 'inbox'`. Sort = UPDATE child_id + category. Survives refresh.

### Move / Copy
Move: update `files.category`. Copy: duplicate blob + new files row. Notifications on shared folder.

---

## iOS-Specific

### Sticky Hover
```css
@media(hover:none){
  .card.hov:hover,.nav-btn:hover{transform:none;background:transparent;color:inherit}
  .btn:hover{transform:none}  /* NO background/color override */
}
```

### Keyboard Collapse Prevention
Never call `re()` from chat send. Use `mi.focus()` after `sb2.disabled=true`. No `ontouchstart preventDefault` on send button.

---

## Calendar

### Smooth Month Navigation
`_calNav(monthKey, dir)` — in-place grid swap with slide animation. No re(). Works for both `renderCalendar` and `renderCalFullscreen`.

### Mini-Calendar Expand
`renderMiniCalendar(children, allApts, onExpand)` — patient dashboard passes custom `onExpand` for filtered calendar.

### Patient Calendar Filtering
Main calendar: `calendarMode='joint'`. Patient profile: `calendarMode='child'`, filter by `S.activeChild`.

---

## Mobile Header — Child Selector

### Top-Level Sections
"🧒 Child ▾" generic label. Tapping navigates INTO child's profile. Dropdown positioned relative to centre element.

### Inside Child Profile
Specific child name + avatar + "▾". Switches child, stays on tab.

---

## Pricing & Payments

| User | Annual | Monthly | Trial |
|------|--------|---------|-------|
| Parents | $5/mo | $7/mo | 14 days |
| Specialists (base) | Free | — | — |
| Specialists (AI) | $9/mo | $11/mo | 7 days on demand |

Paddle production. Webhook: `supabase/functions/paddle-webhook/index.ts`. Plan-aware.

---

## Infrastructure

- **Supabase:** smgbojgrdezasxciloll.supabase.co
- **Vercel:** Hobby plan, max 12 serverless functions (at limit), `maxDuration: 60` for AI endpoints
- **Email:** Resend API
- **AI:** Anthropic Claude API

---

## Git & Deployment Workflow

- **Repo:** https://github.com/eytanmoriah/Huddledin
- **Production:** www.huddledin.com (Vercel auto-deploys `main`)
- **Database:** Supabase project `smgbojgrdezasxciloll`
- **Supabase GitHub integration:** enabled — auto-runs migrations in `supabase/migrations/` and deploys Edge Functions in `supabase/functions/` when pushed

### Rules
1. **NEVER push directly to `main`.** All changes go through a feature branch + PR.
2. Create a feature branch before making changes:
   ```
   git checkout -b feature/description-of-work
   ```
3. Make changes, commit, and push the feature branch:
   ```
   git add .
   git commit -m "..."
   git push origin feature/description-of-work
   ```
4. After pushing, **tell the user to open a PR on GitHub** for testing.
5. **Vercel auto-deploys a preview URL** on every PR (posted as a commit status / PR comment).
6. **Supabase auto-runs migrations and deploys Edge Functions** when `supabase/` files change on the PR branch.
7. **Only merge to `main` when the user confirms** the preview is tested and approved.
8. After merging, switch back to `main` and pull:
   ```
   git checkout main && git pull origin main
   ```

Docs-only edits to `CLAUDE.md` / `README.md` may be pushed directly to `main` when the user explicitly says so.

---

## XSS Fix Warning
March 23, 2026. If child photos, appointment chips, button labels, avatar emojis, ✕ buttons, or modal buttons break → check XSS fix first.

---

## Test Accounts

| Role | Email | User ID |
|------|-------|---------|
| Primary parent | eytanmoriah@gmail.com | b3ab6d4e |
| Co-parent | laurimoriah@gmail.com | f1d4d485 |
| Specialist Lauri | lauri@hamakortherapy.com | 0a58f99f |
| Specialist Eytan | eytan760@gmail.com | 43342d4f |

**Children:** Erez (c4629a74), Shalev (b0f8b71c), Amalya (5854881f), Nadav (56daa421), Omer (462be20c)

---

## Syntax Check

```bash
npm run build
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const scripts=html.match(/<script[^>]*>([\s\S]*?)<\/script>/g)||[];scripts.forEach((s,i)=>{try{new Function(s.replace(/<\/?script[^>]*>/g,''))}catch(e){console.error('Block '+i+':',e.message)}});console.log('✅ Syntax OK')"
```