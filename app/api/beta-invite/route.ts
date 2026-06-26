import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Triggered by the invite_beta_user() Postgres function via pg_net.http_post()
// when an admin runs `SELECT invite_beta_user('person@company.com');` in the
// Supabase SQL editor. Not exposed to the browser — guarded by a shared secret.
export async function POST(request: Request) {
  const secret = request.headers.get("x-beta-invite-secret");
  if (!secret || secret !== process.env.BETA_INVITE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, code } = await request.json();
  if (!email || !code) {
    return NextResponse.json({ error: "Missing email or code" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const registerUrl = `${appUrl}/register?code=${encodeURIComponent(code)}`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"DIMA Risk" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "You're invited to the DIMA Risk beta",
    html: betaInviteEmailHtml(registerUrl, code),
  });

  return NextResponse.json({ ok: true });
}

function betaInviteEmailHtml(registerUrl: string, code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>You're invited to DIMA Risk</title></head>
<body style="margin:0; padding:0; background-color:#000212; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000212; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#181430; border:1px solid rgba(117,76,190,0.35); border-radius:16px;">
          <tr>
            <td align="center" style="padding:36px 32px 0 32px;">
              <span style="display:inline-block; padding:6px 14px; border-radius:8px; background-color:rgba(117,76,190,0.15); color:#c4a8f0; font-size:13px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                DIMA&nbsp;RISK
              </span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px 0 32px;">
              <h1 style="margin:0; color:#ddd7ea; font-size:22px; font-weight:700; line-height:1.3;">
                You're invited to the beta
              </h1>
              <p style="margin:12px 0 0 0; color:rgba(221,215,234,0.65); font-size:14px; line-height:1.6;">
                You've been personally invited to join the DIMA Risk private beta. Click below to register — your invite code is already filled in.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 32px 0 32px;">
              <a href="${registerUrl}"
                 style="display:inline-block; background-color:#754cbe; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; padding:13px 32px; border-radius:8px;">
                Register Here
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid rgba(221,215,234,0.12);"></td></tr></table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 32px 0 32px;">
              <p style="margin:0 0 12px 0; color:rgba(221,215,234,0.55); font-size:13px;">
                Or enter this invite code manually on the registration page:
              </p>
              <div style="display:inline-block; background-color:rgba(117,76,190,0.1); border:1px solid rgba(117,76,190,0.35); border-radius:10px; padding:14px 28px;">
                <span style="color:#c4a8f0; font-size:24px; font-weight:700; letter-spacing:0.2em; font-family:'Courier New', Courier, monospace;">
                  ${code}
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid rgba(221,215,234,0.12);"></td></tr></table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 32px 36px 32px;">
              <p style="margin:0; color:rgba(221,215,234,0.4); font-size:12px; line-height:1.6;">
                This code is single-use and tied to this email address. If you weren't expecting this, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0 0; color:rgba(221,215,234,0.3); font-size:11px;">
          DIMA Risk &middot; Compliance &amp; Risk Intelligence
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
