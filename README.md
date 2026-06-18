# DIMA Risk

Privacy and cybersecurity compliance intelligence platform for Canadian and American organizations in regulated industries.

DIMA Risk automates compliance assessment against PIPEDA (Canada) and HIPAA (USA), calculates a composite risk score from four components, generates a prioritized remediation roadmap, and provides a full evidence registry — all from a single onboarding session.

---

## What It Does

- **Compliance questionnaire** — domain-by-domain guided assessment tailored to the organization's industry and framework
- **Automated network scan** — passive technical audit of the org's public IP via the EWNAF scanner (Go binary on DigitalOcean)
- **Risk scoring** — four-component model (data volume, sensitivity, third-party exposure, compliance gap) blended with scan results into a 0–100 score
- **Financial exposure** — breach cost estimate using IBM 2024 per-record rates + regulatory fine ranges
- **Remediation roadmap** — auto-generated action items from every failed control, prioritized by severity
- **Evidence center** — file upload registry stored on the EWNAF droplet, proxied securely through the Next.js API

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack) |
| Styling | CSS Modules + Bootstrap |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Scanner | EWNAF Go binary — DigitalOcean droplet |
| Auth | Supabase Auth (email/password, SSR cookies) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project with the schema from `schema_migration.sql` applied
- An EWNAF droplet running with the evidence routes registered (see `docs/DATA_FLOW.md`)

### Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
EWNAF_HOST=http://your_droplet_ip:8080
EWNAF_UPLOAD_TOKEN=your_upload_token
```

### Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database Setup

Run `schema_migration.sql` in the Supabase SQL editor. The file is addendum-based — run it top to bottom in one pass, or run each addendum block in order if the base schema already exists.

---

## Documentation

| Doc | Contents |
|---|---|
| [`docs/OVERVIEW.md`](docs/OVERVIEW.md) | Platform overview, supported frameworks, dashboard pages |
| [`docs/USER_FLOW.md`](docs/USER_FLOW.md) | Full user journey from registration to dashboard |
| [`docs/DATA_FLOW.md`](docs/DATA_FLOW.md) | Data flow diagram, all DB tables with column details, RLS strategy |
| [`docs/SCORING.md`](docs/SCORING.md) | Risk score formulas, maturity levels, financial exposure math |

---

## Supported Frameworks

| Framework | Region | Industries |
|---|---|---|
| PIPEDA | Canada | Healthcare, Healthtech, Education, Fintech, Finance |
| HIPAA | USA | Healthcare, Healthtech |

SOC 2, GDPR, ISO 27001/27002, Quebec Law 25, and FIPPA are seeded in the database for future expansion.
