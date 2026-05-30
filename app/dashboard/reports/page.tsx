"use client";

import { Download, FileText, Mail, RefreshCw } from "lucide-react";
import styles from "../dashboard.module.css";

const REPORTS = [
  {
    id: "RPT-001",
    title: "Executive Summary Report",
    desc: "High-level overview of your risk score, compliance status, and top 5 action items. Designed for C-suite and board presentations.",
    type: "Executive",
    lastGenerated: "May 23, 2026",
    formats: ["PDF"],
    size: "1.2 MB",
    badge: styles.badgePurple,
  },
  {
    id: "RPT-002",
    title: "Full PIPEDA Compliance Report",
    desc: "Detailed breakdown of all PIPEDA controls — pass/fail status, evidence references, and gap analysis by domain.",
    type: "Compliance",
    lastGenerated: "May 23, 2026",
    formats: ["PDF", "CSV"],
    size: "3.8 MB",
    badge: styles.badgeInfo,
  },
  {
    id: "RPT-003",
    title: "Risk Register Export",
    desc: "Full list of identified risks with severity scores, owners, statuses, and due dates. Suitable for risk committee review.",
    type: "Risk",
    lastGenerated: "May 23, 2026",
    formats: ["CSV", "PDF"],
    size: "0.9 MB",
    badge: styles.badgeHigh,
  },
  {
    id: "RPT-004",
    title: "Audit-Ready Report",
    desc: "Evidence-linked compliance documentation formatted for regulatory audits. Includes document references and timestamps.",
    type: "Audit",
    lastGenerated: "May 20, 2026",
    formats: ["PDF"],
    size: "5.1 MB",
    badge: styles.badgeCritical,
  },
  {
    id: "RPT-005",
    title: "Questionnaire Responses Export",
    desc: "Complete record of all submitted questionnaire answers with timestamps and confidence flags, grouped by category.",
    type: "Assessment",
    lastGenerated: "May 22, 2026",
    formats: ["CSV", "PDF"],
    size: "0.6 MB",
    badge: styles.badgeGray,
  },
  {
    id: "RPT-006",
    title: "Action Plan Report",
    desc: "Prioritized remediation roadmap with effort estimates, deadlines, ownership, and progress tracking.",
    type: "Action Plan",
    lastGenerated: "May 23, 2026",
    formats: ["PDF", "CSV"],
    size: "1.4 MB",
    badge: styles.badgeMedium,
  },
];

export default function ReportsPage() {
  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Reports</h1>
          <p className={styles.pageSubtitle}>Generate, download, or schedule compliance reports</p>
        </div>
        <div className={styles.pageActions}>
          <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}>
            <Mail size={14} /> Schedule Monthly Email
          </button>
        </div>
      </div>

      <div className={styles.grid2}>
        {REPORTS.map((r) => (
          <div key={r.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
                <div className={`${styles.statCardIcon} ${styles.iconPurple}`}>
                  <FileText size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem" }}>{r.title}</div>
                  <span className={`${styles.badge} ${r.badge}`} style={{ marginTop: "0.2rem", display: "inline-flex" }}>{r.type}</span>
                </div>
              </div>
            </div>
            <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.6)", marginBottom: "1rem", lineHeight: 1.6 }}>{r.desc}</p>
            <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`}>
              <div>
                <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>Last generated: {r.lastGenerated}</div>
                <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.35)", marginTop: "0.1rem" }}>Size: {r.size}</div>
              </div>
              <div className={`${styles.flex} ${styles.gap04}`}>
                <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}><RefreshCw size={13} /> Regenerate</button>
                {r.formats.map((fmt) => (
                  <button key={fmt} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}>
                    <Download size={13} /> {fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
