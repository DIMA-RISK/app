"use client";

import { useState } from "react";
import { Plus, Download, Laptop, Server, Globe, Database, Cloud, HardDrive } from "lucide-react";
import styles from "../dashboard.module.css";

const TYPE_ICON: Record<string, React.ReactNode> = {
  Laptop: <Laptop size={16} />, Server: <Server size={16} />, Application: <Globe size={16} />,
  Database: <Database size={16} />, Cloud: <Cloud size={16} />, Storage: <HardDrive size={16} />,
};

const ASSETS = [
  { id: "AST-001", name: "Reception Workstations (x4)", type: "Laptop", owner: "IT Team", sensitivity: 3, risk: "high", relevant: true, notes: "Handle patient check-in data" },
  { id: "AST-002", name: "EMR Server (on-premise)", type: "Server", owner: "IT Team", sensitivity: 5, risk: "critical", relevant: true, notes: "Primary electronic medical records" },
  { id: "AST-003", name: "Patient Portal (web app)", type: "Application", owner: "Dev Team", sensitivity: 4, risk: "high", relevant: true, notes: "Patient-facing self-service portal" },
  { id: "AST-004", name: "Billing Database", type: "Database", owner: "Finance", sensitivity: 4, risk: "high", relevant: true, notes: "Contains payment and insurance info" },
  { id: "AST-005", name: "AWS S3 — Backup Storage", type: "Cloud", owner: "IT Team", sensitivity: 4, risk: "medium", relevant: true, notes: "Nightly encrypted backups" },
  { id: "AST-006", name: "Staff Laptops (x12)", type: "Laptop", owner: "IT Team", sensitivity: 3, risk: "high", relevant: true, notes: "Mobile devices — encryption status: partial" },
  { id: "AST-007", name: "HR Management System", type: "Application", owner: "HR Team", sensitivity: 3, risk: "medium", relevant: true, notes: "Employee personal data" },
  { id: "AST-008", name: "Network Attached Storage", type: "Storage", owner: "IT Team", sensitivity: 3, risk: "medium", relevant: true, notes: "Shared drive for internal docs" },
];

const SENS_COLOR = (s: number) => s >= 5 ? "#ef4444" : s >= 4 ? "#f97316" : s >= 3 ? "#f59e0b" : "#22c55e";
const SENS_LABEL = (s: number) => s >= 5 ? "Critical" : s >= 4 ? "High" : s >= 3 ? "Medium" : "Low";
const RISK_BADGE: Record<string, string> = {
  critical: styles.badgeCritical, high: styles.badgeHigh, medium: styles.badgeMedium, low: styles.badgeLow,
};

export default function AssetsPage() {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? ASSETS : ASSETS.filter((a) => a.risk === filter);

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Assets & Data Inventory</h1>
          <p className={styles.pageSubtitle}>{ASSETS.length} assets tracked across your organization</p>
        </div>
        <div className={styles.pageActions}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}><Download size={14} /> Export CSV</button>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}><Plus size={14} /> Add Asset</button>
        </div>
      </div>

      {/* Summary */}
      <div className={`${styles.grid4} ${styles.mb15}`}>
        {[
          { label: "Total Assets", value: ASSETS.length },
          { label: "Critical Sensitivity", value: ASSETS.filter(a => a.sensitivity >= 5).length },
          { label: "High Risk", value: ASSETS.filter(a => a.risk === "high" || a.risk === "critical").length },
          { label: "PIPEDA Relevant", value: ASSETS.filter(a => a.relevant).length },
        ].map((s) => (
          <div key={s.label} className={styles.card}>
            <div className={styles.statCardLabel}>{s.label}</div>
            <div className={styles.statCardValue}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className={`${styles.tabs} ${styles.mb1}`}>
        {["all", "critical", "high", "medium", "low"].map((f) => (
          <button key={f} className={`${styles.tab} ${filter === f ? styles.tabActive : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All Assets" : f.charAt(0).toUpperCase() + f.slice(1) + " Risk"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className={styles.card} style={{ padding: 0, overflow: "hidden" }}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Sensitivity</th>
                <th>Risk Level</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: "#ddd7ea" }}>{a.name}</div>
                    <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.35)", fontFamily: "monospace" }}>{a.id}</div>
                  </td>
                  <td>
                    <div className={`${styles.flex} ${styles.gap04} ${styles.itemsCenter}`}>
                      <span style={{ color: "rgba(221,215,234,0.5)" }}>{TYPE_ICON[a.type]}</span>
                      <span className={styles.textSm}>{a.type}</span>
                    </div>
                  </td>
                  <td><span className={styles.textSm}>{a.owner}</span></td>
                  <td>
                    <div className={`${styles.flex} ${styles.gap04} ${styles.itemsCenter}`}>
                      <span style={{ color: SENS_COLOR(a.sensitivity), fontWeight: 700, fontSize: "0.85rem" }}>L{a.sensitivity}</span>
                      <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)" }}>{SENS_LABEL(a.sensitivity)}</span>
                    </div>
                  </td>
                  <td><span className={`${styles.badge} ${RISK_BADGE[a.risk]}`}>{a.risk}</span></td>
                  <td><span className={styles.textXs} style={{ color: "rgba(221,215,234,0.5)" }}>{a.notes}</span></td>
                  <td><button className={`${styles.btn} ${styles.btnGhost} ${styles.btnXs}`}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
