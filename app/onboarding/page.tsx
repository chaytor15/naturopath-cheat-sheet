"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { uploadProfilePictureFile } from "@/lib/uploadProfilePictureFile";
import {
  fetchClinicPracticeForOnboarding,
  fetchProfileForOnboardingForm,
  formatSupabaseError,
  isOnboardingComplete,
} from "@/lib/onboardingComplete";
import AppHeader from "@/components/AppHeader";
import MainContent from "@/components/MainContent";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-sky-50/80 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400";
const labelClass = "block text-[11px] mb-1 text-slate-700 font-medium";

function formatLoadError(e: unknown): string {
  const raw = formatSupabaseError(e);
  if (/column|does not exist|42703/i.test(raw)) {
    return `${raw} — Optional: run migrations/add_onboarding_and_practice_address.sql (Supabase → SQL) or npm run db:migrate:onboarding to add missing columns; the app will still run without them where possible.`;
  }
  if (/permission denied|42501|row-level security/i.test(raw)) {
    return `${raw} — check profiles RLS policies or run fix_profiles_rls_self_access.sql.`;
  }
  return raw;
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [practiceStreet, setPracticeStreet] = useState("");
  const [practiceCity, setPracticeCity] = useState("");
  const [practiceRegion, setPracticeRegion] = useState("");
  const [practicePostcode, setPracticePostcode] = useState("");
  const [practiceCountry, setPracticeCountry] = useState("");
  const [clinicTimezone, setClinicTimezone] = useState("Australia/Sydney");
  const [hasOnboardingCompletedAtColumn, setHasOnboardingCompletedAtColumn] =
    useState(true);
  const [hasClinicPracticeColumns, setHasClinicPracticeColumns] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        const userId = session.user.id;

        const {
          profile,
          hasOnboardingCompletedAtColumn: hasOCol,
          error: pFormErr,
        } = await fetchProfileForOnboardingForm(supabase, userId);
        if (pFormErr) throw pFormErr;
        setHasOnboardingCompletedAtColumn(hasOCol);

        // Already completed, or legacy profile (name + practice filled before onboarding existed).
        if (isOnboardingComplete(profile)) {
          if (hasOCol && profile && !profile.onboarding_completed_at) {
            await supabase
              .from("profiles")
              .update({ onboarding_completed_at: new Date().toISOString() })
              .eq("id", userId);
          }
          router.replace("/dashboard");
          return;
        }

        setFullName(profile?.full_name ?? "");
        setCompanyName(profile?.company_name ?? "");
        setPhone(profile?.phone ?? "");
        setProfilePicture(profile?.profile_picture ?? null);

        const { clinic, error: cErr } = await fetchClinicPracticeForOnboarding(
          supabase,
          userId
        );
        if (cErr) throw cErr;
        setHasClinicPracticeColumns(clinic.hasPracticeAddressColumns);
        setClinicTimezone(clinic.timezone);
        setPracticeStreet(clinic.practice_street);
        setPracticeCity(clinic.practice_city);
        setPracticeRegion(clinic.practice_region);
        setPracticePostcode(clinic.practice_postcode);
        setPracticeCountry(clinic.practice_country);
      } catch (e: unknown) {
        setError(formatLoadError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not signed in");

      const url = await uploadProfilePictureFile(supabase, session.user.id, file);
      setProfilePicture(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingImage(false);
      try {
        event.target.value = "";
      } catch {
        /* ignore */
      }
    }
  };

  const handleRemoveImage = () => {
    setProfilePicture(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not signed in");

      const userId = session.user.id;
      const email = session.user.email ?? "";

      const profilePayload: Record<string, unknown> = {
        full_name: fullName.trim() || null,
        company_name: companyName.trim() || null,
        phone: phone.trim() || null,
        profile_picture: profilePicture?.trim() || null,
        email: email || null,
      };
      if (hasOnboardingCompletedAtColumn) {
        profilePayload.onboarding_completed_at = new Date().toISOString();
      }

      // Upsert avoids “insert duplicate key” when a profile row exists but a prior SELECT
      // returned no row (RLS timing) or the row was created by a DB trigger.
      const { error: pErr } = await supabase.from("profiles").upsert(
        {
          id: userId,
          plan: "free",
          ...profilePayload,
        },
        { onConflict: "id" }
      );
      if (pErr) throw pErr;

      const clinicPatch = {
        practice_street: practiceStreet.trim() || null,
        practice_city: practiceCity.trim() || null,
        practice_region: practiceRegion.trim() || null,
        practice_postcode: practicePostcode.trim() || null,
        practice_country: practiceCountry.trim() || null,
      };

      const clinicBody: Record<string, unknown> = {
        user_id: userId,
        timezone: clinicTimezone || "Australia/Sydney",
      };
      if (hasClinicPracticeColumns) {
        Object.assign(clinicBody, clinicPatch);
      }

      const { error: cErr } = await supabase
        .from("clinic_settings")
        .upsert(clinicBody, { onConflict: "user_id" });
      if (cErr) throw cErr;

      router.replace("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(formatLoadError(err));
    } finally {
      setSaving(false);
    }
  };

  const displayInitial =
    (companyName.trim() || fullName.trim() || "U").charAt(0).toUpperCase();

  return (
    <>
      <AppHeader />
      <MainContent>
        <div className="max-w-lg mx-auto py-10 px-4">
          <h1 className="text-2xl font-semibold text-[#4B543B] mb-1">
            Welcome to tonic.
          </h1>
          <p className="text-[13px] text-slate-600 mb-6">
            Set up your practice details. You can change these anytime in Profile
            and My Clinic.
          </p>

          {verified && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Email verified. Complete the form below to continue.
            </div>
          )}

          {!loading &&
            (!hasOnboardingCompletedAtColumn || !hasClinicPracticeColumns) && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 leading-relaxed">
                Some optional columns are not in your Supabase database yet. You can
                still continue; when convenient, run{" "}
                <code className="rounded bg-white/70 px-1 py-0.5 text-[10px]">
                  npm run db:migrate:onboarding
                </code>{" "}
                or paste{" "}
                <code className="rounded bg-white/70 px-1 py-0.5 text-[10px]">
                  migrations/add_onboarding_and_practice_address.sql
                </code>{" "}
                in the Supabase SQL editor so completion and practice address fields
                persist in the database.
              </div>
            )}

          {loading ? (
            <p className="text-sm text-slate-600">Loading…</p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-2xl border border-white/60 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5"
            >
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                  {error}
                </div>
              )}

              <div>
                <label className={labelClass} htmlFor="ob-name">
                  Your name
                </label>
                <input
                  id="ob-name"
                  className={inputClass}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="ob-company">
                  Practice / company name
                </label>
                <input
                  id="ob-company"
                  className={inputClass}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  autoComplete="organization"
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="ob-phone">
                  Phone
                </label>
                <input
                  id="ob-phone"
                  type="tel"
                  className={inputClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>

              <div>
                <p className={labelClass}>Practice logo (optional)</p>
                <div className="flex items-start gap-4">
                  {profilePicture ? (
                    <div className="relative shrink-0">
                      <img
                        src={profilePicture}
                        alt=""
                        className="h-20 w-20 rounded-full object-cover border-2 border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        disabled={uploadingImage || saving}
                        className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-[#2E332B] flex items-center justify-center text-white text-2xl font-semibold shrink-0">
                      {displayInitial}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <input
                      ref={fileInputRef}
                      id="ob-logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploadingImage || saving}
                    />
                    <label
                      htmlFor="ob-logo-upload"
                      className="inline-block px-4 py-2 text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer disabled:opacity-50"
                    >
                      {uploadingImage ? "Uploading…" : profilePicture ? "Change picture" : "Upload picture"}
                    </label>
                    <p className="mt-1 text-[11px] text-slate-500">
                      JPG, PNG or GIF. Max 5MB — same storage as Profile.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide mb-3">
                  Practice address (optional)
                </p>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass} htmlFor="ob-street">
                      Street
                    </label>
                    <input
                      id="ob-street"
                      className={inputClass}
                      value={practiceStreet}
                      onChange={(e) => setPracticeStreet(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass} htmlFor="ob-city">
                        City
                      </label>
                      <input
                        id="ob-city"
                        className={inputClass}
                        value={practiceCity}
                        onChange={(e) => setPracticeCity(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="ob-region">
                        State / region
                      </label>
                      <input
                        id="ob-region"
                        className={inputClass}
                        value={practiceRegion}
                        onChange={(e) => setPracticeRegion(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass} htmlFor="ob-post">
                        Postcode
                      </label>
                      <input
                        id="ob-post"
                        className={inputClass}
                        value={practicePostcode}
                        onChange={(e) => setPracticePostcode(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="ob-country">
                        Country
                      </label>
                      <input
                        id="ob-country"
                        className={inputClass}
                        value={practiceCountry}
                        onChange={(e) => setPracticeCountry(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || uploadingImage}
                className={cn(
                  "w-full rounded-xl bg-[#72B01D] px-4 py-3 text-white text-sm font-semibold hover:bg-[#6AA318] transition",
                  (saving || uploadingImage) && "opacity-50"
                )}
              >
                {saving ? "Saving…" : "Continue to dashboard"}
              </button>
            </form>
          )}
        </div>
      </MainContent>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F7F8F3] text-sm text-slate-600">
          Loading…
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
