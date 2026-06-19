"use client";

import { Download } from "lucide-react";
import type { ComplianceData } from "../queries";
import styles from "../dashboard.module.css";

function exportCsv(data: ComplianceData) {
  const summary = [
    ["Framework", data.frameworkId.toUpperCase()],
    ["Overall Risk Score", String(data.overallScore)],
    ["Risk Band", data.riskBand],
    ["Compliance Rate", `${data.compliancePct}%`],
    ["Controls Met", String(data.yesCount)],
    ["Controls Failing", String(data.noCount)],
    ["Partial Controls", String(data.partialCount)],
    ["Not Applicable", String(data.naCount)],
    ["Total Controls Assessed", String(data.totalControls)],
  ];

  const domainHeaders = ["Domain", "Maturity Level", "Label", "Score"];
  const domainRows = data.domains.map((d) => [d.domain, String(d.maturityLevel), d.label, `${d.rawScore}%`]);

  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const csv = [
    ...summary.map((row) => row.map(escape).join(",")),
    "",
    domainHeaders.map(escape).join(","),
    ...domainRows.map((row) => row.map(escape).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `compliance-status-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ComplianceExportButton({ data }: { data: ComplianceData }) {
  return (
    <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => exportCsv(data)}>
      <Download size={14} /> Export
    </button>
  );
}
