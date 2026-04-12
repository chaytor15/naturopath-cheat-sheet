import type { SupabaseClient } from "@supabase/supabase-js";

/** Postgres / PostgREST “column does not exist” (migration not applied yet). */
export function isUndefinedColumnError(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const o = err as Record<string, unknown>;
  const code = String(o.code ?? "");
  const message = String(o.message ?? "");
  const details = String(o.details ?? "");
  const blob = `${code} ${message} ${details}`;
  if (code === "42703" || /\b42703\b/.test(blob)) return true;
  if (/column\s+[\w.]+\s+does\s+not\s+exist/i.test(message)) return true;
  if (/could not find/i.test(message) && /column/i.test(message)) return true;
  return false;
}

/**
 * Load profile fields for onboarding routing. If `onboarding_completed_at` is missing
 * in the DB, falls back to a select without it (legacy schema).
 */
export async function fetchProfileOnboardingGateRow(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  row: {
    onboarding_completed_at?: string | null;
    full_name?: string | null;
    company_name?: string | null;
  } | null;
  error: unknown | null;
}> {
  const full = await supabase
    .from("profiles")
    .select("onboarding_completed_at, full_name, company_name")
    .eq("id", userId)
    .maybeSingle();

  if (!full.error) {
    return { row: full.data, error: null };
  }

  if (!isUndefinedColumnError(full.error)) {
    return { row: null, error: full.error };
  }

  const partial = await supabase
    .from("profiles")
    .select("full_name, company_name")
    .eq("id", userId)
    .maybeSingle();

  if (partial.error) {
    return { row: null, error: partial.error };
  }

  return {
    row: partial.data
      ? {
          ...partial.data,
          onboarding_completed_at: null,
        }
      : null,
    error: null,
  };
}

export type OnboardingProfileForm = {
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  profile_picture: string | null;
  onboarding_completed_at: string | null;
};

/** Full profile row for /onboarding form; retries without `onboarding_completed_at` if column missing. */
export async function fetchProfileForOnboardingForm(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  profile: OnboardingProfileForm | null;
  hasOnboardingCompletedAtColumn: boolean;
  error: unknown | null;
}> {
  const full = await supabase
    .from("profiles")
    .select(
      "full_name, company_name, phone, profile_picture, onboarding_completed_at"
    )
    .eq("id", userId)
    .maybeSingle();

  if (!full.error) {
    return {
      profile: full.data as OnboardingProfileForm | null,
      hasOnboardingCompletedAtColumn: true,
      error: null,
    };
  }

  if (!isUndefinedColumnError(full.error)) {
    return {
      profile: null,
      hasOnboardingCompletedAtColumn: true,
      error: full.error,
    };
  }

  const partial = await supabase
    .from("profiles")
    .select("full_name, company_name, phone, profile_picture")
    .eq("id", userId)
    .maybeSingle();

  if (partial.error) {
    return {
      profile: null,
      hasOnboardingCompletedAtColumn: false,
      error: partial.error,
    };
  }

  const row = partial.data;
  return {
    profile: row
      ? {
          full_name: row.full_name ?? null,
          company_name: row.company_name ?? null,
          phone: row.phone ?? null,
          profile_picture: row.profile_picture ?? null,
          onboarding_completed_at: null,
        }
      : null,
    hasOnboardingCompletedAtColumn: false,
    error: null,
  };
}

export type ClinicPracticeForm = {
  timezone: string;
  practice_street: string;
  practice_city: string;
  practice_region: string;
  practice_postcode: string;
  practice_country: string;
  hasPracticeAddressColumns: boolean;
};

const emptyClinic = (): ClinicPracticeForm => ({
  timezone: "Australia/Sydney",
  practice_street: "",
  practice_city: "",
  practice_region: "",
  practice_postcode: "",
  practice_country: "",
  hasPracticeAddressColumns: true,
});

/** Clinic row for onboarding; retries with only `timezone` if practice_* columns missing. */
export async function fetchClinicPracticeForOnboarding(
  supabase: SupabaseClient,
  userId: string
): Promise<{ clinic: ClinicPracticeForm; error: unknown | null }> {
  const full = await supabase
    .from("clinic_settings")
    .select(
      "timezone, practice_street, practice_city, practice_region, practice_postcode, practice_country"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!full.error && full.data) {
    const d = full.data;
    return {
      clinic: {
        timezone: d.timezone || "Australia/Sydney",
        practice_street: d.practice_street ?? "",
        practice_city: d.practice_city ?? "",
        practice_region: d.practice_region ?? "",
        practice_postcode: d.practice_postcode ?? "",
        practice_country: d.practice_country ?? "",
        hasPracticeAddressColumns: true,
      },
      error: null,
    };
  }

  if (full.error && !isUndefinedColumnError(full.error)) {
    return { clinic: emptyClinic(), error: full.error };
  }

  if (!full.error && !full.data) {
    return { clinic: emptyClinic(), error: null };
  }

  // Undefined column on practice_* — fall back to timezone only.
  const tzOnly = await supabase
    .from("clinic_settings")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();

  if (tzOnly.error) {
    return { clinic: emptyClinic(), error: tzOnly.error };
  }

  return {
    clinic: {
      timezone: tzOnly.data?.timezone || "Australia/Sydney",
      practice_street: "",
      practice_city: "",
      practice_region: "",
      practice_postcode: "",
      practice_country: "",
      hasPracticeAddressColumns: false,
    },
    error: null,
  };
}

/**
 * Whether the user should skip first-time onboarding.
 * - Explicit completion timestamp, or
 * - Legacy: already filled practice + name on profile (pre-onboarding feature).
 */
export function isOnboardingComplete(
  p:
    | {
        onboarding_completed_at?: string | null;
        full_name?: string | null;
        company_name?: string | null;
      }
    | null
    | undefined
): boolean {
  if (!p) return false;
  if (p.onboarding_completed_at) return true;
  return Boolean(p.full_name?.trim() && p.company_name?.trim());
}

/** Supabase Postgrest / Auth errors are often plain objects, not Error. */
export function formatSupabaseError(err: unknown): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;

  const o = err as Record<string, unknown>;
  const parts = [
    typeof o.message === "string" ? o.message : null,
    typeof o.details === "string" ? o.details : null,
    typeof o.hint === "string" ? o.hint : null,
    typeof o.code === "string" ? o.code : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" — ") : JSON.stringify(err);
}
