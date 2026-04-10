/**
 * Canonical browser origin for Supabase auth redirects (OAuth, email confirm, password reset).
 *
 * On Vercel, set NEXT_PUBLIC_SITE_URL to your live URL (e.g. https://your-app.vercel.app).
 * Supabase → Authentication → URL configuration: Site URL + Redirect URLs must include that origin and /auth/callback.
 */
export function getAuthRedirectOrigin(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv.replace(/\/$/, "");
  }
  return window.location.origin;
}

export function getAuthCallbackUrl(): string {
  return `${getAuthRedirectOrigin()}/auth/callback`;
}
