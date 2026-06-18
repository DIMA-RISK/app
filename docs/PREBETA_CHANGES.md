# DIMA Risk — Pre-Beta Changes

All fixes and features applied before soft launch. Listed in the order they were implemented.

---

## Bug Fixes

### BLOCKER 1 — Alerts badge was hardcoded to "3"

**Problem:** The sidebar showed "Alerts 3" with a red badge regardless of actual data.

**Root cause:** `badge: 3` was hardcoded in the `NAV` array inside `Sidebar.tsx`.

**Fix:**
- Added `getAlertCount()` to `app/dashboard/queries.ts` — counts open `critical` and `high` priority roadmap items from the database
- Made `app/dashboard/layout.tsx` async — fetches the real count server-side at page load
- Passed the count down: `layout → DashboardShell → Sidebar`
- Badge now only renders when `alertCount > 0` and shows the actual number

**Files changed:** `app/dashboard/queries.ts`, `app/dashboard/layout.tsx`, `app/dashboard/_components/DashboardShell.tsx`, `app/dashboard/_components/Sidebar.tsx`

---

### BLOCKER 2 — Assets page showed "No scan scope detected" even with a registered IP

**Problem:** The network scan page always showed the "no results" empty state even though the organization had a registered IP.

**Root cause (two issues):**
1. `organizations.org_uid` was `null` for existing orgs — `queueScanJob()` silently returned early when `org_uid` was null, so no scan job was ever inserted into `software_queue`
2. `checkScanStatus()` returned `done: true` immediately when `org_uid` was null, so the `/scanning` page assumed the scan was complete and moved on without waiting

**Fix:**
- `queueScanJob()` now selects `id` in addition to `org_uid` and auto-derives `org_uid` from the Supabase org `id` if it was never set — then persists it back to the `organizations` table
- `checkScanStatus()` uses the same fallback
- `getAssetsData()` in `queries.ts` uses the same fallback when reading scan results
- Added a **Request Network Scan** button on the Assets page `noScope` state — clicking it calls `queueScanJob()` and redirects to `/scanning` to wait for results

**Files changed:** `app/onboarding/actions.ts`, `app/dashboard/queries.ts`, `app/dashboard/assets/page.tsx`

---

### BLOCKER 3 — Download Report button was non-functional

**Problem:** The "Download Report" button on the dashboard home showed a toast saying "generating PDF…" but never did anything.

**Fix:**
- Re-implemented with real functionality: button navigates to `/dashboard/reports?print=1`
- `ReportsClient` detects the `?print=1` query param via `useSearchParams` and calls `window.print()` after a 600ms render delay
- The user gets the native browser print dialog → Save as PDF
- Button is disabled when no assessment has been completed yet (with a tooltip)
- Wrapped `ReportsClient` in `<Suspense>` as required by `useSearchParams` in Next.js App Router

**Files changed:** `app/dashboard/_components/ExecutiveSummary.tsx`, `app/dashboard/reports/ReportsClient.tsx`, `app/dashboard/reports/page.tsx`

---

## UX Polish

### UX POLISH 1 — Invite User feature

See `docs/TEAM_INVITES.md` for the full breakdown.

---

### UX POLISH 2 — Email alert toggles disabled

**Problem:** Notification Preferences showed four toggles (Email Alerts, Weekly Summary, Critical Risk Alerts, Score Change Alerts) that were interactive but had no backend — toggling them had no effect.

**Fix:**
- Added `disabled` prop to the `Toggle` component
- All four notification toggles are now `disabled` (opacity 0.4, cursor not-allowed, click blocked)
- Added a note below: *"Email notifications coming soon — SMTP will be configured before launch."*
- The default toggle states remain visible so clients can see what notifications will eventually exist

**Files changed:** `app/dashboard/settings/SettingsClient.tsx`

---

## Auth Callback Route

**Problem:** Supabase's magic-link invite flow redirects to `/auth/callback` after authentication, but that route didn't exist in the Next.js app.

**Fix:** Created `app/auth/callback/route.ts` — a standard Next.js route handler that:
1. Receives the `code` query param from Supabase
2. Exchanges it for a session via `supabase.auth.exchangeCodeForSession(code)`
3. Redirects to `/dashboard` on success, `/login` on failure

**Files changed:** `app/auth/callback/route.ts` (new)

**Required:** `https://app.dimarisk.com/auth/callback` must be added to **Supabase → Authentication → URL Configuration → Redirect URLs** (already done).

---

## Schema Changes

### ADDENDUM 4 — `priority_rank` generated column (run status: ✅ confirmed)

Adds a stored generated column to `remediation_roadmap` that maps text priority values to integers for correct sort order. Without this, alphabetical sorting puts `low` before `medium`.

```sql
ALTER TABLE remediation_roadmap
  ADD COLUMN IF NOT EXISTS priority_rank INT GENERATED ALWAYS AS (
    CASE priority
      WHEN 'critical' THEN 0
      WHEN 'high'     THEN 1
      WHEN 'medium'   THEN 2
      WHEN 'low'      THEN 3
      ELSE 4
    END
  ) STORED;
```

### ADDENDUM 5 — `org_invitations` table (must be run)

Adds the `org_invitations` table required for the team invite feature. See `docs/TEAM_INVITES.md` for the full SQL.

---

## Environment Variables Added

| Variable | Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://app.dimarisk.com` | Base URL for Supabase invite redirect links |
