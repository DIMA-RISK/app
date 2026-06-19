"use server";

import { createAdminClient } from "../../../utils/supabase/admin";
import { createClient } from "../../../utils/supabase/server";

export async function updateTaskStatus(
  taskId: string,
  status: "open" | "in_progress" | "resolved",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Resolve the org owner's user_id (same logic as getOrgContext)
  const { data: org } = await admin
    .from("organizations")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let ownerId = user.id;

  if (!org) {
    const { data: invite } = await admin
      .from("org_invitations")
      .select("role, organizations!inner(user_id)")
      .eq("accepted_by", user.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (!invite) return { error: "Not authorized" };
    if (invite.role !== "admin") return { error: "Viewers cannot update task status" };
    ownerId = (invite.organizations as unknown as { user_id: string }).user_id;
  }

  const { data: task } = await admin
    .from("remediation_roadmap")
    .select("id, session_id, question_id, priority, status")
    .eq("id", taskId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (!task) return { error: "Task not found" };

  const { error } = await admin
    .from("remediation_roadmap")
    .update({ status })
    .eq("id", taskId)
    .eq("user_id", ownerId);

  if (error) return { error: error.message };

  // Keep the underlying questionnaire answer (and therefore the risk score) in
  // sync with task resolution — resolving a task means the gap is closed;
  // reopening it means the gap is back.
  if (task.question_id != null) {
    let newResponse: "yes" | "no" | "partial" | null = null;
    if (status === "resolved" && task.status !== "resolved") {
      newResponse = "yes";
    } else if (task.status === "resolved" && status !== "resolved") {
      newResponse = task.priority === "high" ? "partial" : "no";
    }

    if (newResponse) {
      await admin
        .from("questionnaire_responses")
        .update({ response: newResponse })
        .eq("session_id", task.session_id)
        .eq("question_id", task.question_id);

      await admin.rpc("calculate_risk_score", { p_session_id: task.session_id });
      await admin.rpc("calculate_financial_impact", { p_session_id: task.session_id });
    }
  }

  return {};
}
