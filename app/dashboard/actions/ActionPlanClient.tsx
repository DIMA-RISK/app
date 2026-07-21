"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, Download, User, Send, X } from "lucide-react";
import type { ActionPlanData, RoadmapTask } from "../queries";
import { updateTaskStatus, updateTaskOwner, escalateToOwner } from "./taskActions";
import { SeverityBadge, SeverityLegend, SEVERITY_META, LabeledBadge, EFFORT_COLOR, STATUS_COLOR, STATUS_LABEL } from "../_components/SeverityBadge";
import styles from "../dashboard.module.css";
const STATUS_CYCLE: Record<string, "open" | "in_progress" | "resolved"> = {
  open: "in_progress",
  "in_progress": "resolved",
  resolved: "open",
};
const FILTERS = ["all", "open", "in_progress", "resolved", "high", "medium"];

function fmtCurrency(n: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function relativeUpdate(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// Assign the asset owner (name + email) for a task.
function OwnerModal({ task, onClose, onSaved }: { task: RoadmapTask; onClose: () => void; onSaved: (name: string, email: string) => void }) {
  const [name, setName] = useState(task.owner ?? "");
  const [email, setEmail] = useState(task.ownerEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,8,20,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div className={styles.card} style={{ width: "100%", maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb1}`}>
          <h2 className={styles.cardTitleLg}>Assign asset owner</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(221,215,234,0.5)", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <p className={styles.textXs} style={{ color: "rgba(221,215,234,0.5)", marginBottom: "0.85rem" }}>{task.title}</p>
        <div className={styles.field} style={{ marginBottom: "0.75rem" }}>
          <label className={styles.fieldLabel}>Owner name</label>
          <input className={styles.fieldInput} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Doe, CISO" />
        </div>
        <div className={styles.field} style={{ marginBottom: "1rem" }}>
          <label className={styles.fieldLabel}>Owner email <span style={{ color: "rgba(221,215,234,0.4)" }}>(for escalation)</span></label>
          <input type="email" className={styles.fieldInput} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@org.com" />
        </div>
        {error && <div style={{ padding: "0.5rem 0.8rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: "0.78rem", color: "#f87171", marginBottom: "0.85rem" }}>{error}</div>}
        <div className={`${styles.flex} ${styles.gap08}`} style={{ justifyContent: "flex-end" }}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={onClose}>Cancel</button>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={pending} onClick={() => {
            startTransition(async () => {
              const res = await updateTaskOwner(task.id, name, email);
              if (res.error) setError(res.error); else onSaved(name.trim(), email.trim());
            });
          }}>{pending ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function exportCsv(tasks: ActionPlanData["tasks"]) {
  const headers = ["Title", "Description", "Category", "Threat", "Annual Exposure", "Priority Score", "Source", "Priority", "Effort", "Status", "Owner", "Due Date"];
  const rows = tasks.map((t) => [
    t.title,
    t.description ?? "",
    t.category,
    t.threat,
    String(t.gapExposure),
    String(t.priorityScore),
    t.source === "scan" ? "Network Scan" : "Questionnaire",
    t.priority,
    t.effort,
    t.status,
    t.owner ?? "",
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

  const [ownerTask, setOwnerTask] = useState<RoadmapTask | null>(null);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleEscalate(task: RoadmapTask) {
    if (!task.ownerEmail) { setOwnerTask(task); return; } // no email yet → open assign first
    setEscalatingId(task.id);
    startTransition(async () => {
      const res = await escalateToOwner(task.id);
      showToast(res.error ? `⚠ ${res.error}` : `✓ Escalation sent to ${task.owner ?? task.ownerEmail}`);
      setEscalatingId(null);
    });
  }

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
    const task = tasks.find((t) => t.id === taskId);
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, nextStatus);
      if (result.error) {
        // Revert on failure
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: currentStatus } : t));
      } else {
        // ROI anchor moment (spec Layer 2): closing a gap eliminates its annual
        // exposure — show the dollar figure, "what fixing it saves."
        if (nextStatus === "resolved" && currentStatus !== "resolved" && task && task.gapExposure > 0) {
          showToast(`✓ ${task.title} closed — ${fmtCurrency(task.gapExposure, data.currency)} in annual exposure eliminated`);
        }
        if (nextStatus === "resolved" || currentStatus === "resolved") {
          // Resolving/reopening flips the underlying questionnaire answer and
          // rescores — refresh so the risk score + exposure reflect it.
          router.refresh();
        }
      }
      setPendingId(null);
    });
  }

  return (
    <>
      {toast && <div className={styles.toast}>{toast}</div>}
      {ownerTask && (
        <OwnerModal
          task={ownerTask}
          onClose={() => setOwnerTask(null)}
          onSaved={(name, email) => {
            setTasks((prev) => prev.map((t) => t.id === ownerTask.id ? { ...t, owner: name || null, ownerEmail: email || null, updatedAt: new Date().toISOString() } : t));
            setOwnerTask(null);
          }}
        />
      )}

      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Action Plan</h1>
          <p className={styles.pageSubtitle}>Ranked by annual dollar exposure (ALE × gap × sensitivity), highest-impact gaps first</p>
        </div>
        <div className={styles.pageActions}>
          {data.openExposure > 0 && (
            <span className={`${styles.badge}`} style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem", background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
              title="Sum of annual loss exposure across all open gaps (ALE × gap% × data-sensitivity weight). Closing a gap eliminates its share.">
              Open exposure: <strong>{fmtCurrency(data.openExposure, data.currency)}/yr</strong>
            </span>
          )}
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
      <div style={{ margin: "0.5rem 0 1rem" }}>
        <SeverityLegend note="priority of the remediation task" />
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No tasks match this filter.</p>
        </div>
      ) : (
        <div className={styles.flexCol} style={{ gap: "0.75rem" }}>
          {filtered.map((task) => {
            const isThisPending = pendingId === task.id;
            const borderColor = (SEVERITY_META[task.priority] ?? SEVERITY_META.medium).color;
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
                  <div className={`${styles.flex} ${styles.gap04}`} style={{ flexWrap: "wrap" }}>
                    {task.gapExposure > 0 && (
                      <span className={styles.badge}
                        title={`Annual loss exposure for this gap — ${task.threat}. ALE × gap% × sensitivity. Priority score ${task.priorityScore} sets its rank.`}
                        style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", cursor: "help" }}>
                        {fmtCurrency(task.gapExposure, data.currency)}/yr
                      </span>
                    )}
                    <SeverityBadge level={task.priority} dimension="Priority" title="Priority of this remediation task" />
                    <LabeledBadge dimension="Effort" value={task.effort === "quick-win" ? "Quick Win" : task.effort.charAt(0).toUpperCase() + task.effort.slice(1)} color={EFFORT_COLOR[task.effort] ?? "#94a3b8"} />
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
                    <span
                      className={styles.badge}
                      title={task.source === "scan" ? "Generated from a network-scan finding" : "Generated from a questionnaire answer"}
                      style={{ background: "rgba(96,165,250,0.12)", color: "#93c5fd", border: "1px solid rgba(96,165,250,0.28)" }}
                    >
                      From: {task.source === "scan" ? "Network Scan" : "Questionnaire"}
                    </span>
                    {task.kpi && (() => {
                      const kc = (SEVERITY_META[task.kpi.priority] ?? SEVERITY_META.medium).color;
                      return (
                        <span
                          className={styles.badge}
                          title={`Blocks a ${task.kpi.priority}-priority KPI: "${task.kpi.name}"${task.kpi.owner ? ` (owner: ${task.kpi.owner})` : ""}. Ranked above same-severity tasks linked to lower-priority KPIs.`}
                          style={{ background: `${kc}1f`, color: kc, border: `1px solid ${kc}55`, cursor: "help" }}
                        >
                          Blocks KPI: {task.kpi.name}
                        </span>
                      );
                    })()}
                    {task.dueDate && (
                      <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>
                        Due: {new Date(task.dueDate).toLocaleDateString("en-CA")}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleStatusClick(task.id, task.status)}
                    disabled={!canEdit || !!pendingId}
                    title={canEdit ? `Status: ${STATUS_LABEL[task.status] ?? task.status} — click to mark ${STATUS_LABEL[STATUS_CYCLE[task.status]] ?? "open"}` : `Status: ${STATUS_LABEL[task.status] ?? task.status}`}
                    className={styles.badge}
                    style={{
                      cursor: canEdit ? "pointer" : "default", border: `1px solid ${(STATUS_COLOR[task.status] ?? "#94a3b8")}44`,
                      background: `${STATUS_COLOR[task.status] ?? "#94a3b8"}1f`, color: STATUS_COLOR[task.status] ?? "#94a3b8",
                      display: "inline-flex", alignItems: "center", gap: "0.25rem",
                    }}
                  >
                    <span style={{ opacity: 0.7, fontWeight: 500 }}>Status:</span> {STATUS_LABEL[task.status] ?? task.status}
                  </button>
                </div>

                {/* Asset owner + last-update + escalation (spec §4) */}
                <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ marginLeft: "2rem", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid rgba(117,76,190,0.07)", flexWrap: "wrap", gap: "0.4rem" }}>
                  <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <User size={12} />
                    Asset owner: <strong style={{ color: task.owner ? "#c4a8f0" : "rgba(221,215,234,0.4)", fontWeight: 600 }}>{task.owner ?? "Unassigned"}</strong>
                    <span style={{ opacity: 0.6 }}>· Last update: {relativeUpdate(task.updatedAt)}</span>
                  </span>
                  {canEdit && (
                    <div className={`${styles.flex} ${styles.gap04}`}>
                      <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnXs}`} onClick={() => setOwnerTask(task)}>
                        {task.owner ? "Reassign" : "Assign owner"}
                      </button>
                      <button
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnXs}`}
                        disabled={escalatingId === task.id}
                        title={task.ownerEmail ? `Email an escalation notice to ${task.ownerEmail}` : "Assign an owner email first"}
                        onClick={() => handleEscalate(task)}
                      >
                        {escalatingId === task.id ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={12} />} Escalate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
