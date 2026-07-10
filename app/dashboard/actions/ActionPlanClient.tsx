"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, Download, AlertTriangle, ChevronsUp, ChevronUp, Minus } from "lucide-react";
import type { ActionPlanData } from "../queries";
import { updateTaskStatus } from "./taskActions";
import styles from "../dashboard.module.css";

// Distinct color + icon per priority so High and Medium are unmistakable at a glance.
const PRIORITY_META: Record<string, { label: string; color: string; Icon: typeof AlertTriangle }> = {
  critical: { label: "Critical", color: "#ef4444", Icon: AlertTriangle },
  high:     { label: "High",     color: "#f97316", Icon: ChevronsUp },
  medium:   { label: "Medium",   color: "#eab308", Icon: ChevronUp },
  low:      { label: "Low",      color: "#22c55e", Icon: Minus },
};

function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority] ?? PRIORITY_META.medium;
  const Icon = m.Icon;
  return (
    <span
      className={styles.badge}
      style={{ background: `${m.color}1f`, color: m.color, border: `1px solid ${m.color}55`, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
    >
      <Icon size={11} /> {m.label}
    </span>
  );
}
const EFFORT_CLASS: Record<string, string> = {
  "quick-win": styles.badgeGreen, medium: styles.badgeInfo, complex: styles.badgeHigh,
};
const STATUS_CYCLE: Record<string, "open" | "in_progress" | "resolved"> = {
  open: "in_progress",
  "in_progress": "resolved",
  resolved: "open",
};
const FILTERS = ["all", "open", "in_progress", "resolved", "high", "medium"];

function exportCsv(tasks: ActionPlanData["tasks"]) {
  const headers = ["Title", "Description", "Category", "Priority", "Effort", "Status", "Due Date"];
  const rows = tasks.map((t) => [
    t.title,
    t.description ?? "",
    t.category,
    t.priority,
    t.effort,
    t.status,
    t.dueDate ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `action-plan-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ActionPlanClient({ data }: { data: ActionPlanData }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [tasks, setTasks] = useState(data.tasks);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolved = tasks.filter((t) => t.status === "resolved").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const open = tasks.filter((t) => t.status === "open").length;
  const pct = tasks.length > 0 ? Math.round((resolved / tasks.length) * 100) : 0;

  const filtered = filter === "all" ? tasks : tasks.filter(
    (t) => t.status === filter || t.priority === filter,
  );

  const bandColor = data.riskBand === "critical" ? "#ef4444" : data.riskBand === "high" ? "#f97316" : data.riskBand === "medium" ? "#f59e0b" : "#22c55e";

  function handleStatusClick(taskId: string, currentStatus: string) {
    if (data.role !== "admin" || pendingId) return;
    const nextStatus = STATUS_CYCLE[currentStatus] ?? "open";
    setPendingId(taskId);
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: nextStatus } : t));
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, nextStatus);
      if (result.error) {
        // Revert on failure
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: currentStatus } : t));
      } else if (nextStatus === "resolved" || currentStatus === "resolved") {
        // Resolving/reopening a task flips the underlying questionnaire answer
        // and rescores — refresh so the risk score badge reflects it.
        router.refresh();
      }
      setPendingId(null);
    });
  }

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
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => exportCsv(filtered)}><Download size={14} /> Export</button>
        </div>
      </div>

      {/* Progress */}
      <div className={`${styles.card} ${styles.mb15}`}>
        <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb1}`}>
          <div>
            <div style={{ fontWeight: 700, color: "#ddd7ea", fontSize: "1rem" }}>Overall Progress</div>
            <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)" }}>{resolved} of {tasks.length} tasks resolved</div>
          </div>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#c4a8f0" }}>{pct}%</span>
        </div>
        <div className={styles.progressBar} style={{ height: 10 }}>
          <div className={`${styles.progressFill} ${styles.fillPurple}`} style={{ width: `${pct}%` }} />
        </div>
        <div className={`${styles.flex} ${styles.gap1} ${styles.mt05}`}>
          {[["open", open, "#f87171"], ["in progress", inProgress, "#fbbf24"], ["resolved", resolved, "#4ade80"]].map(([label, count, color]) => (
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
            {f === "all" ? "All Tasks" : f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Priority legend */}
      <div className={`${styles.flex} ${styles.gap1}`} style={{ flexWrap: "wrap", margin: "0.5rem 0 1rem" }}>
        <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>Priority:</span>
        {(["critical", "high", "medium", "low"] as const).map((p) => {
          const m = PRIORITY_META[p];
          const Icon = m.Icon;
          return (
            <span key={p} className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.25rem", color: m.color, fontSize: "0.72rem", fontWeight: 600 }}>
              <Icon size={12} /> {m.label}
            </span>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No tasks match this filter.</p>
        </div>
      ) : (
        <div className={styles.flexCol} style={{ gap: "0.75rem" }}>
          {filtered.map((task) => {
            const isThisPending = pendingId === task.id;
            const borderColor = (PRIORITY_META[task.priority] ?? PRIORITY_META.medium).color;
            const canEdit = data.role === "admin";

            return (
              <div key={task.id} className={styles.card} style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}>
                <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb05}`}>
                  <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
                    <button
                      onClick={() => handleStatusClick(task.id, task.status)}
                      disabled={!canEdit || !!pendingId}
                      title={canEdit ? `Click to mark ${STATUS_CYCLE[task.status] ?? "open"}` : "View only"}
                      style={{ background: "none", border: "none", padding: 0, cursor: canEdit ? "pointer" : "default", lineHeight: 0 }}
                    >
                      {isThisPending
                        ? <Loader2 size={18} color="#f59e0b" style={{ animation: "spin 1s linear infinite" }} />
                        : task.status === "resolved"
                          ? <CheckCircle2 size={18} color="#22c55e" />
                          : task.status === "in_progress"
                            ? <CheckCircle2 size={18} color="#f59e0b" />
                            : <Circle size={18} color={canEdit ? "rgba(221,215,234,0.5)" : "rgba(221,215,234,0.25)"} />}
                    </button>
                    <span style={{
                      fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem",
                      textDecoration: task.status === "resolved" ? "line-through" : "none",
                      opacity: task.status === "resolved" ? 0.6 : 1,
                    }}>
                      {task.title}
                    </span>
                  </div>
                  <div className={`${styles.flex} ${styles.gap04}`}>
                    <PriorityBadge priority={task.priority} />
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
                  <button
                    onClick={() => handleStatusClick(task.id, task.status)}
                    disabled={!canEdit || !!pendingId}
                    title={canEdit ? `Click to mark ${STATUS_CYCLE[task.status] ?? "open"}` : undefined}
                    className={`${styles.badge} ${task.status === "resolved" ? styles.badgeGreen : task.status === "in_progress" ? styles.badgeMedium : styles.badgeGray}`}
                    style={{ cursor: canEdit ? "pointer" : "default", border: "none" }}
                  >
                    {task.status === "in_progress" ? "in progress" : task.status}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
