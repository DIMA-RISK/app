import { getAnalyticsData } from "../queries";
import styles from "../dashboard.module.css";

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const h = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={styles.barCol}>
      <span className={styles.barValue}>{value}</span>
      <div className={styles.barFill} style={{ height: `${h}%`, background: color }} />
      <span className={styles.barLabel} style={{ fontSize: "0.6rem", textAlign: "center" }}>{label}</span>
    </div>
  );
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Complete the onboarding questionnaire to view analytics.</p>
      </div>
    );
  }

  const maxDomain = Math.max(...data.domains.map((d) => d.rawScore), 1);
  const totalFinancial = data.financial.breachCost + data.financial.finesMax;
  const fmt = (n: number) => n.toLocaleString("en-CA", { style: "currency", currency: data.financial.currency, maximumFractionDigits: 0 });
  const bandColor = data.risk.band === "critical" ? "#ef4444" : data.risk.band === "high" ? "#f97316" : data.risk.band === "medium" ? "#f59e0b" : "#22c55e";

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Analytics</h1>
          <p className={styles.pageSubtitle}>Risk breakdown, maturity scores, and financial exposure</p>
        </div>
      </div>

      {/* Top stats */}
      <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
        {[
          { label: "Risk Score", value: `${data.risk.total}`, sub: data.risk.band, color: bandColor },
          { label: "Compliance Rate", value: `${data.compliancePct}%`, sub: "controls met", color: "#22c55e" },
          { label: "Financial Exposure", value: fmt(data.financial.totalMin), sub: `up to ${fmt(data.financial.totalMax)}`, color: "#f59e0b" },
          { label: "Domains Assessed", value: `${data.domains.length}`, sub: "PIPEDA domains", color: "#9b7de2" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className={styles.statCard}>
            <div className={styles.statCardTop}><span className={styles.statCardLabel}>{label}</span></div>
            <div className={styles.statCardValue} style={{ color, fontSize: "1.6rem" }}>{value}</div>
            <div className={styles.statCardSub} style={{ textTransform: "capitalize" }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className={styles.grid2} style={{ marginBottom: "1.25rem" }}>
        {/* Domain maturity chart */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Domain Maturity Scores</h2>
            <span className={`${styles.badge} ${styles.badgePurple}`}>PIPEDA</span>
          </div>
          <div className={styles.barChart} style={{ height: 160, alignItems: "flex-end", gap: "0.35rem" }}>
            {data.domains.map((d) => {
              const color = d.rawScore >= 80 ? "#22c55e" : d.rawScore >= 60 ? "#60a5fa" : d.rawScore >= 40 ? "#f59e0b" : "#ef4444";
              const shortLabel = d.domain.split(/[\s/–-]/)[0];
              return <Bar key={d.domain} value={d.rawScore} max={maxDomain} color={color} label={shortLabel} />;
            })}
          </div>
          <div className={`${styles.flex} ${styles.gap1}`} style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
            {[["≥80 Optimized", "#22c55e"], ["60–79 Managed", "#60a5fa"], ["40–59 Defined", "#f59e0b"], ["<40 Developing", "#ef4444"]].map(([l, c]) => (
              <span key={l} className={`${styles.flex} ${styles.itemsCenter} ${styles.textXs} ${styles.textMuted}`} style={{ gap: "0.3rem" }}>
                <span className={styles.dot} style={{ background: c as string }} />{l}
              </span>
            ))}
          </div>
        </div>

        {/* Risk component breakdown */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Risk Component Breakdown</h2>
          </div>
          <div className={styles.flexCol} style={{ gap: "1rem" }}>
            {[
              { label: "Likelihood Score", value: data.risk.likelihood, max: 100, color: "#ef4444" },
              { label: "Impact Score", value: data.risk.impact, max: 100, color: "#f97316" },
              { label: "Control Gap Score", value: data.risk.control, max: 100, color: "#f59e0b" },
            ].map(({ label, value, max, color }) => (
              <div key={label}>
                <div className={`${styles.flex} ${styles.justifyBetween}`} style={{ marginBottom: "0.35rem" }}>
                  <span className={styles.textSm} style={{ color: "rgba(221,215,234,0.75)" }}>{label}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color }}>{value}</span>
                </div>
                <div style={{ height: 8, background: "rgba(117,76,190,0.1)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
            <div style={{ padding: "0.75rem 0 0", borderTop: "1px solid rgba(117,76,190,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className={`${styles.textSm} ${styles.textMuted}`}>Overall Risk Score</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 700, color: bandColor }}>{data.risk.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial exposure */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitleLg}>Financial Exposure ({data.financial.currency})</h2>
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f59e0b" }}>{fmt(data.financial.totalMax)}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
          {[
            { label: "Estimated Breach Cost", value: data.financial.breachCost, pct: totalFinancial > 0 ? (data.financial.breachCost / totalFinancial) * 100 : 0, color: "#ef4444" },
            { label: "Regulatory Fines (max)", value: data.financial.finesMax, pct: totalFinancial > 0 ? (data.financial.finesMax / totalFinancial) * 100 : 0, color: "#f97316" },
            { label: "Min Total Exposure", value: data.financial.totalMin, pct: 100, color: "#f59e0b" },
          ].map(({ label, value, pct, color }) => (
            <div key={label} className={styles.card} style={{ padding: "1rem" }}>
              <div className={`${styles.textXs} ${styles.textMuted}`} style={{ marginBottom: "0.5rem" }}>{label}</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color, marginBottom: "0.5rem" }}>{fmt(value)}</div>
              <div style={{ height: 4, background: "rgba(117,76,190,0.1)", borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
