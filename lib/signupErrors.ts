export const ACCOUNT_EXISTS =
  "An account with this email already exists. Please sign in instead.";

/** Rate limits are not "email taken" — show this on signUp instead of ACCOUNT_EXISTS. */
export const SIGNUP_RATE_LIMIT_MESSAGE =
  "Too many signup attempts for this email. Please wait a few minutes and try again.";

/**
 * GoTrue sometimes returns a duplicate-shaped response even when auth.users has no row
 * (e.g. after a delete + cooldown). Prefer retry instead of "already exists" when admin says free.
 */
export const SIGNUP_RETRY_AFTER_FALSE_DUPLICATE =
  "Signup did not complete. If you recently removed this account, wait a minute and try again.";

/** Map Supabase signUp errors to user-facing copy. */
export function mapSignupErrorForUser(error: {
  message?: string;
  code?: string;
}): string {
  const m = (error.message || "").toLowerCase();
  const c = error.code || "";

  if (
    m.includes("only request this after") ||
    m.includes("for security purposes") ||
    m.includes("too many requests") ||
    m.includes("rate limit") ||
    m.includes("email rate limit")
  ) {
    return SIGNUP_RATE_LIMIT_MESSAGE;
  }

  if (
    c === "user_already_exists" ||
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already exists") ||
    m.includes("email address is already")
  ) {
    return ACCOUNT_EXISTS;
  }

  return error.message || "Something went wrong. Please try again.";
}

export const RATE_LIMIT_FRIENDLY =
  "Too many emails were sent from this address. Please wait a few minutes and try again.";

/** Password reset / magic-link style errors (show friendly copy, not raw Supabase wording). */
export function mapPasswordResetErrorForUser(error: {
  message?: string;
  code?: string;
}): string {
  const m = (error.message || "").toLowerCase();
  if (
    m.includes("only request this after") ||
    m.includes("for security purposes") ||
    m.includes("too many requests") ||
    m.includes("rate limit") ||
    m.includes("email rate limit")
  ) {
    return RATE_LIMIT_FRIENDLY;
  }
  return error.message || "Something went wrong. Please try again.";
}
