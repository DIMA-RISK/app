"use server";

import { createAdminClient } from "../../../utils/supabase/admin";
import { createClient } from "../../../utils/supabase/server";

async function getOwner(): Promise<{ ownerId: string; role: "admin" | "viewer" } | { error: string }> {
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

export async function updatePhaseStatus(
  phaseId: number,
  status: "not_started" | "in_progress" | "complete",
  notes?: string,
): Promise<{ error?: string }> {
  const resolved = await getOwner();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot update tracker status" };
  const admin = createAdminClient();
  const { error } = await admin.from("iso27001_tracker").upsert(
    { user_id: resolved.ownerId, phase_id: phaseId, status, notes: notes ?? null, updated_at: new Date().toISOString() },
    { onConflict: "user_id,phase_id" }
  );
  if (error) return { error: error.message };
  return {};
}

export async function updateSoaControl(
  controlId: string,
  applicable: boolean,
  implemented: boolean,
  justification?: string,
): Promise<{ error?: string }> {
  const resolved = await getOwner();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot update the SoA" };
  const admin = createAdminClient();
  const { error } = await admin.from("iso27001_soa").upsert(
    { user_id: resolved.ownerId, control_id: controlId, applicable, implemented, justification: justification ?? null, updated_at: new Date().toISOString() },
    { onConflict: "user_id,control_id" }
  );
  if (error) return { error: error.message };
  return {};
}
