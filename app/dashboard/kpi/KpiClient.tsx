"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { KpiData } from "../queries";
import { saveBoardMeeting } from "./actions";
import styles from "../dashboard.module.css";

function ragColor(pct: number, target: number, higherIsBetter = true): string {
  const ratio = higherIsBetter ? pct / target : target / pct;
  if (ratio >= 1.1) return "#22c55e";
  if (ratio >= 0.9) return "#f59e0b";
  if (ratio >= 0.7) return "#f97316";
  return "#ef4444";
}

function KpiCard({ label, value, unit, target, description, framework }: {
  label: string; value: string | null; unit: string; target: string;
  description: string; framework: string;
}) {
  const isEmpty = value === null;
  return (
    <div className={styles.statCard}>
      <div className={styles.statCardTop}>
        <span className={styles.statCardLabel}>{label}</span>
        <span className={`${styles.badge} ${styles.badgePurple}`} style={{ fontSize: "0.62rem" }}>{framework}</span>
      </div>
      <div className={styles.statCardValue} style={{ fontSize: "1.75rem", color: isEmpty ? "rgba(221,215,234,0.3)" : undefined }}>
        {isEmpty ? "—" : value}{!isEmpty && <span style={{ fontSize: "0.9rem", color: "rgba(221,215,234,0.4)" }}>{unit}</span>}
      </div>
      <div className={styles.statCardSub}>{isEmpty ? "No data yet" : description}</div>
      <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.35)", marginTop: "0.25rem" }}>Target: {target}</div>
    </div>
  );
}

function AddMeetingModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [riskItem, setRiskItem] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Direct Supabase call via server action would be needed here, but for
    // simplicity we POST via the API or just use router.refresh after a native form.
    // For now, show a simple instruction since this needs a dedicated server action.
    onClose();
    router.refresh();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,8,20,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div className={styles.card} style={{ width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.cardTitleLg} style={{ marginBottom: "1rem" }}>Log Board Meeting</h2>
        <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.5)", marginBottom: "1rem" }}>
          Record a board or committee meeting and indicate whether enterprise risk was a documented agenda item.
        </p>
        <div className={styles.field} style={{ marginBottom: "0.75rem" }}>
          <label className={styles.fieldLabel}>Meeting date</label>
          <input type="date" className={styles.fieldInput} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", cursor: "pointer", fontSize: "0.85rem", color: "#ddd7ea" }}>
          <input type="checkbox" checked={riskItem} onChange={(e) => setRiskItem(e.target.checked)} />
          Enterprise risk was a documented agenda item
        </label>
        <div className={styles.field} style={{ marginBottom: "1rem" }}>
          <label className={styles.fieldLabel}>Notes (optional)</label>
          <input className={styles.fieldInput} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Q2 board review..." />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={onClose}>Cancel</button>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={isPending} onClick={() => {
            startTransition(async () => {
              const res = await saveBoardMeeting(date, riskItem, notes || undefined);
              if (!res.error) { onSaved(); onClose(); }
            });
          }}>
            {isPending ? "Saving…" : "Log Meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KpiClient({ data }: { data: KpiData }) {
  const router = useRouter();
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const canEdit = data.role === "admin";

  const maturityLabels = ["", "Initial", "Developing", "Defined", "Managed", "Optimized"];

  return (
    <>
      {showMeetingModal && (
        <AddMeetingModal
          onClose={() => setShowMeetingModal(false)}
          onSaved={() => router.refresh()}
        />
      )}

      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>KPI Dashboard</h1>
          <p className={styles.pageSubtitle}>Framework-aware key risk indicators — ISO 31000 + NIST NRF</p>
        </div>
        {canEdit && (
          <div className={styles.pageActions}>
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => setShowMeetingModal(true)}>
              <Plus size={14} /> Log Meeting
            </button>
          </div>
        )}
      </div>

      {/* ISO 31000 KPIs */}
      <p className={styles.sectionLabel} style={{ marginBottom: "0.75rem" }}>ISO 31000 — Leadership & Appetite</p>
      <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
        <KpiCard
          label="Board Risk Oversight Frequency"
          value={data.boardOversightFrequencyPct !== null ? String(data.boardOversightFrequencyPct) : null}
          unit="%"
          target="≥90% of meetings"
          description={`${data.riskInclusiveMeetings}/${data.totalBoardMeetings} meetings with risk agenda item`}
          framework="ISO 31000"
        />
        <KpiCard
          label="Risk Appetite Adherence"
          value={data.riskAppetiteAdherencePct !== null ? String(data.riskAppetiteAdherencePct) : null}
          unit="%"
          target="100% (all within $250K tolerance)"
          description={`${data.outsideAppetiteCount} of ${data.totalRiskEntries} entries exceed appetite`}
          framework="ISO 31000"
        />
      </div>

      {/* NIST NRF KPIs */}
      <p className={styles.sectionLabel} style={{ marginBottom: "0.75rem" }}>NIST NRF — Control Maturity & Detection</p>
      <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
        <KpiCard
          label="Control Maturity (avg)"
          value={data.avgMaturityLevel !== null ? String(data.avgMaturityLevel) : null}
          unit={data.avgMaturityLevel !== null ? ` — ${maturityLabels[Math.round(data.avgMaturityLevel)] ?? ""}` : ""}
          target="≥3.0 (Defined)"
          description="Average maturity level across compliance domains"
          framework="NIST NRF"
        />
        <KpiCard
          label="MTTD — Critical Incidents"
          value={data.mttdCriticalHours !== null ? String(data.mttdCriticalHours) : null}
          unit="h avg"
          target="≤4 hours"
          description="Mean time to detect critical-severity incidents"
          framework="NIST NRF"
        />
        <KpiCard
          label="MTTD — High Incidents"
          value={data.mttdHighHours !== null ? String(data.mttdHighHours) : null}
          unit="h avg"
          target="≤24 hours"
          description="Mean time to detect high-severity incidents"
          framework="NIST NRF"
        />
      </div>

      {/* Guidance for empty state */}
      {(data.totalBoardMeetings === 0 || data.totalRiskEntries === 0) && (
        <div className={styles.card} style={{ padding: "1.25rem" }}>
          <p className={styles.cardTitleLg} style={{ marginBottom: "0.5rem" }}>Populate your KPIs</p>
          <ul className={styles.textSm} style={{ color: "rgba(221,215,234,0.6)", lineHeight: 1.8, margin: 0, paddingLeft: "1.25rem" }}>
            {data.totalBoardMeetings === 0 && <li>Log board meetings using the "Log Meeting" button to populate Board Risk Oversight Frequency.</li>}
            {data.totalRiskEntries === 0 && <li>Add risk entries in the <a href="/dashboard/risks" style={{ color: "#9b7de2" }}>Risk Register</a> to see Risk Appetite Adherence.</li>}
            {data.mttdCriticalHours === null && <li>Log security incidents (with occurred_at and detected_at timestamps) via the database to populate MTTD metrics.</li>}
          </ul>
        </div>
      )}
    </>
  );
}
