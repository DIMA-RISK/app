"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Upload, Download } from "lucide-react";
import styles from "../dashboard.module.css";

const TASKS = [
  { id: "ACT-001", title: "Appoint a Privacy Officer", why: "PIPEDA requires a designated individual accountable for compliance.", framework: "PIPEDA", effort: "medium", priority: "critical", deadline: "Jun 1, 2026", status: "open", reduction: 12 },
  { id: "ACT-002", title: "Create a Data Retention Policy", why: "Without a written policy, you can't demonstrate compliance with PIPEDA's retention principle.", framework: "PIPEDA", effort: "medium", priority: "critical", deadline: "Jun 15, 2026", status: "open", reduction: 10 },
  { id: "ACT-003", title: "Enable MFA for all admin accounts", why: "Weak access controls are the #1 cause of healthcare data breaches.", framework: "PIPEDA", effort: "quick-win", priority: "high", deadline: "May 30, 2026", status: "in-progress", reduction: 8 },
  { id: "ACT-004", title: "Encrypt all portable storage devices", why: "Portable devices containing PHI must be encrypted to prevent unauthorized access.", framework: "PIPEDA", effort: "complex", priority: "high", deadline: "Jun 20, 2026", status: "open", reduction: 7 },
  { id: "ACT-005", title: "Document a Breach Response Plan", why: "PIPEDA mandates breach notification procedures with specific timelines.", framework: "PIPEDA", effort: "medium", priority: "high", deadline: "Jun 20, 2026", status: "open", reduction: 7 },
  { id: "ACT-006", title: "Sign DPAs with all 3 vendors", why: "Vendors handling personal data must have contractual obligations in place.", framework: "PIPEDA", effort: "quick-win", priority: "high", deadline: "Jun 30, 2026", status: "in-progress", reduction: 6 },
  { id: "ACT-007", title: "Run privacy awareness training", why: "Staff who handle personal data must understand their obligations.", framework: "PIPEDA", effort: "medium", priority: "medium", deadline: "Jul 1, 2026", status: "open", reduction: 5 },
  { id: "ACT-008", title: "Enable audit logging for patient records", why: "Access logs are required to detect and investigate privacy incidents.", framework: "PIPEDA", effort: "complex", priority: "medium", deadline: "Jun 5, 2026", status: "in-progress", reduction: 5 },
  { id: "ACT-009", title: "Update website privacy policy", why: "Privacy notices must reflect current data collection and usage practices.", framework: "PIPEDA", effort: "quick-win", priority: "medium", deadline: "May 28, 2026", status: "resolved", reduction: 4 },
  { id: "ACT-010", title: "Encrypt cloud backups", why: "Data at rest in cloud environments must be protected.", framework: "PIPEDA", effort: "quick-win", priority: "medium", deadline: "Jun 10, 2026", status: "open", reduction: 4 },
];

const PRIORITY_BADGE: Record<string, string> = {
  critical: styles.badgeCritical, high: styles.badgeHigh,
  medium: styles.badgeMedium, low: styles.badgeLow,
};
const EFFORT_BADGE: Record<string, string> = {
  "quick-win": styles.badgeGreen, medium: styles.badgeInfo, complex: styles.badgeHigh,
};

const resolved = TASKS.filter((t) => t.status === "resolved").length;
const pct = Math.round((resolved / TASKS.length) * 100);

export default function ActionsPage() {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? TASKS : TASKS.filter((t) => t.status === filter || t.priority === filter);

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Action Plan</h1>
          <p className={styles.pageSubtitle}>Prioritized remediation tasks to improve your compliance posture</p>
        </div>
        <div className={styles.pageActions}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}><Download size={14} /> Export</button>
        </div>
      </div>

      {/* Progress */}
      <div className={`${styles.card} ${styles.mb15}`}>
        <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb1}`}>
          <div>
            <div style={{ fontWeight: 700, color: "#ddd7ea", fontSize: "1rem" }}>Overall Progress</div>
            <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)" }}>{resolved} of {TASKS.length} tasks completed</div>
          </div>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#c4a8f0" }}>{pct}%</span>
        </div>
        <div className={styles.progressBar} style={{ height: 10 }}>
          <div className={`${styles.progressFill} ${styles.fillPurple}`} style={{ width: `${pct}%` }} />
        </div>
        <div className={`${styles.flex} ${styles.gap1} ${styles.mt05}`}>
          {[["open", TASKS.filter(t=>t.status==="open").length, "#f87171"],
            ["in-progress", TASKS.filter(t=>t.status==="in-progress").length, "#fbbf24"],
            ["resolved", resolved, "#4ade80"]
          ].map(([label, count, color]) => (
            <span key={label as string} className={styles.textXs} style={{ color: color as string }}>
              ● {count} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className={styles.tabs}>
        {["all","open","in-progress","resolved","critical","high","medium"].map((f) => (
          <button key={f} className={`${styles.tab} ${filter===f?styles.tabActive:""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All Tasks" : f.charAt(0).toUpperCase() + f.slice(1).replace("-"," ")}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className={styles.flexCol} style={{ gap: "0.75rem" }}>
        {filtered.map((task) => (
          <div key={task.id} className={styles.card} style={{
            borderLeftWidth: 3,
            borderLeftColor: task.priority === "critical" ? "#ef4444" : task.priority === "high" ? "#f97316" : "#f59e0b",
          }}>
            <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb05}`}>
              <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
                {task.status === "resolved"
                  ? <CheckCircle2 size={18} color="#22c55e" />
                  : <Circle size={18} color="rgba(221,215,234,0.3)" />}
                <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem",
                  textDecoration: task.status === "resolved" ? "line-through" : "none",
                  opacity: task.status === "resolved" ? 0.6 : 1 }}>
                  {task.title}
                </span>
              </div>
              <div className={`${styles.flex} ${styles.gap04}`}>
                <span className={`${styles.badge} ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</span>
                <span className={`${styles.badge} ${EFFORT_BADGE[task.effort]}`}>{task.effort}</span>
              </div>
            </div>
            <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.6)", margin: "0.3rem 0 0.6rem 2rem" }}>{task.why}</p>
            <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ marginLeft: "2rem" }}>
              <div className={`${styles.flex} ${styles.gap04}`}>
                <span className={`${styles.badge} ${styles.badgePurple}`}>{task.framework}</span>
                <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>Due: {task.deadline}</span>
                <span className={styles.textXs} style={{ color: "#22c55e" }}>↓ {task.reduction}pts risk</span>
              </div>
              <div className={`${styles.flex} ${styles.gap04}`}>
                <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnXs}`}><Upload size={11} /> Evidence</button>
                <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnXs}`}>
                  {task.status === "resolved" ? "Reopen" : task.status === "in-progress" ? "Mark Done" : "Start"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
