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

  const { error } = await admin
    .from("remediation_roadmap")
    .update({ status })
    .eq("id", taskId)
    .eq("user_id", ownerId);

  if (error) return { error: error.message };
  return {};
}
