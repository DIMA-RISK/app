"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { CriticalControlItem } from "../queries";
import { setCriticalControl } from "./actions";
import styles from "../dashboard.module.css";

const FRAMEWORK_LABELS: Record<string, string> = {
  iso27001: "ISO 27001",
  gdpr: "GDPR",
  hipaa: "HIPAA",
  pipeda: "PIPEDA",
};

const GAP_BAND: (pct: number) => { label: string; color: string } = (pct) => {
  if (pct <= 25) return { label: "Well-controlled", color: "#22c55e" };
  if (pct <= 50) return { label: "Moderate risk", color: "#f59e0b" };
  if (pct <= 75) return { label: "High risk", color: "#f97316" };
  return { label: "Critical risk", color: "#ef4444" };
};

export default function CriticalControlsClient({
  controls,
  canEdit,
}: {
  controls: CriticalControlItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(controls);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const frameworks = Array.from(new Set(items.map((c) => c.frameworkId)));

  function toggle(controlId: number, current: boolean) {
    if (!canEdit || pendingId !== null) return;
    const next = !current;
    setPendingId(controlId);
    setItems((prev) => prev.map((c) => c.id === controlId ? { ...c, present: next } : c));
    startTransition(async () => {
      const res = await setCriticalControl(controlId, next);
      if (res.error) {
        setItems((prev) => prev.map((c) => c.id === controlId ? { ...c, present: current } : c));
      } else {
        router.refresh();
      }
      setPendingId(null);
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitleLg}>Critical Controls</h2>
        <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)" }}>
          Feeds the 4-framework Compliance Gap Risk formula
        </span>
      </div>

      {/* Clarify what the per-framework "risk" band means here: it rates the
          NON-COMPLIANCE GAP (share of required controls still missing), which is
          a different axis than a remediation task's priority. */}
      <div
        className={styles.textXs}
        title="Gap % = share of this framework's critical controls not yet in place. The band rates how severe that non-compliance gap is — not the urgency of any single task."
        style={{ color: "rgba(221,215,234,0.4)", marginBottom: "0.9rem", cursor: "help" }}
      >
        Each band rates a framework&rsquo;s <strong style={{ color: "rgba(221,215,234,0.6)" }}>non-compliance gap</strong> — the share of required controls still missing:{" "}
        <span style={{ color: "#22c55e" }}>0–25% Well-controlled</span> ·{" "}
        <span style={{ color: "#f59e0b" }}>26–50% Moderate</span> ·{" "}
        <span style={{ color: "#f97316" }}>51–75% High</span> ·{" "}
        <span style={{ color: "#ef4444" }}>76–100% Critical</span>
      </div>

      <div className={styles.grid2} style={{ gap: "1.25rem" }}>
        {frameworks.map((fw) => {
          const fwControls = items.filter((c) => c.frameworkId === fw);
          const missing = fwControls.filter((c) => !c.present).length;
          const gapPct = fwControls.length > 0 ? Math.round((missing / fwControls.length) * 100) : 0;
          const band = GAP_BAND(gapPct);

          return (
            <div key={fw} style={{ background: "rgba(0,2,18,0.35)", border: "1px solid rgba(117,76,190,0.15)", borderRadius: 10, padding: "0.9rem 1rem" }}>
              <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ marginBottom: "0.6rem" }}>
                <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.85rem" }}>{FRAMEWORK_LABELS[fw] ?? fw}</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: band.color }}>
                  {gapPct}% gap — {band.label}
                </span>
              </div>

              <div className={styles.flexCol} style={{ gap: "0.4rem" }}>
                {fwControls.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id, c.present)}
                    disabled={!canEdit || pendingId !== null}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.6rem",
                      background: "none", border: "none", cursor: canEdit ? "pointer" : "default",
                      padding: "0.3rem 0", textAlign: "left", width: "100%",
                      opacity: pendingId === c.id ? 0.5 : 1,
                    }}
                  >
                    {c.present
                      ? <ShieldCheck size={16} color="#22c55e" style={{ flexShrink: 0 }} />
                      : <ShieldAlert size={16} color="#ef4444" style={{ flexShrink: 0 }} />}
                    <span style={{ fontSize: "0.8rem" }}>
                      <span style={{ color: "rgba(221,215,234,0.5)", fontFamily: "monospace", marginRight: "0.4rem" }}>{c.controlRef}</span>
                      <span style={{ color: c.present ? "#ddd7ea" : "rgba(221,215,234,0.55)" }}>{c.controlName}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!canEdit && (
        <p className={styles.textXs} style={{ color: "rgba(221,215,234,0.35)", marginTop: "0.75rem" }}>
          View-only — contact your admin to update critical control status.
        </p>
      )}
    </div>
  );
}
