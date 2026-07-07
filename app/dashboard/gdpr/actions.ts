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

export async function saveGdprResponse(
  questionId: number,
  response: "yes" | "no" | "q_yes" | null,
  documented?: boolean,
  comments?: string,
): Promise<{ error?: string }> {
  const resolved = await getOwner();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot update assessment responses" };

  const admin = createAdminClient();
  const { error } = await admin.from("gdpr_responses").upsert(
    {
      user_id: resolved.ownerId,
      question_id: questionId,
      response,
      documented: documented ?? null,
      comments: comments ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,question_id" }
  );
  if (error) return { error: error.message };
  return {};
}

export async function saveGdprProcess(input: {
  id?: string;
  processName: string;
  controllerStatus: string | null;
  personalData: boolean;
  specialCategory: boolean;
  childrenData: boolean;
  lawfulBasis: string | null;
  dataVolume: string | null;
  gdprCompliant: string | null;
  notes: string | null;
}): Promise<{ error?: string }> {
  const resolved = await getOwner();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot update the process register" };

  const admin = createAdminClient();
  const row = {
    user_id: resolved.ownerId,
    process_name: input.processName,
    controller_status: input.controllerStatus,
    personal_data: input.personalData,
    special_category: input.specialCategory,
    children_data: input.childrenData,
    lawful_basis: input.lawfulBasis,
    data_volume: input.dataVolume,
    gdpr_compliant: input.gdprCompliant,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await admin.from("gdpr_process_register").update(row).eq("id", input.id).eq("user_id", resolved.ownerId);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from("gdpr_process_register").insert(row);
    if (error) return { error: error.message };
  }
  return {};
}

export async function deleteGdprProcess(id: string): Promise<{ error?: string }> {
  const resolved = await getOwner();
  if ("error" in resolved) return resolved;
  if (resolved.role !== "admin") return { error: "Viewers cannot delete process register entries" };
  const admin = createAdminClient();
  const { error } = await admin.from("gdpr_process_register").delete().eq("id", id).eq("user_id", resolved.ownerId);
  if (error) return { error: error.message };
  return {};
}
