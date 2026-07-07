import { getComplianceData } from "../queries";
import ComplianceExportButton from "./ComplianceExportButton";
import CriticalControlsClient from "./CriticalControlsClient";
import styles from "../dashboard.module.css";

const BAND_COLOR: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#22c55e", unknown: "#9b7de2",
};

const LEVEL_LABEL = ["", "Initial", "Developing", "Defined", "Managed", "Optimized"];

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
      <div style={{ flex: 1, height: 8, background: "rgba(117,76,190,0.1)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color, minWidth: 36, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

export default async function CompliancePage() {
  const data = await getComplianceData();

  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Complete the onboarding questionnaire to view your compliance status.</p>
      </div>
    );
  }

  const bandColor = BAND_COLOR[data.riskBand] ?? "#9b7de2";

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Compliance Status</h1>
          <p className={styles.pageSubtitle}>
            {data.frameworkId.toUpperCase()} — {data.domains.length} domains assessed
          </p>
        </div>
        <div className={styles.pageActions}>
          <ComplianceExportButton data={data} />
        </div>
      </div>

      {/* Summary stats */}
      <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
        {[
          { label: "Overall Risk Score", value: `${data.overallScore}`, sub: data.riskBand, color: bandColor, icon: styles.iconPurple },
          { label: "Compliance Rate", value: `${data.compliancePct}%`, sub: `${data.yesCount} controls met`, color: "#22c55e", icon: styles.iconGreen },
          { label: "Controls Failing", value: `${data.noCount}`, sub: "require remediation", color: "#ef4444", icon: styles.iconRed },
          { label: "Partial Controls", value: `${data.partialCount}`, sub: "partially compliant", color: "#f59e0b", icon: styles.iconAmber },
        ].map(({ label, value, sub, color, icon }) => (
          <div key={label} className={styles.statCard}>
            <div className={styles.statCardTop}>
              <span className={styles.statCardLabel}>{label}</span>
              <div className={`${styles.statCardIcon} ${icon}`} />
            </div>
            <div className={styles.statCardValue} style={{ color, fontSize: "1.75rem" }}>{value}</div>
            <div className={styles.statCardSub} style={{ textTransform: "capitalize" }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className={styles.grid21}>
        {/* Domain breakdown */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Domain Maturity Breakdown</h2>
            <span className={`${styles.badge} ${styles.badgePurple}`}>{data.frameworkId.toUpperCase()}</span>
          </div>
          <div className={styles.flexCol} style={{ gap: "1.1rem" }}>
            {data.domains.map((d) => {
              const color = d.rawScore >= 80 ? "#22c55e" : d.rawScore >= 60 ? "#f59e0b" : d.rawScore >= 40 ? "#f97316" : "#ef4444";
              return (
                <div key={d.domain}>
                  <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.83rem", color: "#ddd7ea", fontWeight: 500 }}>{d.domain}</span>
                    <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.7rem", color: "rgba(221,215,234,0.45)" }}>L{d.maturityLevel} — {d.label}</span>
                    </div>
                  </div>
                  <ScoreBar value={d.rawScore} color={color} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: response summary + maturity legend */}
        <div className={styles.flexCol} style={{ gap: "1.25rem" }}>
          <div className={styles.card}>
            <h2 className={`${styles.cardTitleLg} ${styles.mb1}`}>Response Summary</h2>
            {[
              { label: "Compliant", count: data.yesCount, color: "#22c55e" },
              { label: "Partial", count: data.partialCount, color: "#f59e0b" },
              { label: "Non-Compliant", count: data.noCount, color: "#ef4444" },
              { label: "Not Applicable", count: data.naCount, color: "rgba(221,215,234,0.3)" },
            ].map(({ label, count, color }) => (
              <div key={label} className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ padding: "0.65rem 0", borderBottom: "1px solid rgba(117,76,190,0.07)" }}>
                <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.5rem" }}>
                  <span className={styles.dot} style={{ background: color }} />
                  <span className={styles.textSm}>{label}</span>
                </div>
                <span style={{ fontWeight: 700, color, fontSize: "1rem" }}>{count}</span>
              </div>
            ))}
            <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ paddingTop: "0.65rem" }}>
              <span className={`${styles.textSm} ${styles.textMuted}`}>Total assessed</span>
              <span style={{ fontWeight: 700, color: "#ddd7ea", fontSize: "1rem" }}>{data.totalControls}</span>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={`${styles.cardTitleLg} ${styles.mb1}`}>Maturity Scale</h2>
            {LEVEL_LABEL.filter(Boolean).map((label, i) => {
              const level = i + 1;
              const color = level <= 2 ? "#ef4444" : level === 3 ? "#f59e0b" : level === 4 ? "#60a5fa" : "#22c55e";
              return (
                <div key={label} className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.6rem", padding: "0.4rem 0" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}22`, border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, color, flexShrink: 0 }}>
                    {level}
                  </div>
                  <span className={styles.textSm} style={{ color: "rgba(221,215,234,0.7)" }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Critical Controls — feeds the 4-framework gap formula */}
      {data.criticalControls.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <CriticalControlsClient
            controls={data.criticalControls}
            canEdit={data.role === "admin"}
          />
        </div>
      )}
    </>
  );
}
