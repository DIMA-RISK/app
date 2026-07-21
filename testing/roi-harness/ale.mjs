// ─────────────────────────────────────────────────────────────────────────────
// ALE / Priority-Score oracle (spec Layers 1–3), reimplemented independently from
// the CEO-confirmed tables — NOT imported from the app. Locks the MATH with
// golden values hand-derived from the confirmed formulas. Run:
//   node harness.mjs formulas
// ─────────────────────────────────────────────────────────────────────────────

export const ARO_BASE = { phi_breach: 0.35, ransomware: 0.625, insider: 0.53, legacy: 0.45, third_party: 0.33, mobile_byod: 0.505 };
export const EXPOSURE_FACTOR_BY_LEVEL = { 1: 0.05, 2: 0.10, 3: 0.25, 4: 0.50, 5: 0.80 }; // by SENSITIVITY level
export const SENSITIVITY_WEIGHT = { 1: 0.6, 2: 0.6, 3: 1.0, 4: 1.5, 5: 1.5 };
export const MATURITY_WEIGHT = { 1: 2.0, 2: 1.5, 3: 1.0, 4: 0.6, 5: 0.3 };
export const BASE_CONTROL_EFFORT = { "quick-win": 1, medium: 2, complex: 3 };

const lvl = (l) => Math.min(5, Math.max(1, Math.round(l)));
export const exposureFactor = (l) => EXPOSURE_FACTOR_BY_LEVEL[lvl(l)] ?? 0.25;
export const sensitivityWeight = (l) => SENSITIVITY_WEIGHT[lvl(l)] ?? 1.0;
export const maturityWeight = (l) => MATURITY_WEIGHT[lvl(l)] ?? 1.0;
export const maturityReductionPct = (l) => 0.2 * (lvl(l) - 1);
export const adjustedEffort = (tag, l) => Math.max(0.1, (BASE_CONTROL_EFFORT[tag] ?? 2) * (1 - maturityReductionPct(l)));
export const gapScore = (missing, total) => (total > 0 ? (missing / total) * 100 : 0);
export const assetValue = (recordsAtRisk, perRecord) => recordsAtRisk * perRecord;
export const sle = (assetVal, sensLevel) => assetVal * exposureFactor(sensLevel);
export const aleForThreat = (assetVal, threat, sensLevel) => sle(assetVal, sensLevel) * ARO_BASE[threat];
export const orgAle = (assetVal, sensLevel) => Object.keys(ARO_BASE).reduce((s, t) => s + aleForThreat(assetVal, t, sensLevel), 0);
export const gapExposure = (ale, gapPct, sensLevel) => ale * (gapPct / 100) * sensitivityWeight(sensLevel);
export const priorityScore = (ale, gapPct, sensLevel, tag, matLevel) =>
  (ale * (gapPct / 100) * sensitivityWeight(sensLevel) * maturityWeight(matLevel)) / adjustedEffort(tag, matLevel);

const approx = (a, b) => Math.abs(a - b) <= Math.max(0.01, 1e-6 * Math.max(Math.abs(a), Math.abs(b)));

// Golden values, hand-derived from the CEO-confirmed formulas (see README §ALE).
export function runGoldenChecks() {
  const out = [];
  const G = (name, got, exp) => out.push({ name, status: approx(got, exp) ? "PASS" : "FAIL", detail: `expected ${exp}, got ${Math.round(got * 1000) / 1000}` });

  // Exposure Factor by sensitivity level (CEO-confirmed L3–L5).
  G("exposureFactor · L3", exposureFactor(3), 0.25);
  G("exposureFactor · L4", exposureFactor(4), 0.5);
  G("exposureFactor · L5", exposureFactor(5), 0.8);
  // Sensitivity weight 5→3 mapping.
  G("sensitivityWeight · L1/L3/L5", sensitivityWeight(1) + sensitivityWeight(3) + sensitivityWeight(5), 0.6 + 1.0 + 1.5);
  // Maturity Weight (required multiplier) and Maturity Reduction %.
  G("maturityWeight · L1", maturityWeight(1), 2.0);
  G("maturityWeight · L5", maturityWeight(5), 0.3);
  G("maturityReduction · L5 = 80%", maturityReductionPct(5), 0.8);
  G("adjustedEffort · medium@L3 = 1.2", adjustedEffort("medium", 3), 1.2);
  // Gap score ×100.
  G("gapScore · 5 of 20 = 25", gapScore(5, 20), 25);
  // End-to-end worked example: 40,000 records × $10.93, sensitivity L4, PHI threat.
  const av = assetValue(40000, 10.93);                 // 437,200
  G("assetValue · 40k×$10.93", av, 437200);
  const sleL4 = sle(av, 4);                             // × 0.50
  G("SLE · L4", sleL4, 218600);
  const alePhi = aleForThreat(av, "phi_breach", 4);     // × 0.35
  G("aleForThreat · PHI@L4", alePhi, 76510);
  G("gapExposure · 40% gap, sensL4", gapExposure(alePhi, 40, 4), 45906);
  // Priority: maturity L3 → weight 1.0, adjusted effort 1.2.
  G("priorityScore · medium@L3", priorityScore(alePhi, 40, 4, "medium", 3), 45906 / 1.2);

  return out;
}
