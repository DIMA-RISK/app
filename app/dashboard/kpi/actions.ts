"use server";

import { createAdminClient } from "../../../utils/supabase/admin";
import { createClient } from "../../../utils/supabase/server";

async function getOwnerId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("user_id").eq("user_id", user.id).maybeSingle();
  if (org) return user.id;
  const { data: invite } = await admin.from("org_invitations")
    .select("organizations!inner(user_id)").eq("accepted_by", user.id).eq("status", "accepted").maybeSingle();
  return invite ? (invite.organizations as unknown as { user_id: string }).user_id : null;
}

// Same as getOwnerId but also returns the caller's role, so KPI definitions
// (which drive roadmap prioritization) can be restricted to admins.
async function resolveOwner(): Promise<{ ownerId: string; role: "admin" | "viewer" } | { error: string }> {
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

export type KpiPriority = "critical" | "high" | "medium" | "low";
export type ControlCategory = "technical" | "administrative" | "physical";

export interface KpiDefinitionInput {
  name: string;
  framework_tag: string | null;
  control_category: ControlCategory | null;
  priority: KpiPriority;
  executive_owner: string | null;
  target: string | null;
  description: string | null;
}

export async function createKpiDefinition(input: KpiDefinitionInput): Promise<{ error?: string }> {
  const resolved = await resolveOwner();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot define KPIs" };
  if (!input.name.trim()) return { error: "KPI name is required" };

  const admin = createAdminClient();
  const { error } = await admin.from("kpi_definitions").insert({ user_id: resolved.ownerId, ...input });
  if (error) return { error: error.message };
  return {};
}

export async function updateKpiDefinition(id: string, input: KpiDefinitionInput): Promise<{ error?: string }> {
  const resolved = await resolveOwner();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot edit KPIs" };

  const admin = createAdminClient();
  const { error } = await admin.from("kpi_definitions")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", resolved.ownerId);
  if (error) return { error: error.message };
  return {};
}

export async function deleteKpiDefinition(id: string): Promise<{ error?: string }> {
  const resolved = await resolveOwner();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot delete KPIs" };

  const admin = createAdminClient();
  const { error } = await admin.from("kpi_definitions").delete().eq("id", id).eq("user_id", resolved.ownerId);
  if (error) return { error: error.message };
  return {};
}

export async function saveBoardMeeting(
  meetingDate: string,
  riskAgendaItem: boolean,
  notes?: string,
): Promise<{ error?: string }> {
  const ownerId = await getOwnerId();
  if (!ownerId) return { error: "Not authenticated" };
  const admin = createAdminClient();
  const { error } = await admin.from("board_meetings").insert({
    user_id: ownerId,
    meeting_date: meetingDate,
    risk_agenda_item: riskAgendaItem,
    notes: notes ?? null,
  });
  if (error) return { error: error.message };
  return {};
}
