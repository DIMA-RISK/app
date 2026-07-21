"use server";

import nodemailer from "nodemailer";
import { createAdminClient } from "../../../utils/supabase/admin";
import { createClient } from "../../../utils/supabase/server";

// Resolve the acting user → the org owner's user_id + their role. Org owners are
// admins; invited members carry their invitation role.
async function resolveOrgAdmin(): Promise<{ ownerId: string; role: "admin" | "viewer" } | { error: string }> {
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

// Set/clear the asset owner (name + email) on a roadmap task (spec §4).
export async function updateTaskOwner(taskId: string, name: string, email: string): Promise<{ error?: string }> {
  const r = await resolveOrgAdmin();
  if ("error" in r) return r;
  if (r.role !== "admin") return { error: "Viewers cannot assign owners" };

  const admin = createAdminClient();
  const { error } = await admin.from("remediation_roadmap")
    .update({ assigned_to: name.trim() || null, asset_owner_email: email.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", taskId).eq("user_id", r.ownerId);
  if (error) return { error: error.message };
  return {};
}

// One-click escalation: email the asset owner about an outstanding task (spec §4).
// Uses the same SMTP transport as the beta-invite flow.
export async function escalateToOwner(taskId: string): Promise<{ error?: string }> {
  const r = await resolveOrgAdmin();
  if ("error" in r) return r;
  if (r.role !== "admin") return { error: "Viewers cannot escalate tasks" };
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return { error: "Email is not configured (SMTP_HOST/SMTP_USER missing)." };

  const admin = createAdminClient();
  const { data: task } = await admin.from("remediation_roadmap")
    .select("title, description, priority, due_date, assigned_to, asset_owner_email")
    .eq("id", taskId).eq("user_id", r.ownerId).maybeSingle();
  if (!task) return { error: "Task not found" };
  const to = (task as { asset_owner_email?: string | null }).asset_owner_email;
  if (!to) return { error: "No owner email set for this task — add one first." };

  const { data: org } = await admin.from("organizations").select("org_name").eq("user_id", r.ownerId).maybeSingle();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: Number(process.env.SMTP_PORT ?? 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
    await transporter.sendMail({
      from: `"DIMA Risk" <${process.env.SMTP_USER}>`,
      to,
      subject: `Action required: ${task.title} (${String(task.priority ?? "").toUpperCase()} priority)`,
      html: `<div style="font-family:Arial,sans-serif;color:#1a1526;max-width:560px">
        <h2 style="color:#754cbe">Remediation task escalated to you</h2>
        <p>${org?.org_name ?? "Your organization"} has flagged the following compliance remediation task as your responsibility:</p>
        <div style="border-left:3px solid #754cbe;padding:0.5rem 1rem;background:#f6f3fc">
          <p style="font-weight:600;margin:0 0 4px">${task.title}</p>
          ${task.description ? `<p style="margin:0 0 4px;color:#555">${task.description}</p>` : ""}
          <p style="margin:0;color:#777;font-size:13px">Priority: ${task.priority ?? "—"}${task.due_date ? ` · Due: ${task.due_date}` : ""}</p>
        </div>
        <p><a href="${appUrl}/dashboard/actions" style="color:#754cbe">Open the action plan →</a></p>
      </div>`,
    });
  } catch (e) {
    return { error: `Failed to send escalation: ${(e as Error).message}` };
  }

  await admin.from("remediation_roadmap").update({ updated_at: new Date().toISOString() }).eq("id", taskId).eq("user_id", r.ownerId);
  return {};
}

export async function updateTaskStatus(
  taskId: string,
  status: "open" | "in_progress" | "resolved",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Resolve the org owner's user_id (same logic as getOrgContext)
  const { data: org } = await admin
    .from("organizations")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let ownerId = user.id;

  if (!org) {
    const { data: invite } = await admin
      .from("org_invitations")
      .select("role, organizations!inner(user_id)")
      .eq("accepted_by", user.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (!invite) return { error: "Not authorized" };
    if (invite.role !== "admin") return { error: "Viewers cannot update task status" };
    ownerId = (invite.organizations as unknown as { user_id: string }).user_id;
  }

  const { data: task } = await admin
    .from("remediation_roadmap")
    .select("id, session_id, question_id, priority, status")
    .eq("id", taskId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (!task) return { error: "Task not found" };

  const { error } = await admin
    .from("remediation_roadmap")
    .update({ status })
    .eq("id", taskId)
    .eq("user_id", ownerId);

  if (error) return { error: error.message };

  // Keep the underlying questionnaire answer (and therefore the risk score) in
  // sync with task resolution — resolving a task means the gap is closed;
  // reopening it means the gap is back.
  if (task.question_id != null) {
    let newResponse: "yes" | "no" | "partial" | null = null;
    if (status === "resolved" && task.status !== "resolved") {
      newResponse = "yes";
    } else if (task.status === "resolved" && status !== "resolved") {
      newResponse = task.priority === "high" ? "partial" : "no";
    }

    if (newResponse) {
      await admin
        .from("questionnaire_responses")
        .update({ response: newResponse })
        .eq("session_id", task.session_id)
        .eq("question_id", task.question_id);

      await admin.rpc("calculate_risk_score", { p_session_id: task.session_id });
      await admin.rpc("calculate_financial_impact", { p_session_id: task.session_id });
    }
  }

  return {};
}
