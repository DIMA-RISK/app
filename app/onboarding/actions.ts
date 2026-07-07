"use server";

import { createAdminClient } from "../../utils/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface AnswerEntry {
  session_id: string;
  question_id: number;
  framework_id: string;
  response: "yes" | "no" | "partial" | "na";
}

interface OrgProfile {
  patient_records_count: number;
  data_storage_gb: number;
  has_health_data: boolean;
  has_financial_data: boolean;
  has_pii_data: boolean;
  data_sensitivity_level: number;
  vendor_count: number;
  max_vendor_access_level: number;
  vendor_data_share_pct: number;
  business_size: string;
  annual_revenue: number;
  employee_count: number;
}

export async function saveOnboardingAnswers(entries: AnswerEntry[], orgProfile: OrgProfile) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // 1. Save org profile data
  const { error: orgError } = await admin
    .from("organizations")
    .update({
      patient_records_count: orgProfile.patient_records_count,
      data_storage_gb: orgProfile.data_storage_gb,
      has_health_data: orgProfile.has_health_data,
      has_financial_data: orgProfile.has_financial_data,
      has_pii_data: orgProfile.has_pii_data,
      data_sensitivity_level: orgProfile.data_sensitivity_level,
      vendor_count: orgProfile.vendor_count,
      max_vendor_access_level: orgProfile.max_vendor_access_level,
      vendor_data_share_pct: orgProfile.vendor_data_share_pct,
      business_size: orgProfile.business_size,
      annual_revenue: orgProfile.annual_revenue,
      employee_count: orgProfile.employee_count,
    })
    .eq("user_id", user.id);

  if (orgError) return { error: orgError.message };

  // 2. Save questionnaire answers
  if (entries.length > 0) {
    const rows = entries.map((e) => ({
      session_id: e.session_id,
      question_id: e.question_id,
      framework_id: e.framework_id,
      response: e.response,
    }));

    const { error: insertError } = await admin
      .from("questionnaire_responses")
      .upsert(rows, { onConflict: "session_id,question_id,framework_id" });

    if (insertError) return { error: insertError.message };
  }

  // 3. Run scoring functions using the session_id
  if (entries.length > 0) {
    const sessionId = entries[0].session_id;
    const frameworkId = entries[0].framework_id;

    await admin.rpc("calculate_risk_score", { p_session_id: sessionId });
    await admin.rpc("calculate_financial_impact", { p_session_id: sessionId });

    // 3b. Generate remediation roadmap from failed / partial responses
    await regenerateRoadmap(admin, user.id, sessionId, frameworkId);
  } else {
    // No questionnaire — still try to find session and score with org data only
    const { data: session } = await admin
      .from("assessment_sessions")
      .select("id")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (session) {
      await admin.rpc("calculate_risk_score", { p_session_id: session.id });
      await admin.rpc("calculate_financial_impact", { p_session_id: session.id });
    }
  }

  // 4. Mark onboarding complete
  const { error: updateError } = await admin
    .from("organizations")
    .update({ onboarding_completed: true })
    .eq("user_id", user.id);

  if (updateError) return { error: updateError.message };

  return { error: null };
}

async function getAuthedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function queueScanJob() {
  const user = await getAuthedUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id, org_uid, org_ip")
    .eq("user_id", user.id)
    .single();

  if (!org?.org_ip) return { error: null }; // no IP configured — skip scan silently

  // Auto-derive org_uid from Supabase org id if it was never set
  let orgUid = org.org_uid ?? org.id;
  if (!org.org_uid) {
    await admin.from("organizations").update({ org_uid: orgUid }).eq("user_id", user.id);
  }

  // Avoid duplicate queued jobs for the same org
  const { data: existing } = await admin
    .from("software_queue")
    .select("id")
    .eq("org_uid", orgUid)
    .in("status", ["queued", "running"])
    .limit(1)
    .maybeSingle();

  if (existing) return { error: null }; // already queued

  const { error } = await admin.from("software_queue").insert({
    job_id: Date.now(),
    org_uid: orgUid,
    org_ip: org.org_ip,
    status: "queued",
  });

  return { error: error?.message ?? null };
}

export async function checkScanStatus(): Promise<{ done: boolean; error: string | null }> {
  const user = await getAuthedUser();
  if (!user) return { done: false, error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id, org_uid, org_ip")
    .eq("user_id", user.id)
    .single();

  // No IP means scan was never submitted — let the user proceed
  if (!org?.org_ip) return { done: true, error: null };

  // Use the derived org_uid (same fallback as queueScanJob)
  const orgUid = org.org_uid ?? org.id;

  const { data: result } = await admin
    .from("fact_software_results")
    .select("job_id, results")
    .eq("org_uid", orgUid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Only consider the scan done when results are actually populated
  return { done: !!(result && result.results), error: null };
}

export async function rescoreWithScan() {
  const user = await getAuthedUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("assessment_sessions")
    .select("id, framework_id")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (!session) return { error: null };

  await admin.rpc("calculate_risk_score", { p_session_id: session.id });
  await admin.rpc("calculate_financial_impact", { p_session_id: session.id });

  // Regenerate roadmap from existing responses (handles case where onboarding
  // roadmap insert was skipped or question_id mapping changed)
  await regenerateRoadmap(admin, user.id, session.id, session.framework_id);

  return { error: null };
}

async function regenerateRoadmap(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  sessionId: string,
  frameworkId: string,
) {
  const { data: allResponses } = await admin
    .from("questionnaire_responses")
    .select("question_id, response")
    .eq("session_id", sessionId);

  if (!allResponses || allResponses.length === 0) return;

  const failing = allResponses.filter((r) => r.response === "no" || r.response === "partial");
  const passingIds = allResponses.filter((r) => r.response === "yes").map((r) => r.question_id);

  // One-time cleanup of pre-linkage rows (question_id was added later). Going
  // forward every row is linked to its question, so this is a no-op after the
  // first run.
  await admin.from("remediation_roadmap").delete().eq("session_id", sessionId).is("question_id", null);

  if (failing.length > 0) {
    const failedIds = failing.map((r) => r.question_id);
    const qMap = new Map<number, { text: string; statement: string | null }>();

    if (frameworkId === "pipeda") {
      const { data: pq } = await admin
        .from("pipeda_questions")
        .select("id, business_question, compliance_statement")
        .in("id", failedIds);
      (pq ?? []).forEach((q) => qMap.set(q.id, { text: q.business_question, statement: q.compliance_statement ?? null }));
    } else if (frameworkId === "hipaa") {
      const { data: hq } = await admin
        .from("hipaa_questions")
        .select("id, questionaire, statement")
        .in("id", failedIds);
      (hq ?? []).forEach((q) => qMap.set(q.id, { text: q.questionaire, statement: q.statement ?? null }));
    }

    const rows = failing.flatMap((r) => {
      const q = qMap.get(r.question_id);
      if (!q) return [];
      return [{
        session_id: sessionId,
        user_id: userId,
        question_id: r.question_id,
        title: q.text,
        description: q.statement,
        category: "administrative",
        priority: r.response === "no" ? "critical" : "high",
        effort: "medium",
      }];
    });

    if (rows.length > 0) {
      // status is intentionally omitted: defaults to 'open' on insert, left
      // untouched on conflict so in-progress/resolved work survives a rescan.
      await admin.from("remediation_roadmap").upsert(rows, { onConflict: "session_id,question_id" });
    }
  }

  // A question that's since been answered "yes" (directly, or via task resolution)
  // should no longer sit open in the roadmap.
  if (passingIds.length > 0) {
    await admin
      .from("remediation_roadmap")
      .update({ status: "resolved" })
      .eq("session_id", sessionId)
      .in("question_id", passingIds)
      .neq("status", "resolved");
  }
}
