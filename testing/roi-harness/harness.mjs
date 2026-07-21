// ─────────────────────────────────────────────────────────────────────────────
// DIMA ROI/Risk Test Harness — entry point.
//
//   node harness.mjs audit            audit every scored org already in the DB
//   node harness.mjs audit <email>    audit a single org by its login email
//   node harness.mjs matrix           seed the 10-profile matrix, run, diff, clean up
//   node harness.mjs matrix --keep    matrix mode but leave the throwaway user in place
//
// Audit mode is READ-ONLY. Matrix mode WRITES to the configured Supabase project
// (creates one throwaway confirmed user, seeds each profile, runs the real
// scoring RPCs, then deletes the user — cascading all seeded rows).
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "./db.mjs";
import { riskComponents, financial } from "./oracle.mjs";
import { runNamedChecks } from "./checks.mjs";
import { runGoldenChecks } from "./ale.mjs";
import { PROFILES } from "./profiles.mjs";

const FRAMEWORKS = ["iso27001", "gdpr", "hipaa", "pipeda"];
const approxEq = (a, b) => a != null && b != null && Math.abs(a - b) <= Math.max(1, 0.001 * Math.max(Math.abs(a), Math.abs(b)));
const money = (n) => (n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
const num = (n, d = 1) => (n == null ? "—" : Number(n).toFixed(d));

// ── Gather every input + the app's stored output for one (org, session) ──────
async function gather(org, session) {
  const userId = org.user_id;
  const sid = session.id;

  const [responses, qRows, controls, ccResponses, scanRows, riskRows, finRows] = await Promise.all([
    db.select("questionnaire_responses", `select=response&session_id=eq.${sid}`),
    db.select("v_session_questions", `select=question_id&session_id=eq.${sid}`),
    db.select("critical_controls", `select=id,framework_id`),
    db.select("critical_control_responses", `select=control_id,present&user_id=eq.${userId}`),
    org.org_uid != null ? db.select("fact_software_results", `select=results&org_uid=eq.${org.org_uid}&order=created_at.desc&limit=1`) : Promise.resolve([]),
    db.select("risk_scores", `select=exposure_score,impact_score,control_score,likelihood_score,total_score&session_id=eq.${sid}`),
    db.select("financial_impact", `select=*&session_id=eq.${sid}`),
  ]);

  const count = (r) => responses.filter((x) => x.response === r).length;
  const presentSet = new Set(ccResponses.filter((r) => r.present).map((r) => r.control_id));
  const ccGaps = {};
  for (const fw of FRAMEWORKS) {
    const inFw = controls.filter((c) => c.framework_id === fw);
    ccGaps[fw] = inFw.length ? (inFw.filter((c) => !presentSet.has(c.id)).length / inFw.length) * 100 : null;
  }

  let ewnaf = null;
  const scanResults = scanRows[0]?.results;
  if (scanResults?.score?.overall != null) {
    ewnaf = { overall: Number(scanResults.score.overall), highRiskCount: Number(scanResults.score.high_risk_count ?? 0) };
  }

  const inputs = {
    frameworkId: session.framework_id,
    patientRecords: Number(org.patient_records_count ?? 0),
    dataStorageGb: Number(org.data_storage_gb ?? 0),
    hasHealth: !!org.has_health_data, hasFinancial: !!org.has_financial_data, hasPii: !!org.has_pii_data,
    sensitivity: Number(org.data_sensitivity_level ?? 3),
    vendorCount: Number(org.vendor_count ?? 0), maxAccessLevel: Number(org.max_vendor_access_level ?? 1),
    vendorSharePct: Number(org.vendor_data_share_pct ?? 0),
    annualRevenue: org.annual_revenue == null ? null : Number(org.annual_revenue),
    employeeCount: Number(org.employee_count ?? 0), businessSize: org.business_size ?? null,
    qTotal: qRows.length, yes: count("yes"), partial: count("partial"), no: count("no"), na: count("na"),
    ccGaps, ewnaf,
  };
  return { inputs, appRisk: riskRows[0] ?? null, appFin: finRows[0] ?? null };
}

// ── Diff oracle vs. app for one org, print the §5 report, return fail count ───
function report(label, org, g) {
  const { inputs, appRisk, appFin } = g;
  const lines = [];
  let fails = 0;
  const cmp = (name, expected, actual, fmt = money) => {
    const ok = approxEq(expected, actual);
    if (!ok) fails++;
    const delta = expected != null && actual != null ? actual - expected : null;
    lines.push(`  ${ok ? "✓" : "✗"} ${name.padEnd(30)} expected ${String(fmt(expected)).padStart(14)}   actual ${String(fmt(actual)).padStart(14)}${ok ? "" : `   ⚠ Δ ${fmt(delta)}`}`);
  };

  console.log(`\nProfile: "${label}"  [${inputs.frameworkId ?? "no framework"}]`);

  // Risk score components (app column ↔ oracle component)
  if (appRisk) {
    const rc = riskComponents(inputs);
    cmp("Data Volume Risk", rc.volume, num0(appRisk.exposure_score), num2);
    cmp("Data Sensitivity Risk", rc.sensitivity, num0(appRisk.impact_score), num2);
    cmp("Third-Party Access Risk", rc.thirdParty, num0(appRisk.control_score), num2);
    cmp("Compliance Gap Risk", rc.complianceGap, num0(appRisk.likelihood_score), num2);
    cmp("Overall Risk Score", rc.total, num0(appRisk.total_score), num2);
  } else {
    lines.push("  — no risk_scores row (org not scored yet)");
  }

  // Financial + ROI
  if (appFin) {
    const riskScore = Number(appFin && appRisk ? appRisk.total_score : 0);
    const f = financial(inputs, riskScore);
    cmp("Data Breach Cost", f.breachCost, num0(appFin.estimated_breach_cost));
    cmp("Regulatory Fines (max)", f.fineMax, num0(appFin.regulatory_fines_max));
    cmp("Regulatory Fines (min)", f.fineMin, num0(appFin.regulatory_fines_min));

    if (f.roiComputed && appFin.investment_total != null) {
      const inv = appFin.investment_breakdown ?? {};
      const ben = appFin.benefits_breakdown ?? {};
      cmp("Investment · Tech/Infra", f.investment.techInfra, num0(inv.technology_infrastructure));
      cmp("Investment · Prof Services", f.investment.profServices, num0(inv.professional_services));
      cmp("Investment · Security Training", f.investment.training, num0(inv.security_training));
      cmp("Investment · Maintenance", f.investment.maintenance, num0(inv.maintenance_operations));
      cmp("Investment · TOTAL", f.investment.total, num0(appFin.investment_total));
      cmp("Benefit · Breach Avoidance", f.benefits.breachAvoid, num0(ben.breach_cost_avoidance));
      cmp("Benefit · Fine Avoidance", f.benefits.fineAvoid, num0(ben.regulatory_fine_avoidance));
      cmp("Benefit · Continuity", f.benefits.continuity, num0(ben.business_continuity));
      cmp("Benefit · Reputation", f.benefits.reputation, num0(ben.reputation_protection));
      cmp("Benefit · Efficiency", f.benefits.efficiency, num0(ben.operational_efficiency));
      cmp("Benefit · Insurance", f.benefits.insurance, num0(ben.cyber_insurance_discount));
      cmp("Benefit · Compliance", f.benefits.compliance, num0(ben.compliance_cost_avoidance));
      cmp("Net Benefit (3yr)", f.netBenefit, num0(appFin.net_benefit_3yr));
      cmp("ROI %", f.roiPct, num0(appFin.roi_pct), (n) => (n == null ? "—" : `${num(n, 1)}%`));
      cmp("Payback (months)", f.payback, num0(appFin.payback_months), (n) => (n == null ? "—" : `${num(n, 1)}mo`));
    }
  } else {
    lines.push("  — no financial_impact row");
  }

  // Named invariant checks (spec §4)
  const named = runNamedChecks({ org, inv: appFin?.investment_breakdown ?? null, ben: appFin?.benefits_breakdown ?? null, fin: appFin ?? {} });
  lines.push("  " + "─".repeat(60));
  for (const c of named) {
    if (c.status === "FAIL") fails++;
    const mark = c.status === "PASS" ? "✓" : c.status === "FAIL" ? "✗" : "·";
    lines.push(`  ${mark} ${c.name.padEnd(48)} ${c.status}  ${c.detail}`);
  }

  console.log(lines.join("\n"));
  const total = lines.filter((l) => l.trimStart().startsWith("✓") || l.trimStart().startsWith("✗")).length;
  console.log(`  Result: ${fails} failed / ${total} checks`);
  return fails;
}

// numeric coercion helpers (DB returns numerics as strings over REST)
const num0 = (v) => (v == null ? null : Number(v));
const num2 = (n) => (n == null ? "—" : Number(n).toFixed(2));

// ── AUDIT MODE (read-only) ───────────────────────────────────────────────────
async function audit(email) {
  let orgs = await db.select("organizations", `select=*${email ? `&email=eq.${encodeURIComponent(email)}` : ""}`);
  if (orgs.length === 0) { console.log(email ? `No org found for ${email}` : "No organizations found."); return; }

  console.log(`\n═══ AUDIT MODE · ${orgs.length} org(s) ═══`);
  let grandFails = 0, audited = 0;
  for (const org of orgs) {
    const sessions = await db.select("assessment_sessions", `select=id,framework_id,started_at&user_id=eq.${org.user_id}&order=started_at.desc&limit=1`);
    if (sessions.length === 0) continue;
    const g = await gather(org, sessions[0]);
    if (!g.appRisk && !g.appFin) continue; // unscored
    grandFails += report(org.org_name || org.email || org.user_id, org, g);
    audited++;
  }
  console.log(`\n═══ ${audited} org(s) audited · ${grandFails} total failing check(s) ═══`);
  process.exitCode = grandFails > 0 ? 1 : 0;
}

// ── MATRIX MODE (writes to DB, then cleans up) ───────────────────────────────
async function matrix(keep) {
  const stamp = Date.now();
  const email = `roi-harness-${stamp}@dima-test.local`;
  console.log(`\n═══ MATRIX MODE · seeding as ${email} ═══`);
  console.log("  (writes a throwaway user + org rows to the configured DB, runs the real RPCs, then deletes them)\n");

  const user = await db.createUser(email, `Test!${stamp}`);
  const userId = user.id;
  let grandFails = 0;

  async function reset() {
    await db.del("assessment_sessions", `user_id=eq.${userId}`); // cascades responses/scores/financial
    await db.del("critical_control_responses", `user_id=eq.${userId}`);
    await db.del("organizations", `user_id=eq.${userId}`);
  }

  try {
    const allControls = await db.select("critical_controls", `select=id,framework_id`);
    for (const p of PROFILES) {
      await reset();

      // organizations (org_name/email/org_uid are NOT NULL)
      await db.insert("organizations", {
        user_id: userId, org_name: p.name.slice(0, 60), email, org_uid: stamp + Math.floor(Math.random() * 1e6),
        ...p.org,
      });
      const session = await db.insert("assessment_sessions", { user_id: userId, framework_id: p.framework, started_at: new Date().toISOString() });

      // questionnaire responses — qGapFrac of answered questions are 'no', rest 'yes'
      const qTable = p.framework === "hipaa" ? "hipaa_questions" : "pipeda_questions";
      const questions = await db.select(qTable, `select=id&order=id`);
      const qRows = questions.map((q, idx) => ({
        session_id: session.id, question_id: q.id, framework_id: p.framework,
        response: idx / Math.max(1, questions.length) < p.qGapFrac ? "no" : "yes",
      }));
      if (qRows.length) await db.insert("questionnaire_responses", qRows);

      // critical controls — ccPresent fraction marked present
      const ccRows = allControls.map((c, idx) => ({
        user_id: userId, control_id: c.id,
        present: idx / Math.max(1, allControls.length) < p.ccPresent,
      }));
      if (ccRows.length) await db.insert("critical_control_responses", ccRows);

      // run the app's real scoring code
      await db.rpc("calculate_risk_score", { p_session_id: session.id });
      await db.rpc("calculate_financial_impact", { p_session_id: session.id });

      const org = (await db.select("organizations", `select=*&user_id=eq.${userId}`))[0];
      const g = await gather(org, session);
      grandFails += report(p.name, org, g);
    }
  } finally {
    if (keep) {
      console.log(`\n(kept throwaway user ${email} / ${userId} — delete it manually when done)`);
    } else {
      await reset();
      await db.deleteUser(userId);
      console.log(`\n(cleaned up throwaway user ${email})`);
    }
  }
  console.log(`\n═══ matrix complete · ${grandFails} total failing check(s) ═══`);
  process.exitCode = grandFails > 0 ? 1 : 0;
}

// ── ALE FORMULAS MODE (offline golden-value checks, no DB) ───────────────────
function formulas() {
  console.log("\n═══ ALE / Priority-Score formula checks (spec Layers 1–3) ═══");
  const results = runGoldenChecks();
  let fails = 0;
  for (const c of results) {
    if (c.status === "FAIL") fails++;
    console.log(`  ${c.status === "PASS" ? "✓" : "✗"} ${c.name.padEnd(38)} ${c.detail}`);
  }
  console.log(`\n═══ ${results.length - fails}/${results.length} passed ═══`);
  process.exitCode = fails > 0 ? 1 : 0;
}

// ── dispatch ─────────────────────────────────────────────────────────────────
const [, , mode, arg] = process.argv;
try {
  if (mode === "matrix") await matrix(arg === "--keep");
  else if (mode === "formulas") formulas();
  else await audit(mode === "audit" ? arg : mode); // allow "audit <email>" or bare "<email>"
} catch (e) {
  console.error("\nHarness error:", e.message);
  process.exit(2);
}
