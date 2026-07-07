"use server";

import { createClient } from "../../utils/supabase/server";
import { createAdminClient } from "../../utils/supabase/admin";

// ─── Org context ──────────────────────────────────────────────────────────────
// Resolves which org's data this user should see.
// Org owners → their own data (role: admin).
// Accepted invited members → the inviting org's data (role: admin | viewer).

interface OrgContext {
  userId: string;           // org owner's user_id — use for all data queries
  currentUserId: string;    // actual logged-in user — use for write operations
  currentUserEmail: string;
  currentUserMeta: Record<string, unknown>;
  currentUserCreatedAt: string;
  role: "admin" | "viewer";
}

async function getOrgContext(): Promise<OrgContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const base = {
    currentUserId: user.id,
    currentUserEmail: user.email ?? "",
    currentUserMeta: (user.user_metadata ?? {}) as Record<string, unknown>,
    currentUserCreatedAt: user.created_at,
  };

  if (org) return { ...base, userId: user.id, role: "admin" };

  const { data: invite } = await admin
    .from("org_invitations")
    .select("role, organizations!inner(user_id)")
    .eq("accepted_by", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (invite) {
    return {
      ...base,
      userId: (invite.organizations as unknown as { user_id: string }).user_id,
      role: invite.role as "admin" | "viewer",
    };
  }

  return null;
}

export async function getRole(): Promise<"admin" | "viewer" | null> {
  const ctx = await getOrgContext();
  return ctx?.role ?? null;
}


export interface RoiData {
  investmentTotal: number;
  investmentBreakdown: Record<string, number>;
  benefitsTotal3yr: number;
  benefitsBreakdown: Record<string, number>;
  netBenefit3yr: number;
  roiPct: number;
  paybackMonths: number;
}

export interface DashboardData {
  orgName: string;
  greeting: string;
  riskScore: number;
  riskBand: "critical" | "high" | "medium" | "low" | null;
  compliancePct: number;
  openCritical: number;
  yesCount: number;
  noCount: number;
  partialCount: number;
  totalControls: number;
  frameworkId: string | null;
  frameworkName: string | null;
  tasks: { title: string; priority: string; effort: string; description: string | null }[];
  financialExposureMin: number | null;
  financialExposureMax: number | null;
  currency: string;
  snapshotDate: string;
  hasSession: boolean;
  activity: { type: "success" | "info"; text: string; timestamp: string }[];
  roi: RoiData | null;
  heatmapEntries: { probabilityBand: string; financialImpact: number; exposure: number; title: string }[];
  maturityDomains: { domain: string; rawScore: number; maturityLevel: number; label: string }[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const empty: DashboardData = {
    orgName: "Your Organization",
    greeting,
    riskScore: 0,
    riskBand: null,
    compliancePct: 0,
    openCritical: 0,
    yesCount: 0,
    noCount: 0,
    partialCount: 0,
    totalControls: 0,
    frameworkId: null,
    frameworkName: null,
    tasks: [],
    financialExposureMin: null,
    financialExposureMax: null,
    currency: "CAD",
    snapshotDate: new Date().toISOString(),
    hasSession: false,
    activity: [],
    roi: null,
    heatmapEntries: [],
    maturityDomains: [],
  };

  const ctx = await getOrgContext();
  if (!ctx) return empty;
  const { userId } = ctx;
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("org_name, org_uid, id")
    .eq("user_id", userId)
    .single();

  const { data: session } = await admin
    .from("assessment_sessions")
    .select("id, framework_id, completed_at, started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return { ...empty, orgName: org?.org_name ?? empty.orgName };
  }

  const orgUid = org?.org_uid ?? org?.id ?? null;

  const [riskResult, responsesResult, remediationResult, financialResult, frameworkResult, scanResult, riskEntriesResult, maturityResult] =
    await Promise.all([
      admin
        .from("risk_scores")
        .select("total_score, risk_band, calculated_at")
        .eq("session_id", session.id)
        .maybeSingle(),
      admin
        .from("questionnaire_responses")
        .select("response")
        .eq("session_id", session.id),
      admin
        .from("remediation_roadmap")
        .select("title, priority, effort, description")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("priority_rank")
        .limit(10),
      admin
        .from("financial_impact")
        .select("total_exposure_min, total_exposure_max, currency, investment_total, investment_breakdown, benefits_total_3yr, benefits_breakdown, net_benefit_3yr, roi_pct, payback_months")
        .eq("session_id", session.id)
        .maybeSingle(),
      admin
        .from("frameworks")
        .select("name")
        .eq("id", session.framework_id)
        .maybeSingle(),
      orgUid
        ? admin.from("fact_software_results").select("created_at").eq("org_uid", orgUid).order("created_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin.from("risk_register_entries").select("title, probability_band, impact_direct, impact_regulatory, impact_recovery").eq("user_id", userId),
      admin.from("maturity_scores").select("domain, raw_score, maturity_level, label").eq("session_id", session.id).order("raw_score"),
    ]);

  const responses = responsesResult.data ?? [];
  const yesCount = responses.filter((r) => r.response === "yes").length;
  const partialCount = responses.filter((r) => r.response === "partial").length;
  const noCount = responses.filter((r) => r.response === "no").length;
  const applicable = responses.filter((r) => r.response !== "na").length;
  const compliancePct =
    applicable > 0
      ? Math.round(((yesCount + partialCount * 0.5) / applicable) * 100)
      : 0;

  const tasks = (remediationResult.data ?? []).map((t) => ({
    title: t.title,
    priority: t.priority ?? "medium",
    effort: t.effort ?? "medium",
    description: t.description ?? null,
  }));

  const activity: DashboardData["activity"] = [];
  if (riskResult.data?.calculated_at) {
    activity.push({ type: "success", text: "Assessment completed — risk score calculated", timestamp: riskResult.data.calculated_at });
  }
  if (scanResult.data?.created_at) {
    activity.push({ type: "info", text: "Network scan completed", timestamp: scanResult.data.created_at });
  }
  if (session.started_at) {
    activity.push({ type: "info", text: "Compliance questionnaire answers saved", timestamp: session.started_at });
  }
  activity.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const roi: RoiData | null =
    financialResult.data?.roi_pct != null
      ? {
          investmentTotal: Number(financialResult.data.investment_total ?? 0),
          investmentBreakdown: (financialResult.data.investment_breakdown as Record<string, number>) ?? {},
          benefitsTotal3yr: Number(financialResult.data.benefits_total_3yr ?? 0),
          benefitsBreakdown: (financialResult.data.benefits_breakdown as Record<string, number>) ?? {},
          netBenefit3yr: Number(financialResult.data.net_benefit_3yr ?? 0),
          roiPct: Number(financialResult.data.roi_pct),
          paybackMonths: Number(financialResult.data.payback_months ?? 0),
        }
      : null;

  return {
    orgName: org?.org_name ?? empty.orgName,
    greeting,
    riskScore: Math.round(Number(riskResult.data?.total_score ?? 0)),
    riskBand: (riskResult.data?.risk_band as DashboardData["riskBand"]) ?? null,
    compliancePct,
    openCritical: tasks.filter((t) => t.priority === "critical").length,
    yesCount,
    noCount,
    partialCount,
    totalControls: applicable,
    frameworkId: session.framework_id,
    frameworkName: frameworkResult.data?.name ?? session.framework_id,
    tasks,
    financialExposureMin:
      financialResult.data?.total_exposure_min != null
        ? Number(financialResult.data.total_exposure_min)
        : null,
    financialExposureMax:
      financialResult.data?.total_exposure_max != null
        ? Number(financialResult.data.total_exposure_max)
        : null,
    currency: financialResult.data?.currency ?? "CAD",
    snapshotDate: session.completed_at ?? new Date().toISOString(),
    hasSession: true,
    activity,
    roi,
    heatmapEntries: (riskEntriesResult.data ?? []).map((e) => {
      const PROB: Record<string, number> = { low: 0.10, medium: 0.35, high: 0.65, critical: 0.90 };
      const financialImpact = Number(e.impact_direct ?? 0) + Number(e.impact_regulatory ?? 0) + Number(e.impact_recovery ?? 0);
      return {
        probabilityBand: e.probability_band,
        financialImpact,
        exposure: financialImpact * (PROB[e.probability_band] ?? 0),
        title: e.title,
      };
    }),
    maturityDomains: (maturityResult.data ?? []).map((d) => ({
      domain: d.domain,
      rawScore: Math.round(Number(d.raw_score)),
      maturityLevel: d.maturity_level,
      label: d.label,
    })),
  };
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface SettingsData {
  orgName: string;
  email: string;
  phone: string;
  industry: string;
  country: string;
  address: string;
  dbaName: string | null;
  orgIp: string | null;
  patientRecords: number;
  vendorCount: number;
}

export async function getSettingsData(): Promise<SettingsData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("org_name, email, p_number, industry, org_country, address, dba_name, org_ip, patient_records_count, vendor_count")
    .eq("user_id", userId)
    .single();
  if (!org) return null;
  return {
    orgName: org.org_name ?? "",
    email: org.email ?? "",
    phone: org.p_number ?? "",
    industry: org.industry ?? "Healthcare",
    country: org.org_country ?? "Canada",
    address: org.address ?? "",
    dbaName: org.dba_name ?? null,
    orgIp: org.org_ip ?? null,
    patientRecords: org.patient_records_count ?? 0,
    vendorCount: org.vendor_count ?? 0,
  };
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface UsersData {
  name: string;
  email: string;
  initials: string;
  orgName: string;
  createdAt: string;
  role: "admin" | "viewer";
}

export async function getUsersData(): Promise<UsersData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId, currentUserEmail, currentUserMeta, currentUserCreatedAt, role } = ctx;
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("org_name")
    .eq("user_id", userId)
    .single();
  const name = (currentUserMeta.full_name as string | undefined) ?? currentUserEmail.split("@")[0];
  const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  return {
    name,
    email: currentUserEmail,
    initials,
    orgName: org?.org_name ?? "",
    createdAt: currentUserCreatedAt,
    role,
  };
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export interface DomainScore {
  domain: string;
  rawScore: number;
  maturityLevel: number;
  label: string;
}

export interface CriticalControlItem {
  id: number;
  frameworkId: string;
  controlRef: string;
  controlName: string;
  present: boolean;
}

export interface ComplianceData {
  frameworkId: string;
  overallScore: number;
  riskBand: string;
  compliancePct: number;
  domains: DomainScore[];
  yesCount: number;
  noCount: number;
  partialCount: number;
  naCount: number;
  totalControls: number;
  criticalControls: CriticalControlItem[];
  role: "admin" | "viewer";
}

export async function getComplianceData(): Promise<ComplianceData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("assessment_sessions")
    .select("id, framework_id")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) return null;

  const [maturityResult, riskResult, responsesResult, ccResult, ccrResult] = await Promise.all([
    admin.from("maturity_scores").select("domain, raw_score, maturity_level, label").eq("session_id", session.id),
    admin.from("risk_scores").select("total_score, risk_band").eq("session_id", session.id).maybeSingle(),
    admin.from("questionnaire_responses").select("response").eq("session_id", session.id),
    admin.from("critical_controls").select("id, framework_id, control_ref, control_name").order("framework_id").order("id"),
    admin.from("critical_control_responses").select("control_id, present").eq("user_id", userId),
  ]);

  const responses = responsesResult.data ?? [];
  const yesCount = responses.filter((r) => r.response === "yes").length;
  const noCount = responses.filter((r) => r.response === "no").length;
  const partialCount = responses.filter((r) => r.response === "partial").length;
  const naCount = responses.filter((r) => r.response === "na").length;
  const applicable = responses.filter((r) => r.response !== "na").length;
  const compliancePct = applicable > 0 ? Math.round(((yesCount + partialCount * 0.5) / applicable) * 100) : 0;

  const presentMap = new Map(
    (ccrResult.data ?? []).map((r) => [r.control_id as number, r.present as boolean])
  );
  const criticalControls: CriticalControlItem[] = (ccResult.data ?? []).map((c) => ({
    id: c.id as number,
    frameworkId: c.framework_id as string,
    controlRef: c.control_ref as string,
    controlName: c.control_name as string,
    present: presentMap.get(c.id as number) ?? false,
  }));

  return {
    frameworkId: session.framework_id,
    overallScore: Math.round(Number(riskResult.data?.total_score ?? 0)),
    riskBand: riskResult.data?.risk_band ?? "unknown",
    compliancePct,
    domains: (maturityResult.data ?? []).map((d) => ({
      domain: d.domain,
      rawScore: Math.round(Number(d.raw_score)),
      maturityLevel: d.maturity_level,
      label: d.label,
    })).sort((a, b) => a.rawScore - b.rawScore),
    yesCount,
    noCount,
    partialCount,
    naCount,
    totalControls: applicable,
    criticalControls,
    role: ctx.role,
  };
}

// ─── GDPR Assessment ──────────────────────────────────────────────────────────

export interface GdprQuestion {
  id: number;
  sectionId: number;
  question: string;
  mandatory: boolean;
  sortOrder: number;
  response: "yes" | "no" | "q_yes" | null;
  documented: boolean | null;
  comments: string | null;
}

export interface GdprSection {
  id: number;
  name: string;
  questions: GdprQuestion[];
  compliancePct: number;
}

export interface GdprProcessEntry {
  id: string;
  processName: string;
  controllerStatus: string | null;
  personalData: boolean;
  specialCategory: boolean;
  childrenData: boolean;
  lawfulBasis: string | null;
  dataVolume: string | null;
  gdprCompliant: string | null;
  notes: string | null;
}

export interface GdprAssessmentData {
  sections: GdprSection[];
  overallCompliancePct: number;
  processRegister: GdprProcessEntry[];
  role: "admin" | "viewer";
}

export async function getGdprAssessmentData(): Promise<GdprAssessmentData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const [sectionsResult, questionsResult, responsesResult, processResult] = await Promise.all([
    admin.from("gdpr_sections").select("id, name").order("id"),
    admin.from("gdpr_questions").select("id, section_id, question, mandatory, sort_order").order("section_id").order("sort_order"),
    admin.from("gdpr_responses").select("question_id, response, documented, comments").eq("user_id", userId),
    admin.from("gdpr_process_register").select("id, process_name, controller_status, personal_data, special_category, children_data, lawful_basis, data_volume, gdpr_compliant, notes").eq("user_id", userId).order("created_at"),
  ]);

  const responseMap = new Map((responsesResult.data ?? []).map((r) => [r.question_id, r]));

  const sections: GdprSection[] = (sectionsResult.data ?? []).map((s) => {
    const questions: GdprQuestion[] = (questionsResult.data ?? [])
      .filter((q) => q.section_id === s.id)
      .map((q) => {
        const r = responseMap.get(q.id);
        return {
          id: q.id,
          sectionId: q.section_id,
          question: q.question,
          mandatory: q.mandatory,
          sortOrder: q.sort_order,
          response: (r?.response as GdprQuestion["response"]) ?? null,
          documented: r?.documented ?? null,
          comments: r?.comments ?? null,
        };
      });

    const answered = questions.filter((q) => q.response !== null);
    const yes = answered.filter((q) => q.response === "yes").length;
    const qYes = answered.filter((q) => q.response === "q_yes").length;
    const compliancePct = answered.length > 0 ? Math.round(((yes + qYes * 0.5) / answered.length) * 100) : 0;

    return { id: s.id, name: s.name, questions, compliancePct };
  });

  const allAnswered = sections.flatMap((s) => s.questions).filter((q) => q.response !== null);
  const totalYes = allAnswered.filter((q) => q.response === "yes").length;
  const totalQYes = allAnswered.filter((q) => q.response === "q_yes").length;
  const overallCompliancePct = allAnswered.length > 0 ? Math.round(((totalYes + totalQYes * 0.5) / allAnswered.length) * 100) : 0;

  const processRegister: GdprProcessEntry[] = (processResult.data ?? []).map((p) => ({
    id: p.id,
    processName: p.process_name,
    controllerStatus: p.controller_status,
    personalData: p.personal_data ?? false,
    specialCategory: p.special_category ?? false,
    childrenData: p.children_data ?? false,
    lawfulBasis: p.lawful_basis,
    dataVolume: p.data_volume,
    gdprCompliant: p.gdpr_compliant,
    notes: p.notes,
  }));

  return { sections, overallCompliancePct, processRegister, role: ctx.role };
}

// ─── ISO 27001 Tracker ────────────────────────────────────────────────────────

export interface Iso27001Phase {
  id: number;
  name: string;
  description: string | null;
  status: "not_started" | "in_progress" | "complete";
  notes: string | null;
}

export interface Iso27001Control {
  id: string;
  clause: string;
  name: string;
  applicable: boolean;
  implemented: boolean;
  justification: string | null;
}

export interface Iso27001Data {
  phases: Iso27001Phase[];
  controls: Iso27001Control[];
  phasesComplete: number;
  controlsApplicable: number;
  controlsImplemented: number;
  role: "admin" | "viewer";
}

export async function getIso27001Data(): Promise<Iso27001Data | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const [phasesResult, trackerResult, annexResult, soaResult] = await Promise.all([
    admin.from("iso27001_phases").select("id, name, description").order("id"),
    admin.from("iso27001_tracker").select("phase_id, status, notes").eq("user_id", userId),
    admin.from("iso27001_annex_a").select("id, clause, name").order("id"),
    admin.from("iso27001_soa").select("control_id, applicable, implemented, justification").eq("user_id", userId),
  ]);

  const trackerMap = new Map((trackerResult.data ?? []).map((t) => [t.phase_id, t]));
  const soaMap = new Map((soaResult.data ?? []).map((s) => [s.control_id, s]));

  const phases: Iso27001Phase[] = (phasesResult.data ?? []).map((p) => {
    const t = trackerMap.get(p.id);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: (t?.status as Iso27001Phase["status"]) ?? "not_started",
      notes: t?.notes ?? null,
    };
  });

  const controls: Iso27001Control[] = (annexResult.data ?? []).map((c) => {
    const s = soaMap.get(c.id);
    return {
      id: c.id,
      clause: c.clause,
      name: c.name,
      applicable: s?.applicable ?? true,
      implemented: s?.implemented ?? false,
      justification: s?.justification ?? null,
    };
  });

  return {
    phases,
    controls,
    phasesComplete: phases.filter((p) => p.status === "complete").length,
    controlsApplicable: controls.filter((c) => c.applicable).length,
    controlsImplemented: controls.filter((c) => c.applicable && c.implemented).length,
    role: ctx.role,
  };
}

// ─── KPI Dashboard ────────────────────────────────────────────────────────────

export interface KpiData {
  // ISO 31000
  boardOversightFrequencyPct: number | null;  // % of meetings with risk agenda item (12-month rolling)
  totalBoardMeetings: number;
  riskInclusiveMeetings: number;
  riskAppetiteAdherencePct: number | null;   // 100 - (outside appetite / total entries × 100)
  outsideAppetiteCount: number;
  totalRiskEntries: number;
  // NIST NRF
  avgMaturityLevel: number | null;           // avg of maturity_scores.maturity_level
  mttdCriticalHours: number | null;          // mean time to detect, critical severity
  mttdHighHours: number | null;              // mean time to detect, high severity
  role: "admin" | "viewer";
}

export async function getKpiData(): Promise<KpiData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: latestSession } = await admin.from("assessment_sessions")
    .select("id").eq("user_id", userId).order("started_at", { ascending: false }).limit(1).maybeSingle();

  const [boardResult, riskEntriesResult, maturityResult, incidentsResult] = await Promise.all([
    admin.from("board_meetings").select("risk_agenda_item").eq("user_id", userId).gte("meeting_date", twelveMonthsAgo.toISOString().slice(0, 10)),
    admin.from("risk_register_entries").select("id, probability_band, impact_direct, impact_regulatory, impact_recovery").eq("user_id", userId),
    latestSession
      ? admin.from("maturity_scores").select("maturity_level").eq("session_id", latestSession.id).limit(20)
      : Promise.resolve({ data: [] as { maturity_level: number }[], error: null }),
    admin.from("security_incidents").select("severity, occurred_at, detected_at").eq("user_id", userId).not("detected_at", "is", null),
  ]);

  const meetings = boardResult.data ?? [];
  const totalBoardMeetings = meetings.length;
  const riskInclusiveMeetings = meetings.filter((m) => m.risk_agenda_item).length;
  const boardOversightFrequencyPct = totalBoardMeetings > 0
    ? Math.round((riskInclusiveMeetings / totalBoardMeetings) * 100)
    : null;

  const PROB_MIDPOINT: Record<string, number> = { low: 0.10, medium: 0.35, high: 0.65, critical: 0.90 };
  const APPETITE_THRESHOLD = 250000;
  const entries = riskEntriesResult.data ?? [];
  const totalRiskEntries = entries.length;
  const outsideAppetiteCount = entries.filter((e) => {
    const impact = Number(e.impact_direct ?? 0) + Number(e.impact_regulatory ?? 0) + Number(e.impact_recovery ?? 0);
    return impact * (PROB_MIDPOINT[e.probability_band] ?? 0) > APPETITE_THRESHOLD;
  }).length;
  const riskAppetiteAdherencePct = totalRiskEntries > 0
    ? Math.round(100 - (outsideAppetiteCount / totalRiskEntries) * 100)
    : null;

  const maturityLevels = (maturityResult.data ?? []).map((m) => m.maturity_level);
  const avgMaturityLevel = maturityLevels.length > 0
    ? Math.round((maturityLevels.reduce((s, v) => s + v, 0) / maturityLevels.length) * 10) / 10
    : null;

  const incidents = incidentsResult.data ?? [];
  function mttdHours(sev: string): number | null {
    const relevant = incidents.filter((i) => i.severity === sev && i.detected_at);
    if (relevant.length === 0) return null;
    const avgMs = relevant.reduce((s, i) => {
      return s + (new Date(i.detected_at!).getTime() - new Date(i.occurred_at).getTime());
    }, 0) / relevant.length;
    return Math.round((avgMs / 3600000) * 10) / 10;
  }

  return {
    boardOversightFrequencyPct,
    totalBoardMeetings,
    riskInclusiveMeetings,
    riskAppetiteAdherencePct,
    outsideAppetiteCount,
    totalRiskEntries,
    avgMaturityLevel,
    mttdCriticalHours: mttdHours("critical"),
    mttdHighHours: mttdHours("high"),
    role: ctx.role,
  };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  domains: DomainScore[];
  risk: { likelihood: number; impact: number; control: number; exposure: number; total: number; band: string; };
  financial: { breachCost: number; finesMin: number; finesMax: number; totalMin: number; totalMax: number; currency: string; };
  compliancePct: number;
}

export async function getAnalyticsData(): Promise<AnalyticsData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("assessment_sessions")
    .select("id")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) return null;

  const [maturityResult, riskResult, financialResult, responsesResult] = await Promise.all([
    admin.from("maturity_scores").select("domain, raw_score, maturity_level, label").eq("session_id", session.id),
    admin.from("risk_scores").select("total_score, risk_band, likelihood_score, impact_score, control_score, exposure_score").eq("session_id", session.id).maybeSingle(),
    admin.from("financial_impact").select("estimated_breach_cost, regulatory_fines_min, regulatory_fines_max, total_exposure_min, total_exposure_max, currency").eq("session_id", session.id).maybeSingle(),
    admin.from("questionnaire_responses").select("response").eq("session_id", session.id),
  ]);

  const responses = responsesResult.data ?? [];
  const applicable = responses.filter((r) => r.response !== "na").length;
  const yes = responses.filter((r) => r.response === "yes").length;
  const partial = responses.filter((r) => r.response === "partial").length;
  const compliancePct = applicable > 0 ? Math.round(((yes + partial * 0.5) / applicable) * 100) : 0;

  const r = riskResult.data;
  const f = financialResult.data;
  return {
    domains: (maturityResult.data ?? []).map((d) => ({
      domain: d.domain, rawScore: Math.round(Number(d.raw_score)), maturityLevel: d.maturity_level, label: d.label,
    })).sort((a, b) => b.rawScore - a.rawScore),
    risk: {
      likelihood: Math.round(Number(r?.likelihood_score ?? 0)),
      impact: Math.round(Number(r?.impact_score ?? 0)),
      control: Math.round(Number(r?.control_score ?? 0)),
      exposure: Math.round(Number(r?.exposure_score ?? 0) * 100) / 100,
      total: Math.round(Number(r?.total_score ?? 0)),
      band: r?.risk_band ?? "unknown",
    },
    financial: {
      breachCost: Math.round(Number(f?.estimated_breach_cost ?? 0)),
      finesMin: Math.round(Number(f?.regulatory_fines_min ?? 0)),
      finesMax: Math.round(Number(f?.regulatory_fines_max ?? 0)),
      totalMin: Math.round(Number(f?.total_exposure_min ?? 0)),
      totalMax: Math.round(Number(f?.total_exposure_max ?? 0)),
      currency: f?.currency ?? "CAD",
    },
    compliancePct,
  };
}

// ─── Action Plan ──────────────────────────────────────────────────────────────

export interface RoadmapTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  effort: string;
  status: string;
  category: string;
  dueDate: string | null;
}

export interface ActionPlanData {
  tasks: RoadmapTask[];
  riskScore: number;
  riskBand: string;
  role: "admin" | "viewer";
}

export async function getActionPlanData(): Promise<ActionPlanData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("assessment_sessions")
    .select("id")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [roadmapResult, riskResult] = await Promise.all([
    admin.from("remediation_roadmap").select("id, title, description, priority, effort, status, category, due_date").eq("user_id", userId).order("priority_rank").order("created_at", { ascending: false }),
    session ? admin.from("risk_scores").select("total_score, risk_band").eq("session_id", session.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return {
    tasks: (roadmapResult.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? null,
      priority: t.priority ?? "medium",
      effort: t.effort ?? "medium",
      status: t.status ?? "open",
      category: t.category ?? "administrative",
      dueDate: t.due_date ?? null,
    })),
    riskScore: Math.round(Number(riskResult.data?.total_score ?? 0)),
    riskBand: riskResult.data?.risk_band ?? "unknown",
    role: ctx.role,
  };
}

// ─── Risk Register ────────────────────────────────────────────────────────────
// Manually-curated risk register (separate from the auto-generated Action Plan
// above). Register totals, the appetite check, and per-entry treatment ROI are
// all derived from the same row fields, not separate calculators.

const PROBABILITY_MIDPOINT: Record<string, number> = { low: 0.10, medium: 0.35, high: 0.65, critical: 0.90 };
const RISK_APPETITE_THRESHOLD = 250000;

export interface RiskRegisterEntry {
  id: string;
  title: string;
  category: string;
  probabilityBand: "low" | "medium" | "high" | "critical";
  impactDirect: number;
  impactRegulatory: number;
  impactRecovery: number;
  financialImpact: number;
  exposure: number;
  outsideAppetite: boolean;
  frameworkTags: string[];
  division: string | null;
  owner: string | null;
  treatmentStatus: "untreated" | "in_progress" | "done";
  probabilityAfterBand: "low" | "medium" | "high" | "critical" | null;
  treatmentCost: number | null;
  roiPct: number | null;
  createdAt: string;
}

export interface RiskRegisterData {
  entries: RiskRegisterEntry[];
  totalExposure: number;
  outsideAppetiteCount: number;
  openEntries: number;
  roiOfTreatmentPct: number | null;
  role: "admin" | "viewer";
}

export async function getRiskRegisterData(): Promise<RiskRegisterData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("risk_register_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const entries: RiskRegisterEntry[] = (rows ?? []).map((r) => {
    const financialImpact = Number(r.impact_direct ?? 0) + Number(r.impact_regulatory ?? 0) + Number(r.impact_recovery ?? 0);
    const midpointBefore = PROBABILITY_MIDPOINT[r.probability_band] ?? 0;
    const exposure = financialImpact * midpointBefore;

    let roiPct: number | null = null;
    if (r.treatment_status !== "untreated" && r.probability_after_band && r.treatment_cost != null && Number(r.treatment_cost) > 0) {
      const midpointAfter = PROBABILITY_MIDPOINT[r.probability_after_band] ?? 0;
      const exposureAvoided = financialImpact * (midpointBefore - midpointAfter);
      roiPct = ((exposureAvoided - Number(r.treatment_cost)) / Number(r.treatment_cost)) * 100;
    }

    return {
      id: r.id,
      title: r.title,
      category: r.category,
      probabilityBand: r.probability_band,
      impactDirect: Number(r.impact_direct ?? 0),
      impactRegulatory: Number(r.impact_regulatory ?? 0),
      impactRecovery: Number(r.impact_recovery ?? 0),
      financialImpact,
      exposure,
      outsideAppetite: exposure > RISK_APPETITE_THRESHOLD,
      frameworkTags: r.framework_tags ?? [],
      division: r.division ?? null,
      owner: r.owner ?? null,
      treatmentStatus: r.treatment_status,
      probabilityAfterBand: r.probability_after_band ?? null,
      treatmentCost: r.treatment_cost != null ? Number(r.treatment_cost) : null,
      roiPct,
      createdAt: r.created_at,
    };
  });

  const totalExposure = entries.reduce((sum, e) => sum + e.exposure, 0);
  const outsideAppetiteCount = entries.filter((e) => e.outsideAppetite).length;
  const openEntries = entries.filter((e) => e.treatmentStatus !== "done").length;

  // Aggregate ROI of treatment: (total exposure avoided − total cost) ÷ total cost,
  // across entries that have a treatment plan (probability_after + cost set).
  const treated = entries.filter((e) => e.roiPct != null && e.treatmentCost);
  let roiOfTreatmentPct: number | null = null;
  if (treated.length > 0) {
    const totalCost = treated.reduce((sum, e) => sum + (e.treatmentCost ?? 0), 0);
    const totalAvoided = treated.reduce((sum, e) => {
      const midBefore = PROBABILITY_MIDPOINT[e.probabilityBand] ?? 0;
      const midAfter = PROBABILITY_MIDPOINT[e.probabilityAfterBand ?? "low"] ?? 0;
      return sum + e.financialImpact * (midBefore - midAfter);
    }, 0);
    roiOfTreatmentPct = totalCost > 0 ? ((totalAvoided - totalCost) / totalCost) * 100 : null;
  }

  return {
    entries,
    totalExposure,
    outsideAppetiteCount,
    openEntries,
    roiOfTreatmentPct,
    role: ctx.role,
  };
}

// ─── Questionnaire ────────────────────────────────────────────────────────────

export interface QuestionRow {
  id: number;
  text: string;
  response: string;
  complianceStatement: string | null;
}

export interface QuestionnaireDomain {
  domain: string;
  rawScore: number;
  label: string;
  maturityLevel: number;
  questions: QuestionRow[];
}

export interface QuestionnaireData {
  frameworkId: string;
  domains: QuestionnaireDomain[];
  summary: { yes: number; no: number; partial: number; na: number; total: number; };
}

export async function getQuestionnaireData(): Promise<QuestionnaireData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("assessment_sessions")
    .select("id, framework_id")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) return null;

  const [questionsResult, responsesResult, maturityResult] = await Promise.all([
    admin.from("v_session_questions").select("question_id, question_text, domain, compliance_statement").eq("session_id", session.id),
    admin.from("questionnaire_responses").select("question_id, response").eq("session_id", session.id),
    admin.from("maturity_scores").select("domain, raw_score, label, maturity_level").eq("session_id", session.id),
  ]);

  const responseMap = new Map<number, string>();
  (responsesResult.data ?? []).forEach((r) => responseMap.set(r.question_id, r.response));

  const maturityMap = new Map<string, { rawScore: number; label: string; maturityLevel: number }>();
  (maturityResult.data ?? []).forEach((m) =>
    maturityMap.set(m.domain, { rawScore: Math.round(Number(m.raw_score)), label: m.label, maturityLevel: m.maturity_level })
  );

  const domainMap = new Map<string, QuestionRow[]>();
  (questionsResult.data ?? []).forEach((q) => {
    if (!domainMap.has(q.domain)) domainMap.set(q.domain, []);
    domainMap.get(q.domain)!.push({
      id: q.question_id,
      text: q.question_text,
      response: responseMap.get(q.question_id) ?? "na",
      complianceStatement: q.compliance_statement ?? null,
    });
  });

  const responses = responsesResult.data ?? [];
  return {
    frameworkId: session.framework_id,
    domains: Array.from(domainMap.entries()).map(([domain, questions]) => {
      const m = maturityMap.get(domain);
      return { domain, rawScore: m?.rawScore ?? 0, label: m?.label ?? "Initial", maturityLevel: m?.maturityLevel ?? 1, questions };
    }).sort((a, b) => a.rawScore - b.rawScore),
    summary: {
      yes: responses.filter((r) => r.response === "yes").length,
      no: responses.filter((r) => r.response === "no").length,
      partial: responses.filter((r) => r.response === "partial").length,
      na: responses.filter((r) => r.response === "na").length,
      total: responses.length,
    },
  };
}

// ─── Dashboard Readiness ──────────────────────────────────────────────────────

export interface DashboardReadiness {
  questionnaireAnswered: boolean;
  hasOrgIp: boolean;
  scanCompleted: boolean;
  scoreNeedsUpdate: boolean;
}

export async function getDashboardReadiness(): Promise<DashboardReadiness | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id, org_uid, org_ip")
    .eq("user_id", userId)
    .single();

  const orgUid = org?.org_uid ?? org?.id ?? null;

  const { data: session } = await admin
    .from("assessment_sessions")
    .select("id")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return { questionnaireAnswered: false, hasOrgIp: !!org?.org_ip, scanCompleted: false, scoreNeedsUpdate: false };
  }

  const [{ count: responseCount }, scoreRow] = await Promise.all([
    admin.from("questionnaire_responses")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id),
    admin.from("risk_scores")
      .select("calculated_at")
      .eq("session_id", session.id)
      .maybeSingle(),
  ]);

  let scanCompletedAt: string | null = null;
  if (orgUid) {
    const { data: scan } = await admin
      .from("fact_software_results")
      .select("created_at, results")
      .eq("org_uid", orgUid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (scan?.results != null) scanCompletedAt = scan.created_at ?? null;
  }

  const scoreCalculatedAt = scoreRow.data?.calculated_at ?? null;
  const scoreNeedsUpdate = !!scanCompletedAt && (
    !scoreCalculatedAt ||
    new Date(scanCompletedAt) > new Date(scoreCalculatedAt)
  );

  return {
    questionnaireAnswered: (responseCount ?? 0) > 0,
    hasOrgIp: !!org?.org_ip,
    scanCompleted: !!scanCompletedAt,
    scoreNeedsUpdate,
  };
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export interface AssetsData {
  orgIp: string | null;
  auditStatus: string | null;
  globalScore: number;
  highRiskCount: number;
  defenseLevel: string | null;
  overallGrade: string | null;
  devices: Record<string, unknown>[];
  networkFindings: Record<string, unknown>;
  auditFindings: Record<string, unknown>;
  scannedAt: string | null;
  noScope: boolean;
}

export async function getAssetsData(): Promise<AssetsData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id, org_uid, org_ip")
    .eq("user_id", userId)
    .single();

  const orgUid = org?.org_uid ?? org?.id ?? null;
  if (!orgUid) return { orgIp: org?.org_ip ?? null, auditStatus: null, globalScore: 0, highRiskCount: 0, defenseLevel: null, overallGrade: null, devices: [], networkFindings: {}, auditFindings: {}, scannedAt: null, noScope: true };

  const { data: scan } = await admin
    .from("fact_software_results")
    .select("results, created_at")
    .eq("org_uid", orgUid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orgIp = org?.org_ip ?? null;
  // Row exists but results not yet written — scan is still processing
  if (scan && !scan.results) return { orgIp, auditStatus: "PENDING", globalScore: 0, highRiskCount: 0, defenseLevel: null, overallGrade: null, devices: [], networkFindings: {}, auditFindings: {}, scannedAt: scan.created_at ?? null, noScope: true };
  if (!scan?.results) return { orgIp, auditStatus: null, globalScore: 0, highRiskCount: 0, defenseLevel: null, overallGrade: null, devices: [], networkFindings: {}, auditFindings: {}, scannedAt: null, noScope: true };

  const r = scan.results as Record<string, unknown>;
  const score = (r.score ?? {}) as Record<string, unknown>;
  const topology = (r.topology ?? {}) as Record<string, unknown>;

  // EWNAF stores host data in topology.nodes (keyed by IP), not score.by_host
  const nodes = (topology.nodes ?? {}) as Record<string, Record<string, unknown>>;
  const devices = Object.values(nodes).map((node) => {
    const openPorts = Array.isArray(node.ports)
      ? (node.ports as Array<{ state: string; number: number; protocol: string }>)
          .filter((p) => p.state === "open")
          .map((p) => p.number)
      : [];
    const riskScore = Number(node.risk_score ?? 0);
    return {
      host: (node.hostname ?? node.ip ?? node.key) as string,
      ip: (node.ip ?? "") as string,
      open_ports: openPorts,
      risk_score: riskScore,
      // Derive letter grade from per-host risk score (0=safe → A)
      grade: riskScore === 0 ? "A" : riskScore <= 20 ? "B" : riskScore <= 50 ? "C" : riskScore <= 75 ? "D" : "F",
      type: "Network Host",
    };
  });

  const globalScore = Number(score.overall ?? 0);
  const highRiskCount = Number(score.high_risk_count ?? 0);

  // Derive overall letter grade from aggregate risk score
  const overallGrade =
    globalScore === 0 && highRiskCount === 0 ? "A"
    : globalScore <= 10 ? "A"
    : globalScore <= 30 ? "B"
    : globalScore <= 60 ? "C"
    : globalScore <= 80 ? "D"
    : "F";

  // topology.gateway and r.version describe DIMA's own scanning infrastructure
  // (its egress IP and engine build) — never surface those to customers.
  const networkFindings: Record<string, unknown> = {};
  if (Array.isArray(topology.dns) && (topology.dns as string[]).length > 0) networkFindings["DNS"] = (topology.dns as string[]).join(", ");
  if (r.security_level) networkFindings["Scan Policy"] = r.security_level;

  return {
    orgIp,
    auditStatus: null,
    globalScore,
    highRiskCount,
    defenseLevel: (r.security_level as string) ?? null,
    overallGrade,
    devices,
    networkFindings,
    auditFindings: {},
    scannedAt: (r.ended_at as string) ?? scan.created_at ?? null,
    noScope: false,
  };
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface ReportsData {
  org: { name: string; industry: string; country: string; email: string; };
  session: { frameworkId: string; completedAt: string | null; };
  risk: { total: number; band: string; likelihood: number; impact: number; control: number; exposure: number; };
  financial: { totalMin: number; totalMax: number; breachCost: number; finesMin: number; finesMax: number; currency: string; };
  domains: DomainScore[];
  tasks: { title: string; priority: string; effort: string; description: string | null; }[];
  summary: { yes: number; no: number; partial: number; compliancePct: number; totalControls: number; };
  generatedAt: string;
}

export async function getReportsData(): Promise<ReportsData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const { data: org } = await admin.from("organizations").select("org_name, industry, org_country, email").eq("user_id", userId).single();
  const { data: session } = await admin.from("assessment_sessions").select("id, framework_id, completed_at").eq("user_id", userId).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!session) return null;

  const [riskResult, financialResult, maturityResult, roadmapResult, responsesResult] = await Promise.all([
    admin.from("risk_scores").select("total_score, risk_band, likelihood_score, impact_score, control_score, exposure_score").eq("session_id", session.id).maybeSingle(),
    admin.from("financial_impact").select("estimated_breach_cost, regulatory_fines_min, regulatory_fines_max, total_exposure_min, total_exposure_max, currency").eq("session_id", session.id).maybeSingle(),
    admin.from("maturity_scores").select("domain, raw_score, maturity_level, label").eq("session_id", session.id),
    admin.from("remediation_roadmap").select("title, priority, effort, description").eq("user_id", userId).order("priority_rank").limit(20),
    admin.from("questionnaire_responses").select("response").eq("session_id", session.id),
  ]);

  const responses = responsesResult.data ?? [];
  const yes = responses.filter((r) => r.response === "yes").length;
  const no = responses.filter((r) => r.response === "no").length;
  const partial = responses.filter((r) => r.response === "partial").length;
  const applicable = responses.filter((r) => r.response !== "na").length;
  const r = riskResult.data;
  const f = financialResult.data;

  return {
    org: { name: org?.org_name ?? "", industry: org?.industry ?? "", country: org?.org_country ?? "", email: org?.email ?? "" },
    session: { frameworkId: session.framework_id, completedAt: session.completed_at ?? null },
    risk: { total: Math.round(Number(r?.total_score ?? 0)), band: r?.risk_band ?? "unknown", exposure: Math.round(Number(r?.exposure_score ?? 0)), impact: Math.round(Number(r?.impact_score ?? 0)), control: Math.round(Number(r?.control_score ?? 0)), likelihood: Math.round(Number(r?.likelihood_score ?? 0)) },
    financial: { totalMin: Math.round(Number(f?.total_exposure_min ?? 0)), totalMax: Math.round(Number(f?.total_exposure_max ?? 0)), breachCost: Math.round(Number(f?.estimated_breach_cost ?? 0)), finesMin: Math.round(Number(f?.regulatory_fines_min ?? 0)), finesMax: Math.round(Number(f?.regulatory_fines_max ?? 0)), currency: f?.currency ?? "CAD" },
    domains: (maturityResult.data ?? []).map((d) => ({ domain: d.domain, rawScore: Math.round(Number(d.raw_score)), maturityLevel: d.maturity_level, label: d.label })).sort((a, b) => a.rawScore - b.rawScore),
    tasks: (roadmapResult.data ?? []).map((t) => ({ title: t.title, priority: t.priority ?? "medium", effort: t.effort ?? "medium", description: t.description ?? null })),
    summary: { yes, no, partial, compliancePct: applicable > 0 ? Math.round(((yes + partial * 0.5) / applicable) * 100) : 0, totalControls: applicable },
    generatedAt: new Date().toISOString(),
  };
}

// ─── Alerts (derived — no separate table; read/dismissed state in alert_states) ─

export interface AlertItem {
  id: string;
  type: "critical" | "warning" | "info" | "success";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface AlertsData {
  alerts: AlertItem[];
}

export async function getAlertsData(): Promise<AlertsData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("assessment_sessions")
    .select("id, framework_id, completed_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return { alerts: [] };

  const [riskResult, maturityResult, roadmapResult, responsesResult, financialResult] = await Promise.all([
    admin.from("risk_scores").select("total_score, risk_band").eq("session_id", session.id).maybeSingle(),
    admin.from("maturity_scores").select("domain, raw_score, maturity_level").eq("session_id", session.id).order("raw_score"),
    admin.from("remediation_roadmap").select("id, title, priority, status, category").eq("user_id", userId).eq("status", "open").order("priority_rank").limit(8),
    admin.from("questionnaire_responses").select("response").eq("session_id", session.id),
    admin.from("financial_impact").select("total_exposure_max, currency").eq("session_id", session.id).maybeSingle(),
  ]);

  const alerts: Omit<AlertItem, "read">[] = [];
  const now = new Date().toISOString();
  const assessedAt = session.completed_at ?? now;

  const responses = responsesResult.data ?? [];
  const applicable = responses.filter((r) => r.response !== "na").length;
  const yes = responses.filter((r) => r.response === "yes").length;
  const no = responses.filter((r) => r.response === "no").length;
  const partial = responses.filter((r) => r.response === "partial").length;
  const compliancePct = applicable > 0 ? Math.round(((yes + partial * 0.5) / applicable) * 100) : 0;
  const band = riskResult.data?.risk_band ?? "medium";
  const totalScore = Math.round(Number(riskResult.data?.total_score ?? 0));
  const fw = session.framework_id.toUpperCase();

  // 1. Risk band
  if (band === "critical") {
    alerts.push({ id: "risk-critical", type: "critical", title: "Critical Risk Level Detected",
      body: `Your overall risk score is ${totalScore}/100 — classified as Critical. Immediate remediation is required to protect patient data and avoid regulatory penalties.`, createdAt: now });
  } else if (band === "high") {
    alerts.push({ id: "risk-high", type: "critical", title: "High Risk Level Detected",
      body: `Your overall risk score is ${totalScore}/100 — classified as High. Priority action is needed on your open remediation items.`, createdAt: now });
  }

  // 2. Compliance score
  if (compliancePct < 60) {
    alerts.push({ id: "compliance-low", type: "critical", title: `Low ${fw} Compliance Score`,
      body: `Your compliance score is ${compliancePct}%. ${no} controls are non-compliant and require immediate attention.`, createdAt: now });
  } else if (compliancePct < 80) {
    alerts.push({ id: "compliance-warning", type: "warning", title: `${fw} Compliance Score Needs Improvement`,
      body: `Your compliance score is ${compliancePct}%. ${no} controls are non-compliant and ${partial} are only partially addressed.`, createdAt: now });
  }

  // 3. Weakest domains (score < 60, max 2)
  const weakDomains = (maturityResult.data ?? []).filter((d) => Number(d.raw_score) < 60).slice(0, 2);
  for (const d of weakDomains) {
    alerts.push({ id: `domain-${d.domain}`, type: "warning",
      title: `Weak Domain: ${d.domain}`,
      body: `Maturity level ${d.maturity_level}/5 (score: ${Math.round(Number(d.raw_score))}/100). Significant compliance gaps in this domain increase your overall risk.`,
      createdAt: assessedAt });
  }

  // 4. Top open high/critical remediation tasks (max 3) — already ordered by priority_rank from DB
  const urgentTasks = (roadmapResult.data ?? [])
    .filter((t) => t.priority === "critical" || t.priority === "high")
    .slice(0, 3);
  for (const t of urgentTasks) {
    const label = t.title.length > 60 ? t.title.slice(0, 60) + "…" : t.title;
    alerts.push({ id: `task-${t.id}`, type: t.priority === "critical" ? "critical" : "warning",
      title: `Open Action Required: ${label}`,
      body: `This ${t.priority}-priority ${t.category ?? "administrative"} control is still open. Resolving it will directly improve your compliance score.`,
      createdAt: assessedAt });
  }

  // 5. Financial exposure
  const exposure = Number(financialResult.data?.total_exposure_max ?? 0);
  if (exposure > 100000) {
    const currency = financialResult.data?.currency ?? "CAD";
    alerts.push({ id: "financial-exposure", type: "warning",
      title: "Significant Financial Exposure",
      body: `Estimated maximum financial exposure is ${new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(exposure)} ${currency}. Closing compliance gaps will reduce this figure.`,
      createdAt: assessedAt });
  }

  // 6. Assessment completed (success, only if few other alerts)
  if (session.completed_at) {
    alerts.push({ id: "assessment-complete", type: "success",
      title: "Assessment Completed",
      body: `Your ${fw} assessment was completed on ${new Date(session.completed_at).toLocaleDateString("en-CA")}. Re-assess quarterly to keep scores current.`,
      createdAt: session.completed_at });
  }

  const alertIds = alerts.map((a) => a.id);
  const { data: states } = alertIds.length > 0
    ? await admin.from("alert_states").select("alert_id, read_at, dismissed_at").eq("user_id", userId).in("alert_id", alertIds)
    : { data: [] as { alert_id: string; read_at: string | null; dismissed_at: string | null }[] };

  const stateMap = new Map((states ?? []).map((s) => [s.alert_id, s]));

  const result: AlertItem[] = alerts
    .filter((a) => !stateMap.get(a.id)?.dismissed_at)
    .map((a) => ({ ...a, read: a.type === "success" || !!stateMap.get(a.id)?.read_at }));

  return { alerts: result };
}

// ─── Evidence Files ────────────────────────────────────────────────────────────

export interface EvidenceFileItem {
  id: string;
  originalName: string;
  storagePath: string;
  fileSize: number | null;
  contentType: string | null;
  category: string;
  controlRef: string | null;
  notes: string | null;
  createdAt: string;
}

export interface EvidenceData {
  files: EvidenceFileItem[];
  missingControls: { title: string; priority: string }[];
}

export async function getEvidenceData(): Promise<EvidenceData | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { userId } = ctx;
  const admin = createAdminClient();

  const [filesResult, roadmapResult] = await Promise.all([
    admin.from("evidence_files")
      .select("id, original_name, storage_path, file_size, content_type, category, control_ref, notes, created_at")
      .eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }),
    admin.from("remediation_roadmap").select("title, priority")
      .eq("user_id", userId).eq("status", "open")
      .in("priority", ["critical", "high"]).order("priority_rank").limit(8),
  ]);

  const files = (filesResult.data ?? []).map((f) => ({
    id: f.id,
    originalName: f.original_name,
    storagePath: f.storage_path,
    fileSize: f.file_size ?? null,
    contentType: f.content_type ?? null,
    category: f.category ?? "General",
    controlRef: f.control_ref ?? null,
    notes: f.notes ?? null,
    createdAt: f.created_at,
  }));

  const uploadedNames = new Set(files.map((f) => f.originalName.toLowerCase()));
  const missingControls = (roadmapResult.data ?? [])
    .filter((t) => !uploadedNames.has(t.title.toLowerCase()))
    .map((t) => ({ title: t.title, priority: t.priority ?? "medium" }));

  return { files, missingControls };
}

export async function uploadEvidenceFile(formData: FormData): Promise<{ error?: string }> {
  const ctx = await getOrgContext();
  if (!ctx) return { error: "Not authenticated" };
  if (ctx.role !== "admin") return { error: "Viewers cannot upload evidence files" };
  const { currentUserId, userId } = ctx;

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };
  if (file.size > 25 * 1024 * 1024) return { error: "File exceeds 25 MB limit" };

  const ALLOWED_EXT = new Set([".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".txt"]);
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return { error: `File type "${ext}" is not allowed. Accepted: PDF, DOCX, XLSX, CSV, PNG, JPG, TXT` };

  const category = (formData.get("category") as string | null)?.trim() ?? "General";
  const controlRef = (formData.get("controlRef") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const base = process.env.EWNAF_HOST;
  const token = process.env.EWNAF_UPLOAD_TOKEN;
  if (!base || !token) return { error: "Storage not configured" };

  const goForm = new FormData();
  goForm.append("file", file);
  goForm.append("user_id", currentUserId);

  let uploadRes: Response;
  try {
    uploadRes = await fetch(`${base}/evidence/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: goForm,
    });
  } catch {
    return { error: "Could not reach storage server" };
  }

  if (!uploadRes.ok) return { error: `Upload failed: ${uploadRes.statusText}` };

  const result = await uploadRes.json() as {
    storage_path: string; file_size: number; original_name: string; content_type: string;
  };

  const admin = createAdminClient();
  const { data: session } = await admin.from("assessment_sessions")
    .select("id").eq("user_id", userId)
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  const { error } = await admin.from("evidence_files").insert({
    user_id: userId,
    session_id: session?.id ?? null,
    original_name: result.original_name,
    storage_path: result.storage_path,
    file_size: result.file_size,
    content_type: result.content_type,
    category,
    control_ref: controlRef,
    notes,
    status: "active",
  });

  if (error) return { error: error.message };
  return {};
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────

export interface TopNavAlert {
  type: "critical" | "warning" | "info";
  title: string;
  createdAt: string;
}

export interface TopNavData {
  orgName: string;
  orgInitials: string;
  riskScore: number;
  riskBand: "critical" | "high" | "medium" | "low" | null;
  frameworkName: string | null;
  lastRun: string | null;
  userEmail: string;
  alertCount: number;
  recentAlerts: TopNavAlert[];
}

export async function getTopNavData(): Promise<TopNavData> {
  const empty: TopNavData = {
    orgName: "Your Organization",
    orgInitials: "YO",
    riskScore: 0,
    riskBand: null,
    frameworkName: null,
    lastRun: null,
    userEmail: "",
    alertCount: 0,
    recentAlerts: [],
  };

  const ctx = await getOrgContext();
  if (!ctx) return empty;

  const { userId, currentUserEmail } = ctx;
  const admin = createAdminClient();

  const [orgResult, sessionResult] = await Promise.all([
    admin.from("organizations").select("org_name, org_uid, id").eq("user_id", userId).single(),
    admin
      .from("assessment_sessions")
      .select("id, framework_id, completed_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const orgName = orgResult.data?.org_name ?? empty.orgName;
  const words = orgName.trim().split(/\s+/);
  const orgInitials = words.slice(0, 2).map((w: string) => w[0].toUpperCase()).join("");

  if (!sessionResult.data) {
    return { ...empty, orgName, orgInitials, userEmail: currentUserEmail };
  }

  const session = sessionResult.data;

  const orgUid = orgResult.data?.org_uid ?? orgResult.data?.id ?? null;

  const [riskResult, frameworkResult, scanResult, alertsData] = await Promise.all([
    admin.from("risk_scores").select("total_score, risk_band, calculated_at").eq("session_id", session.id).maybeSingle(),
    admin.from("frameworks").select("name").eq("id", session.framework_id).maybeSingle(),
    orgUid
      ? admin.from("fact_software_results").select("created_at").eq("org_uid", orgUid).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    getAlertsData(),
  ]);

  // Badge count + dropdown preview both come from the same unread-alert source
  // that powers the Alerts page, so dismissing/reading an alert there keeps these in sync.
  const unreadAlerts = (alertsData?.alerts ?? []).filter((a) => !a.read);

  const recentAlerts: TopNavAlert[] = unreadAlerts.slice(0, 3).map((a) => ({
    type: a.type === "success" ? "info" : a.type,
    title: a.title.length > 55 ? a.title.slice(0, 55) + "…" : a.title,
    createdAt: a.createdAt,
  }));

  return {
    orgName,
    orgInitials,
    riskScore: Math.round(Number(riskResult.data?.total_score ?? 0)),
    riskBand: (riskResult.data?.risk_band as TopNavData["riskBand"]) ?? null,
    frameworkName: frameworkResult.data?.name ?? session.framework_id?.toUpperCase() ?? null,
    lastRun: [riskResult.data?.calculated_at, scanResult.data?.created_at, session.completed_at]
      .filter(Boolean)
      .sort()
      .at(-1) ?? null,
    userEmail: currentUserEmail,
    alertCount: unreadAlerts.length,
    recentAlerts,
  };
}

export async function deleteEvidenceFile(id: string): Promise<{ error?: string }> {
  const ctx = await getOrgContext();
  if (!ctx) return { error: "Not authenticated" };
  if (ctx.role !== "admin") return { error: "Viewers cannot delete evidence files" };
  const { userId } = ctx;

  const admin = createAdminClient();
  const { data: file } = await admin.from("evidence_files")
    .select("storage_path").eq("id", id).eq("user_id", userId).single();

  if (!file) return { error: "File not found" };

  const base = process.env.EWNAF_HOST;
  const token = process.env.EWNAF_UPLOAD_TOKEN;
  if (base && token) {
    await fetch(
      `${base}/evidence/delete?path=${encodeURIComponent(file.storage_path)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    ).catch(() => { /* best-effort — still delete DB row */ });
  }

  const { error } = await admin.from("evidence_files").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: error.message };
  return {};
}

// ─── Org Invitations ──────────────────────────────────────────────────────────

export interface OrgInvitation {
  id: string;
  invitedEmail: string;
  role: "admin" | "viewer";
  status: "pending" | "accepted" | "revoked";
  invitedAt: string;
  acceptedAt: string | null;
}

export async function getOrgInvitations(): Promise<OrgInvitation[]> {
  const ctx = await getOrgContext();
  if (!ctx || ctx.role !== "admin") return [];
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("user_id", ctx.userId)
    .single();
  if (!org) return [];
  const { data } = await admin
    .from("org_invitations")
    .select("id, invited_email, role, status, invited_at, accepted_at")
    .eq("org_id", org.id)
    .in("status", ["pending", "accepted"])
    .order("invited_at", { ascending: false });
  return (data ?? []).map((i) => ({
    id: i.id,
    invitedEmail: i.invited_email,
    role: i.role as "admin" | "viewer",
    status: i.status as "pending" | "accepted" | "revoked",
    invitedAt: i.invited_at,
    acceptedAt: i.accepted_at ?? null,
  }));
}
