/**
 * Interpret Supabase `auth.signUp` response for email/password signup.
 *
 * For duplicate / already-registered emails, GoTrue often returns either:
 * - `user: null` (no error), or
 * - `user` with `identities: []` (anti-enumeration / “fake” user shell)
 *
 * A real new email signup should include at least one identity (e.g. `email`).
 */
export function isEmailSignupDuplicateResponse(data: {
  user: { identities?: unknown[] | null } | null;
}): boolean {
  if (!data.user) return true;
  const identities = data.user.identities;
  if (Array.isArray(identities) && identities.length === 0) return true;
  return false;
}
