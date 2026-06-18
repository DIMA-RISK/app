# DIMA Risk — Scoring Model

All scoring is implemented as PostgreSQL functions (`calculate_risk_score`, `calculate_financial_impact`) called from Next.js Server Actions after the onboarding questionnaire is submitted and again after the EWNAF network scan completes.

---

## Risk Score (0–100)

The total risk score is the sum of four independent components, each worth a maximum of **25 points**. A higher score means higher risk.

```
Total Score = exposure_score + impact_score + control_score + likelihood_score
```

---

### Component 1 — Data Volume Risk → `exposure_score` (0–25)

Measures how much data the organization holds. More records and more storage volume = higher exposure.

```
exposure_score = min(25,  records / 10,000  +  storage_GB / 100)
```

**Inputs (from `organizations`):**
- `patient_records_count` — number of patient or customer records
- `data_storage_gb` — total data storage in gigabytes

**Examples:**

| Records | Storage (GB) | Raw | Capped |
|---|---|---|---|
| 5,000 | 50 GB | 0.5 + 0.5 = 1.0 | 1.0 |
| 50,000 | 200 GB | 5.0 + 2.0 = 7.0 | 7.0 |
| 500,000 | 1,000 GB | 50 + 10 = 60 | **25** (cap) |

---

### Component 2 — Data Sensitivity → `impact_score` (0–25)

Measures how sensitive the data is. Sensitive data types (health, financial, PII) and a high-sensitivity level increase the score.

```
impact_score = min(25,
    (sensitivity_level × 3)
  + (8 if has_health_data)
  + (5 if has_financial_data)
  + (4 if has_pii_data)
)
```

**Sensitivity level scores:**

| Level | Label | Base points (×3) |
|---|---|---|
| 1 | Public | 3 |
| 2 | Internal | 6 |
| 3 | Confidential | 9 |
| 4 | Restricted | 12 |
| 5 | Top Secret | 15 |

**Data type bonuses:**

| Type | Points |
|---|---|
| Health / PHI | +8 |
| Financial | +5 |
| PII | +4 |

---

### Component 3 — Third-Party Risk → `control_score` (0–25)

Measures exposure introduced by vendors who have access to organizational data.

```
control_score = min(25,
    (vendor_count × 2)
  + (max_vendor_access_level × 3)
  + (vendor_data_share_pct / 4)
)
```

**Vendor access level scores:**

| Level | Label | Points (×3) |
|---|---|---|
| 1 | Read-Only | 3 |
| 2 | Limited Write | 6 |
| 3 | Full Access (CRUD) | 9 |
| 4 | Administrative | 12 |

---

### Component 4 — Compliance Gap → `likelihood_score` (0–25)

#### Mode A — Questionnaire Only (no scan)

```
gap_pct          = (failed_responses / applicable_responses) × 100
likelihood_score = (gap_pct / 100) × 25
```

Where:
- `failed_responses` = count of "no" + "partial" responses
- `applicable_responses` = all responses except "na"
- If no responses at all: `gap_pct` defaults to 50

#### Mode B — Blended with EWNAF Technical Scan

```
ewnaf_defense    = max(0, min(100, 100 - (overall × 2) - (high_risk_count × 15)))
ewnaf_tech_gap   = 100 - ewnaf_defense
gap_pct_combined = 0.6 × questionnaire_gap + 0.4 × ewnaf_tech_gap
likelihood_score = (gap_pct_combined / 100) × 25
```

The 60/40 split reflects that the questionnaire captures policy/administrative controls the scanner cannot see, while the scanner captures technical controls the questionnaire cannot reliably measure.

---

## Risk Band Classification

| Total Score | Band |
|---|---|
| ≥ 80 | **Critical** |
| 60 – 79 | **High** |
| 40 – 59 | **Medium** |
| < 40 | **Low** |

---

## Maturity Score (per domain)

### Raw Score (0–100)

```
raw_score = (yes_count / applicable_count) × 100
```

Partial answers receive **no credit** in the maturity score.

### Maturity Level (1–5)

| raw_score | Level | Label |
|---|---|---|
| ≥ 90% | 5 | **Optimized** |
| ≥ 75% | 4 | **Managed** |
| ≥ 50% | 3 | **Defined** |
| ≥ 25% | 2 | **Developing** |
| < 25% | 1 | **Initial** |

---

## Compliance Percentage (dashboard display)

Calculated in TypeScript from `questionnaire_responses`. Gives partial credit unlike the maturity score:

```
compliance_pct = ((yes_count + partial_count × 0.5) / applicable_count) × 100
```

---

## Financial Impact

### Breach Cost

Per-record rates from IBM Cost of a Data Breach Report 2024:

| Data Type | Per-record cost |
|---|---|
| Health / PHI | $10.93 |
| Financial | $5.85 |
| General (default) | $4.35 |

```
records_at_risk = patient_records_count × (vendor_data_share_pct / 100)
breach_cost     = records_at_risk × per_record_cost
```

### Regulatory Fines

**PIPEDA (Canada):**

| Gap severity | Fine |
|---|---|
| > 50% gap | $100,000 CAD |
| > 25% gap | $25,000 CAD |
| ≤ 25% gap | $0 |

**HIPAA (USA):**

| Gap severity | Fine |
|---|---|
| > 50% gap | $1,500,000 USD |
| > 25% gap | $250,000 USD |
| ≤ 25% gap | $100 USD |

```
total_exposure_min = breach_cost + regulatory_fines_min
total_exposure_max = breach_cost + regulatory_fines_max
```

---

## Remediation Roadmap Generation

Runs in TypeScript (`regenerateRoadmap()`) after every scoring pass. Produces action items from every failed questionnaire response. The entire roadmap is deleted and re-inserted on each call (idempotent per session).

```
for each questionnaire response where response IN ('no', 'partial'):
  fetch question text and compliance_statement from the framework question table
  insert into remediation_roadmap:
    title       = question_text
    description = compliance_statement
    priority    = 'critical'  if response = 'no'
                  'high'      if response = 'partial'
    effort      = 'medium'
    category    = 'administrative'
    status      = 'open'
```

**Rationale for critical/high mapping:** An unanswered control (No) represents a complete gap — the organization has no implementation at all for that requirement, which is a critical compliance failure. A partial answer means the control exists but is incomplete, which is a high-priority gap but not a zero.

### Priority ordering

All roadmap queries order by `priority_rank`, a generated stored column on `remediation_roadmap`:

```sql
CASE priority
  WHEN 'critical' THEN 0
  WHEN 'high'     THEN 1
  WHEN 'medium'   THEN 2
  WHEN 'low'      THEN 3
  ELSE 4
END
```

This avoids the alphabetical text sort issue where `low` (l) would incorrectly rank above `medium` (m).

---

## Scoring Trigger Points

| When | What runs |
|---|---|
| Onboarding submit | `calculate_risk_score()` → `calculate_financial_impact()` → `regenerateRoadmap()` |
| EWNAF scan completes | `calculate_risk_score()` (with EWNAF blend) → `regenerateRoadmap()` |

The scoring functions are idempotent — re-running them always produces the latest correct values and upserts into the relevant tables.
