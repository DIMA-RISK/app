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
