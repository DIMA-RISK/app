// ─────────────────────────────────────────────────────────────────────────────
// TEST PROFILE MATRIX (spec §3).
//
// Each profile is a set of known org inputs plus a questionnaire/critical-control
// gap intent. Matrix mode seeds these onto a throwaway org, runs the app's real
// scoring RPCs, then diffs oracle vs. app for every line item.
//
// org      → columns written to `organizations`
// framework→ 'pipeda' | 'hipaa' (the assigned questionnaire framework)
// qGapFrac → fraction of ANSWERED questions marked 'no' (rest 'yes')
// ccPresent→ fraction of critical controls marked present (1 = fully compliant)
// ─────────────────────────────────────────────────────────────────────────────

const base = {
  data_storage_gb: 50,
  has_pii_data: true,
  data_sensitivity_level: 3,
  vendor_count: 3,
  max_vendor_access_level: 2,
  vendor_data_share_pct: 20,
};

export const PROFILES = [
  {
    name: "Small biz · low everything · low gap",
    framework: "pipeda", qGapFrac: 0.1, ccPresent: 0.9,
    org: { ...base, business_size: "small", annual_revenue: 2_000_000, employee_count: 30,
      patient_records_count: 5_000, has_health_data: true, has_financial_data: false },
  },
  {
    name: "Small biz · low revenue · HIGH employee count (training regression)",
    framework: "pipeda", qGapFrac: 0.3, ccPresent: 0.6,
    org: { ...base, business_size: "small", annual_revenue: 2_000_000, employee_count: 50_000,
      patient_records_count: 5_000, has_health_data: true, has_financial_data: false },
  },
  {
    name: "Enterprise · high revenue · high employee count",
    framework: "hipaa", qGapFrac: 0.4, ccPresent: 0.5,
    org: { ...base, business_size: "enterprise", annual_revenue: 500_000_000, employee_count: 5_000,
      patient_records_count: 2_000_000, has_health_data: true, has_financial_data: true,
      vendor_count: 40, max_vendor_access_level: 4, vendor_data_share_pct: 80, data_sensitivity_level: 5 },
  },
  {
    name: "High compliance gap · all frameworks (~100%)",
    framework: "hipaa", qGapFrac: 1.0, ccPresent: 0.0,
    org: { ...base, business_size: "medium", annual_revenue: 20_000_000, employee_count: 200,
      patient_records_count: 200_000, has_health_data: true, has_financial_data: true },
  },
  {
    name: "Zero compliance gap · fully compliant",
    framework: "hipaa", qGapFrac: 0.0, ccPresent: 1.0,
    org: { ...base, business_size: "medium", annual_revenue: 20_000_000, employee_count: 200,
      patient_records_count: 200_000, has_health_data: true, has_financial_data: true },
  },
  {
    name: "Health data only",
    framework: "hipaa", qGapFrac: 0.3, ccPresent: 0.6,
    org: { ...base, business_size: "medium", annual_revenue: 10_000_000, employee_count: 120,
      patient_records_count: 100_000, has_health_data: true, has_financial_data: false, has_pii_data: false },
  },
  {
    name: "Financial data only",
    framework: "pipeda", qGapFrac: 0.3, ccPresent: 0.6,
    org: { ...base, business_size: "medium", annual_revenue: 10_000_000, employee_count: 120,
      patient_records_count: 100_000, has_health_data: false, has_financial_data: true, has_pii_data: false },
  },
  {
    name: "PII only (no health, no financial)",
    framework: "pipeda", qGapFrac: 0.3, ccPresent: 0.6,
    org: { ...base, business_size: "medium", annual_revenue: 10_000_000, employee_count: 120,
      patient_records_count: 100_000, has_health_data: false, has_financial_data: false, has_pii_data: true },
  },
  {
    name: "High third-party exposure (vendors/access/share at cap)",
    framework: "pipeda", qGapFrac: 0.3, ccPresent: 0.6,
    org: { ...base, business_size: "large", annual_revenue: 80_000_000, employee_count: 900,
      patient_records_count: 300_000, has_health_data: true, has_financial_data: true,
      vendor_count: 60, max_vendor_access_level: 4, vendor_data_share_pct: 100 },
  },
  {
    name: "Zero vendors (third-party floor)",
    framework: "pipeda", qGapFrac: 0.3, ccPresent: 0.6,
    org: { ...base, business_size: "small", annual_revenue: 3_000_000, employee_count: 40,
      patient_records_count: 10_000, has_health_data: true, has_financial_data: false,
      vendor_count: 0, max_vendor_access_level: 1, vendor_data_share_pct: 0 },
  },
];
