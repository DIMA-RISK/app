"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, Trash2, FileText, FileImage, File, AlertCircle, X } from "lucide-react";
import { uploadEvidenceFile, deleteEvidenceFile } from "../queries";
import type { EvidenceData } from "../queries";
import styles from "../dashboard.module.css";

const CATEGORIES = ["Policy", "Training", "Contract", "Technical", "Consent", "Audit", "Other"];

const FILE_ICON = (ct: string | null) => {
  if (!ct) return <File size={18} color="#c4a8f0" />;
  if (ct.includes("pdf")) return <FileText size={18} color="#f87171" />;
  if (ct.includes("image")) return <FileImage size={18} color="#60a5fa" />;
  if (ct.includes("sheet") || ct.includes("excel") || ct.includes("csv")) return <FileText size={18} color="#4ade80" />;
  return <File size={18} color="#c4a8f0" />;
};

function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceClient({ data }: { data: EvidenceData }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState("Policy");
  const [controlRef, setControlRef] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function onFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    setSelectedFile(files[0]);
    setError(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    onFileSelect(e.dataTransfer.files);
  }

  function cancelUpload() {
    setSelectedFile(null);
    setError(null);
    setControlRef("");
    setNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleUpload() {
    if (!selectedFile) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", selectedFile);
    fd.append("category", category);
    fd.append("controlRef", controlRef);
    fd.append("notes", notes);
    startTransition(async () => {
      const result = await uploadEvidenceFile(fd);
      if (result.error) {
        setError(result.error);
      } else {
        cancelUpload();
        router.refresh();
      }
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      await deleteEvidenceFile(id);
      setDeletingId(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Evidence Center</h1>
          <p className={styles.pageSubtitle}>{data.files.length} document{data.files.length !== 1 ? "s" : ""} uploaded</p>
        </div>
      </div>

      <div className={styles.grid2} style={{ marginBottom: "1.5rem", alignItems: "start" }}>

        {/* Upload zone */}
        <div className={styles.card}>
          <div style={{ fontWeight: 700, color: "#ddd7ea", marginBottom: "1rem", fontSize: "0.95rem" }}>Upload Evidence</div>

          {!selectedFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? "#754cbe" : "rgba(117,76,190,0.3)"}`,
                borderRadius: 10, padding: "2rem 1rem", textAlign: "center", cursor: "pointer",
                background: dragging ? "rgba(117,76,190,0.06)" : "transparent",
                transition: "all 0.15s",
              }}
            >
              <Upload size={28} style={{ color: "rgba(221,215,234,0.3)", marginBottom: "0.5rem" }} />
              <div style={{ fontWeight: 500, color: "rgba(221,215,234,0.6)", fontSize: "0.85rem" }}>
                Drop files here or click to browse
              </div>
              <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.35)", marginTop: "0.3rem" }}>
                PDF, DOCX, XLSX, CSV, PNG, JPG — max 25 MB
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Selected file pill */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(117,76,190,0.08)", border: "1px solid rgba(117,76,190,0.2)", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
                {FILE_ICON(selectedFile.type)}
                <span style={{ flex: 1, fontSize: "0.82rem", color: "#ddd7ea", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedFile.name}</span>
                <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)", flexShrink: 0 }}>{fmtSize(selectedFile.size)}</span>
                <button onClick={cancelUpload} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(221,215,234,0.4)", padding: 2 }}><X size={14} /></button>
              </div>

              {/* Category */}
              <div>
                <label className={styles.textXs} style={{ color: "rgba(221,215,234,0.55)", display: "block", marginBottom: "0.25rem" }}>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  style={{ width: "100%", background: "rgba(7,5,26,0.8)", border: "1px solid rgba(117,76,190,0.25)", borderRadius: 6, color: "#ddd7ea", padding: "0.4rem 0.6rem", fontSize: "0.83rem" }}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Control ref */}
              <div>
                <label className={styles.textXs} style={{ color: "rgba(221,215,234,0.55)", display: "block", marginBottom: "0.25rem" }}>Control Reference <span style={{ color: "rgba(221,215,234,0.3)" }}>(optional)</span></label>
                <input
                  type="text" placeholder="e.g. PIPEDA-GOV-002"
                  value={controlRef} onChange={(e) => setControlRef(e.target.value)}
                  style={{ width: "100%", background: "rgba(7,5,26,0.8)", border: "1px solid rgba(117,76,190,0.25)", borderRadius: 6, color: "#ddd7ea", padding: "0.4rem 0.6rem", fontSize: "0.83rem", boxSizing: "border-box" }}
                />
              </div>

              {/* Notes */}
              <div>
                <label className={styles.textXs} style={{ color: "rgba(221,215,234,0.55)", display: "block", marginBottom: "0.25rem" }}>Notes <span style={{ color: "rgba(221,215,234,0.3)" }}>(optional)</span></label>
                <textarea
                  rows={2} placeholder="Brief description..."
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  style={{ width: "100%", background: "rgba(7,5,26,0.8)", border: "1px solid rgba(117,76,190,0.25)", borderRadius: 6, color: "#ddd7ea", padding: "0.4rem 0.6rem", fontSize: "0.83rem", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>

              {error && (
                <div style={{ fontSize: "0.8rem", color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "0.4rem 0.6rem" }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={isPending}
                className={`${styles.btn} ${styles.btnPrimary}`}
                style={{ width: "100%", justifyContent: "center", opacity: isPending ? 0.7 : 1 }}
              >
                <Upload size={14} /> {isPending ? "Uploading…" : "Upload File"}
              </button>
            </div>
          )}

          <input ref={fileInputRef} type="file" style={{ display: "none" }}
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.txt"
            onChange={(e) => onFileSelect(e.target.files)} />
        </div>

        {/* Needs evidence */}
        {data.missingControls.length > 0 && (
          <div className={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ fontWeight: 700, color: "#ddd7ea", fontSize: "0.95rem" }}>Needs Evidence</div>
              <span className={`${styles.badge} ${styles.badgeCritical}`}>{data.missingControls.length} open</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {data.missingControls.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", padding: "0.55rem 0", borderBottom: "1px solid rgba(117,76,190,0.07)" }}>
                  <AlertCircle size={13} color={c.priority === "critical" ? "#ef4444" : "#f59e0b"} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, fontSize: "0.8rem", color: "rgba(221,215,234,0.7)", lineHeight: 1.4 }}>{c.title}</div>
                  <span className={`${styles.badge} ${c.priority === "critical" ? styles.badgeCritical : styles.badgeHigh}`} style={{ fontSize: "0.65rem" }}>{c.priority}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Files table */}
      {data.files.length > 0 ? (
        <div className={styles.card} style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid rgba(117,76,190,0.1)" }}>
            <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem" }}>Uploaded Documents</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Category</th>
                  <th>Control Ref</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.files.map((f) => (
                  <tr key={f.id} style={{ opacity: deletingId === f.id ? 0.4 : 1 }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {FILE_ICON(f.contentType)}
                        <div>
                          <div style={{ fontWeight: 500, color: "#ddd7ea", fontSize: "0.83rem" }}>{f.originalName}</div>
                          {f.notes && <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>{f.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className={`${styles.badge} ${styles.badgePurple}`}>{f.category}</span></td>
                    <td>
                      {f.controlRef
                        ? <span className={styles.textXs} style={{ color: "#c4a8f0", fontFamily: "monospace" }}>{f.controlRef}</span>
                        : <span style={{ color: "rgba(221,215,234,0.25)" }}>—</span>}
                    </td>
                    <td><span className={styles.textXs} style={{ color: "rgba(221,215,234,0.5)" }}>{fmtSize(f.fileSize)}</span></td>
                    <td><span className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)" }}>{new Date(f.createdAt).toLocaleDateString("en-CA")}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <a
                          href={`/api/evidence/download/${f.id}`}
                          download={f.originalName}
                          className={`${styles.btn} ${styles.btnGhost} ${styles.btnXs}`}
                          style={{ textDecoration: "none" }}
                        >
                          <Download size={11} />
                        </a>
                        <button
                          onClick={() => handleDelete(f.id)}
                          disabled={isPending}
                          className={`${styles.btn} ${styles.btnDanger} ${styles.btnXs}`}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState} style={{ marginTop: "1rem" }}>
          <Upload size={28} style={{ color: "rgba(221,215,234,0.2)", marginBottom: "0.5rem" }} />
          <p className={styles.emptyText}>No documents uploaded yet. Upload your first compliance document above.</p>
        </div>
      )}
    </>
  );
}
