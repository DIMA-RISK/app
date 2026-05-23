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
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: insertError.message };
  }

  return { error: null };
}
