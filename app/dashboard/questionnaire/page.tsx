"use client";

import { useState } from "react";
import { Edit2, Check, X, Search } from "lucide-react";
import styles from "../dashboard.module.css";

const CATEGORIES = [
  {
    id: "governance",
    label: "Governance",
    questions: [
      { id: "Q-001", text: "Do you have a designated Privacy Officer?", answer: "no", updated: "May 23, 2026", complete: false },
      { id: "Q-002", text: "Do you have a documented privacy policy?", answer: "yes", updated: "May 20, 2026", complete: true },
      { id: "Q-003", text: "Are privacy policies reviewed annually?", answer: "partial", updated: "May 20, 2026", complete: true },
      { id: "Q-004", text: "Is there an executive sponsor for privacy compliance?", answer: "no", updated: "May 23, 2026", complete: false },
    ],
  },
  {
    id: "data",
    label: "Data Collection",
    questions: [
      { id: "Q-005", text: "Do you document what personal data you collect?", answer: "yes", updated: "May 18, 2026", complete: true },
      { id: "Q-006", text: "Do you collect only the minimum necessary data?", answer: "partial", updated: "May 18, 2026", complete: true },
      { id: "Q-007", text: "Is consent obtained before collecting personal information?", answer: "yes", updated: "May 18, 2026", complete: true },
      { id: "Q-008", text: "Can individuals withdraw consent easily?", answer: "no", updated: "May 23, 2026", complete: false },
    ],
  },
  {
    id: "storage",
    label: "Storage Practices",
    questions: [
      { id: "Q-009", text: "Is personal data encrypted at rest?", answer: "partial", updated: "May 21, 2026", complete: true },
      { id: "Q-010", text: "Do you have a data retention schedule?", answer: "no", updated: "May 23, 2026", complete: false },
      { id: "Q-011", text: "Are backups encrypted and tested regularly?", answer: "partial", updated: "May 21, 2026", complete: true },
      { id: "Q-012", text: "Is data stored in Canada or a PIPEDA-compliant jurisdiction?", answer: "yes", updated: "May 19, 2026", complete: true },
    ],
  },
  {
    id: "security",
    label: "Security Controls",
    questions: [
      { id: "Q-013", text: "Is MFA enforced for all system access?", answer: "no", updated: "May 23, 2026", complete: false },
      { id: "Q-014", text: "Are access rights reviewed at least quarterly?", answer: "partial", updated: "May 22, 2026", complete: true },
      { id: "Q-015", text: "Is there a vulnerability management program?", answer: "partial", updated: "May 22, 2026", complete: true },
      { id: "Q-016", text: "Are portable devices encrypted?", answer: "no", updated: "May 23, 2026", complete: false },
    ],
  },
  {
    id: "access",
    label: "Access Management",
    questions: [
      { id: "Q-017", text: "Is the principle of least privilege applied?", answer: "yes", updated: "May 17, 2026", complete: true },
      { id: "Q-018", text: "Are departing employees' accounts revoked within 24 hours?", answer: "partial", updated: "May 20, 2026", complete: true },
      { id: "Q-019", text: "Do you have a formal access request process?", answer: "yes", updated: "May 17, 2026", complete: true },
    ],
  },
  {
    id: "incident",
    label: "Incident Response",
    questions: [
      { id: "Q-020", text: "Do you have a documented breach response plan?", answer: "no", updated: "May 23, 2026", complete: false },
      { id: "Q-021", text: "Is there a process to notify OPC within 72 hours?", answer: "no", updated: "May 23, 2026", complete: false },
      { id: "Q-022", text: "Have staff been trained on breach reporting?", answer: "partial", updated: "May 22, 2026", complete: true },
    ],
  },
  {
    id: "vendors",
    label: "Vendors / Third Parties",
    questions: [
      { id: "Q-023", text: "Do all vendors with data access have signed DPAs?", answer: "no", updated: "May 23, 2026", complete: false },
      { id: "Q-024", text: "Are vendor privacy practices reviewed annually?", answer: "partial", updated: "May 21, 2026", complete: true },
      { id: "Q-025", text: "Do you have an up-to-date vendor inventory?", answer: "yes", updated: "May 19, 2026", complete: true },
    ],
  },
  {
    id: "training",
    label: "Employee Training",
    questions: [
      { id: "Q-026", text: "Do all staff complete privacy training on hire?", answer: "partial", updated: "May 22, 2026", complete: true },
      { id: "Q-027", text: "Is annual refresher privacy training conducted?", answer: "no", updated: "May 23, 2026", complete: false },
      { id: "Q-028", text: "Are training records documented and retained?", answer: "partial", updated: "May 22, 2026", complete: true },
    ],
  },
];

const ANSWER_BADGE: Record<string, { cls: string; label: string }> = {
  yes: { cls: styles.badgeGreen, label: "Yes" },
  no: { cls: styles.badgeCritical, label: "No" },
  partial: { cls: styles.badgeMedium, label: "Partial" },
  na: { cls: styles.badgeGray, label: "N/A" },
};

export default function QuestionnairePage() {
  const [activeTab, setActiveTab] = useState("governance");
  const [search, setSearch] = useState("");

  const category = CATEGORIES.find((c) => c.id === activeTab)!;
  const questions = category.questions.filter((q) =>
    q.text.toLowerCase().includes(search.toLowerCase())
  );

  const totalAnswered = CATEGORIES.flatMap((c) => c.questions).filter((q) => q.complete).length;
  const total = CATEGORIES.flatMap((c) => c.questions).length;

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Questionnaire Responses</h1>
          <p className={styles.pageSubtitle}>{totalAnswered}/{total} questions answered · PIPEDA assessment</p>
        </div>
        <div className={styles.pageActions}>
          <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}>Save Draft</button>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}><Check size={14} /> Submit Updates</button>
        </div>
      </div>

      {/* Overall progress */}
      <div className={`${styles.card} ${styles.mb15}`}>
        <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb05}`}>
          <span className={styles.textSm}>Completion</span>
          <span style={{ fontWeight: 700, color: "#c4a8f0" }}>{Math.round((totalAnswered / total) * 100)}%</span>
        </div>
        <div className={styles.progressBar}>
          <div className={`${styles.progressFill} ${styles.fillPurple}`} style={{ width: `${(totalAnswered / total) * 100}%` }} />
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "1.25rem", maxWidth: 400 }}>
        <Search size={14} style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "rgba(221,215,234,0.35)" }} />
        <input className={styles.topnavSearchInput} style={{ paddingLeft: "2.1rem", width: "100%", fontSize: "0.85rem", borderRadius: 8 }}
          placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Category tabs */}
      <div className={styles.tabs}>
        {CATEGORIES.map((c) => {
          const answered = c.questions.filter((q) => q.complete).length;
          return (
            <button key={c.id} className={`${styles.tab} ${activeTab === c.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(c.id)}>
              {c.label} <span style={{ opacity: 0.5, marginLeft: 4 }}>({answered}/{c.questions.length})</span>
            </button>
          );
        })}
      </div>

      {/* Questions */}
      <div className={styles.flexCol} style={{ gap: "0.6rem" }}>
        {questions.map((q) => {
          const ans = ANSWER_BADGE[q.answer] ?? ANSWER_BADGE.na;
          return (
            <div key={q.id} className={styles.card} style={{ padding: "1rem 1.25rem" }}>
              <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`}>
                <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`} style={{ flex: 1 }}>
                  <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.3)", fontFamily: "monospace", flexShrink: 0 }}>{q.id}</span>
                  <span className={styles.textSm} style={{ color: "#ddd7ea", fontWeight: 500 }}>{q.text}</span>
                </div>
                <div className={`${styles.flex} ${styles.gap04} ${styles.itemsCenter}`} style={{ flexShrink: 0, marginLeft: "1rem" }}>
                  <span className={`${styles.badge} ${ans.cls}`}>{ans.label}</span>
                  <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.35)" }}>{q.updated}</span>
                  <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnXs}`}><Edit2 size={11} /></button>
                </div>
              </div>
            </div>
          );
        })}
        {questions.length === 0 && (
          <div className={styles.emptyState}><X size={28} className={styles.emptyIcon} /><p className={styles.emptyText}>No questions match your search.</p></div>
        )}
      </div>
    </>
  );
}
