"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Circle, ChevronDown, ChevronRight, ShieldCheck, ShieldOff } from "lucide-react";
import type { Iso27001Data, Iso27001Phase, Iso27001Control } from "../queries";
import { updatePhaseStatus, updateSoaControl } from "./actions";
import styles from "../dashboard.module.css";

const STATUS_CONFIG = {
  not_started: { label: "Not started", color: "rgba(221,215,234,0.4)", Icon: Circle },
  in_progress:  { label: "In progress", color: "#f59e0b",               Icon: Clock },
  complete:     { label: "Complete",    color: "#22c55e",               Icon: CheckCircle2 },
};
const STATUS_CYCLE: Array<Iso27001Phase["status"]> = ["not_started", "in_progress", "complete"];

function PhaseRow({ phase, canEdit }: { phase: Iso27001Phase; canEdit: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(phase.status);
  const [isPending, startTransition] = useTransition();
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.Icon;

  function cycle() {
    if (!canEdit) return;
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length];
    setStatus(next);
    startTransition(async () => {
      await updatePhaseStatus(phase.id, next);
      router.refresh();
    });
  }

  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem 0",
        borderBottom: "1px solid rgba(117,76,190,0.08)",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <button onClick={cycle} disabled={!canEdit} style={{ background: "none", border: "none", cursor: canEdit ? "pointer" : "default", flexShrink: 0, lineHeight: 0, marginTop: "0.15rem" }}>
        <Icon size={18} color={cfg.color} />
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.85rem" }}>Phase {phase.id} — {phase.name}</span>
          <span style={{ fontSize: "0.72rem", color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
        </div>
        {phase.description && (
          <p className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)", margin: "0.2rem 0 0" }}>{phase.description}</p>
        )}
        {phase.id === 4 && (
          <a href="/dashboard/risks" className={styles.textXs} style={{ color: "#9b7de2", marginTop: "0.2rem", display: "inline-block" }}>
            → Open Risk Register
          </a>
        )}
      </div>
    </div>
  );
}

function SoaClause({ clause, controls, canEdit }: { clause: string; controls: Iso27001Control[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(controls);
  const [isPending, startTransition] = useTransition();

  const applicable = items.filter((c) => c.applicable).length;
  const implemented = items.filter((c) => c.applicable && c.implemented).length;

  function toggleApplicable(c: Iso27001Control) {
    if (!canEdit) return;
    const next = !c.applicable;
    setItems((prev) => prev.map((item) => item.id === c.id ? { ...item, applicable: next, implemented: next ? item.implemented : false } : item));
    startTransition(async () => { await updateSoaControl(c.id, next, next ? c.implemented : false); router.refresh(); });
  }

  function toggleImplemented(c: Iso27001Control) {
    if (!canEdit || !c.applicable) return;
    const next = !c.implemented;
    setItems((prev) => prev.map((item) => item.id === c.id ? { ...item, implemented: next } : item));
    startTransition(async () => { await updateSoaControl(c.id, c.applicable, next); router.refresh(); });
  }

  return (
    <div className={styles.card} style={{ marginBottom: "0.5rem" }}>
      <button
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        onClick={() => setOpen((o) => !o)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {open ? <ChevronDown size={14} color="#9b7de2" /> : <ChevronRight size={14} color="#9b7de2" />}
          <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.82rem" }}>{clause}</span>
        </div>
        <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>
          {implemented}/{applicable} implemented
        </span>
      </button>

      {open && (
        <div style={{ marginTop: "0.6rem" }}>
          {items.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.35rem 0", borderBottom: "1px solid rgba(117,76,190,0.06)" }}>
              <button onClick={() => toggleApplicable(c)} disabled={!canEdit} style={{ background: "none", border: "none", cursor: canEdit ? "pointer" : "default", lineHeight: 0, flexShrink: 0 }}>
                {c.applicable ? <ShieldCheck size={14} color="#754cbe" /> : <ShieldOff size={14} color="rgba(221,215,234,0.25)" />}
              </button>
              <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "rgba(221,215,234,0.4)", flexShrink: 0 }}>{c.id}</span>
              <span className={styles.textXs} style={{ flex: 1, color: c.applicable ? "#ddd7ea" : "rgba(221,215,234,0.35)" }}>{c.name}</span>
              {c.applicable && (
                <button onClick={() => toggleImplemented(c)} disabled={!canEdit} style={{ background: "none", border: "none", cursor: canEdit ? "pointer" : "default", lineHeight: 0, flexShrink: 0 }}>
                  <CheckCircle2 size={14} color={c.implemented ? "#22c55e" : "rgba(221,215,234,0.2)"} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Iso27001Client({ data }: { data: Iso27001Data }) {
  const canEdit = data.role === "admin";
  const [tab, setTab] = useState<"phases" | "soa">("phases");

  const implementedPct = data.controlsApplicable > 0
    ? Math.round((data.controlsImplemented / data.controlsApplicable) * 100)
    : 0;

  const clauses = Array.from(new Set(data.controls.map((c) => c.clause)));

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>ISO 27001 Tracker</h1>
          <p className={styles.pageSubtitle}>15-phase certification workflow + 114-control Statement of Applicability</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Phases Complete</span><div className={`${styles.statCardIcon} ${styles.iconPurple}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.75rem" }}>{data.phasesComplete}<span style={{ fontSize: "1rem", color: "rgba(221,215,234,0.4)" }}>/15</span></div>
          <div className={styles.statCardSub}>certification phases</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Controls Applicable</span><div className={`${styles.statCardIcon} ${styles.iconBlue}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.75rem" }}>{data.controlsApplicable}<span style={{ fontSize: "1rem", color: "rgba(221,215,234,0.4)" }}>/114</span></div>
          <div className={styles.statCardSub}>Annex A controls in scope</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Controls Implemented</span><div className={`${styles.statCardIcon} ${styles.iconGreen}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.75rem", color: implementedPct >= 75 ? "#22c55e" : "#f59e0b" }}>
            {implementedPct}%
          </div>
          <div className={styles.statCardSub}>{data.controlsImplemented}/{data.controlsApplicable} implemented</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Overall Progress</span><div className={`${styles.statCardIcon} ${styles.iconAmber}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.75rem" }}>{Math.round((data.phasesComplete / 15) * 100)}%</div>
          <div className={styles.statCardSub}>of 15 phases complete</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs} style={{ marginBottom: "1.25rem" }}>
        <button className={`${styles.tab} ${tab === "phases" ? styles.tabActive : ""}`} onClick={() => setTab("phases")}>Phase Tracker</button>
        <button className={`${styles.tab} ${tab === "soa" ? styles.tabActive : ""}`} onClick={() => setTab("soa")}>Statement of Applicability</button>
      </div>

      {tab === "phases" ? (
        <div className={styles.card}>
          {data.phases.map((phase) => (
            <PhaseRow key={phase.id} phase={phase} canEdit={canEdit} />
          ))}
        </div>
      ) : (
        <div>
          <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.5)", marginBottom: "0.75rem" }}>
            Click the shield icon to toggle applicability. Click the check to mark a control implemented.
          </p>
          {clauses.map((clause) => (
            <SoaClause
              key={clause}
              clause={clause}
              controls={data.controls.filter((c) => c.clause === clause)}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </>
  );
}
