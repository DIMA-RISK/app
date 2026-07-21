// ─────────────────────────────────────────────────────────────────────────────
// NAMED REGRESSION CHECKS (spec §4).
//
// These are spec-derived INVARIANTS on the app's own stored output — they don't
// depend on the oracle reproducing every formula, so they stay robust even if a
// formula's exact shape changes. The first two map directly to the two ROI bugs
// already found and would have caught both immediately.
//
// Each check returns { name, status: "PASS"|"FAIL"|"SKIP", detail }.
// ─────────────────────────────────────────────────────────────────────────────

import { FINE_CEILING, FINE_TIER, TRAINING_PER_EMPLOYEE, TRAINING_REVENUE_CAP_PCT } from "./oracle.mjs";

const money = (n) => (n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`);

// abs tolerance $1 or 0.1% relative — the app rounds to 2 decimals.
function approxEq(a, b) {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= Math.max(1, 0.001 * Math.max(Math.abs(a), Math.abs(b)));
}
const P = (name, detail) => ({ name, status: "PASS", detail });
const F = (name, detail) => ({ name, status: "FAIL", detail });
const S = (name, detail) => ({ name, status: "SKIP", detail });

// ctx: { org, inv (investment_breakdown), ben (benefits_breakdown), fin (financial_impact row) }
export const NAMED_CHECKS = [
  function test_security_training_matches_org_employee_count({ org, inv }) {
    const name = "test_security_training_matches_org_employee_count";
    if (!inv) return S(name, "no ROI (org has no annual_revenue)");
    const raw = TRAINING_PER_EMPLOYEE * (org.employee_count ?? 0);
    const expected = org.annual_revenue > 0 ? Math.min(raw, org.annual_revenue * TRAINING_REVENUE_CAP_PCT) : raw;
    const actual = Number(inv.security_training ?? 0);
    return approxEq(expected, actual)
      ? P(name, `${money(actual)} = min($250×${org.employee_count}, 2%×${money(org.annual_revenue)})`)
      : F(name, `expected ${money(expected)} (min of $250×${org.employee_count}=${money(raw)} and 2% revenue=${money(org.annual_revenue * TRAINING_REVENUE_CAP_PCT)}), got ${money(actual)}`);
  },

  function test_regulatory_fine_avoidance_within_ceiling({ ben }) {
    const name = "test_regulatory_fine_avoidance_within_ceiling";
    if (!ben) return S(name, "no ROI (org has no annual_revenue)");
    const avoid = Number(ben.regulatory_fine_avoidance ?? 0);
    const impliedWorstCase = avoid / 0.85;
    return impliedWorstCase <= FINE_CEILING + 1
      ? P(name, `implied worst-case ${money(impliedWorstCase)} ≤ ceiling ${money(FINE_CEILING)}`)
      : F(name, `CEILING VIOLATION: fine avoidance ${money(avoid)} ÷ 0.85 = ${money(impliedWorstCase)} > ${money(FINE_CEILING)} (GDPR ${money(FINE_TIER.GDPR)}+HIPAA ${money(FINE_TIER.HIPAA)}+PIPEDA ${money(FINE_TIER.PIPEDA)})`);
  },

  function test_investment_breakdown_sums_to_total({ inv, fin }) {
    const name = "test_investment_breakdown_sums_to_total";
    if (!inv) return S(name, "no ROI (org has no annual_revenue)");
    const sum = ["technology_infrastructure", "professional_services", "security_training", "maintenance_operations"]
      .reduce((s, k) => s + Number(inv[k] ?? 0), 0);
    const total = Number(fin.investment_total ?? 0);
    return approxEq(sum, total) ? P(name, `${money(sum)} = ${money(total)}`) : F(name, `lines sum ${money(sum)} ≠ investment_total ${money(total)}`);
  },

  function test_benefits_sum_to_net_benefit({ ben, fin }) {
    const name = "test_benefits_sum_to_net_benefit";
    if (!ben) return S(name, "no ROI (org has no annual_revenue)");
    const sum = ["breach_cost_avoidance", "regulatory_fine_avoidance", "business_continuity", "reputation_protection", "operational_efficiency", "cyber_insurance_discount", "compliance_cost_avoidance"]
      .reduce((s, k) => s + Number(ben[k] ?? 0), 0);
    const net = Number(fin.net_benefit_3yr ?? 0);
    const inv = Number(fin.investment_total ?? 0);
    return approxEq(sum - inv, net)
      ? P(name, `Σbenefits ${money(sum)} − investment ${money(inv)} = net ${money(net)}`)
      : F(name, `Σbenefits ${money(sum)} − investment ${money(inv)} = ${money(sum - inv)} ≠ net_benefit ${money(net)}`);
  },

  function test_roi_percentage_formula({ fin }) {
    const name = "test_roi_percentage_formula";
    if (fin.roi_pct == null) return S(name, "no ROI (org has no annual_revenue)");
    const inv = Number(fin.investment_total ?? 0);
    const net = Number(fin.net_benefit_3yr ?? 0);
    const expected = inv > 0 ? (net / inv) * 100 : null;
    const actual = Number(fin.roi_pct);
    return approxEq(expected, actual) ? P(name, `${actual.toFixed(1)}% = net/investment×100`) : F(name, `expected ${expected?.toFixed(1)}% (net ${money(net)}/inv ${money(inv)}), got ${actual.toFixed(1)}%`);
  },

  function test_payback_period_formula({ fin }) {
    const name = "test_payback_period_formula";
    if (fin.payback_months == null) return S(name, "no ROI (org has no annual_revenue)");
    const inv = Number(fin.investment_total ?? 0);
    const benTotal = Number(fin.benefits_total_3yr ?? 0);
    const expected = benTotal > 0 ? inv / (benTotal / 36) : null; // = inv/(annual benefit)×12
    const actual = Number(fin.payback_months);
    return approxEq(expected, actual) ? P(name, `${actual.toFixed(1)} mo = investment÷(benefits÷3)×12`) : F(name, `expected ${expected?.toFixed(1)} mo, got ${actual.toFixed(1)} mo`);
  },

  function test_revenue_consistency_across_benefit_lines({ ben }) {
    const name = "test_revenue_consistency_across_benefit_lines";
    if (!ben) return S(name, "no ROI (org has no annual_revenue)");
    const fromContinuity = Number(ben.business_continuity ?? 0) / (0.015 * 3);
    const fromReputation = Number(ben.reputation_protection ?? 0) / (0.01 * 3);
    const fromEfficiency = Number(ben.operational_efficiency ?? 0) / (0.005 * 3);
    const consistent = approxEq(fromContinuity, fromReputation) && approxEq(fromReputation, fromEfficiency);
    return consistent
      ? P(name, `all three imply revenue ≈ ${money(fromContinuity)}`)
      : F(name, `revenue mismatch: continuity→${money(fromContinuity)}, reputation→${money(fromReputation)}, efficiency→${money(fromEfficiency)}`);
  },

  // Written last, per spec §4: only meaningful once the Compliance Gap saturation
  // decision is made. Until then it's an explicit SKIP, not a guess.
  function test_compliance_gap_saturation() {
    return S("test_compliance_gap_saturation", "pending product decision on saturation (spec §2.1) — not yet asserted");
  },
];

export function runNamedChecks(ctx) {
  return NAMED_CHECKS.map((fn) => fn(ctx));
}
