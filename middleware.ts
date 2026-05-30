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

  // Logged in + hitting a public route → smart redirect based on onboarding
  if (user && isPublic) {
    const { data: org } = await supabase
      .from("organizations")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .single();

    const destination = org?.onboarding_completed ? "/dashboard" : "/welcome";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Logged in + hitting /welcome or /onboarding but already completed onboarding → dashboard
  // /scanning is exempt — user lands there right after onboarding completes, before the scan finishes
  if (user && (pathname.startsWith("/welcome") || pathname.startsWith("/onboarding"))) {
    const { data: org } = await supabase
      .from("organizations")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .single();

    if (org?.onboarding_completed) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
