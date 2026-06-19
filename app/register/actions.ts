"use server";

import { createAdminClient } from "../../utils/supabase/admin";

interface RegisterPayload {
  userId: string;
  email: string;
  org_name: string;
  p_number: string;
  industry: string;
  address: string;
  org_country: string;
  dba_name: string;
  org_ip: string;
}

// Called after the client has already created the auth user via supabase.auth.signUp().
// We only own the organization row + framework assignment here — the auth user
// itself (and its email confirmation) is handled by Supabase Auth directly.
export async function registerOrganization(payload: RegisterPayload) {
  const admin = createAdminClient();

  const { error: insertError } = await admin.from("organizations").insert({
    user_id: payload.userId,
    org_name: payload.org_name,
    email: payload.email,
    p_number: payload.p_number,
    industry: payload.industry,
    address: payload.address,
    org_country: payload.org_country,
    dba_name: payload.dba_name || null,
    org_ip: payload.org_ip || null,
    org_uid: Date.now(),
  });

  if (insertError) {
    // Roll back the auth user so the email isn't stuck on a half-created account
    await admin.auth.admin.deleteUser(payload.userId);
    return { error: insertError.message };
  }

  // Assign the correct compliance framework based on country + industry
  await admin.rpc("assign_frameworks_for_org", { p_user_id: payload.userId });

  return { error: null };
}
