import { redirect } from "next/navigation";
import { getAssetsData } from "../queries";
import { queueScanJob } from "../../onboarding/actions";
import styles from "../dashboard.module.css";

function fmt(n: number) {
  return n.toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

function gradeColor(g: string | null) {
  if (!g) return "#6b7280";
  if (g === "A") return "#22c55e";
  if (g === "B") return "#84cc16";
  if (g === "C") return "#f59e0b";
  if (g === "D") return "#f97316";
  return "#ef4444";
}

export default async function AssetsPage() {
  const data = await getAssetsData();

  if (!data || data.noScope) {
    return (
      <>
        <div className={styles.pageHeader}>
          <div className={styles.pageTitleGroup}>
            <h1 className={styles.pageTitle}>Assets &amp; Network Scan</h1>
            <p className={styles.pageSubtitle}>EWNAF continuous attack-surface intelligence</p>
          </div>
        </div>

        <div className={styles.card} style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔍</div>
          <div style={{ fontWeight: 700, color: "#ddd7ea", fontSize: "1.1rem", marginBottom: "0.5rem" }}>No scan scope detected</div>
          <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.55)", maxWidth: 480, margin: "0 auto 1rem" }}>
            {data?.auditStatus === "NO_SCOPE"
              ? "Your IP address was classified as residential or private — EWNAF only scans public-facing healthcare infrastructure. Once your organization has a public IP associated with its environment, scan results will appear here automatically."
              : data?.auditStatus === "PENDING"
              ? "A scan has been queued and is currently processing. Results will appear here automatically once the scan completes — this usually takes a few minutes."
              : "No network scan data found. Make sure your organization IP is registered and a scan has been completed."}
          </p>
          {data?.orgIp && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center", background: "rgba(117,76,190,0.08)", border: "1px solid rgba(117,76,190,0.2)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.8rem", color: "rgba(221,215,234,0.6)", fontFamily: "monospace" }}>
                Registered IP: {data.orgIp}
              </div>
              <form action={async () => {
                "use server";
                await queueScanJob();
                redirect("/scanning");
              }}>
                <button type="submit" style={{ background: "rgba(117,76,190,0.15)", border: "1px solid rgba(117,76,190,0.35)", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", color: "#c4a8f0", cursor: "pointer", fontWeight: 600 }}>
                  Request Network Scan
                </button>
              </form>
            </div>
          )}
        </div>

        <div className={styles.grid2} style={{ marginTop: "1.5rem" }}>
          <div className={styles.card}>
            <div style={{ fontWeight: 600, color: "#ddd7ea", marginBottom: "0.5rem" }}>What EWNAF scans</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {["Open ports & exposed services", "TLS/SSL certificate health", "Web application headers", "Email security (SPF/DKIM/DMARC)", "DNS configuration", "Known CVE exposure"].map((item) => (
                <li key={item} className={styles.textSm} style={{ color: "rgba(221,215,234,0.55)", display: "flex", gap: "0.5rem" }}>
                  <span style={{ color: "#754cbe" }}>→</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.card}>
            <div style={{ fontWeight: 600, color: "#ddd7ea", marginBottom: "0.5rem" }}>Why this matters for PIPEDA</div>
            <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.55)", lineHeight: 1.7 }}>
              PIPEDA Principle 7 (Safeguards) requires organizations to protect personal health information against loss, theft, and unauthorized access. Continuous network scanning helps identify gaps before a breach occurs.
            </p>
          </div>
        </div>
      </>
    );
  }

  const gc = gradeColor(data.overallGrade);

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Assets &amp; Network Scan</h1>
          <p className={styles.pageSubtitle}>
            {data.devices.length} device{data.devices.length !== 1 ? "s" : ""} discovered
            {data.scannedAt ? ` · Last scan: ${new Date(data.scannedAt).toLocaleDateString("en-CA")}` : ""}
          </p>
        </div>
      </div>

      {/* Score cards */}
      <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Overall Grade</span><div className={`${styles.statCardIcon} ${styles.iconPurple}`} /></div>
          <div className={styles.statCardValue} style={{ color: gc, fontSize: "2rem", fontWeight: 800 }}>{data.overallGrade ?? "—"}</div>
          <div className={styles.statCardSub}>{data.defenseLevel ?? ""}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Global Score</span><div className={`${styles.statCardIcon} ${styles.iconBlue}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.75rem" }}>{fmt(data.globalScore)}</div>
          <div className={styles.statCardSub}>attack-surface score</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Devices Found</span><div className={`${styles.statCardIcon} ${styles.iconGreen}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.75rem" }}>{data.devices.length}</div>
          <div className={styles.statCardSub}>public-facing assets</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Scan Status</span><div className={`${styles.statCardIcon} ${styles.iconAmber}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1rem", color: "#22c55e", fontWeight: 700 }}>{data.auditStatus ?? "COMPLETE"}</div>
          {data.orgIp && <div className={styles.statCardSub} style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>{data.orgIp}</div>}
        </div>
      </div>

      {/* Devices table */}
      {data.devices.length > 0 && (
        <div className={styles.card} style={{ padding: 0 }}>
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid rgba(117,76,190,0.1)" }}>
            <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem" }}>Discovered Devices</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Host / IP</th>
                  <th>Type</th>
                  <th>Open Ports</th>
                  <th>Grade</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {data.devices.map((device, i) => {
                  const host = (device.host ?? device.ip ?? device.hostname ?? `Device ${i + 1}`) as string;
                  const devType = (device.type ?? device.device_type ?? "Unknown") as string;
                  const ports = Array.isArray(device.open_ports) ? (device.open_ports as number[]).join(", ") : (device.ports as string) ?? "—";
                  const grade = (device.grade ?? device.overall_grade ?? null) as string | null;
                  const score = Number(device.score ?? device.global_score ?? 0);
                  const dgc = gradeColor(grade);
                  return (
                    <tr key={i}>
                      <td><span style={{ fontFamily: "monospace", fontSize: "0.82rem", color: "#ddd7ea" }}>{host}</span></td>
                      <td><span className={`${styles.badge} ${styles.badgePurple}`}>{devType}</span></td>
                      <td><span className={styles.textXs} style={{ fontFamily: "monospace", color: "rgba(221,215,234,0.55)" }}>{ports}</span></td>
                      <td><span style={{ fontWeight: 700, color: dgc }}>{grade ?? "—"}</span></td>
                      <td><span style={{ color: "rgba(221,215,234,0.7)", fontSize: "0.85rem" }}>{score > 0 ? fmt(score) : "—"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Network & audit finding summaries */}
      {(Object.keys(data.networkFindings).length > 0 || Object.keys(data.auditFindings).length > 0) && (
        <div className={styles.grid2} style={{ marginTop: "1.5rem" }}>
          {Object.keys(data.networkFindings).length > 0 && (
            <div className={styles.card}>
              <div style={{ fontWeight: 600, color: "#ddd7ea", marginBottom: "0.75rem" }}>Network Findings</div>
              {Object.entries(data.networkFindings).map(([key, val]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: "1px solid rgba(117,76,190,0.06)" }}>
                  <span className={styles.textSm} style={{ color: "rgba(221,215,234,0.55)" }}>{key.replace(/_/g, " ")}</span>
                  <span className={styles.textSm} style={{ color: "#ddd7ea", fontWeight: 500 }}>{String(val)}</span>
                </div>
              ))}
            </div>
          )}
          {Object.keys(data.auditFindings).length > 0 && (
            <div className={styles.card}>
              <div style={{ fontWeight: 600, color: "#ddd7ea", marginBottom: "0.75rem" }}>Audit Findings</div>
              {Object.entries(data.auditFindings).map(([key, val]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: "1px solid rgba(117,76,190,0.06)" }}>
                  <span className={styles.textSm} style={{ color: "rgba(221,215,234,0.55)" }}>{key.replace(/_/g, " ")}</span>
                  <span className={styles.textSm} style={{ color: "#ddd7ea", fontWeight: 500 }}>{String(val)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
