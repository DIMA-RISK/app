// ─────────────────────────────────────────────────────────────────────────────
// ORACLE — an independent re-derivation of every risk/ROI formula.
//
// Written from the documented formulas (EWNAF_Risk_Module_Spec §4.2–4.6, the
// Option-C 4-framework compliance-gap method, and the two confirmed fixes:
// flat statutory fine tiers and revenue-bounded Security Training). It is NOT a
// copy of the app's SQL — it is a second, plain-JS implementation so that a diff
// against the app's stored output surfaces drift, stale functions, or bad data.
//
// Formula sources are noted per block. Where a product decision modified the raw
// spec formula (fine tiers, training cap), the decision is encoded here so the
// harness locks in the CORRECT post-fix behavior and fails if the app regresses.
// ─────────────────────────────────────────────────────────────────────────────

export const PER_RECORD = { health: 10.93, financial: 5.85, general: 4.35 };
export const SIZE_MULT = { enterprise: 2.5, large: 1.8, medium: 1.3, small: 1.0, micro: 0.7 };
// Flat statutory-cap fine tiers (spec §4.3). Worst-case combined ceiling = $3.6M.
export const FINE_TIER = { GDPR: 2_000_000, HIPAA: 1_500_000, PIPEDA: 100_000 };
export const FINE_CEILING = FINE_TIER.GDPR + FINE_TIER.HIPAA + FINE_TIER.PIPEDA; // 3,600,000
export const TRAINING_PER_EMPLOYEE = 250;
export const TRAINING_REVENUE_CAP_PCT = 0.02; // training ≤ 2% of annual revenue

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Risk score: four components, each capped at 25 (spec §4.2) ───────────────
// exposure_score=Volume, impact_score=Sensitivity, control_score=Third-Party,
// likelihood_score=Compliance Gap.
export function riskComponents(i) {
  const volume = Math.min(25, i.patientRecords / 10000 + i.dataStorageGb / 100);

  const sensitivity = Math.min(
    25,
    i.sensitivity * 3 + (i.hasHealth ? 8 : 0) + (i.hasFinancial ? 5 : 0) + (i.hasPii ? 4 : 0),
  );

  const thirdParty = Math.min(25, i.vendorCount * 2 + i.maxAccessLevel * 3 + i.vendorSharePct / 4);

  // Compliance-gap component (Option-C 4-framework average, optional EWNAF blend).
  const applicable = i.qTotal - i.na;
  const qGap = applicable > 0 ? 100 - ((i.yes + 0.5 * i.partial) / applicable) * 100 : 50;

  const iso = i.ccGaps.iso27001 ?? 100;
  const gdpr = i.ccGaps.gdpr ?? 100;
  const hipaa = i.frameworkId === "hipaa" ? qGap : i.ccGaps.hipaa ?? 100;
  const pipeda = i.frameworkId === "pipeda" ? qGap : i.ccGaps.pipeda ?? 100;
  const gapAvg = (iso + gdpr + hipaa + pipeda) / 4;

  let gapCombined = gapAvg;
  if (i.ewnaf && i.ewnaf.overall != null) {
    const defense = clamp(100 - i.ewnaf.overall * 2 - (i.ewnaf.highRiskCount ?? 0) * 15, 0, 100);
    gapCombined = 0.6 * gapAvg + 0.4 * (100 - defense);
  }
  const complianceGap = (gapCombined / 100) * 25;

  const total = volume + sensitivity + thirdParty + complianceGap;
  return { volume, sensitivity, thirdParty, complianceGap, total, _qGap: qGap };
}

// ── Financial impact + 3-year ROI (spec §4.3–4.6) ────────────────────────────
// riskScore is an INPUT here (the app's calculate_financial_impact reads it from
// risk_scores), so the financial oracle is decoupled from the risk oracle.
export function financial(i, riskScore) {
  const perRecord = i.hasHealth ? PER_RECORD.health : i.hasFinancial ? PER_RECORD.financial : PER_RECORD.general;
  const recordsAtRisk = i.patientRecords * (i.vendorSharePct / 100);
  const breachCost = recordsAtRisk * perRecord;

  // Financial gap = failed / answered (unanswered are NOT counted here, unlike the
  // risk-score gap). failed = no+partial, answered = yes+partial+no.
  const answered = i.yes + i.partial + i.no;
  const finGap = answered > 0 ? ((i.no + i.partial) / answered) * 100 : 50;

  // Flat, gap-scaled fine tiers. Each individual fine stays under its ceiling.
  const hipaaFine = i.frameworkId === "hipaa" ? FINE_TIER.HIPAA * (finGap / 100) : 0;
  const pipedaFine = i.frameworkId === "pipeda" ? FINE_TIER.PIPEDA * (finGap / 100) : 0;
  const gdprGap = i.ccGaps.gdpr ?? 100;
  const gdprFine = FINE_TIER.GDPR * (gdprGap / 100);

  const fineMax = hipaaFine + pipedaFine + gdprFine;
  const fineMin = round2(fineMax * 0.4);

  const out = {
    perRecord, recordsAtRisk, breachCost,
    finGap, hipaaFine, pipedaFine, gdprFine, fineMax, fineMin,
    roiComputed: false,
  };

  // ROI only when the org filled in annual revenue.
  if (i.annualRevenue == null) return out;

  const sizeMult = SIZE_MULT[i.businessSize] ?? 1.0;
  const techInfra = (35000 + 715000 * (riskScore / 100)) * sizeMult;
  const profServices = (20000 + 480000 * (riskScore / 100)) * sizeMult;

  let training = TRAINING_PER_EMPLOYEE * (i.employeeCount ?? 0);
  if (i.annualRevenue > 0) training = Math.min(training, i.annualRevenue * TRAINING_REVENUE_CAP_PCT);

  const maintenance = 0.15 * (techInfra + profServices) * 3;
  const investment = techInfra + profServices + training + maintenance;

  const breachAvoid = breachCost * 0.75;
  const fineAvoid = fineMax * 0.85;
  const continuity = i.annualRevenue * 0.015 * 3;
  const reputation = i.annualRevenue * 0.01 * 3;
  const efficiency = i.annualRevenue * 0.005 * 3;
  const insurance = 75000 * (sizeMult / 2.5);
  const compliance = 75000 + 75000 * (riskScore / 100);
  const benefits = breachAvoid + fineAvoid + continuity + reputation + efficiency + insurance + compliance;

  const netBenefit = benefits - investment;
  const roiPct = investment > 0 ? (netBenefit / investment) * 100 : null;
  const payback = benefits > 0 ? investment / (benefits / 36) : null; // months

  return {
    ...out, roiComputed: true, sizeMult,
    investment: { techInfra, profServices, training, maintenance, total: investment },
    benefits: { breachAvoid, fineAvoid, continuity, reputation, efficiency, insurance, compliance, total: benefits },
    netBenefit, roiPct, payback,
  };
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}
