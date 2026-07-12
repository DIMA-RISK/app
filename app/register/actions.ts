"use server";

import { createAdminClient } from "../../utils/supabase/admin";

interface OrgMetadata {
  org_name?: string;
  p_number?: string;
  industry?: string;
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

  // Atomic claim. We intentionally do NOT reference `expires_at` by name in the
  // query (no `.or()` filter, `select("*")` instead of naming columns) so this
  // can never fail with "column expires_at does not exist" if the API schema
  // cache is lagging behind a migration. Expiry is enforced defensively below,
  // only when the column is actually present on the returned row.
  const { data, error } = await admin
    .from("beta_codes")
    .update({ used_at: now })
    .eq("code", trimmedCode)
    .eq("email", trimmedEmail)
    .is("used_at", null)
    .select("*")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Invalid invite code, or it doesn't match this email." };

  const expiresAt = (data as { expires_at?: string | null }).expires_at;
  if (expiresAt && new Date(expiresAt) <= new Date(now)) {
    // Code was expired — release the claim we just made and reject.
    await admin.from("beta_codes").update({ used_at: null }).eq("code", trimmedCode);
    return { error: "This invite code has expired. Please request a new invitation." };
  }
  return {};
}

// Whether an account with this email already exists AND is confirmed.
// signUp() obfuscates existing accounts (returns user: null) to prevent
// enumeration, so we can't tell from its response whether re-registration
// hit a confirmed account (no code will be sent — nothing to confirm) or an
// unconfirmed one (a fresh code is resent). This lets the register page show
// "please log in" for confirmed accounts instead of dead-ending on the
// check-email page waiting for a code that will never arrive.
export async function emailAlreadyConfirmed(email: string): Promise<boolean> {
  const target = email.trim().toLowerCase();
  const admin = createAdminClient();
  // Beta scale — a single large page is sufficient. Revisit with a targeted
  // lookup if the user base grows past a few hundred.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = data.users.find((u) => u.email?.toLowerCase() === target);
  return !!(match && match.email_confirmed_at);
}

// Best-effort release if signUp() fails for an unrelated reason after the
// code was already claimed, so the person doesn't lose their one shot.
export async function releaseBetaCode(code: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("beta_codes").update({ used_at: null }).eq("code", code.trim().toUpperCase());
}
