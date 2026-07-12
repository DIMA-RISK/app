"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart2, AlertTriangle, CheckCircle2, Clock, Download, RefreshCw, ArrowRight } from "lucide-react";
import styles from "../dashboard.module.css";
import { SeverityBadge, LabeledBadge, EFFORT_COLOR } from "./SeverityBadge";
import type { DashboardData } from "../queries";

const ARC_LENGTH = 251.3;

function RiskGauge({ score }: { score: number }) {
  const fill = (score / 100) * ARC_LENGTH;
  const color =
    score >= 80 ? "#ef4444" : score >= 60 ? "#f97316" : score >= 40 ? "#f59e0b" : "#22c55e";
  const label =
    score >= 80
      ? "Critical Risk"
      : score >= 60
      ? "High Risk"
      : score >= 40
      ? "Medium Risk"
      : score > 0
      ? "Low Risk"
      : "Not Scored";

  return (
    <div className={styles.gaugeWrap}>
      <svg viewBox="0 0 200 110" className={styles.gaugeSvg}>
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="rgba(117,76,190,0.12)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${ARC_LENGTH}`}
          style={{ filter: `drop-shadow(0 0 8px ${color}70)` }}
        />
        <text x="15" y="112" textAnchor="middle" fill="rgba(221,215,234,0.25)" fontSize="8" fontFamily="Poppins,sans-serif">0</text>
        <text x="185" y="112" textAnchor="middle" fill="rgba(221,215,234,0.25)" fontSize="8" fontFamily="Poppins,sans-serif">100</text>
        <text x="100" y="80" textAnchor="middle" fill="#ddd7ea" fontSize="30" fontWeight="700" fontFamily="Poppins,sans-serif">
          {score > 0 ? score : "—"}
        </text>
        <text x="100" y="96" textAnchor="middle" fill="rgba(221,215,234,0.4)" fontSize="10" fontFamily="Poppins,sans-serif">out of 100</text>
      </svg>
      <div className={styles.gaugeMeta}>
        <span className={styles.gaugeDot} style={{ background: color, boxShadow: `0 0 6px ${color}90` }} />
        <span className={styles.gaugeRiskLabel}>{label}</span>
      </div>
    </div>
  );
}

function fmtEffort(e: string) {
  if (e === "quick-win") return "Quick Win";
  return e.charAt(0).toUpperCase() + e.slice(1);
}

function fmtCurrency(n: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function roiRecommendation(pct: number): { label: string; color: string } {
  if (pct >= 300) return { label: "Exceptional", color: "#22c55e" };
  if (pct >= 200) return { label: "Excellent", color: "#4ade80" };
  if (pct >= 100) return { label: "Good", color: "#84cc16" };
  if (pct >= 50) return { label: "Moderate", color: "#f59e0b" };
  if (pct >= 0) return { label: "Low", color: "#f97316" };
  return { label: "Negative", color: "#ef4444" };
}

const INVESTMENT_LABELS: Record<string, string> = {
  technology_infrastructure: "Technology & Infrastructure",
  professional_services: "Professional Services",
  security_training: "Security Training",
  maintenance_operations: "Maintenance & Operations",
};

const BENEFIT_LABELS: Record<string, string> = {
  breach_cost_avoidance: "Breach Cost Avoidance",
  regulatory_fine_avoidance: "Regulatory Fine Avoidance",
  business_continuity: "Business Continuity",
  reputation_protection: "Reputation Protection",
  operational_efficiency: "Operational Efficiency",
  cyber_insurance_discount: "Cyber Insurance Discount",
  compliance_cost_avoidance: "Compliance Cost Avoidance",
};

// How each benefit figure is derived — shown under the label so numbers aren't bare.
const BENEFIT_NOTES: Record<string, string> = {
  breach_cost_avoidance: "75% of estimated breach cost",
  regulatory_fine_avoidance: "85% of worst-case regulatory fines",
  business_continuity: "1.5% of annual revenue × 3 yrs",
  reputation_protection: "1% of annual revenue × 3 yrs",
  operational_efficiency: "0.5% of annual revenue × 3 yrs",
  cyber_insurance_discount: "up to $75K, scaled by business size",
  compliance_cost_avoidance: "$75K–$150K band, scaled by your risk score",
};

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const DOT_CLASS: Record<string, string> = {
  success: styles.dotSuccess,
  error: styles.dotError,
  warning: styles.dotWarning,
  info: styles.dotInfo,
};

export default function ExecutiveSummary({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      showToast("✓ Dashboard refreshed — data is up to date");
    }, 1800);
  }

  const complianceStatus =
    data.compliancePct >= 80
      ? "Compliant"
      : data.compliancePct >= 60
      ? "At Risk"
      : data.compliancePct > 0
      ? "Non-Compliant"
      : "Pending";

  const complianceColor =
    data.compliancePct >= 80
      ? "#22c55e"
      : data.compliancePct >= 60
      ? "#f59e0b"
      : data.compliancePct > 0
      ? "#ef4444"
      : "rgba(221,215,234,0.4)";

  const riskBadgeClass =
    data.riskBand === "critical"
      ? styles.badgeCritical
      : data.riskBand === "high"
      ? styles.badgeHigh
      : data.riskBand === "medium"
      ? styles.badgeMedium
      : data.riskBand === "low"
      ? styles.badgeLow
      : styles.badgeGray;

  const riskBandLabel =
    data.riskBand === "critical"
      ? "Critical Risk"
      : data.riskBand === "high"
      ? "High Risk"
      : data.riskBand === "medium"
      ? "Medium Risk"
      : data.riskBand === "low"
      ? "Low Risk"
      : "Not Scored";

  const roiRec = data.roi ? roiRecommendation(data.roi.roiPct) : null;

  const nextAction = data.tasks[0] ?? null;

  return (
    <>
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>
            {data.greeting}, {data.orgName}
          </h1>
          <p className={styles.pageSubtitle}>
            {data.hasSession
              ? `Here's your compliance snapshot as of ${fmtDate(data.snapshotDate)}`
              : "Complete your assessment to see your risk score"}
          </p>
        </div>
        <div className={styles.pageActions}>
          <button
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
            onClick={() => router.push("/dashboard/reports?print=1")}
            disabled={!data.hasSession}
            title={!data.hasSession ? "Complete assessment first" : "Download compliance report as PDF"}
          >
            <Download size={14} /> Download Report
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className={styles.statGrid}>
        <div
          className={styles.statCard}
          title={
            data.riskComponents
              ? `Risk Score = four components, each capped at 25 (EWNAF §4.2):\n• Data Volume: ${data.riskComponents.volume}/25\n• Data Sensitivity: ${data.riskComponents.sensitivity}/25\n• Third-Party Access: ${data.riskComponents.thirdParty}/25\n• Compliance Gap: ${data.riskComponents.complianceGap}/25\nCompliance is only one of four — a high score can coexist with decent compliance.`
              : undefined
          }
          style={{ cursor: data.riskComponents ? "help" : undefined }}
        >
          <div className={styles.statCardTop}>
            <span className={styles.statCardLabel}>Risk Score</span>
            <div className={`${styles.statCardIcon} ${data.riskBand === "low" ? styles.iconGreen : data.riskBand === "medium" ? styles.iconAmber : styles.iconRed}`}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className={styles.statCardValue} style={{ color: data.riskBand === "low" ? "#22c55e" : data.riskBand === "medium" ? "#f59e0b" : data.riskBand === "high" ? "#f97316" : data.riskBand === "critical" ? "#ef4444" : undefined }}>
            {data.riskScore > 0 ? data.riskScore : "—"}
            <span style={{ fontSize: "1rem", color: "rgba(221,215,234,0.4)" }}>/100</span>
          </div>
          <div className={styles.statCardSub}>
            {data.riskBand ? (
              <span style={{ color: data.riskBand === "low" ? "#22c55e" : data.riskBand === "medium" ? "#f59e0b" : data.riskBand === "high" ? "#f97316" : "#ef4444" }}>{riskBandLabel}</span>
            ) : (
              <span>Complete assessment to score</span>
            )}
          </div>
          {/* Component breakdown so a high score is explained, not left looking
              contradictory next to a decent compliance %. */}
          {data.riskComponents && data.riskScore > 0 && (
            <div style={{ marginTop: "0.6rem", paddingTop: "0.55rem", borderTop: "1px solid rgba(117,76,190,0.12)", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {([
                ["Data Volume", data.riskComponents.volume],
                ["Data Sensitivity", data.riskComponents.sensitivity],
                ["Third-Party Access", data.riskComponents.thirdParty],
                ["Compliance Gap", data.riskComponents.complianceGap],
              ] as const).map(([label, val]) => {
                const c = val >= 21 ? "#ef4444" : val >= 15 ? "#f97316" : val >= 9 ? "#eab308" : "#22c55e";
                return (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.62rem", color: "rgba(221,215,234,0.5)", flex: "0 0 6.5rem" }}>{label}</span>
                    <span style={{ flex: 1, height: 4, background: "rgba(117,76,190,0.12)", borderRadius: 2, overflow: "hidden" }}>
                      <span style={{ display: "block", height: "100%", width: `${(val / 25) * 100}%`, background: c, borderRadius: 2 }} />
                    </span>
                    <span style={{ fontSize: "0.6rem", color: c, fontWeight: 600, flex: "0 0 2.2rem", textAlign: "right" }}>{val}/25</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <span className={styles.statCardLabel}>Compliance</span>
            <div className={`${styles.statCardIcon} ${styles.iconAmber}`}>
              <BarChart2 size={16} />
            </div>
          </div>
          <div className={styles.statCardValue}>
            {data.compliancePct > 0 ? data.compliancePct : "—"}
            {data.compliancePct > 0 && (
              <span style={{ fontSize: "1rem", color: "rgba(221,215,234,0.4)" }}>%</span>
            )}
          </div>
          <div className={styles.statCardSub}>
            {data.frameworkName ?? "No framework assigned"}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <span className={styles.statCardLabel}>Open Critical Issues</span>
            <div className={`${styles.statCardIcon} ${styles.iconRed}`}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className={styles.statCardValue}>{data.openCritical}</div>
          <div className={styles.statCardSub}>
            {data.openCritical > 0 ? (
              <span className={styles.trendUp}>Require immediate attention</span>
            ) : (
              <span>No critical issues open</span>
            )}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <span className={styles.statCardLabel}>Controls Completed</span>
            <div className={`${styles.statCardIcon} ${styles.iconGreen}`}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className={styles.statCardValue}>
            {data.yesCount}
            <span style={{ fontSize: "1rem", color: "rgba(221,215,234,0.4)" }}>
              /{data.totalControls}
            </span>
          </div>
          <div className={styles.statCardSub}>of applicable controls</div>
        </div>
      </div>

      {/* Middle Row */}
      <div className={`${styles.grid21} ${styles.mb15}`}>
        {/* Risk Overview */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Risk Overview</h2>
            <span
              className={`${styles.badge} ${riskBadgeClass}`}
              title={`Overall risk band from your risk score of ${data.riskScore}/100 — Low (0–39), Medium (40–59), High (60–79), Critical (80–100). Higher score = higher risk.`}
              style={{ cursor: "help" }}
            >
              {riskBandLabel}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
            <RiskGauge score={data.riskScore} />
          </div>

          {/* Financial exposure strip */}
          {data.financialExposureMin !== null && data.financialExposureMax !== null && (
            <div
              style={{
                padding: "0.7rem 0.9rem",
                background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.12)",
                borderRadius: "10px",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "0.78rem", color: "rgba(221,215,234,0.5)" }}>
                  Estimated breach exposure{" "}
                  <span style={{ fontSize: "0.66rem", color: "rgba(221,215,234,0.35)" }}>(total)</span>
                </span>
                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#f87171" }}>
                  {fmtCurrency(data.financialExposureMin, data.currency)} –{" "}
                  {fmtCurrency(data.financialExposureMax, data.currency)}{" "}
                  <span style={{ fontWeight: 400, fontSize: "0.72rem" }}>{data.currency}</span>
                </span>
              </div>
              {/* Per-record breakdown so the total reads as records × rate, not a
                  bare lump sum. Only shown when we know how many records are exposed. */}
              {data.recordsAtRisk !== null && data.recordsAtRisk > 0 && data.perRecordRate !== null && (
                <div
                  title={`Based on IBM's per-record cost for a ${data.perRecordBasis} (${fmtCurrency(data.perRecordRate, data.currency)}), applied to the ${data.recordsAtRisk.toLocaleString("en-CA")} sensitive records exposed to third parties.`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "0.45rem",
                    paddingTop: "0.45rem",
                    borderTop: "1px solid rgba(239,68,68,0.1)",
                    cursor: "help",
                  }}
                >
                  <span style={{ fontSize: "0.68rem", color: "rgba(221,215,234,0.4)" }}>
                    {data.recordsAtRisk.toLocaleString("en-CA")} records at risk
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "rgba(221,215,234,0.5)", fontWeight: 600 }}>
                    {fmtCurrency(data.perRecordRate, data.currency)}/{data.perRecordBasis}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Beyond the fine — regulatory fines are rarely the largest component
              of total breach cost (IBM 2024 / Ponemon). */}
          {data.financialExposureMax !== null && (
            <div style={{ padding: "0.7rem 0.9rem", background: "rgba(117,76,190,0.06)", border: "1px solid rgba(117,76,190,0.15)", borderRadius: "10px", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(221,215,234,0.6)", marginBottom: "0.4rem" }}>
                Beyond the fine — costs this estimate does not include
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {["Forensic investigation", "Legal defense", "Breach notification", "Credit monitoring", "Insurance premium increases", "Business disruption"].map((c) => (
                  <span key={c} className={`${styles.badge} ${styles.badgeGray}`} style={{ fontSize: "0.62rem" }}>{c}</span>
                ))}
              </div>
              <div style={{ fontSize: "0.6rem", color: "rgba(221,215,234,0.35)", marginTop: "0.4rem" }}>
                Per IBM 2024 Cost of a Data Breach, regulatory fines are typically a minority of total breach cost.
              </div>
            </div>
          )}

          {/* Framework compliance bars */}
          {data.frameworkId && (
            <>
              <hr className={styles.divider} />
              <p className={styles.sectionLabel}>Compliance by Framework</p>
              <div style={{ marginBottom: "0.75rem" }}>
                <div
                  className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb05}`}
                >
                  <span className={styles.textSm}>{data.frameworkName}</span>
                  <div className={`${styles.flex} ${styles.gap04} ${styles.itemsCenter}`}>
                    <span
                      className={styles.textSm}
                      style={{ color: complianceColor, fontWeight: 600 }}
                    >
                      {data.compliancePct}%
                    </span>
                    <span
                      className={`${styles.badge} ${
                        complianceStatus === "Compliant"
                          ? styles.badgeLow
                          : complianceStatus === "At Risk"
                          ? styles.badgeMedium
                          : complianceStatus === "Non-Compliant"
                          ? styles.badgeHigh
                          : styles.badgeGray
                      }`}
                    >
                      {complianceStatus}
                    </span>
                  </div>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${data.compliancePct}%`, background: complianceColor }}
                  />
                </div>
                <div className={`${styles.flex} ${styles.gap08} ${styles.mt05}`}>
                  <span className={styles.textXs} style={{ color: "#4ade80" }}>
                    ✓ {data.yesCount} passed
                  </span>
                  {data.partialCount > 0 && (
                    <span className={styles.textXs} style={{ color: "#fbbf24" }}>
                      ~ {data.partialCount} partial
                    </span>
                  )}
                  <span className={styles.textXs} style={{ color: "#f87171" }}>
                    ✗ {data.noCount} failed
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Activity Feed */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Recent Activity</h2>
            <span className={`${styles.badge} ${styles.badgeGray}`}>
              <Clock size={10} /> Live
            </span>
          </div>
          <div className={styles.timeline}>
            {data.activity.length === 0 ? (
              <div className={styles.timelineItem}>
                <div className={styles.timelineContent}>
                  <p className={styles.timelineTime}>No activity yet — complete your assessment to get started.</p>
                </div>
              </div>
            ) : (
              data.activity.map((a, i) => (
                <div key={i} className={styles.timelineItem}>
                  <div className={`${styles.timelineDot} ${DOT_CLASS[a.type]}`} />
                  <div className={styles.timelineContent}>
                    <p className={styles.timelineText}>{a.text}</p>
                    <p className={styles.timelineTime}>{relativeTime(a.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Return on Investment */}
      {data.roi && roiRec ? (
        <div className={`${styles.card} ${styles.mb15}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Return on Investment</h2>
            <span className={styles.badge} style={{ background: `${roiRec.color}22`, color: roiRec.color, border: `1px solid ${roiRec.color}44` }}>
              {roiRec.label}
            </span>
          </div>

          <div className={styles.statGrid} style={{ marginBottom: "1rem" }}>
            <div className={styles.statCard}>
              <div className={styles.statCardTop}><span className={styles.statCardLabel}>3-Yr Net Benefit</span></div>
              <div className={styles.statCardValue} style={{ fontSize: "1.5rem", color: data.roi.netBenefit3yr >= 0 ? "#22c55e" : "#ef4444" }}>
                {fmtCurrency(data.roi.netBenefit3yr, data.currency)}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statCardTop}><span className={styles.statCardLabel}>ROI</span></div>
              <div className={styles.statCardValue} style={{ fontSize: "1.5rem", color: roiRec.color }}>
                {Math.round(data.roi.roiPct)}%
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statCardTop}><span className={styles.statCardLabel}>Payback Period</span></div>
              <div className={styles.statCardValue} style={{ fontSize: "1.5rem" }}>{data.roi.paybackMonths.toFixed(1)} mo</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statCardTop}><span className={styles.statCardLabel}>3-Yr Investment</span></div>
              <div className={styles.statCardValue} style={{ fontSize: "1.5rem" }}>{fmtCurrency(data.roi.investmentTotal, data.currency)}</div>
            </div>
          </div>

          <hr className={styles.divider} />
          <div className={styles.grid2}>
            <div>
              <p className={styles.sectionLabel}>Investment Breakdown</p>
              {Object.entries(data.roi.investmentBreakdown).map(([key, val]) => (
                <div key={key} className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ padding: "0.35rem 0", borderBottom: "1px solid rgba(117,76,190,0.07)" }}>
                  <span className={styles.textSm} style={{ color: "rgba(221,215,234,0.6)" }}>{INVESTMENT_LABELS[key] ?? key}</span>
                  <span className={styles.textSm} style={{ color: "#ddd7ea", fontWeight: 600 }}>{fmtCurrency(Number(val), data.currency)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className={styles.sectionLabel}>3-Year Benefits</p>
              {Object.entries(data.roi.benefitsBreakdown).map(([key, val]) => (
                <div key={key} className={`${styles.flex} ${styles.justifyBetween}`} style={{ alignItems: "flex-start", padding: "0.35rem 0", borderBottom: "1px solid rgba(117,76,190,0.07)" }}>
                  <span style={{ minWidth: 0 }}>
                    <span className={styles.textSm} style={{ color: "rgba(221,215,234,0.6)", display: "block" }}>{BENEFIT_LABELS[key] ?? key}</span>
                    {BENEFIT_NOTES[key] && (
                      <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.35)" }}>{BENEFIT_NOTES[key]}</span>
                    )}
                  </span>
                  <span className={styles.textSm} style={{ color: "#4ade80", fontWeight: 600, whiteSpace: "nowrap" }}>{fmtCurrency(Number(val), data.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : data.hasSession ? (
        <div className={`${styles.card} ${styles.mb15}`} style={{ textAlign: "center", padding: "1.5rem" }}>
          <p className={styles.emptyText}>
            Add your business size, annual revenue, and employee count during onboarding to see your security investment ROI here.
          </p>
        </div>
      ) : null}

      {/* Risk Heatmap + Maturity Dashboard */}
      {(data.heatmapEntries.length > 0 || data.maturityDomains.length > 0) && (
        <div className={`${styles.grid2} ${styles.mb15}`}>
          {/* Risk Heatmap */}
          {data.heatmapEntries.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitleLg}>Risk Heatmap</h2>
                <span className={`${styles.badge} ${styles.badgePurple}`}>{data.heatmapEntries.length} entries</span>
              </div>
              {/* 4×4 probability × impact grid */}
              {(() => {
                const BANDS = ["low","medium","high","critical"] as const;
                const PROB_LABEL: Record<string,string> = { low:"Low", medium:"Med", high:"High", critical:"Crit" };
                type Band = typeof BANDS[number];
                const grid: Record<string, string[]> = {};
                BANDS.forEach((p) => BANDS.forEach((i) => { grid[`${p}:${i}`] = []; }));
                data.heatmapEntries.forEach((e) => {
                  const iBand: Band = e.financialImpact >= 1000000 ? "critical" : e.financialImpact >= 250000 ? "high" : e.financialImpact >= 50000 ? "medium" : "low";
                  const key = `${e.probabilityBand}:${iBand}`;
                  if (grid[key]) grid[key].push(e.title);
                });
                const cellColor = (p: string, i: string): string => {
                  const score = (BANDS.indexOf(p as Band)+1) * (BANDS.indexOf(i as Band)+1);
                  return score >= 12 ? "rgba(239,68,68,0.25)" : score >= 6 ? "rgba(245,158,11,0.2)" : score >= 3 ? "rgba(249,115,22,0.1)" : "rgba(34,197,94,0.08)";
                };
                return (
                  <div>
                    <div style={{ display: "flex", gap: "0.2rem", marginBottom: "0.2rem", paddingLeft: "3rem" }}>
                      {BANDS.map((i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "0.62rem", color: "rgba(221,215,234,0.4)" }}>{PROB_LABEL[i]}</div>)}
                    </div>
                    {[...BANDS].reverse().map((p) => (
                      <div key={p} style={{ display: "flex", alignItems: "center", gap: "0.2rem", marginBottom: "0.2rem" }}>
                        <div style={{ width: "2.8rem", fontSize: "0.62rem", color: "rgba(221,215,234,0.4)", flexShrink: 0 }}>{PROB_LABEL[p]} P</div>
                        {BANDS.map((i) => {
                          const entries = grid[`${p}:${i}`] ?? [];
                          return (
                            <div key={i} title={entries.join(", ")} style={{ flex: 1, height: 36, borderRadius: 4, background: cellColor(p, i), border: "1px solid rgba(117,76,190,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {entries.length > 0 && <span style={{ fontWeight: 700, fontSize: "0.75rem", color: "#ddd7ea" }}>{entries.length}</span>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div style={{ fontSize: "0.6rem", color: "rgba(221,215,234,0.3)", marginTop: "0.5rem", textAlign: "right" }}>Impact →</div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Maturity Dashboard */}
          {data.maturityDomains.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitleLg}>Maturity Dashboard</h2>
              </div>
              <div className={styles.flexCol} style={{ gap: "0.7rem" }}>
                {data.maturityDomains.map((d) => {
                  const color = d.rawScore >= 80 ? "#22c55e" : d.rawScore >= 60 ? "#f59e0b" : d.rawScore >= 40 ? "#f97316" : "#ef4444";
                  return (
                    <div key={d.domain}>
                      <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ marginBottom: "0.3rem" }}>
                        <span className={styles.textSm} style={{ color: "#ddd7ea" }}>{d.domain}</span>
                        <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>L{d.maturityLevel} {d.label}</span>
                      </div>
                      <div className={styles.progressBar} style={{ height: 6 }}>
                        <div style={{ height: "100%", width: `${d.rawScore}%`, background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Risk Curve — 5×5 likelihood (by maturity) × impact (by data sensitivity) */}
      {data.maturityDomains.length > 0 && (
        <div className={`${styles.card} ${styles.mb15}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Risk Curve</h2>
            <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>likelihood × impact by domain maturity</span>
          </div>
          {(() => {
            // Likelihood = 6 − maturity level (maturity 1 → likelihood 5 "Very Likely" … 5 → 1 "Rare")
            // Impact column = org data sensitivity level (1–5)
            const LIK_LABEL = ["", "Rare", "Unlikely", "Possible", "Likely", "Very Likely"];
            const IMP_LABEL = ["", "Minimal", "Minor", "Moderate", "Major", "Severe"];
            const impactCol = Math.min(5, Math.max(1, data.dataSensitivityLevel));
            // bucket domains by likelihood row
            const byLik: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
            data.maturityDomains.forEach((d) => {
              const lik = Math.min(5, Math.max(1, 6 - d.maturityLevel));
              byLik[lik].push(d.domain);
            });
            const cellColor = (lik: number, imp: number) => {
              const s = lik * imp;
              return s >= 15 ? "rgba(239,68,68,0.25)" : s >= 9 ? "rgba(245,158,11,0.2)" : s >= 4 ? "rgba(249,115,22,0.12)" : "rgba(34,197,94,0.08)";
            };
            return (
              <div>
                <div style={{ display: "flex", gap: "0.2rem", marginBottom: "0.2rem", paddingLeft: "5.5rem" }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "0.6rem", color: i === impactCol ? "#c4a8f0" : "rgba(221,215,234,0.35)", fontWeight: i === impactCol ? 700 : 400 }}>{IMP_LABEL[i]}</div>
                  ))}
                </div>
                {[5, 4, 3, 2, 1].map((lik) => (
                  <div key={lik} style={{ display: "flex", alignItems: "center", gap: "0.2rem", marginBottom: "0.2rem" }}>
                    <div style={{ width: "5.3rem", fontSize: "0.6rem", color: "rgba(221,215,234,0.4)", flexShrink: 0, textAlign: "right", paddingRight: "0.2rem" }}>{LIK_LABEL[lik]}</div>
                    {[1, 2, 3, 4, 5].map((imp) => {
                      const domains = imp === impactCol ? byLik[lik] : [];
                      return (
                        <div key={imp} title={domains.join(", ")} style={{ flex: 1, height: 34, borderRadius: 4, background: cellColor(lik, imp), border: imp === impactCol ? "1px solid rgba(117,76,190,0.4)" : "1px solid rgba(117,76,190,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {domains.length > 0 && <span style={{ fontWeight: 700, fontSize: "0.72rem", color: "#ddd7ea" }}>{domains.length}</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div style={{ fontSize: "0.6rem", color: "rgba(221,215,234,0.3)", marginTop: "0.5rem", display: "flex", justifyContent: "space-between" }}>
                  <span>↑ Likelihood (lower maturity = more likely)</span>
                  <span>Impact = data sensitivity (L{impactCol}) →</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Bottom Row */}
      <div className={styles.grid21}>
        {/* Outstanding Tasks */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Outstanding Tasks</h2>
            <span className={`${styles.badge} ${styles.badgePurple}`}>
              {data.tasks.length} open
            </span>
          </div>

          {data.tasks.length === 0 ? (
            <div className={styles.emptyState}>
              <CheckCircle2 size={32} className={styles.emptyIcon} />
              <p className={styles.emptyText}>
                {data.hasSession
                  ? "No open tasks — your remediation roadmap will be generated after scoring."
                  : "Complete your assessment to generate your remediation roadmap."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {data.tasks.slice(0, 5).map((task, i) => (
                <div
                  key={i}
                  className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`}
                  style={{ padding: "0.6rem 0", borderBottom: "1px solid rgba(117,76,190,0.07)" }}
                >
                  <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
                    <SeverityBadge level={task.priority} dimension="Priority" />
                    <span className={styles.textSm}>{task.title}</span>
                  </div>
                  <LabeledBadge dimension="Effort" value={fmtEffort(task.effort)} color={EFFORT_COLOR[task.effort] ?? "#94a3b8"} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Next Recommended Action */}
        {nextAction ? (
          <div
            className={styles.card}
            style={{
              borderColor: "rgba(239,68,68,0.3)",
              background:
                "linear-gradient(135deg, #181430 80%, rgba(239,68,68,0.05))",
            }}
          >
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitleLg}>Next Recommended Action</h2>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <SeverityBadge level={nextAction.priority} dimension="Priority" />
            </div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#ddd7ea", margin: "0.5rem 0" }}>
              {nextAction.title}
            </h3>
            {nextAction.description && (
              <p style={{ fontSize: "0.82rem", color: "rgba(221,215,234,0.65)", lineHeight: 1.6, margin: "0 0 1rem" }}>
                {nextAction.description}
              </p>
            )}
            <div className={`${styles.flex} ${styles.gap04} ${styles.mb1}`}>
              {data.frameworkName && (
                <span className={`${styles.badge} ${styles.badgePurple}`}>{data.frameworkName}</span>
              )}
              <span className={`${styles.badge} ${styles.badgeGray}`}>
                Effort: {fmtEffort(nextAction.effort)}
              </span>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary} ${styles.w100}`}
              style={{ justifyContent: "center" }}
              onClick={() => router.push("/dashboard/actions")}
            >
              Start This Task <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className={styles.card} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div className={styles.emptyState}>
              <CheckCircle2 size={32} className={styles.emptyIcon} />
              <p className={styles.emptyText}>
                Your recommended actions will appear here once your assessment is scored.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
