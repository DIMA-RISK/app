# DIMA Risk — Data Flow & Database Structure

---

## High-Level Data Flow

```
Browser
  │
  ├── Next.js Server Components / Server Actions (app/)
  │     ├── Supabase SSR client  →  Supabase Auth  →  users table (managed by Auth)
  │     ├── Supabase Admin client (service-role)  →  PostgreSQL tables (RLS bypassed server-side)
  │     └── EWNAF HTTP client  →  Go scanner (DigitalOcean :8080)
  │
  └── Next.js API Routes (app/api/)
        └── /api/evidence/download/[id]  →  proxies EWNAF file serve (bearer token never sent to browser)
```

---

## Database Tables

All tables live in the `public` schema on Supabase (PostgreSQL 15).

---

### `organizations`

Stores one row per registered user. Created on registration, updated throughout onboarding.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `user_id` | uuid (FK → auth.users) | Supabase Auth user ID |
| `owner_name` | text | Full name from registration |
| `name` | text | Organization name (set in onboarding step 1) |
| `industry` | text | e.g. `healthcare`, `fintech` |
| `country` | text | e.g. `canada`, `usa` |
| `compliance_framework` | text | Derived from country + industry (`PIPEDA`, `HIPAA`, …) |
| `patient_records_count` | int | Number of records held |
| `data_storage_gb` | numeric | Data storage in GB |
| `data_sensitivity_level` | int | 1 (Public) → 5 (Top Secret) |
| `has_health_data` | boolean | |
| `has_financial_data` | boolean | |
| `has_pii_data` | boolean | |
| `vendor_count` | int | Number of third-party vendors |
| `max_vendor_access_level` | int | 1–4 (Read-Only → Admin) |
| `vendor_data_share_pct` | numeric | % of data shared with vendors |
| `public_ip` | text | IP submitted for EWNAF scan |
| `onboarding_completed` | boolean | Guards dashboard access via middleware |
| `created_at` | timestamptz | Auto-set |
| `updated_at` | timestamptz | Updated on each onboarding step |

---

### `assessment_sessions`

One row per scoring run. Created when the user submits the questionnaire (or skips it).

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `org_id` | uuid (FK → organizations) | |
| `user_id` | uuid (FK → auth.users) | |
| `session_type` | text | `onboarding`, `rescan`, `manual` |
| `scan_id` | text | EWNAF scan job ID |
| `scan_status` | text | `pending`, `running`, `completed`, `failed` |
| `started_at` | timestamptz | **Used for ordering** (no `created_at` on this table) |
| `completed_at` | timestamptz | Set when scan finishes |

---

### `questionnaire_responses`

One row per question per session.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `session_id` | uuid (FK → assessment_sessions) | |
| `org_id` | uuid | |
| `question_id` | uuid (FK → framework_questions) | |
| `response` | text | `yes`, `partial`, `no`, `na` |
| `notes` | text | Optional user note |
| `created_at` | timestamptz | |

---

### `risk_scores`

Upserted by `calculate_risk_score()` after each scoring run.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `org_id` | uuid | |
| `session_id` | uuid | |
| `total_score` | numeric | 0–100 |
| `exposure_score` | numeric | 0–25 — data volume component |
| `impact_score` | numeric | 0–25 — data sensitivity component |
| `control_score` | numeric | 0–25 — third-party risk component |
| `likelihood_score` | numeric | 0–25 — compliance gap component |
| `risk_level` | text | `critical`, `high`, `medium`, `low` |
| `ewnaf_data` | jsonb | Raw scan results (if scan ran) |
| `calculated_at` | timestamptz | |

---

### `financial_impacts`

Upserted by `calculate_financial_impact()`.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `org_id` | uuid | |
| `session_id` | uuid | |
| `breach_cost_estimate` | numeric | Per-record cost × records at risk |
| `regulatory_fines_min` | numeric | Low-end regulatory fine |
| `regulatory_fines_max` | numeric | High-end regulatory fine |
| `total_exposure_min` | numeric | breach_cost + fines_min |
| `total_exposure_max` | numeric | breach_cost + fines_max |
| `records_at_risk` | int | patient_records × vendor_share_pct |
| `calculated_at` | timestamptz | |

---

### `remediation_roadmap`

Auto-generated action items from every failed questionnaire response. Deleted and re-inserted on each scoring run (idempotent per session).

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `org_id` | uuid | |
| `session_id` | uuid | Scoped to the session that generated it |
| `title` | text | Question text |
| `description` | text | Compliance statement from the framework |
| `priority` | text | `critical`, `high`, `medium`, `low` |
| `priority_rank` | int (GENERATED STORED) | `critical=0, high=1, medium=2, low=3` — used for DB ordering |
| `effort` | text | `low`, `medium`, `high` |
| `category` | text | `administrative`, `technical`, `physical` |
| `status` | text | `open`, `in_progress`, `completed` |
| `due_date` | date | Optional |
| `created_at` | timestamptz | |

`priority_rank` is a generated stored column added by ADDENDUM 4 of `schema_migration.sql`. All roadmap queries order by `priority_rank` (not text `priority`) to avoid alphabetical sort anomalies.

---

### `evidence_files`

Metadata for uploaded evidence files. The actual files live on the EWNAF droplet.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `org_id` | uuid | |
| `session_id` | uuid | |
| `control_id` | uuid (FK → framework_questions) | The control this evidence satisfies |
| `file_name` | text | Original filename |
| `file_size` | int | Bytes |
| `file_type` | text | MIME type |
| `ewnaf_path` | text | Path on the EWNAF droplet for proxied downloads |
| `uploaded_by` | uuid (FK → auth.users) | |
| `uploaded_at` | timestamptz | |

---

### `compliance_frameworks`

Lookup table of supported frameworks.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `code` | text | `PIPEDA`, `HIPAA`, `SOC2`, … |
| `name` | text | Full framework name |
| `region` | text | |
| `description` | text | |

---

### `framework_questions`

All questionnaire questions, grouped by domain, per framework.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `framework_id` | uuid (FK → compliance_frameworks) | |
| `domain` | text | e.g. `Data Governance`, `Access Control` |
| `question_text` | text | Displayed to the user |
| `compliance_statement` | text | Used as the roadmap item description |
| `guidance` | text | Helper text shown under the question |
| `order_index` | int | Display order within the domain |
| `is_active` | boolean | |

---

## Row-Level Security (RLS)

RLS is enabled on all tables. The anon/authenticated policies restrict each row to the requesting user's `user_id` or `org_id`.

Server Actions and API routes that need to read across multiple orgs (admin ops) or bypass RLS use `createAdminClient()`, which initializes the Supabase client with the `SUPABASE_SERVICE_ROLE_KEY`. This key is never sent to the browser.

---

## Evidence File Flow

```
Browser (EvidenceClient.tsx)
  │  FormData (file + control_id)
  ▼
Server Action: uploadEvidenceFile()  (app/dashboard/queries.ts)
  │  Validates file extension (.pdf, .docx, .xlsx, .csv, .png, .jpg, .txt)
  │  POST multipart/form-data → EWNAF_HOST/evidence/upload (bearer token)
  │  ← { path: "/var/data/evidence/uuid.ext" }
  │  INSERT INTO evidence_files (metadata + ewnaf_path)
  ▼
Browser receives { success: true }

Browser clicks Download
  │  GET /api/evidence/download/[id]
  ▼
API Route (app/api/evidence/download/[id]/route.ts)
  │  SELECT ewnaf_path FROM evidence_files WHERE id = [id]
  │  GET EWNAF_HOST/evidence/serve?path=… (bearer token — server only)
  │  Streams file bytes back to browser
  ▼
Browser receives file
```

---

## EWNAF Scanner Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/scan` | Start a new scan job. Body: `{ ip, org_id }` |
| `GET` | `/scan/status?scan_id=…` | Poll scan status |
| `POST` | `/evidence/upload` | Upload an evidence file (multipart) |
| `GET` | `/evidence/serve?path=…` | Download an evidence file |
| `DELETE` | `/evidence/delete?path=…` | Delete an evidence file |

All requests require `Authorization: Bearer {EWNAF_UPLOAD_TOKEN}`.
