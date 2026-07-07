"use server";

import { createAdminClient } from "../../../utils/supabase/admin";
import { createClient } from "../../../utils/supabase/server";

async function getOwnerId(): Promise<{ ownerId: string; role: "admin" | "viewer" } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("user_id").eq("user_id", user.id).maybeSingle();
  if (org) return { ownerId: user.id, role: "admin" };
  const { data: invite } = await admin.from("org_invitations")
    .select("role, organizations!inner(user_id)").eq("accepted_by", user.id).eq("status", "accepted").maybeSingle();
  if (!invite) return { error: "Not authorized" };
  return { ownerId: (invite.organizations as unknown as { user_id: string }).user_id, role: invite.role as "admin" | "viewer" };
}

export async function setCriticalControl(controlId: number, present: boolean): Promise<{ error?: string }> {
  const resolved = await getOwnerId();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot update critical controls" };

  const admin = createAdminClient();
  const { error } = await admin.from("critical_control_responses").upsert(
    { user_id: resolved.ownerId, control_id: controlId, present, updated_at: new Date().toISOString() },
    { onConflict: "user_id,control_id" }
  );

  if (error) return { error: error.message };
  return {};
}
