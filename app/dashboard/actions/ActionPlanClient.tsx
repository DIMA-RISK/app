"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Download } from "lucide-react";
import type { ActionPlanData } from "../queries";
import styles from "../dashboard.module.css";

const PRIORITY_CLASS: Record<string, string> = {
  critical: styles.badgeCritical, high: styles.badgeHigh, medium: styles.badgeMedium, low: styles.badgeLow,
};
const EFFORT_CLASS: Record<string, string> = {
  "quick-win": styles.badgeGreen, medium: styles.badgeInfo, complex: styles.badgeHigh,
};
const FILTERS = ["all", "open", "in-progress", "resolved", "high", "medium"];

export default function ActionPlanClient({ data }: { data: ActionPlanData }) {
  const [filter, setFilter] = useState("all");

  const resolved = data.tasks.filter((t) => t.status === "resolved").length;
  const inProgress = data.tasks.filter((t) => t.status === "in-progress").length;
  const open = data.tasks.filter((t) => t.status === "open").length;
  const pct = data.tasks.length > 0 ? Math.round((resolved / data.tasks.length) * 100) : 0;

  const filtered = filter === "all" ? data.tasks : data.tasks.filter(
    (t) => t.status === filter || t.priority === filter
  );

  const bandColor = data.riskBand === "critical" ? "#ef4444" : data.riskBand === "high" ? "#f97316" : data.riskBand === "medium" ? "#f59e0b" : "#22c55e";

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Action Plan</h1>
          <p className={styles.pageSubtitle}>Prioritized remediation tasks based on your compliance assessment</p>
        </div>
        <div className={styles.pageActions}>
          <span className={`${styles.badge} ${styles.badgePurple}`} style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}>
            Risk Score: <strong style={{ color: bandColor }}>{data.riskScore}</strong>
          </span>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}><Download size={14} /> Export</button>
        </div>
      </div>

      {/* Progress */}
      <div className={`${styles.card} ${styles.mb15}`}>
        <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb1}`}>
          <div>
            <div style={{ fontWeight: 700, color: "#ddd7ea", fontSize: "1rem" }}>Overall Progress</div>
            <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)" }}>{resolved} of {data.tasks.length} tasks resolved</div>
          </div>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#c4a8f0" }}>{pct}%</span>
        </div>
        <div className={styles.progressBar} style={{ height: 10 }}>
          <div className={`${styles.progressFill} ${styles.fillPurple}`} style={{ width: `${pct}%` }} />
        </div>
        <div className={`${styles.flex} ${styles.gap1} ${styles.mt05}`}>
          {[["open", open, "#f87171"], ["in-progress", inProgress, "#fbbf24"], ["resolved", resolved, "#4ade80"]].map(([label, count, color]) => (
            <span key={label as string} className={styles.textXs} style={{ color: color as string }}>
              ● {count} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className={styles.tabs}>
        {FILTERS.map((f) => (
          <button key={f} className={`${styles.tab} ${filter === f ? styles.tabActive : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All Tasks" : f.charAt(0).toUpperCase() + f.slice(1).replace("-", " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No tasks match this filter.</p>
        </div>
      ) : (
        <div className={styles.flexCol} style={{ gap: "0.75rem" }}>
          {filtered.map((task) => {
            const borderColor = task.priority === "critical" ? "#ef4444" : task.priority === "high" ? "#f97316" : "#f59e0b";
            return (
              <div key={task.id} className={styles.card} style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}>
                <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb05}`}>
                  <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
                    {task.status === "resolved"
                      ? <CheckCircle2 size={18} color="#22c55e" />
                      : task.status === "in-progress"
                        ? <CheckCircle2 size={18} color="#f59e0b" />
                        : <Circle size={18} color="rgba(221,215,234,0.3)" />}
                    <span style={{
                      fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem",
                      textDecoration: task.status === "resolved" ? "line-through" : "none",
                      opacity: task.status === "resolved" ? 0.6 : 1,
                    }}>
                      {task.title}
                    </span>
                  </div>
                  <div className={`${styles.flex} ${styles.gap04}`}>
                    <span className={`${styles.badge} ${PRIORITY_CLASS[task.priority] ?? styles.badgeMedium}`}>{task.priority}</span>
                    <span className={`${styles.badge} ${EFFORT_CLASS[task.effort] ?? styles.badgeInfo}`}>{task.effort}</span>
                  </div>
                </div>
                {task.description && (
                  <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.6)", margin: "0.3rem 0 0.6rem 2rem" }}>
                    {task.description}
                  </p>
                )}
                <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ marginLeft: "2rem" }}>
                  <div className={`${styles.flex} ${styles.gap04}`}>
                    <span className={`${styles.badge} ${styles.badgePurple}`}>{task.category}</span>
                    {task.dueDate && (
                      <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>
                        Due: {new Date(task.dueDate).toLocaleDateString("en-CA")}
                      </span>
                    )}
                  </div>
                  <span className={`${styles.badge} ${task.status === "resolved" ? styles.badgeGreen : task.status === "in-progress" ? styles.badgeMedium : styles.badgeGray}`}>
                    {task.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
