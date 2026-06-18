import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register"];

export async function middleware(request: NextRequest) {
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
  const { pathname } = request.nextUrl;
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
        .single();

      const completed = org?.onboarding_completed ?? false;

      // Logged in + public route → smart redirect
      if (isPublic) {
        return NextResponse.redirect(new URL(completed ? "/dashboard" : "/welcome", request.url));
      }

      // Already completed → don't let them revisit welcome/onboarding
      if (completed && (pathname.startsWith("/welcome") || pathname.startsWith("/onboarding"))) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      // Incomplete onboarding → cannot access dashboard
      if (!completed && pathname.startsWith("/dashboard")) {
        return NextResponse.redirect(new URL("/welcome", request.url));
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
