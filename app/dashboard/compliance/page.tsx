"use client";

import { useState } from "react";
import { ShieldCheck, ShieldX, ChevronDown, ChevronUp, Download, ExternalLink } from "lucide-react";
import styles from "../dashboard.module.css";

const FRAMEWORKS = [
  {
    id: "pipeda",
    name: "PIPEDA",
    fullName: "Personal Information Protection and Electronic Documents Act",
    region: "Canada",
    score: 72,
    status: "at-risk",
    passed: 34,
    failed: 13,
    missing: 8,
    total: 47,
    lastRun: "May 23, 2026",
    domains: [
      { name: "Governance & Accountability", score: 85, passed: 6, failed: 1 },
      { name: "Consent & Purpose Limitation", score: 70, passed: 7, failed: 3 },
      { name: "Data Minimization", score: 80, passed: 4, failed: 1 },
      { name: "Accuracy & Retention", score: 55, passed: 3, failed: 4 },
      { name: "Safeguards & Security", score: 68, passed: 5, failed: 2 },
      { name: "Openness & Access", score: 60, passed: 4, failed: 2 },
      { name: "Breach Response", score: 50, passed: 3, failed: 3 },
      { name: "Vendor Management", score: 65, passed: 2, failed: 1 },
    ],
    topGaps: [
      { id: "PIPEDA-GOV-001", title: "No designated Privacy Officer", severity: "critical" },
      { id: "PIPEDA-ACC-005", title: "Missing data retention policy", severity: "critical" },
      { id: "PIPEDA-SAF-003", title: "Unencrypted portable storage devices", severity: "high" },
      { id: "PIPEDA-BRE-001", title: "No documented breach response plan", severity: "high" },
      { id: "PIPEDA-VEN-002", title: "3 vendors lack data processing agreements", severity: "high" },
    ],
  },
];

const STATUS_COLOR: Record<string, string> = {
  compliant: "#22c55e",
  "at-risk": "#f59e0b",
  critical: "#ef4444",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: styles.badgeCritical,
  high: styles.badgeHigh,
  medium: styles.badgeMedium,
  low: styles.badgeLow,
};

function scoreColor(s: number) {
  return s >= 80 ? "#22c55e" : s >= 60 ? "#f59e0b" : "#ef4444";
}
function scoreFill(s: number) {
  return s >= 80 ? styles.fillGreen : s >= 60 ? styles.fillAmber : styles.fillRed;
}

export default function CompliancePage() {
  const [expanded, setExpanded] = useState<string | null>("pipeda");

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Compliance Status</h1>
          <p className={styles.pageSubtitle}>Framework-level compliance overview based on your latest assessment run</p>
        </div>
        <div className={styles.pageActions}>
          <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}>
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className={`${styles.grid3} ${styles.mb15}`}>
        {[
          { label: "Active Frameworks", value: "1", sub: "PIPEDA", icon: "🛡️" },
          { label: "Overall Compliance", value: "72%", sub: "Needs improvement", icon: "📊" },
          { label: "High-Risk Gaps", value: "5", sub: "Require immediate action", icon: "⚠️" },
        ].map((s) => (
          <div key={s.label} className={styles.card}>
            <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
              <span style={{ fontSize: "1.5rem" }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ddd7ea" }}>{s.value}</div>
                <div className={styles.statCardLabel}>{s.label}</div>
                <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>{s.sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Framework cards */}
      {FRAMEWORKS.map((fw) => {
        const open = expanded === fw.id;
        const color = STATUS_COLOR[fw.status];
        return (
          <div key={fw.id} className={`${styles.card} ${styles.mb1}`}>
            {/* Header row */}
            <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`}>
              <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
                <div className={styles.scoreCircle}
                  style={{ background: `${color}18`, color, fontSize: "0.9rem", fontWeight: 700 }}>
                  {fw.score}%
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "#ddd7ea" }}>{fw.name}</div>
                  <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)" }}>{fw.fullName} · {fw.region}</div>
                </div>
              </div>
              <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
                <span className={`${styles.badge} ${styles.badgeMedium}`}>At Risk</span>
                <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>Last run: {fw.lastRun}</span>
                <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={() => setExpanded(open ? null : fw.id)}>
                  {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {open ? "Collapse" : "Details"}
                </button>
                <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
                  <Download size={14} />
                </button>
              </div>
            </div>

            {/* Score bar */}
            <div style={{ marginTop: "1rem" }}>
              <div className={styles.progressBar}>
                <div className={`${styles.progressFill} ${scoreFill(fw.score)}`} style={{ width: `${fw.score}%` }} />
              </div>
              <div className={`${styles.flex} ${styles.gap1} ${styles.mt05}`}>
                <span className={styles.textXs} style={{ color: "#4ade80" }}>
                  <ShieldCheck size={11} style={{ display: "inline" }} /> {fw.passed} passed
                </span>
                <span className={styles.textXs} style={{ color: "#f87171" }}>
                  <ShieldX size={11} style={{ display: "inline" }} /> {fw.failed} failed
                </span>
                <span className={styles.textXs} style={{ color: "#fbbf24" }}>⚠ {fw.missing} missing evidence</span>
              </div>
            </div>

            {/* Expanded details */}
            {open && (
              <>
                <hr className={styles.divider} />
                <div className={styles.grid2}>
                  {/* Domain scores */}
                  <div>
                    <p className={styles.sectionLabel}>Score by Domain</p>
                    {fw.domains.map((d) => (
                      <div key={d.name} style={{ marginBottom: "0.75rem" }}>
                        <div className={`${styles.flex} ${styles.justifyBetween} ${styles.mb05}`}>
                          <span className={styles.textSm}>{d.name}</span>
                          <span className={styles.textSm} style={{ color: scoreColor(d.score), fontWeight: 600 }}>{d.score}%</span>
                        </div>
                        <div className={styles.progressBar}>
                          <div className={`${styles.progressFill} ${scoreFill(d.score)}`} style={{ width: `${d.score}%` }} />
                        </div>
                        <div className={`${styles.flex} ${styles.gap08} ${styles.mt05}`}>
                          <span className={styles.textXs} style={{ color: "#4ade80" }}>✓ {d.passed}</span>
                          <span className={styles.textXs} style={{ color: "#f87171" }}>✗ {d.failed}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Top gaps */}
                  <div>
                    <p className={styles.sectionLabel}>High-Risk Gaps</p>
                    {fw.topGaps.map((g) => (
                      <div key={g.id} className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`}
                        style={{ padding: "0.65rem 0", borderBottom: "1px solid rgba(117,76,190,0.07)" }}>
                        <div>
                          <div className={styles.textSm}>{g.title}</div>
                          <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)", marginTop: "0.15rem" }}>{g.id}</div>
                        </div>
                        <div className={`${styles.flex} ${styles.gap04}`}>
                          <span className={`${styles.badge} ${SEVERITY_BADGE[g.severity]}`}>{g.severity}</span>
                          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnXs}`}>
                            <ExternalLink size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Future frameworks notice */}
      <div className={`${styles.card} ${styles.mt1}`} style={{ borderStyle: "dashed", opacity: 0.6, textAlign: "center", padding: "1.75rem" }}>
        <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.5)", margin: 0 }}>
          Additional frameworks (HIPAA, SOC 2, Quebec Law 25) will appear here once your organization qualifies or datasets are available.
        </p>
      </div>
    </>
  );
}
