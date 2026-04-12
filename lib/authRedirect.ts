/**
 * Canonical browser origin for Supabase auth redirects (OAuth, email confirm, password reset).
 *
 * Client code prefers `NEXT_PUBLIC_SITE_URL` when set; otherwise `window.location.origin`.
 * Email verification links use whatever was sent as `emailRedirectTo` at signup time — on
 * Vercel that comes from the **built-in** `NEXT_PUBLIC_*` value, not from localhost unless misconfigured.
 *
 * Production checklist (fix “verify link opens localhost”):
 *
 * 1) Vercel → Project → Settings → Environment Variables → **Production**
 *    Set `NEXT_PUBLIC_SITE_URL` = `https://<your-live-host>` (no trailing slash).
 *    Redeploy after changing (Next embeds this at build time).
 *
 * 2) Supabase Dashboard → Authentication → **URL configuration**
 *    - **Site URL**: same origin as production (e.g. `https://<your-live-host>`).
 *    - **Redirect URLs**: add `https://<your-live-host>/auth/callback`,
 *      `https://<your-live-host>/onboarding`, and `https://<your-live-host>/dashboard`
 *      (and `http://localhost:3000/...` equivalents for local dev if you use them).
 *
 * 3) Re-test: sign up from the **production** URL so the confirmation email contains the production host.
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
