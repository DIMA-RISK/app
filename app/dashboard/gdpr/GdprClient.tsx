"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Trash2, CheckCircle2, AlertCircle, MinusCircle, Circle } from "lucide-react";
import type { GdprAssessmentData, GdprSection, GdprQuestion, GdprProcessEntry } from "../queries";
import { saveGdprResponse, saveGdprProcess, deleteGdprProcess, saveGdprTargetDate } from "./actions";
import styles from "../dashboard.module.css";

const RESPONSE_CONFIG = {
  yes:   { label: "Yes",       color: "#22c55e", Icon: CheckCircle2 },
  q_yes: { label: "Partially", color: "#f59e0b", Icon: AlertCircle },
  no:    { label: "No",        color: "#ef4444", Icon: MinusCircle },
  null:  { label: "—",         color: "rgba(221,215,234,0.3)", Icon: Circle },
};

function SectionCard({ section, canEdit }: { section: GdprSection; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState(section.questions);
  const [isPending, startTransition] = useTransition();

  const answered = questions.filter((q) => q.response !== null).length;
  const yes = questions.filter((q) => q.response === "yes").length;
  const qYes = questions.filter((q) => q.response === "q_yes").length;
  const localPct = answered > 0 ? Math.round(((yes + qYes * 0.5) / answered) * 100) : 0;
  const pctColor = localPct >= 75 ? "#22c55e" : localPct >= 50 ? "#f59e0b" : localPct > 0 ? "#f97316" : "rgba(221,215,234,0.3)";

  function cycleResponse(q: GdprQuestion) {
    if (!canEdit) return;
    const order: Array<GdprQuestion["response"]> = [null, "yes", "q_yes", "no"];
    const next = order[(order.indexOf(q.response) + 1) % order.length];
    setQuestions((prev) => prev.map((item) => item.id === q.id ? { ...item, response: next } : item));
    startTransition(async () => {
      await saveGdprResponse(q.id, next ?? null);
      router.refresh();
    });
  }

  return (
    <div className={styles.card}>
      <button
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        onClick={() => setOpen((o) => !o)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {open ? <ChevronDown size={16} color="#9b7de2" /> : <ChevronRight size={16} color="#9b7de2" />}
          <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem" }}>{section.name}</span>
          <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>
            {answered}/{questions.length} answered
          </span>
        </div>
        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: pctColor }}>{localPct}%</span>
      </button>

      {open && (
        <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {questions.map((q) => {
            const cfg = RESPONSE_CONFIG[q.response ?? "null"];
            const Icon = cfg.Icon;
            return (
              <div key={q.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.5rem 0", borderBottom: "1px solid rgba(117,76,190,0.07)" }}>
                <button
                  onClick={() => cycleResponse(q)}
                  disabled={!canEdit || isPending}
                  title={canEdit ? "Click to cycle: — → Yes → Partial → No" : "View only"}
                  style={{ background: "none", border: "none", cursor: canEdit ? "pointer" : "default", flexShrink: 0, lineHeight: 0, marginTop: "0.1rem" }}
                >
                  <Icon size={16} color={cfg.color} />
                </button>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "#ddd7ea", lineHeight: 1.5 }}>
                    {q.question}
                    {!q.mandatory && <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.35)", marginLeft: "0.4rem" }}>(optional)</span>}
                  </p>
                  {q.response !== null && (
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProcessModal({ entry, onClose, onSaved }: { entry: GdprProcessEntry | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    processName: entry?.processName ?? "",
    controllerStatus: entry?.controllerStatus ?? "controller",
    personalData: entry?.personalData ?? false,
    specialCategory: entry?.specialCategory ?? false,
    childrenData: entry?.childrenData ?? false,
    lawfulBasis: entry?.lawfulBasis ?? "",
    dataVolume: entry?.dataVolume ?? "low",
    transborder: entry?.transborder ?? "no",
    gdprCompliant: entry?.gdprCompliant ?? null,
    notes: entry?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveGdprProcess({ id: entry?.id, ...form, controllerStatus: form.controllerStatus || null, lawfulBasis: form.lawfulBasis || null, gdprCompliant: (form.gdprCompliant as string | null) || null, notes: form.notes || null, dataVolume: form.dataVolume || null, transborder: form.transborder || null });
      if (res.error) { setError(res.error); return; }
      onSaved(); onClose();
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,8,20,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div className={styles.card} style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.cardTitleLg} style={{ marginBottom: "1rem" }}>{entry ? "Edit Process" : "Add Process"}</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Process name</label>
            <input className={styles.fieldInput} value={form.processName} onChange={(e) => setForm({ ...form, processName: e.target.value })} required placeholder="e.g. Customer Registration" />
          </div>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Controller status</label>
              <select className={styles.fieldSelect} value={form.controllerStatus} onChange={(e) => setForm({ ...form, controllerStatus: e.target.value })}>
                <option value="controller">Controller</option>
                <option value="joint_controller">Joint Controller</option>
                <option value="processor">Processor</option>
                <option value="dont_know">Don't know</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Data volume</label>
              <select className={styles.fieldSelect} value={form.dataVolume} onChange={(e) => setForm({ ...form, dataVolume: e.target.value })}>
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="very_high">Very High</option>
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Lawful basis for processing</label>
            <select className={styles.fieldSelect} value={form.lawfulBasis} onChange={(e) => setForm({ ...form, lawfulBasis: e.target.value })}>
              <option value="">— select —</option>
              <option value="consent">Consent</option>
              <option value="contractual">Contractual obligation</option>
              <option value="legal">Legal obligation</option>
              <option value="vital">Vital interests</option>
              <option value="public">Public interest</option>
              <option value="legitimate">Legitimate interests</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {([["personalData","Personal data"],["specialCategory","Special category"],["childrenData","Children's data"]] as [keyof typeof form, string][]).map(([key, label]) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: "#ddd7ea", cursor: "pointer" }}>
                <input type="checkbox" checked={form[key] as boolean} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Cross-border transfer mechanism</label>
            <select className={styles.fieldSelect} value={form.transborder} onChange={(e) => setForm({ ...form, transborder: e.target.value })}>
              <option value="no">No transfer outside EEA</option>
              <option value="eea">Within EEA</option>
              <option value="adequacy">Adequacy ruling</option>
              <option value="dpf">EU-US Data Privacy Framework</option>
              <option value="scc">Standard Contractual Clauses (SCC)</option>
              <option value="bcr">Binding Corporate Rules (BCR)</option>
              <option value="derogation">Derogation (Art. 49)</option>
              <option value="dont_know">Don&apos;t know</option>
            </select>
            {form.transborder === "dpf" && (
              <p className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)", marginTop: "0.25rem" }}>
                Replaces the invalidated US Privacy Shield (Schrems II, 2020).
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>GDPR compliant?</label>
            <select className={styles.fieldSelect} value={form.gdprCompliant ?? ""} onChange={(e) => setForm({ ...form, gdprCompliant: e.target.value || null })}>
              <option value="">— not assessed —</option>
              <option value="yes">Yes</option>
              <option value="q_yes">Partially</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Notes</label>
            <input className={styles.fieldInput} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional context..." />
          </div>
          {error && <p style={{ color: "#f87171", fontSize: "0.8rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={onClose}>Cancel</button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={isPending}>
              {isPending ? "Saving…" : entry ? "Save" : "Add Process"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GdprClient({ data }: { data: GdprAssessmentData }) {
  const router = useRouter();
  const [modalEntry, setModalEntry] = useState<GdprProcessEntry | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(data.targetDate ?? "");
  const canEdit = data.role === "admin";

  const pctColor = data.overallCompliancePct >= 75 ? "#22c55e" : data.overallCompliancePct >= 50 ? "#f59e0b" : "#f97316";

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteGdprProcess(id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <>
      {modalEntry !== null && (
        <ProcessModal
          entry={modalEntry === "new" ? null : modalEntry}
          onClose={() => setModalEntry(null)}
          onSaved={() => router.refresh()}
        />
      )}

      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>GDPR Gap Analysis</h1>
          <p className={styles.pageSubtitle}>10-section self-assessment — identify gaps ahead of GDPR compliance</p>
        </div>
        <div className={styles.pageActions} style={{ alignItems: "center", gap: "1rem" }}>
          <label className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.4rem" }}>
            <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.5)" }}>Target compliance date</span>
            <input
              type="date"
              className={styles.fieldInput}
              style={{ maxWidth: 160, padding: "0.35rem 0.5rem" }}
              value={targetDate}
              disabled={!canEdit}
              onChange={(e) => {
                setTargetDate(e.target.value);
                saveGdprTargetDate(e.target.value || null);
              }}
            />
          </label>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: pctColor }}>{data.overallCompliancePct}% compliant</span>
        </div>
      </div>

      {/* Questionnaire sections */}
      <div className={styles.flexCol} style={{ gap: "0.75rem", marginBottom: "2rem" }}>
        {data.sections.map((section) => (
          <SectionCard key={section.id} section={section} canEdit={canEdit} />
        ))}
      </div>

      {/* Article 30 Process Register */}
      <div className={styles.card} style={{ padding: 0 }}>
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid rgba(117,76,190,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem" }}>Article 30 — Records of Processing</span>
          {canEdit && (
            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={() => setModalEntry("new")}>
              <Plus size={14} /> Add Process
            </button>
          )}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Process</th>
                <th>Role</th>
                <th>Lawful Basis</th>
                <th>Volume</th>
                <th>Special Cat.</th>
                <th>GDPR Status</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.processRegister.length === 0 ? (
                <tr><td colSpan={canEdit ? 7 : 6} style={{ textAlign: "center", color: "rgba(221,215,234,0.35)", padding: "2rem" }}>
                  No processes added yet.{canEdit ? " Click \"Add Process\" to document your first data processing activity." : ""}
                </td></tr>
              ) : data.processRegister.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500, color: "#ddd7ea" }}>{p.processName}</td>
                  <td><span className={`${styles.badge} ${styles.badgePurple}`}>{p.controllerStatus ?? "—"}</span></td>
                  <td>{p.lawfulBasis ?? "—"}</td>
                  <td>{p.dataVolume ?? "—"}</td>
                  <td>{p.specialCategory ? <span style={{ color: "#f59e0b" }}>Yes</span> : "No"}</td>
                  <td>
                    {p.gdprCompliant === "yes" ? <span className={`${styles.badge} ${styles.badgeGreen}`}>Compliant</span>
                      : p.gdprCompliant === "q_yes" ? <span className={`${styles.badge} ${styles.badgeMedium}`}>Partial</span>
                      : p.gdprCompliant === "no" ? <span className={`${styles.badge} ${styles.badgeCritical}`}>Gap</span>
                      : <span className={`${styles.badge} ${styles.badgeGray}`}>—</span>}
                  </td>
                  {canEdit && (
                    <td>
                      <div className={styles.flex} style={{ gap: "0.4rem" }}>
                        <button onClick={() => setModalEntry(p)} style={{ background: "none", border: "none", color: "#9b7de2", cursor: "pointer" }}><Plus size={13} /></button>
                        <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}><Trash2 size={13} /></button>
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
