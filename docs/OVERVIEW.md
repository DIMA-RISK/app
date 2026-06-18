# DIMA Risk — Platform Overview

DIMA Risk is a privacy and cybersecurity compliance intelligence platform for organizations operating under PIPEDA (Canada) or HIPAA (USA). It automates the compliance assessment lifecycle: guided questionnaire → automated network scan → risk scoring → prioritized remediation → evidence management.

---

## Target Users

- Compliance officers and privacy leads at small-to-mid-size organizations
- Regulated industries: healthcare, healthtech, fintech, finance, education
- Geography: Canada (PIPEDA) and USA (HIPAA); database seeded for future EU/UK expansion

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 16.2 (App Router) | Turbopack in dev; server components by default |
| Styling | Bootstrap 5 + CSS Modules | Bootstrap loaded globally; page-level overrides via modules |
| Backend | Next.js Server Actions + API Routes | No separate API server |
| Auth | Supabase Auth | Email/password; SSR cookie session |
| Database | Supabase (PostgreSQL) | RLS on all tables; service-role client for server-only reads |
| Scanner | EWNAF Go binary | Runs on DigitalOcean droplet, port 8080; bearer token auth |
| Evidence store | EWNAF droplet `/var/data/evidence/` | Files stored on droplet; metadata in Supabase |

---

## Supported Compliance Frameworks

| Code | Name | Region | Industries |
|---|---|---|---|
| `PIPEDA` | Personal Information Protection and Electronic Documents Act | Canada | Healthcare, Healthtech, Education, Fintech, Finance |
| `HIPAA` | Health Insurance Portability and Accountability Act | USA | Healthcare, Healthtech |
| `SOC2` | SOC 2 Type II | USA | (seeded, not yet active) |
| `GDPR` | General Data Protection Regulation | EU | (seeded, not yet active) |
| `ISO27001` | ISO/IEC 27001:2022 | Global | (seeded, not yet active) |
| `ISO27002` | ISO/IEC 27002:2022 | Global | (seeded, not yet active) |
| `LAW25` | Quebec Law 25 | Canada | (seeded, not yet active) |
| `FIPPA` | Freedom of Information and Protection of Privacy Act | Canada | (seeded, not yet active) |

---

## Dashboard Pages

| Route | Purpose |
|---|---|
| `/dashboard` | Home — risk score card, open critical tasks, quick stats |
| `/dashboard/risks` | Risk Register — full remediation roadmap with filter/sort |
| `/dashboard/compliance` | Compliance — per-domain maturity scores and framework progress |
| `/dashboard/actions` | Action Plan — all roadmap items with status management |
| `/dashboard/analytics` | Analytics — risk score trend, breach cost, regulatory fine estimates |
| `/dashboard/evidence` | Evidence Center — file upload, download, and audit trail |
| `/dashboard/questionnaire` | Questionnaire — view answers from onboarding; re-run not yet implemented |
| `/dashboard/alerts` | Alerts — top-priority open roadmap items surfaced as alert cards |
| `/dashboard/reports` | Reports — executive summary, printable compliance report |
| `/dashboard/assets` | Assets — placeholder for future asset inventory |
| `/dashboard/users` | Users — placeholder for team management |
| `/dashboard/settings` | Settings — organization profile display |

---

## Auth & Routing

| Route | Access |
|---|---|
| `/login`, `/register` | Public. Logged-in users are redirected to `/dashboard` (or `/welcome` if onboarding incomplete) |
| `/welcome`, `/onboarding` | Requires auth + incomplete onboarding. Redirects to `/dashboard` if already completed |
| `/dashboard/*` | Requires auth + completed onboarding. Redirects to `/welcome` if onboarding incomplete |
| `/scanning` | Requires auth. Exempt from onboarding guard (user lands here right after submit, before the flag flips) |

All routing logic lives in `middleware.ts` as a single Supabase lookup per request.
