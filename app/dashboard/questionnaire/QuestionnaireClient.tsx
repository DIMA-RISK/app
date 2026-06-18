"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { QuestionnaireData } from "../queries";
import styles from "../dashboard.module.css";

const RESPONSE_COLOR: Record<string, string> = {
  yes: "#22c55e", no: "#ef4444", partial: "#f59e0b", na: "rgba(221,215,234,0.25)",
};
const RESPONSE_LABEL: Record<string, string> = {
  yes: "Compliant", no: "Non-Compliant", partial: "Partial", na: "N/A",
};

export default function QuestionnaireClient({ data }: { data: QuestionnaireData }) {
  const [openDomains, setOpenDomains] = useState<Set<string>>(new Set());

  function toggle(domain: string) {
    setOpenDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) { next.delete(domain); } else { next.add(domain); }
      return next;
    });
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Questionnaire Review</h1>
          <p className={styles.pageSubtitle}>{data.frameworkId.toUpperCase()} — {data.summary.total} responses across {data.domains.length} domains</p>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
        {[
          { label: "Compliant", value: data.summary.yes, color: "#22c55e", icon: styles.iconGreen },
          { label: "Non-Compliant", value: data.summary.no, color: "#ef4444", icon: styles.iconRed },
          { label: "Partial", value: data.summary.partial, color: "#f59e0b", icon: styles.iconAmber },
          { label: "Not Applicable", value: data.summary.na, color: "rgba(221,215,234,0.4)", icon: styles.iconPurple },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className={styles.statCard}>
            <div className={styles.statCardTop}><span className={styles.statCardLabel}>{label}</span><div className={`${styles.statCardIcon} ${icon}`} /></div>
            <div className={styles.statCardValue} style={{ color, fontSize: "1.75rem" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Domains — collapsible */}
      <div className={styles.flexCol} style={{ gap: "0.75rem" }}>
        {data.domains.map((domain) => {
          const isOpen = openDomains.has(domain.domain);
          const scoreColor = domain.rawScore >= 80 ? "#22c55e" : domain.rawScore >= 60 ? "#f59e0b" : "#ef4444";
          return (
            <div key={domain.domain} className={styles.card} style={{ padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => toggle(domain.domain)}
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}
              >
                <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.75rem", flex: 1, minWidth: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: `${scoreColor}18`, border: `1px solid ${scoreColor}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", color: scoreColor, flexShrink: 0 }}>
                    {domain.rawScore}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem" }}>{domain.domain}</div>
                    <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)" }}>
                      L{domain.maturityLevel} — {domain.label} · {domain.questions.length} controls
                    </div>
                  </div>
                </div>
                <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.5rem", flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: 3 }}>
                    {(["yes", "partial", "no"] as const).map((r) => {
                      const count = domain.questions.filter((q) => q.response === r).length;
                      if (count === 0) return null;
                      return <span key={r} className={styles.dot} style={{ background: RESPONSE_COLOR[r], width: 8, height: 8 }} title={`${count} ${r}`} />;
                    })}
                  </div>
                  {isOpen ? <ChevronUp size={16} color="rgba(221,215,234,0.5)" /> : <ChevronDown size={16} color="rgba(221,215,234,0.5)" />}
                </div>
              </button>

              {isOpen && (
                <div style={{ borderTop: "1px solid rgba(117,76,190,0.1)" }}>
                  {domain.questions.map((q, i) => (
                    <div key={q.id} style={{
                      display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem 1.25rem",
                      borderBottom: i < domain.questions.length - 1 ? "1px solid rgba(117,76,190,0.06)" : "none",
                      background: q.response === "no" ? "rgba(239,68,68,0.03)" : q.response === "partial" ? "rgba(245,158,11,0.03)" : "transparent",
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: RESPONSE_COLOR[q.response] ?? "gray", flexShrink: 0, marginTop: 7 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.83rem", color: "#ddd7ea", lineHeight: 1.45 }}>{q.text}</div>
                        {q.response !== "yes" && q.response !== "na" && q.complianceStatement && (
                          <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)", marginTop: "0.25rem", lineHeight: 1.4 }}>{q.complianceStatement}</div>
                        )}
                      </div>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, color: RESPONSE_COLOR[q.response], background: `${RESPONSE_COLOR[q.response]}18`, border: `1px solid ${RESPONSE_COLOR[q.response]}33`, padding: "0.15rem 0.45rem", borderRadius: 20, flexShrink: 0 }}>
                        {RESPONSE_LABEL[q.response] ?? q.response}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
