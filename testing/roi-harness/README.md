# DIMA ROI / Risk Test Harness

Independently re-derives every risk & ROI formula and **diffs it against the running app's stored output**, so ROI bugs (like Regulatory Fine Avoidance 8× over its ceiling, or Security Training implying 50,000 employees) are caught automatically instead of by eyeballing a screenshot.

Standalone — lives outside the Next app (`testing/roi-harness/`), Node-only, no build step, no extra dependencies (Node 18+ global `fetch`).

## Run it

```bash
cd testing/roi-harness

node harness.mjs audit                 # audit every scored org in the DB (READ-ONLY)
node harness.mjs audit user@email.com  # audit one org by login email
node harness.mjs matrix                # seed the 10-profile matrix, run, diff, clean up
node harness.mjs matrix --keep         # same, but leave the throwaway user in place
```

Credentials are read automatically from `../../.env.local` (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`), or from those env vars if set. Exit code is non-zero when any check fails (CI-friendly).

## Architecture (Oracle vs. App)

- **Oracle** (`oracle.mjs`) — a clean, second implementation of the formulas (risk 4 components, breach cost, flat fine tiers, investment, 3-yr benefits, net/ROI/payback), written from the documented formulas, **not** by importing the app's SQL. A diff between the two surfaces drift, stale DB functions, and bad data.
- **App output** — what the app actually stored: `risk_scores` (4 components + total) and `financial_impact` (breach cost, fines, investment & benefit breakdowns, net, ROI%, payback).
- **Harness** (`harness.mjs`) — gathers a given org's inputs + the app's output, runs the oracle on the same inputs, and prints a line-by-line PASS/FAIL diff plus the named invariant checks.

## What it checks

**Line-by-line diff** (spec §5): each of the 4 risk components + total, breach cost, each regulatory fine, every investment line, every benefit line, net benefit, ROI%, payback — expected vs. actual vs. delta.

**Named invariant checks** (`checks.mjs`, spec §4) — spec-derived invariants that hold regardless of the exact formula, so they stay robust:

| Check | Guards against |
|---|---|
| `test_security_training_matches_org_employee_count` | the $12.5M-on-50,000-employees bug |
| `test_regulatory_fine_avoidance_within_ceiling` | the $30M-implied-ceiling bug (asserts ≤ $3.6M) |
| `test_investment_breakdown_sums_to_total` | investment lines not summing |
| `test_benefits_sum_to_net_benefit` | net benefit not reconciling |
| `test_roi_percentage_formula` | ROI% ≠ net/investment×100 |
| `test_payback_period_formula` | payback ≠ investment÷(benefits÷3)×12 |
| `test_revenue_consistency_across_benefit_lines` | benefit lines reading different revenues |
| `test_compliance_gap_saturation` | **SKIP** — pending the saturation product decision (spec §2.1) |

## Test-profile matrix

`profiles.mjs` defines the 10 profiles from spec §3 (small/enterprise, high-employee-count regression, high/zero compliance gap, health/financial/PII-only per-record rates, third-party cap/floor). `matrix` mode seeds each onto a throwaway org and runs the **real** scoring RPCs.

## Encoded decisions (keep in sync with the app)

The oracle locks in the two ROI fixes already shipped, so a regression back to the old behavior fails the suite:

- **Flat statutory fine tiers** (ADDENDUM 21): HIPAA $1.5M / PIPEDA $100K / GDPR $2M overlay, gap-scaled. Ceiling $3.6M.
- **Revenue-bounded Security Training** (ADDENDUM 22): `min($250 × employees, 2% × annual_revenue)`.

If a future product decision changes these, update `oracle.mjs` (`FINE_TIER`, `TRAINING_REVENUE_CAP_PCT`) and the matching check.

## Scope & limitations (honest notes)

- **Getting data in** — spec §2 prefers registering test accounts through the *real* invite/registration flow (to also catch input-handling bugs). That path (invite token + email-OTP confirmation) isn't automated here; `matrix` mode uses **direct DB seeding** (spec's option 2) + the real scoring RPCs. It therefore catches *calculation* bugs, not *input-save* bugs. `audit` mode covers real orgs (whose data did go through the real input path), which partially compensates.
- **Matrix mode writes to the configured DB** — it creates one throwaway confirmed auth user, seeds each profile, and deletes the user at the end (cascading the seeded rows). Use `audit` (read-only) for routine runs.
- **Oracle independence caveat** — the oracle is a separate implementation, but it was written from the documented/known formulas; without the raw spec text in hand it may mirror an intended-but-wrong formula. The **named invariant checks** are the strongest guardrail because they assert spec-level truths (ceilings, sums, formula identities) that don't depend on reproducing each formula exactly.

## Files

| File | Role |
|---|---|
| `oracle.mjs` | independent formula re-implementation |
| `db.mjs` | Supabase REST client (read, count, rpc, admin user create/delete) |
| `checks.mjs` | the 7 named invariant checks (+ pending saturation) |
| `profiles.mjs` | 10-profile test matrix |
| `harness.mjs` | entry point: audit + matrix modes, diff + report |
