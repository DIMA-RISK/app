"use server";

import { createAdminClient } from "../../../utils/supabase/admin";
import { createClient } from "../../../utils/supabase/server";

export type RiskCategory = "operational" | "financial" | "strategic" | "compliance" | "technology" | "reputational";
export type ProbabilityBand = "low" | "medium" | "high" | "critical";
export type TreatmentStatus = "untreated" | "in_progress" | "done";

export interface RiskEntryInput {
  title: string;
  category: RiskCategory;
  probability_band: ProbabilityBand;
  impact_direct: number;
  impact_regulatory: number;
  impact_recovery: number;
  framework_tags: string[];
  division: string | null;
  owner: string | null;
  treatment_status: TreatmentStatus;
  probability_after_band: ProbabilityBand | null;
  treatment_cost: number | null;
}

async function resolveOwner(): Promise<{ ownerId: string; role: "admin" | "viewer" } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("user_id").eq("user_id", user.id).maybeSingle();

  if (org) return { ownerId: user.id, role: "admin" };

  const { data: invite } = await admin
    .from("org_invitations")
    .select("role, organizations!inner(user_id)")
    .eq("accepted_by", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!invite) return { error: "Not authorized" };
  return {
    ownerId: (invite.organizations as unknown as { user_id: string }).user_id,
    role: invite.role as "admin" | "viewer",
  };
}

export async function createRiskEntry(input: RiskEntryInput): Promise<{ error?: string }> {
  const resolved = await resolveOwner();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot add risk entries" };

  const admin = createAdminClient();
  const { error } = await admin.from("risk_register_entries").insert({
    user_id: resolved.ownerId,
    ...input,
  });

  if (error) return { error: error.message };
  return {};
}

export async function updateRiskEntry(id: string, input: RiskEntryInput): Promise<{ error?: string }> {
  const resolved = await resolveOwner();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot edit risk entries" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("risk_register_entries")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", resolved.ownerId);

  if (error) return { error: error.message };
  return {};
}

export async function deleteRiskEntry(id: string): Promise<{ error?: string }> {
  const resolved = await resolveOwner();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot delete risk entries" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("risk_register_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", resolved.ownerId);

  if (error) return { error: error.message };
  return {};
}
