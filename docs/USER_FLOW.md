# DIMA Risk — User Flow

End-to-end journey from account creation to a live dashboard.

---

## 1. Registration

**Route:** `/register`

User fills in: first name, last name, email, password.

**What happens:**
- `supabase.auth.signUp()` creates the user in Supabase Auth
- A row is inserted into `organizations` with `user_id`, `owner_name`, and `onboarding_completed = false`
- User is redirected to `/welcome`

---

## 2. Welcome Screen

**Route:** `/welcome`

Explains what DIMA Risk does and prompts the user to start onboarding.

**Guard:** Middleware checks `organizations.onboarding_completed`. If already `true`, redirects to `/dashboard`.

---

## 3. Onboarding — Organization Profile (Step 1)

**Route:** `/onboarding` (step 1 of 3)

User fills in:
- Organization name
- Industry
- Country / region
- Number of patient/customer records
- Data storage in GB
- Data sensitivity level (1–5)
- Whether they handle health data, financial data, or PII
- Number of third-party vendors
- Vendor access level
- Percentage of data shared with vendors

**What happens (`saveOrgProfile` server action):**
- Updates the `organizations` row with all profile fields
- Derives the compliance framework from country + industry (e.g., Canada + Healthcare → PIPEDA)
- Advances the session to step 2

---

## 4. Onboarding — Compliance Questionnaire (Step 2)

**Route:** `/onboarding` (step 2 of 3)

DIMA loads questions for the matched framework, grouped by domain (e.g., Data Governance, Access Control, Incident Response).

User answers each question: **Yes / Partial / No / N/A**

**What happens (`saveOnboardingAnswers` server action):**
- Creates an `assessment_session` row (`started_at = now()`, `session_type = 'onboarding'`)
- Inserts one `questionnaire_response` row per answer
- Calls `calculate_risk_score()` PostgreSQL function → writes to `risk_scores`
- Calls `calculate_financial_impact()` PostgreSQL function → writes to `financial_impacts`
- Calls `regenerateRoadmap()` TypeScript function → deletes + re-inserts `remediation_roadmap` rows for this session
- Sets `organizations.onboarding_completed = true`
- Advances the session to step 3 (network scan)

**Skip path:** If the user skips the questionnaire, a minimal session is created and the above scoring still runs with all-zero/default inputs. The most recent session is fetched by `started_at DESC`.

---

## 5. Onboarding — Network Scan (Step 3)

**Route:** `/onboarding` (step 3) → `/scanning`

User enters the organization's public IP address. DIMA sends it to the EWNAF Go scanner.

**What happens (`submitScanRequest` server action):**
- POSTs `{ ip, org_id }` to `EWNAF_HOST/scan` with bearer token auth
- Stores the returned `scan_id` in the session
- Redirects to `/scanning`

**Scanning page (`/scanning`):**
- Polls `GET /api/ewnaf/status?scan_id=…` every 3 seconds
- When status = `completed`, calls `rescoreWithScan` server action:
  - Fetches raw scan results from EWNAF
  - Calls `calculate_risk_score()` again with EWNAF data blended in (60% questionnaire / 40% technical scan)
  - Calls `regenerateRoadmap()` again to refresh action items
  - Marks the scan complete
- Redirects to `/dashboard`

---

## 6. Dashboard

**Route:** `/dashboard`

First load shows:
- Risk score (0–100) with band label (Critical / High / Medium / Low)
- Number of open critical tasks
- Compliance percentage
- Top 10 open roadmap items (ordered by `priority_rank`)

All dashboard data is fetched server-side via `app/dashboard/queries.ts` using the Supabase service-role client. This avoids RLS issues for cross-table reads while keeping credentials server-only.

---

## 7. Key Sub-Flows

### Evidence Upload

**Route:** `/dashboard/evidence`

1. User selects a file (PDF, DOCX, XLSX, CSV, PNG, JPG, TXT — extension validated before upload)
2. User picks a control from the dropdown (filtered to critical/high open items)
3. `uploadEvidenceFile` server action:
   - POSTs the file to `EWNAF_HOST/evidence/upload` (multipart/form-data)
   - EWNAF stores the file at `/var/data/evidence/{uuid}.{ext}` and returns a path
   - Inserts a row into `evidence_files` (Supabase) with file metadata and the EWNAF path
4. File appears in the evidence table with download link

### Evidence Download

`GET /api/evidence/download/[id]` — Next.js API route that:
- Reads the `evidence_files` row to get the EWNAF path
- Proxies `GET EWNAF_HOST/evidence/serve?path=…` with the bearer token (never exposed to the browser)
- Streams the file back to the user

### Print / Export Report

**Route:** `/dashboard/reports`

Page renders an executive summary and domain compliance table. The "Print" button triggers `window.print()`. Bootstrap `d-print-none` hides the sidebar and nav during print. The report includes the risk score, financial exposure, compliance percentage, and top 20 roadmap items.

---

## 8. Session Ordering

All queries that fetch "the most recent assessment session" order by `started_at DESC` (not `created_at`, which does not exist on `assessment_sessions`).
