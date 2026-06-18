"use server";

import { createAdminClient } from "../../../utils/supabase/admin";
import { createClient } from "../../../utils/supabase/server";

export async function inviteTeamMember(
  email: string,
  role: "admin" | "viewer",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Caller must be the org owner (admin)
  const { data: org } = await admin
    .from("organizations")
    .select("id, org_name")
    .eq("user_id", user.id)
    .single();

  if (!org) return { error: "Only the organization owner can invite members" };

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { error: "Please enter a valid email address" };
  }

  // Prevent duplicate invites
  const { data: existing } = await admin
    .from("org_invitations")
    .select("id, status")
    .eq("org_id", org.id)
    .eq("invited_email", trimmedEmail)
    .in("status", ["pending", "accepted"])
    .maybeSingle();

  if (existing) {
    return {
      error:
        existing.status === "accepted"
          ? "This person is already a member of your organization"
          : "An invitation has already been sent to this email",
    };
  }

  // Insert invite record first
  const { data: invite, error: insertError } = await admin
    .from("org_invitations")
    .insert({
      org_id: org.id,
      invited_email: trimmedEmail,
      role,
      status: "pending",
      invited_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !invite) return { error: insertError?.message ?? "Failed to create invitation" };

  // Send the magic-link invite via Supabase Auth
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error: authError } = await admin.auth.admin.inviteUserByEmail(trimmedEmail, {
    redirectTo: `${appUrl}/auth/callback`,
    data: { org_id: org.id, invited_role: role },
  });

  if (authError) {
    // Roll back the invite row if the email send failed
    await admin.from("org_invitations").delete().eq("id", invite.id);
    return { error: authError.message };
  }

  return {};
}

export async function revokeInvitation(invitationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!org) return { error: "Only the organization owner can revoke invitations" };

  const { error } = await admin
    .from("org_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("org_id", org.id);

  if (error) return { error: error.message };
  return {};
}
