"use server";

import { createAdminClient } from "../../utils/supabase/admin";

interface OrgMetadata {
  org_name?: string;
  p_number?: string;
  industry?: string;
  address?: string;
  org_country?: string;
  dba_name?: string;
  org_ip?: string;
}

// Called once we have a confirmed, authenticated user — whether they arrived
// via the magic-link callback, OTP code verification, or (when "Confirm email"
// is off) immediately after signUp(). The org details are stored as
// user_metadata at signUp() time rather than passed around client-side, since
// that travels with the auth user across devices/tabs/browsers, unlike
// sessionStorage or query params.
export async function completeOrgRegistration(userId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();

  // Idempotent — safe to call from multiple verification paths.
  const { data: existing } = await admin.from("organizations").select("id").eq("user_id", userId).maybeSingle();
  if (existing) return {};

  const { data: userResult, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userResult.user) return { error: userError?.message ?? "User not found" };

  const meta = (userResult.user.user_metadata ?? {}) as OrgMetadata;

  // No org_name in metadata means this isn't an org-registration signup (e.g.
  // an invited team member confirming via their own magic link) — nothing to do.
  if (!meta.org_name) return {};

  const { error: insertError } = await admin.from("organizations").insert({
    user_id: userId,
    org_name: meta.org_name,
    email: userResult.user.email ?? "",
    p_number: meta.p_number,
    industry: meta.industry,
    address: meta.address,
    org_country: meta.org_country,
    dba_name: meta.dba_name || null,
    org_ip: meta.org_ip || null,
    org_uid: Date.now(),
  });

  if (insertError) return { error: insertError.message };

  // Assign the correct compliance framework based on country + industry
  await admin.rpc("assign_frameworks_for_org", { p_user_id: userId });

  return {};
}

// Atomically claims a beta invite code (single UPDATE...WHERE used_at IS NULL,
// so two people racing on the same code can't both get through). Called right
// before signUp() — invalid/used/mismatched codes never reach Supabase Auth.
export async function redeemBetaCode(code: string, email: string): Promise<{ error?: string }> {
  const trimmedCode = code.trim().toUpperCase();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedCode) return { error: "Please enter your invite code." };

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("beta_codes")
    .update({ used_at: now })
    .eq("code", trimmedCode)
    .eq("email", trimmedEmail)
    .is("used_at", null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .select("code")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    // Distinguish an expired code for a clearer message (the atomic claim above
    // already failed either way; this SELECT is only for wording).
    const { data: existing } = await admin
      .from("beta_codes")
      .select("expires_at, used_at")
      .eq("code", trimmedCode)
      .eq("email", trimmedEmail)
      .maybeSingle();
    if (existing?.expires_at && new Date(existing.expires_at) <= new Date(now) && !existing.used_at) {
      return { error: "This invite code has expired. Please request a new invitation." };
    }
    return { error: "Invalid invite code, or it doesn't match this email." };
  }
  return {};
}

// Best-effort release if signUp() fails for an unrelated reason after the
// code was already claimed, so the person doesn't lose their one shot.
export async function releaseBetaCode(code: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("beta_codes").update({ used_at: null }).eq("code", code.trim().toUpperCase());
}
