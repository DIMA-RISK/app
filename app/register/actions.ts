"use server";

import { createAdminClient } from "../../utils/supabase/admin";

interface RegisterPayload {
  email: string;
  password: string;
  org_name: string;
  p_number: string;
  industry: string;
  address: string;
  org_country: string;
  dba_name: string;
  org_ip: string;
}

export async function registerOrganization(payload: RegisterPayload) {
  const admin = createAdminClient();

  const { data: authData, error: signUpError } = await admin.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
  });

  if (signUpError) return { error: signUpError.message };

  const { error: insertError } = await admin.from("organizations").insert({
    user_id: authData.user.id,
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
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: insertError.message };
  }

  // Assign the correct compliance framework based on country + industry
  await admin.rpc("assign_frameworks_for_org", { p_user_id: authData.user.id });

  return { error: null };
}
