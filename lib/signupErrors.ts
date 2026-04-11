const ACCOUNT_EXISTS =
  "An account with this email already exists. Please sign in instead.";

/** Map Supabase signUp errors to user-facing copy (avoid rate-limit / security wording). */
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
    return ACCOUNT_EXISTS;
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

export { ACCOUNT_EXISTS };
