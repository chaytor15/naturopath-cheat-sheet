import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  fetchProfileOnboardingGateRow,
  isOnboardingComplete,
} from "@/lib/onboardingComplete";

const MARKETING_EXACT = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot",
  "/pricing",
  "/landingpage",
]);

function isAuthPath(pathname: string) {
  return pathname.startsWith("/auth/");
}

function isBookPath(pathname: string) {
  return pathname === "/book" || pathname.startsWith("/book/");
}

function isMarketingPublic(pathname: string) {
  return MARKETING_EXACT.has(pathname);
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const needsAuth =
    !isMarketingPublic(pathname) &&
    !isAuthPath(pathname) &&
    !isBookPath(pathname);

  const redirectTo = (path: string) => {
    const url = new URL(path, request.url);
    const res = NextResponse.redirect(url);
    copyCookies(supabaseResponse, res);
    return res;
  };

  if (user && pathname === "/") {
    return redirectTo("/dashboard");
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return redirectTo("/dashboard");
  }

  if (!user && needsAuth) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    const res = NextResponse.redirect(login);
    copyCookies(supabaseResponse, res);
    return res;
  }

  if (user && needsAuth) {
    const { row: prof } = await fetchProfileOnboardingGateRow(supabase, user.id);
    const done = isOnboardingComplete(prof);

    if (pathname === "/onboarding") {
      if (done) {
        return redirectTo("/dashboard");
      }
    } else if (!done) {
      return redirectTo("/onboarding");
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
