import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password"];

// Server-to-server webhooks (e.g. pg_net calling /api/beta-invite) carry no
// session cookie and authenticate via their own shared secret instead — let
// them through before any cookie-based auth/redirect logic runs.
const WEBHOOK_ROUTES = ["/api/beta-invite"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (WEBHOOK_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // Not logged in → login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // For any route where onboarding state matters, do a single DB lookup
  // /scanning is always exempt — user lands there right after submit, before the flag flips
  if (user) {
    const needsOrgCheck =
      isPublic ||
      pathname.startsWith("/welcome") ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/dashboard");

    if (needsOrgCheck) {
      const { data: org } = await supabase
        .from("organizations")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (org) {
        // ── Org owner path ──────────────────────────────────────────────
        const completed = org.onboarding_completed ?? false;

        if (isPublic) {
          return NextResponse.redirect(new URL(completed ? "/dashboard" : "/welcome", request.url));
        }
        if (completed && (pathname.startsWith("/welcome") || pathname.startsWith("/onboarding"))) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        if (!completed && pathname.startsWith("/dashboard")) {
          return NextResponse.redirect(new URL("/welcome", request.url));
        }
      } else {
        // ── Invited-member path ─────────────────────────────────────────
        // Use service role to look up (and possibly auto-accept) the invite
        const admin = createAdminSupabase(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );

        const { data: invite } = await admin
          .from("org_invitations")
          .select("id, status")
          .eq("invited_email", user.email ?? "")
          .in("status", ["pending", "accepted"])
          .limit(1)
          .maybeSingle();

        if (invite) {
          // Auto-accept pending invite on first login
          if (invite.status === "pending") {
            await admin
              .from("org_invitations")
              .update({ status: "accepted", accepted_by: user.id, accepted_at: new Date().toISOString() })
              .eq("id", invite.id);
          }
          // Member: treat like a completed onboarding owner
          if (isPublic || pathname.startsWith("/welcome") || pathname.startsWith("/onboarding")) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
          }
          // Allow dashboard access — fall through to supabaseResponse
        } else {
          // No org, no invite — redirect away from protected routes
          if (!isPublic) {
            return NextResponse.redirect(new URL("/login", request.url));
          }
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
