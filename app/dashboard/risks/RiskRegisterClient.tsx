"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Download, Trash2, Edit2 } from "lucide-react";
import type { RiskRegisterData, RiskRegisterEntry } from "../queries";
import {
  createRiskEntry, updateRiskEntry, deleteRiskEntry, saveRiskTolerance,
  type RiskEntryInput, type RiskCategory, type ProbabilityBand, type TreatmentStatus,
} from "./actions";
import { SeverityBadge } from "../_components/SeverityBadge";
import styles from "../dashboard.module.css";

const CATEGORY_LABELS: Record<string, string> = {
  operational: "Operational", financial: "Financial", strategic: "Strategic",
  compliance: "Compliance", technology: "Technology", reputational: "Reputational",
};
const PROBABILITY_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const PROBABILITY_MIDPOINT: Record<string, number> = { low: 0.10, medium: 0.35, high: 0.65, critical: 0.90 };
const STATUS_LABELS: Record<string, string> = { untreated: "Untreated", in_progress: "In Progress", done: "Done" };
const FRAMEWORK_OPTIONS = ["ISO 31000", "NIST NRF", "COSO", "PIPEDA", "HIPAA", "GDPR"];

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}

function computeRoiOfTreatment(rows: RiskRegisterEntry[]): number | null {
  const treated = rows.filter((e) => e.roiPct != null && e.treatmentCost);
  if (treated.length === 0) return null;
  const totalCost = treated.reduce((sum, e) => sum + (e.treatmentCost ?? 0), 0);
  const totalAvoided = treated.reduce((sum, e) => {
    const midBefore = PROBABILITY_MIDPOINT[e.probabilityBand] ?? 0;
    const midAfter = PROBABILITY_MIDPOINT[e.probabilityAfterBand ?? "low"] ?? 0;
    return sum + e.financialImpact * (midBefore - midAfter);
  }, 0);
  return totalCost > 0 ? ((totalAvoided - totalCost) / totalCost) * 100 : null;
}

function exportCsv(entries: RiskRegisterEntry[]) {
  const headers = ["Risk", "Category", "Division", "Owner", "Framework Tags", "Probability", "Financial Impact", "Annualized Exposure", "Outside Appetite", "Treatment Status"];
  const rows = entries.map((e) => [
    e.title, CATEGORY_LABELS[e.category] ?? e.category, e.division ?? "", e.owner ?? "", e.frameworkTags.join("; "),
    PROBABILITY_LABELS[e.probabilityBand] ?? e.probabilityBand, String(e.financialImpact), String(Math.round(e.exposure)),
    e.outsideAppetite ? "Yes" : "No", STATUS_LABELS[e.treatmentStatus] ?? e.treatmentStatus,
  ]);
  const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `risk-register-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function EntryModal({
  entry, suggestion, onClose, onSaved,
}: {
  entry: RiskRegisterEntry | null;
  suggestion: RiskRegisterData["impactSuggestion"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [category, setCategory] = useState<RiskCategory>((entry?.category as RiskCategory) ?? "operational");
  const [probabilityBand, setProbabilityBand] = useState<ProbabilityBand>(entry?.probabilityBand ?? "medium");
  // New risks pre-fill Direct with the org-derived suggestion (records × per-record
  // cost); editing an existing risk keeps its saved value. Always overridable.
  const [impactDirect, setImpactDirect] = useState(entry?.impactDirect ?? suggestion?.suggestedDirect ?? 0);
  const [impactPrefilled, setImpactPrefilled] = useState(!entry && !!suggestion);
  const [impactRegulatory, setImpactRegulatory] = useState(entry?.impactRegulatory ?? 0);
  const [impactRecovery, setImpactRecovery] = useState(entry?.impactRecovery ?? 0);
  const [frameworkTags, setFrameworkTags] = useState<string[]>(entry?.frameworkTags ?? []);
  const [division, setDivision] = useState(entry?.division ?? "");
  const [owner, setOwner] = useState(entry?.owner ?? "");
  const [treatmentStatus, setTreatmentStatus] = useState<TreatmentStatus>(entry?.treatmentStatus ?? "untreated");
  const [probabilityAfterBand, setProbabilityAfterBand] = useState<ProbabilityBand | "">(entry?.probabilityAfterBand ?? "");
  const [treatmentCost, setTreatmentCost] = useState(entry?.treatmentCost ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleFramework(tag: string) {
    setFrameworkTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input: RiskEntryInput = {
      title,
      category,
      probability_band: probabilityBand,
      impact_direct: Number(impactDirect) || 0,
      impact_regulatory: Number(impactRegulatory) || 0,
      impact_recovery: Number(impactRecovery) || 0,
      framework_tags: frameworkTags,
      division: division.trim() || null,
      owner: owner.trim() || null,
      treatment_status: treatmentStatus,
      probability_after_band: treatmentStatus !== "untreated" && probabilityAfterBand ? probabilityAfterBand : null,
      treatment_cost: treatmentStatus !== "untreated" && treatmentCost ? Number(treatmentCost) : null,
    };
    startTransition(async () => {
      const res = entry ? await updateRiskEntry(entry.id, input) : await createRiskEntry(input);
      if (res.error) {
        setError(res.error);
        return;
      }
      onSaved();
      onClose();
    });
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(10,8,20,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        className={styles.card}
        style={{ width: "100%", maxWidth: 560, margin: "1rem", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb1}`}>
          <h2 className={styles.cardTitleLg}>{entry ? "Edit Risk" : "Add Risk"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(221,215,234,0.5)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field} style={{ marginBottom: "0.85rem" }}>
            <label className={styles.fieldLabel}>Risk description</label>
            <input
              className={styles.fieldInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Unencrypted backups stored offsite"
            />
          </div>

          <div className={styles.grid2} style={{ marginBottom: "0.85rem" }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Category</label>
              <select className={styles.fieldSelect} value={category} onChange={(e) => setCategory(e.target.value as RiskCategory)}>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Probability</label>
              <select className={styles.fieldSelect} value={probabilityBand} onChange={(e) => setProbabilityBand(e.target.value as ProbabilityBand)}>
                {Object.entries(PROBABILITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <p className={styles.fieldLabel} style={{ marginBottom: "0.4rem" }}>Financial impact (CAD)</p>
          <div className={styles.grid3} style={{ marginBottom: impactPrefilled ? "0.35rem" : "0.85rem", gap: "0.6rem" }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} style={{ fontSize: "0.7rem" }}>Direct</label>
              <input type="number" min={0} className={styles.fieldInput} value={impactDirect}
                onChange={(e) => { setImpactDirect(Number(e.target.value)); setImpactPrefilled(false); }} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} style={{ fontSize: "0.7rem" }}>Regulatory</label>
              <input type="number" min={0} className={styles.fieldInput} value={impactRegulatory} onChange={(e) => setImpactRegulatory(Number(e.target.value))} />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} style={{ fontSize: "0.7rem" }}>Recovery</label>
              <input type="number" min={0} className={styles.fieldInput} value={impactRecovery} onChange={(e) => setImpactRecovery(Number(e.target.value))} />
            </div>
          </div>

          {impactPrefilled && suggestion && (
            <p className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)", marginBottom: "0.85rem", lineHeight: 1.5 }}>
              Suggested Direct impact <strong style={{ color: "#c4a8f0" }}>{fmtCurrency(suggestion.suggestedDirect)}</strong>{" "}
              ({suggestion.recordsAtRisk.toLocaleString("en-CA")} records × {fmtCurrency(suggestion.perRecordRate)}/{suggestion.basis}, from your data profile).
              Edit if this risk doesn&rsquo;t apply org-wide.
            </p>
          )}

          <div className={styles.field} style={{ marginBottom: "0.85rem" }}>
            <label className={styles.fieldLabel}>Framework tags</label>
            <div className={styles.flex} style={{ gap: "0.4rem", flexWrap: "wrap" }}>
              {FRAMEWORK_OPTIONS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleFramework(tag)}
                  className={`${styles.badge} ${frameworkTags.includes(tag) ? styles.badgePurple : styles.badgeGray}`}
                  style={{ cursor: "pointer", border: "none" }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.grid2} style={{ marginBottom: "0.85rem" }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Division</label>
              <input className={styles.fieldInput} value={division} onChange={(e) => setDivision(e.target.value)} placeholder="e.g. IT Operations" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Owner</label>
              <input className={styles.fieldInput} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. Jane Doe, CISO" />
            </div>
          </div>

          <div className={styles.field} style={{ marginBottom: "0.85rem" }}>
            <label className={styles.fieldLabel}>Treatment status</label>
            <select className={styles.fieldSelect} value={treatmentStatus} onChange={(e) => setTreatmentStatus(e.target.value as TreatmentStatus)}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {treatmentStatus !== "untreated" && (
            <div className={styles.grid2} style={{ marginBottom: "0.85rem" }}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Probability after treatment</label>
                <select className={styles.fieldSelect} value={probabilityAfterBand} onChange={(e) => setProbabilityAfterBand(e.target.value as ProbabilityBand)}>
                  <option value="">—</option>
                  {Object.entries(PROBABILITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Cost of treatment (CAD)</label>
                <input type="number" min={0} className={styles.fieldInput} value={treatmentCost} onChange={(e) => setTreatmentCost(Number(e.target.value))} />
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: "0.6rem 0.9rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: "0.8rem", color: "#f87171", marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          <div className={`${styles.flex} ${styles.gap08}`} style={{ justifyContent: "flex-end" }}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={onClose}>Cancel</button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={pending}>
              {pending ? "Saving…" : entry ? "Save Changes" : "Add Risk"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RiskRegisterClient({ data }: { data: RiskRegisterData }) {
  const router = useRouter();
  const [entries, setEntries] = useState(data.entries);
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [frameworkFilter, setFrameworkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalEntry, setModalEntry] = useState<RiskRegisterEntry | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(data.toleranceThreshold);
  const [editingTolerance, setEditingTolerance] = useState(false);

  const canEdit = data.role === "admin";

  const divisions = Array.from(new Set(entries.map((e) => e.division).filter(Boolean))) as string[];
  const frameworks = Array.from(new Set(entries.flatMap((e) => e.frameworkTags)));

  const filtered = entries.filter((e) => {
    if (divisionFilter !== "all" && e.division !== divisionFilter) return false;
    if (frameworkFilter !== "all" && !e.frameworkTags.includes(frameworkFilter)) return false;
    if (statusFilter !== "all" && e.treatmentStatus !== statusFilter) return false;
    return true;
  });

  const totalExposure = filtered.reduce((sum, e) => sum + e.exposure, 0);
  const outsideAppetiteCount = filtered.filter((e) => e.outsideAppetite).length;
  const openEntries = filtered.filter((e) => e.treatmentStatus !== "done").length;
  const roiOfTreatment = computeRoiOfTreatment(filtered);

  // Departmental exposure = SUM(impact × probability) grouped by division (live aggregate)
  const deptExposure = Array.from(
    entries.reduce((map, e) => {
      const key = e.division?.trim() || "Unassigned";
      const d = map.get(key) ?? { division: key, exposure: 0, count: 0, outside: 0 };
      d.exposure += e.exposure; d.count += 1; if (e.outsideAppetite) d.outside += 1;
      map.set(key, d);
      return map;
    }, new Map<string, { division: string; exposure: number; count: number; outside: number }>()).values()
  ).sort((a, b) => b.exposure - a.exposure);
  const maxDeptExposure = Math.max(1, ...deptExposure.map((d) => d.exposure));

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await deleteRiskEntry(id);
    if (!res.error) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
    setDeletingId(null);
  }

  function refresh() {
    router.refresh();
  }

  return (
    <>
      {modalEntry !== null && (
        <EntryModal
          entry={modalEntry === "new" ? null : modalEntry}
          suggestion={data.impactSuggestion}
          onClose={() => setModalEntry(null)}
          onSaved={refresh}
        />
      )}

      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Risk Register</h1>
          <p className={styles.pageSubtitle}>{entries.length} risk{entries.length !== 1 ? "s" : ""} tracked across your organization</p>
        </div>
        <div className={styles.pageActions} style={{ alignItems: "center", gap: "0.75rem" }}>
          {/* Per-org risk appetite tolerance */}
          <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.4rem" }}>
            <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.5)" }}>Appetite</span>
            {editingTolerance && canEdit ? (
              <input
                type="number" min={0} step={10000} autoFocus
                className={styles.fieldInput}
                style={{ maxWidth: 120, padding: "0.3rem 0.5rem" }}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                onBlur={() => { setEditingTolerance(false); saveRiskTolerance(tolerance).then(() => router.refresh()); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setEditingTolerance(false); saveRiskTolerance(tolerance).then(() => router.refresh()); } }}
              />
            ) : (
              <button
                onClick={() => canEdit && setEditingTolerance(true)}
                className={`${styles.badge} ${styles.badgeGray}`}
                style={{ cursor: canEdit ? "pointer" : "default", border: "none" }}
                title={canEdit ? "Click to edit tolerance threshold" : undefined}
              >
                {fmtCurrency(tolerance)}
              </button>
            )}
          </div>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => exportCsv(filtered)}>
            <Download size={14} /> Export
          </button>
          {canEdit && (
            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={() => setModalEntry("new")}>
              <Plus size={14} /> Add Risk
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Total Exposure</span><div className={`${styles.statCardIcon} ${styles.iconPurple}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.5rem" }}>{fmtCurrency(totalExposure)}</div>
          <div className={styles.statCardSub}>sum of impact × probability</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Outside Appetite</span><div className={`${styles.statCardIcon} ${styles.iconRed}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.5rem", color: outsideAppetiteCount > 0 ? "#ef4444" : "#22c55e" }}>{outsideAppetiteCount}</div>
          <div className={styles.statCardSub}>exceeds {fmtCurrency(tolerance)} tolerance</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Open Entries</span><div className={`${styles.statCardIcon} ${styles.iconBlue}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.5rem" }}>{openEntries}</div>
          <div className={styles.statCardSub}>not yet fully treated</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>ROI of Treatment</span><div className={`${styles.statCardIcon} ${styles.iconGreen}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.5rem", color: (roiOfTreatment ?? 0) >= 0 ? "#22c55e" : "#ef4444" }}>
            {roiOfTreatment != null ? `${Math.round(roiOfTreatment)}%` : "—"}
          </div>
          <div className={styles.statCardSub}>exposure avoided vs. cost</div>
        </div>
      </div>

      {/* Departmental exposure — live SUM(impact × probability) by division */}
      {deptExposure.length > 0 && (
        <div className={styles.card} style={{ marginBottom: "1.5rem" }}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Departmental Exposure</h2>
            <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>annualized, by division</span>
          </div>
          <div className={styles.flexCol} style={{ gap: "0.6rem" }}>
            {deptExposure.map((d) => (
              <div key={d.division}>
                <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ marginBottom: "0.3rem" }}>
                  <span className={styles.textSm} style={{ color: "#ddd7ea" }}>
                    {d.division}
                    <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)", marginLeft: "0.5rem" }}>
                      {d.count} risk{d.count !== 1 ? "s" : ""}{d.outside > 0 ? ` · ${d.outside} outside appetite` : ""}
                    </span>
                  </span>
                  <span className={styles.textSm} style={{ fontWeight: 600, color: d.outside > 0 ? "#f87171" : "#ddd7ea" }}>{fmtCurrency(d.exposure)}</span>
                </div>
                <div className={styles.progressBar} style={{ height: 6 }}>
                  <div style={{ height: "100%", width: `${(d.exposure / maxDeptExposure) * 100}%`, background: d.outside > 0 ? "#ef4444" : "#754cbe", borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.flex} style={{ gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <select className={styles.fieldSelect} style={{ maxWidth: 200 }} value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value)}>
          <option value="all">All divisions</option>
          {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className={styles.fieldSelect} style={{ maxWidth: 200 }} value={frameworkFilter} onChange={(e) => setFrameworkFilter(e.target.value)}>
          <option value="all">All frameworks</option>
          {frameworks.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className={styles.fieldSelect} style={{ maxWidth: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className={styles.card} style={{ padding: 0 }}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Risk</th>
                <th>Division</th>
                <th>Owner</th>
                <th>Framework</th>
                <th>Probability</th>
                <th>Financial Impact</th>
                <th>Annualized Exposure</th>
                <th>Appetite</th>
                <th>Status</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 10 : 9} style={{ textAlign: "center", color: "rgba(221,215,234,0.35)", padding: "2rem" }}>
                    No risks match this filter.{canEdit ? " Click \"Add Risk\" to create one." : ""}
                  </td>
                </tr>
              ) : filtered.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: "#ddd7ea" }}>{e.title}</div>
                    <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>{CATEGORY_LABELS[e.category] ?? e.category}</div>
                  </td>
                  <td>{e.division ?? "—"}</td>
                  <td>{e.owner ?? "—"}</td>
                  <td>
                    <div className={styles.flex} style={{ gap: "0.3rem", flexWrap: "wrap" }}>
                      {e.frameworkTags.length === 0 ? "—" : e.frameworkTags.map((t) => (
                        <span key={t} className={`${styles.badge} ${styles.badgePurple}`}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td><SeverityBadge level={e.probabilityBand} title={`Probability: ${PROBABILITY_LABELS[e.probabilityBand]}`} /></td>
                  <td>{fmtCurrency(e.financialImpact)}</td>
                  <td>{fmtCurrency(e.exposure)}</td>
                  <td>
                    <span className={`${styles.badge} ${e.outsideAppetite ? styles.badgeCritical : styles.badgeGreen}`}>
                      {e.outsideAppetite ? "Outside" : "Within"}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${e.treatmentStatus === "done" ? styles.badgeGreen : e.treatmentStatus === "in_progress" ? styles.badgeMedium : styles.badgeGray}`}>
                      {STATUS_LABELS[e.treatmentStatus] ?? e.treatmentStatus}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <div className={styles.flex} style={{ gap: "0.4rem" }}>
                        <button onClick={() => setModalEntry(e)} style={{ background: "none", border: "none", color: "#9b7de2", cursor: "pointer" }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(e.id)} disabled={deletingId === e.id} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
