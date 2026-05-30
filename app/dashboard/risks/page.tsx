"use client";

import { useState } from "react";
import { Plus, Download, Filter } from "lucide-react";
import styles from "../dashboard.module.css";

const RISKS = [
  { id: "RSK-001", title: "No designated Privacy Officer", category: "Governance", likelihood: "High", impact: "High", score: 88, owner: "Unassigned", status: "open", due: "Jun 1, 2026", framework: "PIPEDA" },
  { id: "RSK-002", title: "Missing data retention policy", category: "Data Management", likelihood: "High", impact: "High", score: 85, owner: "Jane Doe", status: "in-progress", due: "Jun 15, 2026", framework: "PIPEDA" },
  { id: "RSK-003", title: "Unencrypted portable devices", category: "Physical Security", likelihood: "Medium", impact: "High", score: 74, owner: "IT Team", status: "open", due: "May 30, 2026", framework: "PIPEDA" },
  { id: "RSK-004", title: "No breach response plan documented", category: "Incident Response", likelihood: "Low", impact: "Critical", score: 71, owner: "Unassigned", status: "open", due: "Jun 20, 2026", framework: "PIPEDA" },
  { id: "RSK-005", title: "3 vendors without DPAs", category: "Vendor Management", likelihood: "Medium", impact: "High", score: 68, owner: "Legal Team", status: "in-progress", due: "Jun 30, 2026", framework: "PIPEDA" },
  { id: "RSK-006", title: "Weak password policy enforced", category: "Access Control", likelihood: "High", impact: "Medium", score: 62, owner: "IT Team", status: "open", due: "May 28, 2026", framework: "PIPEDA" },
  { id: "RSK-007", title: "No staff privacy training program", category: "Training", likelihood: "Medium", impact: "Medium", score: 55, owner: "HR Team", status: "open", due: "Jul 1, 2026", framework: "PIPEDA" },
  { id: "RSK-008", title: "Consent forms not updated for 2024", category: "Consent", likelihood: "Medium", impact: "Medium", score: 48, owner: "Legal Team", status: "resolved", due: "—", framework: "PIPEDA" },
  { id: "RSK-009", title: "Patient records access logs missing", category: "Audit & Logging", likelihood: "Low", impact: "High", score: 45, owner: "IT Team", status: "in-progress", due: "Jun 5, 2026", framework: "PIPEDA" },
  { id: "RSK-010", title: "Cloud backup without encryption", category: "Data Security", likelihood: "Low", impact: "Medium", score: 38, owner: "IT Team", status: "open", due: "Jun 10, 2026", framework: "PIPEDA" },
];

const SCORE_BAND = (s: number) => s >= 75 ? { label: "Critical", cls: styles.badgeCritical } : s >= 60 ? { label: "High", cls: styles.badgeHigh } : s >= 40 ? { label: "Medium", cls: styles.badgeMedium } : { label: "Low", cls: styles.badgeLow };

const STATUS_BADGE: Record<string, string> = {
  open: styles.badgeCritical,
  "in-progress": styles.badgeMedium,
  resolved: styles.badgeGreen,
};

export default function RisksPage() {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? RISKS : RISKS.filter((r) => r.status === filter);

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Risk Register</h1>
          <p className={styles.pageSubtitle}>{RISKS.length} identified risks — sorted by severity</p>
        </div>
        <div className={styles.pageActions}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}><Download size={14} /> Export CSV</button>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}><Plus size={14} /> Add Risk</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className={`${styles.grid4} ${styles.mb15}`}>
        {[
          { label: "Critical", count: RISKS.filter(r => SCORE_BAND(r.score).label === "Critical").length, cls: styles.iconRed },
          { label: "High", count: RISKS.filter(r => SCORE_BAND(r.score).label === "High").length, cls: styles.iconAmber },
          { label: "Open", count: RISKS.filter(r => r.status === "open").length, cls: styles.iconRed },
          { label: "Resolved", count: RISKS.filter(r => r.status === "resolved").length, cls: styles.iconGreen },
        ].map((s) => (
          <div key={s.label} className={styles.card}>
            <div className={styles.statCardLabel}>{s.label}</div>
            <div className={styles.statCardValue}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className={`${styles.tabs} ${styles.mb1}`}>
        {["all", "open", "in-progress", "resolved"].map((f) => (
          <button key={f} className={`${styles.tab} ${filter === f ? styles.tabActive : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All Risks" : f === "in-progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className={styles.card} style={{ padding: 0, overflow: "hidden" }}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Risk</th>
                <th>Category</th>
                <th>Score</th>
                <th>Likelihood</th>
                <th>Impact</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const band = SCORE_BAND(r.score);
                return (
                  <tr key={r.id}>
                    <td><span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)", fontFamily: "monospace" }}>{r.id}</span></td>
                    <td>
                      <div style={{ fontWeight: 500, color: "#ddd7ea" }}>{r.title}</div>
                      <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>{r.framework}</div>
                    </td>
                    <td><span className={`${styles.badge} ${styles.badgePurple}`}>{r.category}</span></td>
                    <td>
                      <div className={`${styles.flex} ${styles.gap04} ${styles.itemsCenter}`}>
                        <span style={{ fontWeight: 700, color: "#ddd7ea" }}>{r.score}</span>
                        <span className={`${styles.badge} ${band.cls}`}>{band.label}</span>
                      </div>
                    </td>
                    <td><span className={styles.textSm}>{r.likelihood}</span></td>
                    <td><span className={styles.textSm}>{r.impact}</span></td>
                    <td><span className={styles.textSm}>{r.owner}</span></td>
                    <td><span className={`${styles.badge} ${STATUS_BADGE[r.status]}`}>{r.status}</span></td>
                    <td><span className={styles.textXs} style={{ color: "rgba(221,215,234,0.5)" }}>{r.due}</span></td>
                    <td>
                      <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnXs}`}>Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
