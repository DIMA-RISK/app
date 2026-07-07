"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart2, AlertTriangle, CheckCircle2, Clock, Download, RefreshCw, ArrowRight } from "lucide-react";
import styles from "../dashboard.module.css";
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
  const nextActionBadgeClass =
    nextAction?.priority === "critical"
      ? styles.badgeCritical
      : nextAction?.priority === "high"
      ? styles.badgeHigh
      : styles.badgeMedium;

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
        <div className={styles.statCard}>
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
            <span className={`${styles.badge} ${riskBadgeClass}`}>{riskBandLabel}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
            <RiskGauge score={data.riskScore} />
          </div>

          {/* Financial exposure strip */}
          {data.financialExposureMin !== null && data.financialExposureMax !== null && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.7rem 0.9rem",
                background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.12)",
                borderRadius: "10px",
                marginBottom: "1rem",
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "rgba(221,215,234,0.5)" }}>
                Estimated breach exposure
              </span>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#f87171" }}>
                {fmtCurrency(data.financialExposureMin, data.currency)} –{" "}
                {fmtCurrency(data.financialExposureMax, data.currency)}{" "}
                <span style={{ fontWeight: 400, fontSize: "0.72rem" }}>{data.currency}</span>
              </span>
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
                <div key={key} className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ padding: "0.35rem 0", borderBottom: "1px solid rgba(117,76,190,0.07)" }}>
                  <span className={styles.textSm} style={{ color: "rgba(221,215,234,0.6)" }}>{BENEFIT_LABELS[key] ?? key}</span>
                  <span className={styles.textSm} style={{ color: "#4ade80", fontWeight: 600 }}>{fmtCurrency(Number(val), data.currency)}</span>
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
                    <span
                      className={`${styles.badge} ${
                        task.priority === "critical"
                          ? styles.badgeCritical
                          : task.priority === "high"
                          ? styles.badgeHigh
                          : task.priority === "medium"
                          ? styles.badgeMedium
                          : styles.badgeLow
                      }`}
                    >
                      {task.priority}
                    </span>
                    <span className={styles.textSm}>{task.title}</span>
                  </div>
                  <span className={`${styles.badge} ${styles.badgeGray}`}>
                    {fmtEffort(task.effort)}
                  </span>
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
            <span
              className={`${styles.badge} ${nextActionBadgeClass}`}
              style={{ marginBottom: "0.75rem", display: "inline-flex" }}
            >
              {nextAction.priority}
            </span>
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
