"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import type { ReportsData } from "../queries";
import styles from "../dashboard.module.css";

const BAND_COLOR: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#22c55e",
};

function fmt(n: number, currency = "CAD") {
  if (n === 0) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className={styles.progressBar} style={{ height: 8 }}>
      <div style={{ width: `${Math.min((value / max) * 100, 100)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.6s" }} />
    </div>
  );
}

export default function ReportsClient({ data }: { data: ReportsData }) {
  const params = useSearchParams();
  const bandColor = BAND_COLOR[data.risk.band] ?? "#f59e0b";
  const generatedDate = new Date(data.generatedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    if (params.get("print") === "1") {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [params]);

  return (
    <>
      {/* Page header — hidden on print */}
      <div className={`${styles.pageHeader} d-print-none`}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Compliance Report</h1>
          <p className={styles.pageSubtitle}>Generated {generatedDate} · {data.session.frameworkId.toUpperCase()}</p>
        </div>
        <div className={styles.pageActions}>
          <button
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* ── Report content ── */}
      <div id="report-content">

        {/* Cover */}
        <div className={styles.card} style={{ marginBottom: "1.5rem", textAlign: "center", padding: "2rem 2rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(221,215,234,0.4)", textTransform: "uppercase", marginBottom: "0.5rem" }}>DIMA Risk — Compliance Report</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#ddd7ea", marginBottom: "0.25rem" }}>{data.org.name}</div>
          <div className={styles.textSm} style={{ color: "rgba(221,215,234,0.5)" }}>{data.org.industry} · {data.org.country}</div>
          <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.35)", marginTop: "0.5rem" }}>
            Framework: {data.session.frameworkId.toUpperCase()} ·
            Assessment: {data.session.completedAt ? new Date(data.session.completedAt).toLocaleDateString("en-CA") : "—"} ·
            Generated: {generatedDate}
          </div>
        </div>

        {/* Executive summary */}
        <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
          {[
            { label: "Risk Score", value: String(data.risk.total), sub: data.risk.band, color: bandColor, icon: styles.iconRed },
            { label: "Compliance", value: `${data.summary.compliancePct}%`, sub: `${data.summary.yes} compliant controls`, color: "#c4a8f0", icon: styles.iconPurple },
            { label: "Gaps Found", value: String(data.summary.no + data.summary.partial), sub: `${data.summary.no} non-compliant + ${data.summary.partial} partial`, color: "#f59e0b", icon: styles.iconAmber },
            { label: "Open Actions", value: String(data.tasks.length), sub: "remediation tasks", color: "#60a5fa", icon: styles.iconBlue },
          ].map(({ label, value, sub, color, icon }) => (
            <div key={label} className={styles.statCard}>
              <div className={styles.statCardTop}><span className={styles.statCardLabel}>{label}</span><div className={`${styles.statCardIcon} ${icon}`} /></div>
              <div className={styles.statCardValue} style={{ color, fontSize: "1.75rem" }}>{value}</div>
              <div className={styles.statCardSub}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Financial exposure */}
        {data.financial.totalMin > 0 && (
          <div className={styles.card} style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: 700, color: "#ddd7ea", marginBottom: "1rem", fontSize: "0.95rem" }}>Financial Exposure ({data.financial.currency})</div>
            <div className={styles.grid2}>
              {[
                { label: "Estimated Breach Cost", value: fmt(data.financial.breachCost, data.financial.currency) },
                { label: "Regulatory Fines (min–max)", value: `${fmt(data.financial.finesMin, data.financial.currency)} – ${fmt(data.financial.finesMax, data.financial.currency)}` },
                { label: "Total Exposure (min)", value: fmt(data.financial.totalMin, data.financial.currency) },
                { label: "Total Exposure (max)", value: fmt(data.financial.totalMax, data.financial.currency) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid rgba(117,76,190,0.08)" }}>
                  <span className={styles.textSm} style={{ color: "rgba(221,215,234,0.55)" }}>{label}</span>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#f87171" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk scores */}
        <div className={styles.card} style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontWeight: 700, color: "#ddd7ea", marginBottom: "1rem", fontSize: "0.95rem" }}>Risk Component Breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { label: "Exposure (Data Volume Risk)",  value: data.risk.exposure,    color: "#f59e0b" },
              { label: "Impact (Data Sensitivity)",    value: data.risk.impact,      color: "#f97316" },
              { label: "Control (Third-Party Risk)",   value: data.risk.control,     color: "#754cbe" },
              { label: "Likelihood (Compliance Gap)",  value: data.risk.likelihood,  color: "#ef4444" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                  <span className={styles.textSm} style={{ color: "rgba(221,215,234,0.7)" }}>{label}</span>
                  <span style={{ fontWeight: 600, fontSize: "0.82rem", color }}>{value}/25</span>
                </div>
                <ScoreBar value={value} max={25} color={color} />
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.5rem", borderTop: "1px solid rgba(117,76,190,0.15)", marginTop: "0.25rem" }}>
              <span className={styles.textSm} style={{ color: "#ddd7ea", fontWeight: 600 }}>Total Score</span>
              <span style={{ fontWeight: 700, fontSize: "0.88rem", color: bandColor }}>{data.risk.total}/100</span>
            </div>
          </div>
        </div>

        {/* Domain maturity */}
        <div className={styles.card} style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontWeight: 700, color: "#ddd7ea", marginBottom: "1rem", fontSize: "0.95rem" }}>Domain Maturity Scores</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {data.domains.map((d) => {
              const dc = d.rawScore >= 80 ? "#22c55e" : d.rawScore >= 60 ? "#f59e0b" : "#ef4444";
              return (
                <div key={d.domain}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <span className={styles.textSm} style={{ color: "rgba(221,215,234,0.7)" }}>{d.domain}</span>
                    <span style={{ fontWeight: 600, fontSize: "0.82rem", color: dc }}>L{d.maturityLevel} — {d.rawScore}/100</span>
                  </div>
                  <ScoreBar value={d.rawScore} color={dc} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Top action items */}
        {data.tasks.length > 0 && (
          <div className={styles.card}>
            <div style={{ fontWeight: 700, color: "#ddd7ea", marginBottom: "1rem", fontSize: "0.95rem" }}>Top Remediation Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {data.tasks.slice(0, 10).map((t, i) => {
                const pc = t.priority === "high" ? "#f97316" : t.priority === "critical" ? "#ef4444" : "#f59e0b";
                return (
                  <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.6rem 0", borderBottom: "1px solid rgba(117,76,190,0.06)", alignItems: "flex-start" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: pc, flexShrink: 0, marginTop: 7 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.85rem", color: "#ddd7ea", fontWeight: 500 }}>{t.title}</div>
                      {t.description && (
                        <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)", marginTop: "0.15rem" }}>
                          {t.description.slice(0, 120)}{t.description.length > 120 ? "…" : ""}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, color: pc, background: `${pc}18`, border: `1px solid ${pc}33`, padding: "0.1rem 0.4rem", borderRadius: 20 }}>{t.priority}</span>
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>{t.effort}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
