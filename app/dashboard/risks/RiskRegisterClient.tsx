"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { RiskRegisterData } from "../queries";
import styles from "../dashboard.module.css";

const PRIORITY_CLASS: Record<string, string> = {
  critical: styles.badgeCritical, high: styles.badgeHigh, medium: styles.badgeMedium, low: styles.badgeLow,
};
const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const LIKELIHOOD: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
const IMPACT: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

function exportCsv(risks: RiskRegisterData["risks"]) {
  const headers = ["Risk", "Description", "Category", "Likelihood", "Impact", "Priority", "Status", "Effort"];
  const rows = risks.map((r) => [
    r.title,
    r.description ?? "",
    r.category,
    LIKELIHOOD[r.priority] ?? "Medium",
    IMPACT[r.priority] ?? "Medium",
    r.priority,
    r.status,
    r.effort,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `risk-register-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RiskRegisterClient({ data }: { data: RiskRegisterData }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? data.risks : data.risks.filter((r) => r.priority === filter || r.status === filter);
  const sorted = [...filtered].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));

  const bandColor = data.riskBand === "critical" ? "#ef4444" : data.riskBand === "high" ? "#f97316" : data.riskBand === "medium" ? "#f59e0b" : "#22c55e";

  const counts = {
    critical: data.risks.filter((r) => r.priority === "critical").length,
    high: data.risks.filter((r) => r.priority === "high").length,
    medium: data.risks.filter((r) => r.priority === "medium").length,
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Risk Register</h1>
          <p className={styles.pageSubtitle}>{data.risks.length} risks identified from compliance assessment</p>
        </div>
        <div className={styles.pageActions}>
          <span className={`${styles.badge} ${styles.badgePurple}`} style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}>
            Risk Score: <strong style={{ color: bandColor }}>{data.riskScore}</strong>
          </span>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => exportCsv(sorted)}><Download size={14} /> Export</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
        {[
          { label: "Total Risks", value: data.risks.length, sub: "identified", color: "#c4a8f0", icon: styles.iconPurple },
          { label: "Critical / High", value: counts.critical + counts.high, sub: "require immediate action", color: "#ef4444", icon: styles.iconRed },
          { label: "Medium", value: counts.medium, sub: "monitor closely", color: "#f59e0b", icon: styles.iconAmber },
          { label: "Open", value: data.risks.filter((r) => r.status === "open").length, sub: "unresolved", color: "#60a5fa", icon: styles.iconBlue },
        ].map(({ label, value, sub, color, icon }) => (
          <div key={label} className={styles.statCard}>
            <div className={styles.statCardTop}><span className={styles.statCardLabel}>{label}</span><div className={`${styles.statCardIcon} ${icon}`} /></div>
            <div className={styles.statCardValue} style={{ color, fontSize: "1.75rem" }}>{value}</div>
            <div className={styles.statCardSub}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className={styles.tabs}>
        {["all", "high", "medium", "open", "in-progress", "resolved"].map((f) => (
          <button key={f} className={`${styles.tab} ${filter === f ? styles.tabActive : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All Risks" : f.charAt(0).toUpperCase() + f.slice(1).replace("-", " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className={styles.card} style={{ padding: 0 }}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Risk</th>
                <th>Category</th>
                <th>Likelihood</th>
                <th>Impact</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Effort</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "rgba(221,215,234,0.35)", padding: "2rem" }}>No risks match this filter.</td></tr>
              ) : sorted.map((risk) => (
                <tr key={risk.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: "#ddd7ea", marginBottom: "0.2rem" }}>{risk.title}</div>
                    {risk.description && <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)", lineHeight: 1.4 }}>{risk.description.slice(0, 90)}{risk.description.length > 90 ? "…" : ""}</div>}
                  </td>
                  <td><span className={`${styles.badge} ${styles.badgePurple}`}>{risk.category}</span></td>
                  <td><span style={{ color: risk.priority === "high" ? "#f87171" : "#fbbf24", fontWeight: 600, fontSize: "0.8rem" }}>{LIKELIHOOD[risk.priority] ?? "Medium"}</span></td>
                  <td><span style={{ color: risk.priority === "high" ? "#f87171" : "#fbbf24", fontWeight: 600, fontSize: "0.8rem" }}>{IMPACT[risk.priority] ?? "Medium"}</span></td>
                  <td><span className={`${styles.badge} ${PRIORITY_CLASS[risk.priority] ?? styles.badgeMedium}`}>{risk.priority}</span></td>
                  <td><span className={`${styles.badge} ${risk.status === "resolved" ? styles.badgeGreen : risk.status === "in-progress" ? styles.badgeMedium : styles.badgeGray}`}>{risk.status}</span></td>
                  <td><span className={`${styles.badge} ${styles.badgeInfo}`}>{risk.effort}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
