# DIMA Risk — Team Invites Feature

Multi-user access with two roles: **Admin** (full access) and **Viewer** (read-only).

---

## Roles

| Capability | Admin | Viewer |
|---|---|---|
| View all dashboard pages | ✓ | ✓ |
| View risk scores, compliance, analytics | ✓ | ✓ |
| View action plan, questionnaire, reports | ✓ | ✓ |
| View evidence files | ✓ | ✓ |
| Upload / delete evidence files | ✓ | ✗ |
| Change action plan task status | ✓ | ✗ |
| Edit settings | ✓ | ✗ |
| Invite team members | ✓ | ✗ |
| Revoke invitations | ✓ | ✗ |

Viewer restrictions are enforced at the **server level** (write server actions check the role and return an error). The UI also hides write controls for viewers.

---

## Database Schema

### `org_invitations` table

```sql
CREATE TABLE IF NOT EXISTS org_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by    UUID NOT NULL REFERENCES auth.users(id),
  invited_at    TIMESTAMPTZ DEFAULT now(),
  accepted_by   UUID REFERENCES auth.users(id),
  accepted_at   TIMESTAMPTZ
);
```

**Status lifecycle:** `pending → accepted` (on first login) or `pending/accepted → revoked` (by admin)

**RLS policies:**
- Org owner can read, insert, update, delete any invitation for their org
- Invited user can read their own invitation (by email match)
- Invited user can update their own invitation from `pending` to `accepted`

> **Run ADDENDUM 5 from `schema_migration.sql` in the Supabase SQL editor before using this feature.**

---

## How the Invite Flow Works — Step by Step

### Step 1 — Admin sends the invite

1. Admin navigates to **User Management** (`/dashboard/users`)
2. Clicks **Invite User** — a modal opens
3. Enters the colleague's email address and selects a role (Viewer or Admin)
4. Clicks **Send Invite**

**What happens in the server (`app/dashboard/users/actions.ts → inviteTeamMember`):**
1. Verifies the caller is the org owner (has a row in `organizations`)
2. Validates the email format
3. Checks `org_invitations` for a duplicate — returns an error if one already exists
4. Inserts a new row into `org_invitations` with `status = 'pending'`
5. Calls `supabase.auth.admin.inviteUserByEmail(email, { redirectTo: "https://app.dimarisk.com/auth/callback" })` — Supabase sends the magic-link email
6. If the email send fails, rolls back the invite row

The invited person receives an email from Supabase with a secure one-time link.

---

### Step 2 — Invited user clicks the magic link

The link in the email looks like:
```
https://app.dimarisk.com/auth/callback?code=XXXXXXXX
```

**What happens in `app/auth/callback/route.ts`:**
1. Receives the `code` query param
2. Calls `supabase.auth.exchangeCodeForSession(code)` — this creates a Supabase Auth session for the invited user and sets the session cookie
3. Redirects to `/dashboard`

At this point the user is logged in but has no `organizations` row (they're not an org owner).

---

### Step 3 — Middleware auto-accepts the invitation

On the redirect to `/dashboard`, the Next.js middleware runs before the page loads.

**What happens in `middleware.ts`:**
1. Gets the authenticated user from the session cookie
2. Looks up `organizations` by `user_id` — finds nothing (invited users have no org row)
3. Falls into the **invited-member path**:
   - Uses the service-role Supabase client to query `org_invitations` by `invited_email = user.email`
   - Finds the `pending` invite row
   - Updates it to `status = 'accepted'`, sets `accepted_by = user.id` and `accepted_at = now()`
4. Allows the request through to `/dashboard`

This happens transparently — the invited user just sees the dashboard load.

---

### Step 4 — Dashboard loads with the org's data

Every server query goes through `getOrgContext()` in `app/dashboard/queries.ts`.

**What `getOrgContext()` does:**
1. Gets the logged-in user
2. Checks `organizations` for a row where `user_id = user.id` → not found for invited users
3. Checks `org_invitations` for a row where `accepted_by = user.id` and `status = 'accepted'` → finds it
4. Joins to `organizations` to get the **org owner's** `user_id`
5. Returns `{ userId: ownerUserId, currentUserId: memberUserId, role: 'viewer' }`

All query functions (`getDashboardData`, `getComplianceData`, `getRiskRegisterData`, etc.) use `ctx.userId` (the owner's ID) for every database query. This means the viewer sees exactly the same data as the admin — it's the same org.

---

### Step 5 — Viewer has read-only access

**Server enforcement (always active regardless of UI):**
- `uploadEvidenceFile()` checks `ctx.role !== 'admin'` → returns `{ error: "Viewers cannot upload evidence files" }`
- `deleteEvidenceFile()` same check
- `inviteTeamMember()` in `users/actions.ts` checks that the caller owns an `organizations` row (viewers don't)

**UI enforcement:**
- The **Invite User** button only renders when `data.role === 'admin'`
- Revoke buttons on invitation rows only render for admins
- The Users page shows a "You have view-only access" note to viewers instead of team management controls

---

## Admin Revokes a Member

On the **User Management** page, the admin can click **Revoke** next to any active member or pending invitation.

**What happens (`revokeInvitation` server action):**
1. Verifies the caller owns the org
2. Updates `org_invitations` row to `status = 'revoked'`

On the revoked user's next request, middleware will:
1. Find no `organizations` row
2. Find no `pending` or `accepted` invite (revoked is excluded from the query)
3. Redirect them to `/login`

---

## Key Files

| File | Purpose |
|---|---|
| `app/dashboard/users/actions.ts` | `inviteTeamMember()` and `revokeInvitation()` server actions |
| `app/dashboard/users/UsersClient.tsx` | Invite modal, member list, pending invitations UI |
| `app/dashboard/users/page.tsx` | Server component — fetches user data + invitations, passes to client |
| `app/dashboard/queries.ts` | `getOrgContext()` — resolves effective user_id for members; `getOrgInvitations()` |
| `app/auth/callback/route.ts` | Exchanges Supabase magic-link code for a session |
| `middleware.ts` | Auto-accepts pending invitations on first login |
| `schema_migration.sql` | ADDENDUM 5 — `org_invitations` table + RLS policies |

---

## Required Setup Checklist

- [ ] Run **ADDENDUM 5** from `schema_migration.sql` in the Supabase SQL editor
- [ ] Add `https://app.dimarisk.com/auth/callback` to Supabase → Authentication → Redirect URLs *(done)*
- [ ] Add `NEXT_PUBLIC_APP_URL=https://app.dimarisk.com` to environment variables *(done)*
- [ ] Supabase project must have **SMTP configured** (or use Supabase's built-in email) so the invite email is actually delivered — check Authentication → Email Templates

---

## Limitations (Beta)

- Invited users cannot change their own role — only the admin can manage roles
- There is no role-change feature yet; to change a member's role, the admin must revoke and re-invite
- Email notifications (via the Notification Preferences toggles) are not yet wired up — SMTP configuration is planned for a future release
- An invited user who already has a Supabase Auth account (from a different org) will be logged into their existing account after clicking the link, which may cause unexpected behavior if they're also an org owner elsewhere
