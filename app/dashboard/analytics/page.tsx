"use client";

import styles from "../dashboard.module.css";

const RISK_TREND = [
  { month: "Nov", score: 85 }, { month: "Dec", score: 82 }, { month: "Jan", score: 79 },
  { month: "Feb", score: 76 }, { month: "Mar", score: 74 }, { month: "Apr", score: 71 }, { month: "May", score: 67 },
];
const COMPLIANCE_TREND = [
  { month: "Nov", pct: 60 }, { month: "Dec", pct: 63 }, { month: "Jan", pct: 65 },
  { month: "Feb", pct: 68 }, { month: "Mar", pct: 70 }, { month: "Apr", pct: 71 }, { month: "May", pct: 72 },
];
const ISSUES_TREND = [
  { month: "Nov", open: 18, resolved: 2 }, { month: "Dec", open: 16, resolved: 4 },
  { month: "Jan", open: 15, resolved: 5 }, { month: "Feb", open: 13, resolved: 7 },
  { month: "Mar", open: 12, resolved: 8 }, { month: "Apr", open: 10, resolved: 10 },
  { month: "May", open: 8, resolved: 12 },
];

function BarChart({ data, valueKey, color, maxVal }: { data: any[]; valueKey: string; color: string; maxVal: number }) {
  return (
    <div className={styles.barChart} style={{ height: 130 }}>
      {data.map((d) => {
        const val = d[valueKey];
        const h = (val / maxVal) * 100;
        return (
          <div key={d.month} className={styles.barCol}>
            <span className={styles.barValue}>{val}</span>
            <div className={styles.barFill} style={{ height: `${h}%`, background: color }} />
            <span className={styles.barLabel}>{d.month}</span>
          </div>
        );
      })}
    </div>
  );
}

function TwoBarChart({ data }: { data: typeof ISSUES_TREND }) {
  const max = Math.max(...data.map((d) => d.open));
  return (
    <div className={styles.barChart} style={{ height: 130 }}>
      {data.map((d) => (
        <div key={d.month} className={styles.barCol}>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: "85%", width: "100%" }}>
            <div style={{ flex: 1, borderRadius: "3px 3px 0 0", background: "#f87171", height: `${(d.open / max) * 100}%`, minHeight: 4 }} />
            <div style={{ flex: 1, borderRadius: "3px 3px 0 0", background: "#4ade80", height: `${(d.resolved / max) * 100}%`, minHeight: 4 }} />
          </div>
          <span className={styles.barLabel}>{d.month}</span>
        </div>
      ))}
    </div>
  );
}

const KPI_CARDS = [
  { label: "Avg Risk Score (90d)", value: "73", delta: "↓ improving", good: true },
  { label: "Compliance Growth", value: "+12%", delta: "over 6 months", good: true },
  { label: "Issues Resolved", value: "12", delta: "this quarter", good: true },
  { label: "Avg Days to Resolve", value: "18d", delta: "target: 14d", good: false },
];

export default function AnalyticsPage() {
  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Analytics & Trends</h1>
          <p className={styles.pageSubtitle}>Historical performance across all compliance metrics</p>
        </div>
      </div>

      {/* KPI row */}
      <div className={`${styles.grid4} ${styles.mb15}`}>
        {KPI_CARDS.map((k) => (
          <div key={k.label} className={styles.card}>
            <div className={styles.statCardLabel}>{k.label}</div>
            <div className={styles.statCardValue}>{k.value}</div>
            <div className={k.good ? styles.trendDown : styles.trendUp}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className={`${styles.grid2} ${styles.mb15}`}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Risk Score Over Time</h2>
            <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>Lower = better</span>
          </div>
          <BarChart data={RISK_TREND} valueKey="score" color="linear-gradient(180deg, #ef4444, #f97316)" maxVal={100} />
          <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)", marginTop: "0.5rem" }}>
            Trend: ↓ 18 points over 7 months — heading in the right direction
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Compliance Progress</h2>
            <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>Higher = better</span>
          </div>
          <BarChart data={COMPLIANCE_TREND} valueKey="pct" color="linear-gradient(180deg, #22c55e, #16a34a)" maxVal={100} />
          <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)", marginTop: "0.5rem" }}>
            Trend: ↑ 12% over 7 months — PIPEDA compliance improving steadily
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className={`${styles.grid21} ${styles.mb15}`}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Open vs Resolved Issues</h2>
            <div className={`${styles.flex} ${styles.gap04}`}>
              <span className={`${styles.badge} ${styles.badgeCritical}`}>● Open</span>
              <span className={`${styles.badge} ${styles.badgeGreen}`}>● Resolved</span>
            </div>
          </div>
          <TwoBarChart data={ISSUES_TREND} />
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitleLg}>Risk by Category</h2>
          </div>
          {[
            { name: "Governance", score: 40, color: "#ef4444" },
            { name: "Data Security", score: 62, color: "#f59e0b" },
            { name: "Access Control", score: 72, color: "#f59e0b" },
            { name: "Vendor Mgmt", score: 65, color: "#f59e0b" },
            { name: "Incident Response", score: 30, color: "#ef4444" },
            { name: "Training", score: 55, color: "#f59e0b" },
          ].map((c) => (
            <div key={c.name} style={{ marginBottom: "0.7rem" }}>
              <div className={`${styles.flex} ${styles.justifyBetween} ${styles.mb05}`}>
                <span className={styles.textSm}>{c.name}</span>
                <span className={styles.textSm} style={{ color: c.color, fontWeight: 600 }}>{c.score}%</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${c.score}%`, background: c.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
