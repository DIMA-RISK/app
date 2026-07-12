"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit2, X, Target } from "lucide-react";
import type { KpiData, KpiDefinition } from "../queries";
import {
  saveBoardMeeting, createKpiDefinition, updateKpiDefinition, deleteKpiDefinition,
  type KpiDefinitionInput, type KpiPriority, type ControlCategory,
} from "./actions";
import { SeverityBadge } from "../_components/SeverityBadge";
import styles from "../dashboard.module.css";

// "All frameworks" (null) plus the frameworks the app knows about. Stored value
// is matched case-insensitively against the org's assessment framework id/name.
const KPI_FRAMEWORK_OPTIONS = ["All frameworks", "HIPAA", "PIPEDA", "GDPR", "ISO 27001", "ISO 31000", "NIST NRF"];
const KPI_CATEGORY_OPTIONS: { value: ControlCategory | ""; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "technical", label: "Technical" },
  { value: "administrative", label: "Administrative" },
  { value: "physical", label: "Physical" },
];
const KPI_PRIORITY_OPTIONS: KpiPriority[] = ["critical", "high", "medium", "low"];

function KpiDefinitionModal({ definition, onClose, onSaved }: {
  definition: KpiDefinition | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(definition?.name ?? "");
  const [frameworkTag, setFrameworkTag] = useState(definition?.frameworkTag ?? "All frameworks");
  const [controlCategory, setControlCategory] = useState<ControlCategory | "">(definition?.controlCategory ?? "");
  const [priority, setPriority] = useState<KpiPriority>(definition?.priority ?? "medium");
  const [executiveOwner, setExecutiveOwner] = useState(definition?.executiveOwner ?? "");
  const [target, setTarget] = useState(definition?.target ?? "");
  const [description, setDescription] = useState(definition?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input: KpiDefinitionInput = {
      name: name.trim(),
      framework_tag: frameworkTag === "All frameworks" ? null : frameworkTag,
      control_category: controlCategory || null,
      priority,
      executive_owner: executiveOwner.trim() || null,
      target: target.trim() || null,
      description: description.trim() || null,
    };
    startTransition(async () => {
      const res = definition ? await updateKpiDefinition(definition.id, input) : await createKpiDefinition(input);
      if (res.error) { setError(res.error); return; }
      onSaved();
      onClose();
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,8,20,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", overflowY: "auto" }} onClick={onClose}>
      <div className={styles.card} style={{ width: "100%", maxWidth: 520, margin: "1rem", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb1}`}>
          <h2 className={styles.cardTitleLg}>{definition ? "Edit KPI" : "Define KPI"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(221,215,234,0.5)", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.field} style={{ marginBottom: "0.85rem" }}>
            <label className={styles.fieldLabel}>KPI name</label>
            <input className={styles.fieldInput} value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Access Review Completion" />
          </div>
          <div className={styles.grid2} style={{ marginBottom: "0.85rem" }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Priority of implementation</label>
              <select className={styles.fieldSelect} value={priority} onChange={(e) => setPriority(e.target.value as KpiPriority)}>
                {KPI_PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Executive owner</label>
              <input className={styles.fieldInput} value={executiveOwner} onChange={(e) => setExecutiveOwner(e.target.value)} placeholder="e.g. CISO, CEO" />
            </div>
          </div>
          <div className={styles.grid2} style={{ marginBottom: "0.85rem" }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Framework</label>
              <select className={styles.fieldSelect} value={frameworkTag} onChange={(e) => setFrameworkTag(e.target.value)}>
                {KPI_FRAMEWORK_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Control category</label>
              <select className={styles.fieldSelect} value={controlCategory} onChange={(e) => setControlCategory(e.target.value as ControlCategory | "")}>
                {KPI_CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.field} style={{ marginBottom: "0.85rem" }}>
            <label className={styles.fieldLabel}>Target <span style={{ color: "rgba(221,215,234,0.4)" }}>(optional)</span></label>
            <input className={styles.fieldInput} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. ≥95% within 30 days" />
          </div>
          <div className={styles.field} style={{ marginBottom: "0.85rem" }}>
            <label className={styles.fieldLabel}>Description <span style={{ color: "rgba(221,215,234,0.4)" }}>(optional)</span></label>
            <input className={styles.fieldInput} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this KPI measures and why it matters" />
          </div>
          <p className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)", marginBottom: "0.85rem", lineHeight: 1.5 }}>
            Remediation tasks matching this framework + category inherit this KPI. Its priority breaks ties within the same severity tier on the Action Plan.
          </p>
          {error && (
            <div style={{ padding: "0.6rem 0.9rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: "0.8rem", color: "#f87171", marginBottom: "1rem" }}>{error}</div>
          )}
          <div className={`${styles.flex} ${styles.gap08}`} style={{ justifyContent: "flex-end" }}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={onClose}>Cancel</button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={pending}>
              {pending ? "Saving…" : definition ? "Save Changes" : "Define KPI"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// RAG bands per concept manual §3: ≥110% Exceeds (green), 90–110% Meets (lime),
// 70–89% Below (amber), <70% Critical (red). ragPct = achievement vs target.
function ragBand(ragPct: number): { color: string; label: string } {
  if (ragPct >= 110) return { color: "#22c55e", label: "Exceeds" };
  if (ragPct >= 90) return { color: "#84cc16", label: "Meets" };
  if (ragPct >= 70) return { color: "#f59e0b", label: "Below" };
  return { color: "#ef4444", label: "Critical" };
}

function KpiCard({ label, value, unit, target, description, framework, ragPct }: {
  label: string; value: string | null; unit: string; target: string;
  description: string; framework: string; ragPct: number | null;
}) {
  const isEmpty = value === null;
  const rag = ragPct !== null ? ragBand(ragPct) : null;
  return (
    <div className={styles.statCard}>
      <div className={styles.statCardTop}>
        <span className={styles.statCardLabel}>{label}</span>
        <span className={`${styles.badge} ${styles.badgePurple}`} style={{ fontSize: "0.62rem" }}>{framework}</span>
      </div>
      <div className={styles.statCardValue} style={{ fontSize: "1.75rem", color: isEmpty ? "rgba(221,215,234,0.3)" : rag?.color }}>
        {isEmpty ? "—" : value}{!isEmpty && <span style={{ fontSize: "0.9rem", color: "rgba(221,215,234,0.4)" }}>{unit}</span>}
      </div>
      <div className={styles.statCardSub}>
        {rag && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: rag.color, marginRight: "0.4rem" }} />}
        {isEmpty ? "No data yet" : (rag ? `${rag.label} · ${description}` : description)}
      </div>
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
  const [kpiModal, setKpiModal] = useState<KpiDefinition | null | "new">(null);
  const [deletingKpiId, setDeletingKpiId] = useState<string | null>(null);
  const canEdit = data.role === "admin";

  async function handleDeleteKpi(id: string) {
    setDeletingKpiId(id);
    const res = await deleteKpiDefinition(id);
    if (!res.error) router.refresh();
    setDeletingKpiId(null);
  }

  const maturityLabels = ["", "Initial", "Developing", "Defined", "Managed", "Optimized"];

  // Framework-tag → KPI surfacing (EWNAF spec 2.2): show a KPI family only when
  // its framework tag appears on the org's risk entries. When no tags exist yet,
  // fall back to showing everything so a new org's dashboard isn't blank.
  const hasTags = data.activeFrameworks.length > 0;
  const showIso = !hasTags || data.activeFrameworks.includes("ISO 31000");
  const showNist = !hasTags || data.activeFrameworks.includes("NIST NRF");

  return (
    <>
      {showMeetingModal && (
        <AddMeetingModal
          onClose={() => setShowMeetingModal(false)}
          onSaved={() => router.refresh()}
        />
      )}

      {kpiModal !== null && (
        <KpiDefinitionModal
          definition={kpiModal === "new" ? null : kpiModal}
          onClose={() => setKpiModal(null)}
          onSaved={() => router.refresh()}
        />
      )}

      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>KPI Dashboard</h1>
          <p className={styles.pageSubtitle}>
            {hasTags
              ? `Surfaced by your risk register's framework tags: ${data.activeFrameworks.join(", ")}`
              : "Framework-aware KPIs — tag risk entries (ISO 31000, NIST NRF) to filter this view"}
          </p>
        </div>
        {canEdit && (
          <div className={styles.pageActions}>
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => setShowMeetingModal(true)}>
              <Plus size={14} /> Log Meeting
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={() => setKpiModal("new")}>
              <Target size={14} /> Define KPI
            </button>
          </div>
        )}
      </div>

      {/* KPI Definitions — manual KPIs that drive roadmap prioritization. Each
          task inheriting one of these is ranked (within its severity tier) by the
          KPI's priority-of-implementation. */}
      <div className={styles.card} style={{ marginBottom: "1.5rem" }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitleLg}>KPI Definitions</h2>
          <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)" }}>
            Drive Action Plan ranking — a task blocking a higher-priority KPI surfaces first within its severity tier
          </span>
        </div>
        {data.kpiDefinitions.length === 0 ? (
          <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.5)", margin: 0 }}>
            {canEdit
              ? "No KPIs defined yet. Click \"Define KPI\" to set a priority-of-implementation and executive owner — remediation tasks in the matching framework/category will inherit it and rank accordingly."
              : "No KPIs defined yet. Ask your admin to define KPIs to drive roadmap prioritization."}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>KPI</th>
                  <th>Priority</th>
                  <th>Framework</th>
                  <th>Category</th>
                  <th>Owner</th>
                  <th>Target</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {data.kpiDefinitions.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <div style={{ fontWeight: 500, color: "#ddd7ea" }}>{k.name}</div>
                      {k.description && <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>{k.description}</div>}
                    </td>
                    <td><SeverityBadge level={k.priority} title={`Priority of implementation: ${k.priority}`} /></td>
                    <td>{k.frameworkTag ?? "All"}</td>
                    <td>{k.controlCategory ? k.controlCategory.charAt(0).toUpperCase() + k.controlCategory.slice(1) : "All"}</td>
                    <td>{k.executiveOwner ?? "—"}</td>
                    <td className={styles.textXs} style={{ color: "rgba(221,215,234,0.55)" }}>{k.target ?? "—"}</td>
                    {canEdit && (
                      <td>
                        <div className={styles.flex} style={{ gap: "0.4rem" }}>
                          <button onClick={() => setKpiModal(k)} style={{ background: "none", border: "none", color: "#9b7de2", cursor: "pointer" }}><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteKpi(k.id)} disabled={deletingKpiId === k.id} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ISO 31000 KPIs — surfaced when an entry is tagged ISO 31000 */}
      {showIso && (
        <>
          <p className={styles.sectionLabel} style={{ marginBottom: "0.75rem" }}>ISO 31000 — Leadership & Appetite</p>
          <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
            <KpiCard
              label="Board Risk Oversight Frequency"
              value={data.boardOversightFrequencyPct !== null ? String(data.boardOversightFrequencyPct) : null}
              unit="%"
              target="≥90% of meetings"
              description={`${data.riskInclusiveMeetings}/${data.totalBoardMeetings} meetings with risk agenda item`}
              framework="ISO 31000"
              ragPct={data.boardOversightFrequencyPct !== null ? (data.boardOversightFrequencyPct / 90) * 100 : null}
            />
            <KpiCard
              label="Risk Appetite Adherence"
              value={data.riskAppetiteAdherencePct !== null ? String(data.riskAppetiteAdherencePct) : null}
              unit="%"
              target="100% (all within tolerance)"
              description={`${data.outsideAppetiteCount} of ${data.totalRiskEntries} entries exceed appetite`}
              framework="ISO 31000"
              ragPct={data.riskAppetiteAdherencePct}
            />
          </div>
        </>
      )}

      {/* NIST NRF KPIs — surfaced when an entry is tagged NIST NRF */}
      {showNist && (
        <>
          <p className={styles.sectionLabel} style={{ marginBottom: "0.75rem" }}>NIST NRF — Control Maturity & Detection</p>
          <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
            <KpiCard
              label="Control Maturity (avg)"
              value={data.avgMaturityLevel !== null ? String(data.avgMaturityLevel) : null}
              unit={data.avgMaturityLevel !== null ? ` — ${maturityLabels[Math.round(data.avgMaturityLevel)] ?? ""}` : ""}
              target="≥3.0 (Defined)"
              description="Average maturity level across compliance domains"
              framework="NIST NRF"
              ragPct={data.avgMaturityLevel !== null ? (data.avgMaturityLevel / 3.0) * 100 : null}
            />
            <KpiCard
              label="MTTD — Critical Incidents"
              value={data.mttdCriticalHours !== null ? String(data.mttdCriticalHours) : null}
              unit="h avg"
              target="≤4 hours"
              description="Mean time to detect critical-severity incidents"
              framework="NIST NRF"
              ragPct={data.mttdCriticalHours !== null && data.mttdCriticalHours > 0 ? (4 / data.mttdCriticalHours) * 100 : null}
            />
            <KpiCard
              label="MTTD — High Incidents"
              value={data.mttdHighHours !== null ? String(data.mttdHighHours) : null}
              unit="h avg"
              target="≤24 hours"
              description="Mean time to detect high-severity incidents"
              framework="NIST NRF"
              ragPct={data.mttdHighHours !== null && data.mttdHighHours > 0 ? (24 / data.mttdHighHours) * 100 : null}
            />
          </div>
        </>
      )}

      {/* Tags present, but none map to a KPI family */}
      {hasTags && !showIso && !showNist && (
        <div className={styles.card} style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.6)", margin: 0 }}>
            Your risk entries are tagged {data.activeFrameworks.join(", ")}, which don&apos;t have dedicated KPI families yet.
            Tag an entry <strong>ISO 31000</strong> or <strong>NIST NRF</strong> to surface those KPIs here.
          </p>
        </div>
      )}

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
