"use server";

import { createAdminClient } from "../../../utils/supabase/admin";
import { createClient } from "../../../utils/supabase/server";

async function getAuthedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function markAlertRead(alertId: string): Promise<{ error?: string }> {
  const userId = await getAuthedUserId();
  if (!userId) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("alert_states")
    .upsert({ user_id: userId, alert_id: alertId, read_at: new Date().toISOString() }, { onConflict: "user_id,alert_id" });

  if (error) return { error: error.message };
  return {};
}

export async function markAllAlertsRead(alertIds: string[]): Promise<{ error?: string }> {
  const userId = await getAuthedUserId();
  if (!userId) return { error: "Not authenticated" };
  if (alertIds.length === 0) return {};

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const rows = alertIds.map((alertId) => ({ user_id: userId, alert_id: alertId, read_at: now }));

  const { error } = await admin.from("alert_states").upsert(rows, { onConflict: "user_id,alert_id" });

  if (error) return { error: error.message };
  return {};
}

export async function dismissAlert(alertId: string): Promise<{ error?: string }> {
  const userId = await getAuthedUserId();
  if (!userId) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("alert_states")
    .upsert({ user_id: userId, alert_id: alertId, dismissed_at: new Date().toISOString() }, { onConflict: "user_id,alert_id" });

  if (error) return { error: error.message };
  return {};
}
