"use server";

import { createClient } from "../../utils/supabase/server";
import { createAdminClient } from "../../utils/supabase/admin";

export interface DashboardData {
  orgName: string;
  greeting: string;
  riskScore: number;
  riskBand: "critical" | "high" | "medium" | "low" | null;
  compliancePct: number;
  openCritical: number;
  yesCount: number;
  noCount: number;
  totalControls: number;
  frameworkId: string | null;
  frameworkName: string | null;
  tasks: { title: string; priority: string; effort: string; description: string | null }[];
  financialExposureMin: number | null;
  financialExposureMax: number | null;
  currency: string;
  snapshotDate: string;
  hasSession: boolean;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
    totalControls: 0,
    frameworkId: null,
    frameworkName: null,
    tasks: [],
    financialExposureMin: null,
    financialExposureMax: null,
    currency: "CAD",
    snapshotDate: new Date().toISOString(),
    hasSession: false,
  };

  if (!user) return empty;

  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("org_name")
    .eq("user_id", user.id)
    .single();

  const { data: session } = await admin
    .from("assessment_sessions")
    .select("id, framework_id, completed_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return { ...empty, orgName: org?.org_name ?? empty.orgName };
  }

  const [riskResult, responsesResult, remediationResult, financialResult, frameworkResult] =
    await Promise.all([
      admin
        .from("risk_scores")
        .select("total_score, risk_band")
        .eq("session_id", session.id)
        .maybeSingle(),
      admin
        .from("questionnaire_responses")
        .select("response")
        .eq("session_id", session.id),
      admin
        .from("remediation_roadmap")
        .select("title, priority, effort, description")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("priority")
        .limit(10),
      admin
        .from("financial_impact")
        .select("total_exposure_min, total_exposure_max, currency")
        .eq("session_id", session.id)
        .maybeSingle(),
      admin
        .from("frameworks")
        .select("name")
        .eq("id", session.framework_id)
        .maybeSingle(),
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

  return {
    orgName: org?.org_name ?? empty.orgName,
    greeting,
    riskScore: Math.round(Number(riskResult.data?.total_score ?? 0)),
    riskBand: (riskResult.data?.risk_band as DashboardData["riskBand"]) ?? null,
    compliancePct,
    openCritical: tasks.filter((t) => t.priority === "critical").length,
    yesCount,
    noCount,
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
  };
}
