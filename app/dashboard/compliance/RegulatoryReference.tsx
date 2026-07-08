import styles from "../dashboard.module.css";

// Static reference data — Fines spec §1.5 (side-by-side) + §1.6 (landmark cases).
const COMPARISON: { dim: string; gdpr: string; hipaa: string; canada: string; iso: string }[] = [
  { dim: "Max fine", gdpr: "€20M or 4% global rev.", hipaa: "$2,190,294/yr per provision", canada: "C$25M or 4% turnover (Law 25)", iso: "None (indirect only)" },
  { dim: "Enforcer", gdpr: "27 national DPAs", hipaa: "HHS OCR + DOJ", canada: "OPC / CAI (Quebec)", iso: "Certification bodies" },
  { dim: "Direct fine power", gdpr: "Yes", hipaa: "Yes", canada: "Quebec: yes / Federal: no", iso: "No" },
  { dim: "Criminal liability", gdpr: "Varies by state", hipaa: "Yes, up to 10 yrs", canada: "Yes, C$100K (PIPEDA)", iso: "No" },
  { dim: "Breach notification", gdpr: "72 hours", hipaa: "60 days", canada: "ASAP / 72h (Law 25)", iso: "Per contract SLA" },
  { dim: "Extraterritorial", gdpr: "Yes", hipaa: "Limited to US", canada: "Yes (Law 25)", iso: "No" },
];

const CASES: { framework: string; org: string; fine: string; summary: string }[] = [
  { framework: "GDPR", org: "Meta Platforms (2023)", fine: "€1.2B", summary: "Largest GDPR fine — EU-US transfers inadequate under Schrems II" },
  { framework: "GDPR", org: "TikTok (2025)", fine: "€530M", summary: "EU user data accessible from China without equivalent protection" },
  { framework: "GDPR", org: "LinkedIn Ireland (2024)", fine: "€310M", summary: "Invalid consent for behavioral profiling / targeted ads" },
  { framework: "HIPAA", org: "Anthem Inc. (2018)", fine: "$16M", summary: "78.8M records breached, no enterprise risk analysis conducted" },
  { framework: "HIPAA", org: "Premera Blue Cross (2020)", fine: "$6.85M + $84M state", summary: "10.4M records; intrusion undetected for 9 months" },
  { framework: "Canada", org: "OpenAI (2025)", fine: "Compliance order", summary: "Invalid consent for data scraping in AI model training" },
];

export default function RegulatoryReference() {
  return (
    <div style={{ marginTop: "1.5rem" }} className={styles.grid2}>
      {/* Side-by-side comparison */}
      <div className={styles.card} style={{ padding: 0 }}>
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid rgba(117,76,190,0.1)" }}>
          <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem" }}>Framework Comparison</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th></th><th>GDPR</th><th>HIPAA</th><th>Canada</th><th>ISO 27001</th></tr>
            </thead>
            <tbody>
              {COMPARISON.map((r) => (
                <tr key={r.dim}>
                  <td style={{ color: "rgba(221,215,234,0.55)", fontWeight: 500 }}>{r.dim}</td>
                  <td className={styles.textXs}>{r.gdpr}</td>
                  <td className={styles.textXs}>{r.hipaa}</td>
                  <td className={styles.textXs}>{r.canada}</td>
                  <td className={styles.textXs}>{r.iso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Landmark enforcement cases */}
      <div className={styles.card} style={{ padding: 0 }}>
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid rgba(117,76,190,0.1)" }}>
          <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem" }}>Comparable Enforcement Cases</span>
        </div>
        <div style={{ padding: "0.5rem 1.25rem" }}>
          {CASES.map((c) => (
            <div key={c.org} style={{ padding: "0.55rem 0", borderBottom: "1px solid rgba(117,76,190,0.06)" }}>
              <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`}>
                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#ddd7ea" }}>
                  <span className={`${styles.badge} ${styles.badgePurple}`} style={{ fontSize: "0.6rem", marginRight: "0.4rem" }}>{c.framework}</span>
                  {c.org}
                </span>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f87171" }}>{c.fine}</span>
              </div>
              <p className={styles.textXs} style={{ color: "rgba(221,215,234,0.5)", margin: "0.2rem 0 0" }}>{c.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
