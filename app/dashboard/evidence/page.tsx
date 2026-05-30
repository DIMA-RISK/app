"use client";

import { Upload, Download, Trash2, FileText, FileImage, File, AlertCircle } from "lucide-react";
import styles from "../dashboard.module.css";

const FILES = [
  { id: "EV-001", name: "Privacy Policy v2.1.pdf", type: "pdf", category: "Policy", uploaded: "May 20, 2026", requirement: "PIPEDA-GOV-002", version: "v2.1", size: "142 KB", status: "current" },
  { id: "EV-002", name: "Consent Form Template.docx", type: "doc", category: "Consent", uploaded: "May 18, 2026", requirement: "PIPEDA-CON-001", version: "v1.4", size: "38 KB", status: "current" },
  { id: "EV-003", name: "Staff Privacy Training Completion.xlsx", type: "sheet", category: "Training", uploaded: "May 15, 2026", requirement: "PIPEDA-TRN-001", version: "v1.0", size: "85 KB", status: "expiring" },
  { id: "EV-004", name: "CloudBase DPA — Signed.pdf", type: "pdf", category: "Vendor Contract", uploaded: "Apr 30, 2026", requirement: "PIPEDA-VEN-002", version: "v1.0", size: "210 KB", status: "current" },
  { id: "EV-005", name: "Data Flow Diagram.png", type: "image", category: "Technical", uploaded: "Apr 22, 2026", requirement: "PIPEDA-DAT-001", version: "v3.0", size: "1.2 MB", status: "current" },
  { id: "EV-006", name: "Incident Response Procedure.pdf", type: "pdf", category: "Policy", uploaded: "Mar 15, 2026", requirement: "PIPEDA-BRE-001", version: "v1.0", size: "98 KB", status: "missing-update" },
];

const MISSING = [
  { requirement: "PIPEDA-GOV-001", title: "Privacy Officer Appointment Letter", severity: "critical" },
  { requirement: "PIPEDA-RET-001", title: "Data Retention Schedule", severity: "critical" },
  { requirement: "PIPEDA-VEN-002", title: "DPAs for 2 remaining vendors", severity: "high" },
];

const FILE_ICON = (type: string) => {
  if (type === "pdf") return <FileText size={20} color="#f87171" />;
  if (type === "image") return <FileImage size={20} color="#60a5fa" />;
  return <File size={20} color="#c4a8f0" />;
};

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  current: { cls: styles.badgeGreen, label: "Current" },
  expiring: { cls: styles.badgeMedium, label: "Expiring Soon" },
  "missing-update": { cls: styles.badgeHigh, label: "Needs Update" },
};

export default function EvidencePage() {
  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Evidence Center</h1>
          <p className={styles.pageSubtitle}>Compliance documents, policies, and supporting evidence</p>
        </div>
        <div className={styles.pageActions}>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}><Upload size={14} /> Upload File</button>
        </div>
      </div>

      <div className={`${styles.grid21} ${styles.mb15}`}>
        {/* Upload zone */}
        <div className={styles.uploadZone}>
          <Upload size={28} style={{ opacity: 0.35, marginBottom: "0.5rem" }} />
          <div style={{ fontWeight: 500, color: "rgba(221,215,234,0.6)" }}>Drop files here or click to upload</div>
          <div className={styles.textXs} style={{ marginTop: "0.3rem" }}>PDF, DOCX, XLSX, PNG — max 25 MB</div>
        </div>

        {/* Missing evidence alerts */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Missing Evidence</h2>
            <span className={`${styles.badge} ${styles.badgeCritical}`}>{MISSING.length} required</span>
          </div>
          {MISSING.map((m) => (
            <div key={m.requirement} className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}
              style={{ padding: "0.65rem 0", borderBottom: "1px solid rgba(117,76,190,0.07)" }}>
              <AlertCircle size={14} color={m.severity === "critical" ? "#ef4444" : "#f59e0b"} />
              <div style={{ flex: 1 }}>
                <div className={styles.textSm}>{m.title}</div>
                <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>{m.requirement}</div>
              </div>
              <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnXs}`}><Upload size={10} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Files list */}
      <div className={styles.card} style={{ padding: 0, overflow: "hidden" }}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>File</th>
                <th>Category</th>
                <th>Linked Requirement</th>
                <th>Version</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {FILES.map((f) => {
                const s = STATUS_BADGE[f.status];
                return (
                  <tr key={f.id}>
                    <td>
                      <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
                        {FILE_ICON(f.type)}
                        <div>
                          <div style={{ fontWeight: 500, color: "#ddd7ea" }}>{f.name}</div>
                          <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.35)" }}>{f.size}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`${styles.badge} ${styles.badgePurple}`}>{f.category}</span></td>
                    <td><span className={styles.textXs} style={{ color: "#c4a8f0", fontFamily: "monospace" }}>{f.requirement}</span></td>
                    <td><span className={styles.textXs} style={{ color: "rgba(221,215,234,0.5)" }}>{f.version}</span></td>
                    <td><span className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)" }}>{f.uploaded}</span></td>
                    <td><span className={`${styles.badge} ${s.cls}`}>{s.label}</span></td>
                    <td>
                      <div className={`${styles.flex} ${styles.gap04}`}>
                        <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnXs}`}><Download size={11} /></button>
                        <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnXs}`}><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
