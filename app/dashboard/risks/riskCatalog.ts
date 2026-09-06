// ─────────────────────────────────────────────────────────────────────────────
// Predefined healthcare risk catalog — sourced verbatim from the CEO's
// DIMA_Healthcare_Risk_Register.xlsx ("DIMA Risk KPI Library v1.0"). A starter
// set of 26 risks mapped to HIPAA / PIPEDA / CA-Health, grouped by control
// category. Drives the "Add Risk" category → risk dropdown. Extend over time by
// adding entries here (same shape).
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogRisk {
  id: string;
  category: string;
  description: string;
  frameworks: string[]; // "HIPAA" | "PIPEDA" | "CA-Health"
  sensitivity: number;  // data sensitivity level 3–5
  baseEffort: "Low" | "Medium" | "High";
}

// The 17 healthcare control categories (CEO chose these over the old 6 generic ones).
export const RISK_CATEGORIES: string[] = [
  "Access Control", "Data Protection", "Monitoring", "Data Integrity", "Governance",
  "Training", "Vendor Risk", "Incident Response", "Physical Security", "Data Disposal",
  "Data Minimization", "Consent", "Individual Rights", "Data Transfer", "Mobile/Endpoint",
  "Business Continuity", "Transparency",
];

export const RISK_CATALOG: CatalogRisk[] = [
  { id: "R-01", category: "Access Control", description: "Unauthorized access to patient/personal health records due to weak access controls", frameworks: ["HIPAA", "PIPEDA", "CA-Health"], sensitivity: 5, baseEffort: "Medium" },
  { id: "R-02", category: "Access Control", description: "No multi-factor authentication on systems housing PHI/personal health information", frameworks: ["HIPAA", "CA-Health"], sensitivity: 5, baseEffort: "Medium" },
  { id: "R-03", category: "Access Control", description: "No automatic session logoff on workstations accessing health records", frameworks: ["HIPAA"], sensitivity: 4, baseEffort: "Low" },
  { id: "R-04", category: "Data Protection", description: "Missing encryption of PHI/personal health information at rest", frameworks: ["HIPAA", "PIPEDA", "CA-Health"], sensitivity: 5, baseEffort: "High" },
  { id: "R-05", category: "Data Protection", description: "Missing encryption of PHI/personal health information in transit", frameworks: ["HIPAA", "PIPEDA"], sensitivity: 5, baseEffort: "High" },
  { id: "R-06", category: "Monitoring", description: "No audit logging or monitoring of access to health records", frameworks: ["HIPAA", "CA-Health"], sensitivity: 4, baseEffort: "Medium" },
  { id: "R-07", category: "Data Integrity", description: "Lack of controls preventing unauthorized alteration or destruction of health data", frameworks: ["HIPAA", "PIPEDA"], sensitivity: 4, baseEffort: "Medium" },
  { id: "R-08", category: "Governance", description: "No formal, documented risk assessment process", frameworks: ["HIPAA", "PIPEDA"], sensitivity: 4, baseEffort: "Low" },
  { id: "R-09", category: "Governance", description: "No designated privacy/security officer or accountable contact person", frameworks: ["HIPAA", "PIPEDA", "CA-Health"], sensitivity: 4, baseEffort: "Low" },
  { id: "R-10", category: "Training", description: "Missing or infrequent workforce security/privacy awareness training", frameworks: ["HIPAA", "PIPEDA"], sensitivity: 3, baseEffort: "Low" },
  { id: "R-11", category: "Vendor Risk", description: "Inadequate Business Associate Agreements / third-party data processing agreements", frameworks: ["HIPAA", "PIPEDA"], sensitivity: 4, baseEffort: "Medium" },
  { id: "R-12", category: "Vendor Risk", description: "No vendor security due-diligence process before onboarding third parties", frameworks: ["HIPAA", "PIPEDA"], sensitivity: 4, baseEffort: "Medium" },
  { id: "R-13", category: "Incident Response", description: "No breach notification procedure meeting framework-specific timelines", frameworks: ["HIPAA", "CA-Health"], sensitivity: 5, baseEffort: "Medium" },
  { id: "R-14", category: "Incident Response", description: "No documented security incident response plan", frameworks: ["HIPAA", "PIPEDA"], sensitivity: 4, baseEffort: "Medium" },
  { id: "R-15", category: "Physical Security", description: "Inadequate physical access controls to facilities or server rooms holding health records", frameworks: ["HIPAA"], sensitivity: 4, baseEffort: "Medium" },
  { id: "R-16", category: "Physical Security", description: "Unsecured workstations or devices with access to health records", frameworks: ["HIPAA"], sensitivity: 4, baseEffort: "Low" },
  { id: "R-17", category: "Data Disposal", description: "No secure device and media disposal/reuse controls for retired hardware", frameworks: ["HIPAA", "PIPEDA", "CA-Health"], sensitivity: 4, baseEffort: "Low" },
  { id: "R-18", category: "Data Minimization", description: "Retention of personal/health information beyond its stated purpose", frameworks: ["PIPEDA", "CA-Health"], sensitivity: 3, baseEffort: "Low" },
  { id: "R-19", category: "Data Minimization", description: "Over-collection of personal/health information beyond what is needed", frameworks: ["PIPEDA", "CA-Health"], sensitivity: 3, baseEffort: "Low" },
  { id: "R-20", category: "Consent", description: "Missing or inadequate consent management process for collection, use, or disclosure", frameworks: ["PIPEDA", "CA-Health"], sensitivity: 5, baseEffort: "Medium" },
  { id: "R-21", category: "Individual Rights", description: "No process for handling individual access or correction requests", frameworks: ["HIPAA", "PIPEDA", "CA-Health"], sensitivity: 4, baseEffort: "Low" },
  { id: "R-22", category: "Data Transfer", description: "No controls governing cross-border or cloud-hosted data transfer of health information", frameworks: ["PIPEDA", "HIPAA"], sensitivity: 4, baseEffort: "Medium" },
  { id: "R-23", category: "Mobile/Endpoint", description: "No mobile device management (BYOD) policy for devices accessing health records", frameworks: ["HIPAA", "PIPEDA"], sensitivity: 4, baseEffort: "Medium" },
  { id: "R-24", category: "Business Continuity", description: "Inadequate backup and disaster recovery plan for systems holding health records", frameworks: ["HIPAA"], sensitivity: 4, baseEffort: "High" },
  { id: "R-25", category: "Governance", description: "No complaint-handling process for individuals to challenge compliance", frameworks: ["PIPEDA", "CA-Health"], sensitivity: 3, baseEffort: "Low" },
  { id: "R-26", category: "Transparency", description: "Lack of a publicly available privacy policy or written statement of information practices", frameworks: ["PIPEDA", "CA-Health"], sensitivity: 3, baseEffort: "Low" },
];

export function risksByCategory(category: string): CatalogRisk[] {
  return RISK_CATALOG.filter((r) => r.category === category);
}
