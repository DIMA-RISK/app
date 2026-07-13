import { redirect } from "next/navigation";
import { getAssetsData, type AssetsData, type ScanFindingRow, type DataAssetProcess } from "../queries";
import { queueScanJob } from "../../onboarding/actions";
import { SeverityBadge } from "../_components/SeverityBadge";
import styles from "../dashboard.module.css";

function fmt(n: number) {
  return n.toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

// Per-module ("category") scan scores — the 8-ish modules the audit reports.
function ModuleScores({ scores }: { scores: AssetsData["categoryScores"] }) {
  if (scores.length === 0) return null;
  return (
    <div className={styles.card} style={{ marginTop: "1.5rem" }}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitleLg}>Scan Module Scores</h2>
        <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>lower is safer</span>
      </div>
      <div className={styles.grid3} style={{ gap: "0.75rem" }}>
        {scores.map((c) => {
          const color = c.score <= 10 ? "#22c55e" : c.score <= 30 ? "#84cc16" : c.score <= 60 ? "#f59e0b" : c.score <= 80 ? "#f97316" : "#ef4444";
          return (
            <div key={c.category} style={{ background: "rgba(0,2,18,0.35)", border: "1px solid rgba(117,76,190,0.15)", borderRadius: 10, padding: "0.7rem 0.9rem" }}>
              <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ marginBottom: "0.4rem" }}>
                <span className={styles.textSm} style={{ color: "#ddd7ea" }}>{c.category}</span>
                <span style={{ fontWeight: 700, color, fontSize: "0.9rem" }}>{c.score}</span>
              </div>
              <div className={styles.progressBar} style={{ height: 5 }}>
                <div style={{ height: "100%", width: `${Math.min(100, c.score)}%`, background: color, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Full structured findings list, most severe first.
function FindingsReport({ findings }: { findings: ScanFindingRow[] }) {
  if (findings.length === 0) return null;
  const sorted = [...findings].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  return (
    <div className={styles.card} style={{ marginTop: "1.5rem" }}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitleLg}>Scan Findings</h2>
        <span className={`${styles.badge} ${styles.badgePurple}`}>{findings.length}</span>
      </div>
      <div className={styles.flexCol} style={{ gap: "0.6rem" }}>
        {sorted.map((f) => (
          <div key={f.id} style={{ padding: "0.7rem 0.9rem", background: "rgba(0,2,18,0.35)", border: "1px solid rgba(117,76,190,0.12)", borderRadius: 10 }}>
            <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`} style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <SeverityBadge level={f.severity} title={`Severity: ${f.severity}`} />
                <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.85rem" }}>{f.title}</span>
                <span className={`${styles.badge} ${styles.badgeGray}`}>{f.category}</span>
              </div>
              <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)", fontFamily: "monospace" }}>
                {f.host}{f.confidence !== null ? ` · ${Math.round(f.confidence * 100)}% conf.` : ""}
              </div>
            </div>
            {f.description && (
              <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.6)", margin: "0.4rem 0 0" }}>{f.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const VOLUME_LABEL: Record<string, string> = { minimal: "Minimal", low: "Low", medium: "Medium", high: "High", very_high: "Very High" };
const CONTROLLER_LABEL: Record<string, string> = { controller: "Controller", joint_controller: "Joint Controller", processor: "Processor", dont_know: "Unknown" };

// Data/process asset inventory from the GDPR process register.
function DataAssetInventory({ processes }: { processes: DataAssetProcess[] }) {
  return (
    <div className={styles.card} style={{ marginTop: "1.5rem", padding: 0 }}>
      <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid rgba(117,76,190,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem" }}>Data Asset Inventory</span>
        <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>from the Process Analysis register</span>
      </div>
      {processes.length === 0 ? (
        <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.5)", padding: "1.25rem" }}>
          No data/process assets recorded yet. Add processes in the{" "}
          <a href="/dashboard/gdpr" style={{ color: "#9b7de2" }}>GDPR Assessment</a> → Process Analysis section to build your data inventory.
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Process</th>
                <th>Role</th>
                <th>Data</th>
                <th>Volume</th>
                <th>Lawful Basis</th>
                <th>Transborder</th>
                <th>Compliant</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: "#ddd7ea" }}>{p.processName}</div>
                    {p.notes && <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>{p.notes}</div>}
                  </td>
                  <td>{p.controllerStatus ? CONTROLLER_LABEL[p.controllerStatus] ?? p.controllerStatus : "—"}</td>
                  <td>
                    <div className={styles.flex} style={{ gap: "0.25rem", flexWrap: "wrap" }}>
                      {p.personalData && <span className={`${styles.badge} ${styles.badgeInfo}`}>PII</span>}
                      {p.specialCategory && <span className={`${styles.badge} ${styles.badgeHigh}`}>Special</span>}
                      {p.childrenData && <span className={`${styles.badge} ${styles.badgeMedium}`}>Children</span>}
                      {!p.personalData && !p.specialCategory && !p.childrenData && "—"}
                    </div>
                  </td>
                  <td>{p.dataVolume ? VOLUME_LABEL[p.dataVolume] ?? p.dataVolume : "—"}</td>
                  <td className={styles.textSm}>{p.lawfulBasis ?? "—"}</td>
                  <td className={styles.textSm}>{p.transborder ?? "—"}</td>
                  <td>
                    <span className={`${styles.badge} ${p.gdprCompliant === "yes" ? styles.badgeGreen : p.gdprCompliant === "q_yes" ? styles.badgeMedium : styles.badgeCritical}`}>
                      {p.gdprCompliant === "yes" ? "Yes" : p.gdprCompliant === "q_yes" ? "Qualified" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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

        {/* Data inventory is independent of the network scan — always show it. */}
        <DataAssetInventory processes={data?.processes ?? []} />
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
            {data.devices.length > 0
              ? `${data.devices.length} device${data.devices.length !== 1 ? "s" : ""} discovered`
              : "Scan complete · no public-facing assets found"}
            {data.scannedAt ? ` · Last scan: ${new Date(data.scannedAt).toLocaleDateString("en-CA")}` : ""}
          </p>
        </div>
        {data.orgIp && (
          <div className={styles.pageActions}>
            <form action={async () => {
              "use server";
              await queueScanJob();
              redirect("/scanning");
            }}>
              <button type="submit" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
                Re-scan Network
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Score cards */}
      <div className={styles.statGrid} style={{ marginBottom: "1.5rem" }}>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Overall Grade</span><div className={`${styles.statCardIcon} ${styles.iconPurple}`} /></div>
          <div className={styles.statCardValue} style={{ color: gc, fontSize: "2rem", fontWeight: 800 }}>{data.overallGrade ?? "—"}</div>
          <div className={styles.statCardSub}>{data.defenseLevel ?? ""}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Risk Score</span><div className={`${styles.statCardIcon} ${styles.iconBlue}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.75rem" }}>{fmt(data.globalScore)}</div>
          <div className={styles.statCardSub}>aggregate risk score</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>Hosts Found</span><div className={`${styles.statCardIcon} ${styles.iconGreen}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.75rem" }}>{data.devices.length}</div>
          <div className={styles.statCardSub}>public-facing assets</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}><span className={styles.statCardLabel}>High-Risk Findings</span><div className={`${styles.statCardIcon} ${styles.iconAmber}`} /></div>
          <div className={styles.statCardValue} style={{ fontSize: "1.75rem", color: data.highRiskCount > 0 ? "#ef4444" : "#22c55e" }}>{data.highRiskCount}</div>
          <div className={styles.statCardSub}>{data.orgIp ?? "scanned IP"}</div>
        </div>
      </div>

      {/* No public assets found after a completed scan */}
      {data.devices.length === 0 && (
        <div className={styles.card} style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.6rem" }}>🛡️</div>
          <div style={{ fontWeight: 700, color: "#ddd7ea", fontSize: "1rem", marginBottom: "0.4rem" }}>No Public Assets Detected</div>
          <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.55)", maxWidth: 460, margin: "0 auto 1rem" }}>
            EWNAF completed the scan of{data.orgIp ? <> <span style={{ fontFamily: "monospace", color: "rgba(221,215,234,0.7)" }}>{data.orgIp}</span></> : " your registered IP"} but found no publicly reachable services or devices.
            This typically means the IP is behind NAT, a firewall, or a residential gateway. If you believe this is incorrect, request a new scan after confirming your network configuration.
          </p>
          {data.orgIp && (
            <form action={async () => {
              "use server";
              await queueScanJob();
              redirect("/scanning");
            }}>
              <button type="submit" style={{ background: "rgba(117,76,190,0.15)", border: "1px solid rgba(117,76,190,0.35)", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", color: "#c4a8f0", cursor: "pointer", fontWeight: 600 }}>
                Request New Scan
              </button>
            </form>
          )}
        </div>
      )}

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
                  <th>Hostname</th>
                  <th>IP Address</th>
                  <th>Open Ports</th>
                  <th>Grade</th>
                  <th>Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {data.devices.map((device, i) => {
                  const host = (device.host ?? device.hostname ?? `Host ${i + 1}`) as string;
                  const ip = (device.ip ?? "") as string;
                  const ports = Array.isArray(device.open_ports) && (device.open_ports as number[]).length > 0
                    ? (device.open_ports as number[]).join(", ")
                    : "—";
                  const grade = (device.grade ?? null) as string | null;
                  const riskScore = Number(device.risk_score ?? 0);
                  const dgc = gradeColor(grade);
                  return (
                    <tr key={i}>
                      <td><span style={{ fontFamily: "monospace", fontSize: "0.82rem", color: "#ddd7ea" }}>{host}</span></td>
                      <td><span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "rgba(221,215,234,0.55)" }}>{ip || "—"}</span></td>
                      <td><span className={styles.textXs} style={{ fontFamily: "monospace", color: "rgba(221,215,234,0.55)" }}>{ports}</span></td>
                      <td><span style={{ fontWeight: 700, color: dgc }}>{grade ?? "—"}</span></td>
                      <td><span style={{ color: "rgba(221,215,234,0.7)", fontSize: "0.85rem" }}>{riskScore}</span></td>
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

      {/* Full scan report: per-module scores + every structured finding. */}
      <ModuleScores scores={data.categoryScores} />
      <FindingsReport findings={data.findings} />

      {/* Data/process asset inventory (source for the roadmap's technical findings). */}
      <DataAssetInventory processes={data.processes} />
    </>
  );
}
