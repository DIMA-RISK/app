// ─────────────────────────────────────────────────────────────────────────────
// ALE-based risk quantification & priority scoring (spec Layers 1–3).
//
// SINGLE SOURCE OF TRUTH for every tunable. Values are CEO-confirmed against the
// six worked examples in the scoring spreadsheet unless marked otherwise. Change
// these tables and the whole model re-derives; the ROI harness (`node harness.mjs
// formulas`) locks the math against drift.
// ─────────────────────────────────────────────────────────────────────────────

export type AroCategory = "phi_breach" | "ransomware" | "insider" | "legacy" | "third_party" | "mobile_byod";

// [CEO-CONFIRMED] Base Annualized Rate of Occurrence per threat category, from
// 2025/2026 industry reports (Sophos, Verizon DBIR, Ponemon, IBM). Midpoints of
// the CEO-provided ranges. Used at BASE in Layer 1 — maturity does NOT scale ARO
// here (that scaling is a deferred/optional enhancement, per the CEO, and would
// double up with the Maturity Weight already in the Priority Score).
export const ARO_BASE: Record<AroCategory, number> = {
  phi_breach: 0.35,   // 0.30–0.40
  ransomware: 0.625,  // 0.60–0.65
  insider: 0.53,      // 0.50–0.56
  legacy: 0.45,       // 0.40–0.50
  third_party: 0.33,  // 0.30–0.36
  mobile_byod: 0.505, // 0.48–0.53
};

export const ARO_LABEL: Record<AroCategory, string> = {
  phi_breach: "PHI Data Breach",
  ransomware: "Ransomware",
  insider: "Insider Threat",
  legacy: "Legacy Systems",
  third_party: "BA / Third-Party Non-Compliance",
  mobile_byod: "Mobile / BYOD",
};

// [CEO-CONFIRMED] Exposure Factor indexed by DATA SENSITIVITY LEVEL (share of the
// asset's value lost in an event). Confirmed: L3=25%, L4=50%, L5=80%.
// L1/L2 [EXTRAPOLATED] — the CEO specified L3–L5 only; low-sensitivity data below
// Confidential carries a small breach value. Override if the CEO defines them.
export const EXPOSURE_FACTOR_BY_LEVEL: Record<number, number> = {
  1: 0.05, 2: 0.10, 3: 0.25, 4: 0.50, 5: 0.80,
};
export function exposureFactor(level: number): number {
  return EXPOSURE_FACTOR_BY_LEVEL[clampLevel(level)] ?? 0.25;
}

// [CEO-CONFIRMED] Base Control Effort: Low / Medium / High = 1 / 2 / 3. The app's
// effort tags map: quick-win → Low, medium → Medium, complex → High.
export const BASE_CONTROL_EFFORT: Record<string, number> = { "quick-win": 1, medium: 2, complex: 3 };

// [CEO-CONFIRMED] Data Sensitivity Weight — 5-level classification → 3 weights.
// Public/Internal 0.6 · Confidential 1.0 · Restricted/Top Secret 1.5.
export const SENSITIVITY_WEIGHT: Record<number, number> = { 1: 0.6, 2: 0.6, 3: 1.0, 4: 1.5, 5: 1.5 };
export function sensitivityWeight(level: number): number {
  return SENSITIVITY_WEIGHT[clampLevel(level)] ?? 1.0;
}

// [CEO-CONFIRMED] Maturity Weight multiplier in the Priority Score, by maturity
// level (1–5). Less mature = higher weight = fixed sooner. Verified against all
// six of the CEO's worked examples — REQUIRED, not optional.
export const MATURITY_WEIGHT: Record<number, number> = { 1: 2.0, 2: 1.5, 3: 1.0, 4: 0.6, 5: 0.3 };
export function maturityWeight(level: number): number {
  return MATURITY_WEIGHT[clampLevel(level)] ?? 1.0;
}

// [CEO-CONFIRMED] Maturity Reduction % on effort: L1 0% → L5 80% (0.2 per level).
export function maturityReductionPct(level: number): number {
  return 0.2 * (clampLevel(level) - 1);
}

// [CEO-CONFIRMED] Adjusted Effort = Base Control Effort × (1 − Maturity Reduction %).
export function adjustedEffort(effortTag: string, maturityLevel: number): number {
  const base = BASE_CONTROL_EFFORT[effortTag] ?? 2;
  return Math.max(0.1, base * (1 - maturityReductionPct(maturityLevel)));
}

// [CEO-CONFIRMED] Gap Score = (missing ÷ total) × 100  (the ×100, not ×10).
export function gapScore(missing: number, total: number): number {
  return total > 0 ? (missing / total) * 100 : 0;
}

function clampLevel(l: number): number {
  return Math.min(5, Math.max(1, Math.round(l)));
}

// Map a roadmap task to an ARO threat category by keywords in its title/category.
// Falls back to PHI breach (the dominant healthcare threat) when nothing matches.
export function aroCategoryFor(title: string, category: string): AroCategory {
  const t = `${title} ${category}`.toLowerCase();
  if (/ransom|encrypt.*malware|extortion/.test(t)) return "ransomware";
  if (/insider|privileg|access review|least privilege|segregation/.test(t)) return "insider";
  if (/legacy|unsupported|end.of.life|unpatched|outdated|patch/.test(t)) return "legacy";
  if (/vendor|third.?party|business associate|\bbaa\b|supplier|outsourc/.test(t)) return "third_party";
  if (/mobile|byod|device|laptop|endpoint/.test(t)) return "mobile_byod";
  return "phi_breach";
}

// ── Core computations (spec Layers 1–3) ──────────────────────────────────────

// Asset Value (per org) = value of the data at risk, from the org's real profile
// (records exposed × per-record cost) — CEO-confirmed as the right derivation.
export function assetValue(recordsAtRisk: number, perRecord: number): number {
  return recordsAtRisk * perRecord;
}

// SLE = Asset Value × Exposure Factor(sensitivity level).
export function sle(assetVal: number, sensLevel: number): number {
  return assetVal * exposureFactor(sensLevel);
}

// ALE for one threat = SLE × base ARO (no maturity scaling here — Layer 1).
export function aleForThreat(assetVal: number, threat: AroCategory, sensLevel: number): number {
  return sle(assetVal, sensLevel) * ARO_BASE[threat];
}

// Org-wide ALE = Σ over all threat categories (spec Layer 1).
export function orgAle(assetVal: number, sensLevel: number): number {
  return (Object.keys(ARO_BASE) as AroCategory[]).reduce((sum, threat) => sum + aleForThreat(assetVal, threat, sensLevel), 0);
}

// Gap Exposure $ (spec Layer 2) = ALE × Gap% × Sensitivity Weight.
export function gapExposure(ale: number, gapPct: number, sensLevel: number): number {
  return ale * (gapPct / 100) * sensitivityWeight(sensLevel);
}

// Priority Score (spec Layer 3) =
//   (ALE × Gap% × Sensitivity Weight × Maturity Weight) ÷ Adjusted Effort.
export function priorityScore(ale: number, gapPct: number, sensLevel: number, effortTag: string, maturityLevel: number): number {
  const numerator = ale * (gapPct / 100) * sensitivityWeight(sensLevel) * maturityWeight(maturityLevel);
  return numerator / adjustedEffort(effortTag, maturityLevel);
}
