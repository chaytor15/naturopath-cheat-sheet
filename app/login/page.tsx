"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAuthCallbackUrl, getAuthRedirectOrigin } from "@/lib/authRedirect";
import { ACCOUNT_EXISTS, mapSignupErrorForUser } from "@/lib/signupErrors";
import AppHeader from "@/components/AppHeader";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-sky-50/80 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400";
const labelClass = "block text-[11px] mb-1 text-slate-700 font-medium";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [origin, setOrigin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSent, setSignupSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const verified = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("verified") === "1";
  }, []);

  useEffect(() => {
    setOrigin(getAuthRedirectOrigin());
  }, []);

  useEffect(() => {
    setMode(searchParams.get("mode") === "signup" ? "signup" : "signin");
  }, [searchParams]);

  useEffect(() => {
    if (!origin) return;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        console.error("Session error:", sessionError);
        if (sessionError.message.includes("fetch")) {
          setError(
            "Unable to connect to Supabase. Please check your internet connection and ensure your Supabase project is active."
          );
        }
        return;
      }
      if (data.session) router.replace("/app");
    }).catch((err) => {
      console.error("Failed to get session:", err);
      if (err.message?.includes("fetch") || err.message?.includes("Failed to fetch")) {
        setError(
          "Network error: Unable to connect to Supabase. Please ensure your Supabase project is active and try again."
        );
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/app");
    });

    return () => sub.subscription.unsubscribe();
  }, [origin, router]);

  const goSignInMode = () => {
    setSignupSent(false);
    setSignupError(null);
    setError(null);
    setConfirmPassword("");
    router.replace("/login");
    setMode("signin");
  };

  const goSignUpMode = () => {
    setError(null);
    setSignupError(null);
    setSignupSent(false);
    router.replace("/login?mode=signup");
    setMode("signup");
  };

  const signInWithGoogle = async () => {
    try {
      setError(null);
      setSignupError(null);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthCallbackUrl(),
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthError) {
        console.error("OAuth error:", oauthError);
        setError(oauthError.message || "Failed to sign in with Google");
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      console.error("Sign in error:", err);
      if (m.includes("fetch") || m.includes("Failed to fetch")) {
        setError(
          "Network error: Unable to connect to Supabase. Please ensure your Supabase project is active and try again."
        );
      } else {
        setError(m || "An error occurred during sign in");
      }
    }
  };

  const signInWithEmail = async () => {
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
    }
  };

  const signUpWithEmail = async () => {
    setSignupError(null);
    if (password !== confirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setSignupError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });
    setBusy(false);

    if (signUpErr) {
      setSignupError(mapSignupErrorForUser(signUpErr));
      return;
    }

    if (!data.user) {
      setSignupError(ACCOUNT_EXISTS);
      return;
    }

    setSignupSent(true);
  };

  const isSignup = mode === "signup";

  return (
    <>
      <AppHeader />
      <main className="min-h-screen pt-[60px] flex items-center justify-center p-8 bg-[#F7F8F3]">
        <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
          <h1 className="text-2xl font-semibold mb-1 text-slate-900">
            {isSignup ? "Create an account" : "Sign in to tonic"}
          </h1>
          <p className="text-[12px] text-slate-600 mb-4">
            {isSignup
              ? "Create with Google or email. You’ll verify via a link."
              : "Sign in with Google or email."}
          </p>

          {verified && !isSignup && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              ✅ Email verified. You can sign in now.
            </div>
          )}

          {error && !isSignup && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              ⚠️ {error}
            </div>
          )}

          {signupError && isSignup && !signupSent && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900 space-y-3">
              <p>{signupError}</p>
              <button
                type="button"
                onClick={goSignInMode}
                className="w-full rounded-xl bg-[#2E332B] px-4 py-2.5 text-white text-[12px] font-semibold hover:bg-black transition"
              >
                Go to sign in
              </button>
            </div>
          )}

          {isSignup && signupSent ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full rounded-xl bg-[#2E332B] px-4 py-3 text-white text-sm font-semibold hover:bg-black transition"
              >
                Continue with Google
              </button>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  or
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <p className="mb-2">
                  ✅ Account created. Please check your email and click the confirmation link, then return here to sign in.
                </p>
                <p>
                  Check your inbox for <b>{email}</b> and click the verification link.
                </p>
              </div>
              <button
                type="button"
                onClick={goSignInMode}
                className="w-full rounded-xl bg-[#2E332B] px-4 py-3 text-white text-sm font-semibold hover:bg-black transition"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full rounded-xl bg-[#2E332B] px-4 py-3 text-white text-sm font-semibold hover:bg-black transition"
              >
                Continue with Google
              </button>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  or
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {origin ? (
                <div className="space-y-3">
                  <div>
                    <label className={labelClass} htmlFor="auth-email">
                      Email address
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      className={inputClass}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                        setSignupError(null);
                      }}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="auth-password">
                      {isSignup ? "Password" : "Your Password"}
                    </label>
                    <input
                      id="auth-password"
                      type="password"
                      className={inputClass}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                        setSignupError(null);
                      }}
                      autoComplete={isSignup ? "new-password" : "current-password"}
                    />
                  </div>
                  {isSignup && (
                    <div>
                      <label className={labelClass} htmlFor="auth-confirm">
                        Confirm password
                      </label>
                      <input
                        id="auth-confirm"
                        type="password"
                        className={inputClass}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setSignupError(null);
                        }}
                        autoComplete="new-password"
                      />
                    </div>
                  )}

                  {isSignup ? (
                    <>
                      <button
                        type="button"
                        onClick={signUpWithEmail}
                        disabled={
                          busy ||
                          !email.trim() ||
                          !password ||
                          !confirmPassword ||
                          !origin
                        }
                        className="w-full rounded-xl bg-[#72B01D] px-4 py-3 text-white text-sm font-semibold hover:bg-[#6AA318] transition disabled:opacity-50"
                      >
                        {busy ? "Creating account…" : "Create account"}
                      </button>
                      <button
                        type="button"
                        onClick={goSignInMode}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        I already have an account
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={signInWithEmail}
                        disabled={busy || !email.trim() || !password || !origin}
                        className="w-full rounded-xl bg-[#72B01D] px-4 py-3 text-white text-sm font-semibold hover:bg-[#6AA318] transition disabled:opacity-50"
                      >
                        {busy ? "Signing in…" : "Sign in"}
                      </button>
                      <button
                        type="button"
                        onClick={goSignUpMode}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Create an account
                      </button>
                      <a
                        href="/forgot"
                        className="block text-center text-[12px] text-slate-600 hover:text-slate-900 mt-2"
                      >
                        Forgot your password?
                      </a>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-600">Loading…</div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader />
          <main className="min-h-screen pt-[60px] flex items-center justify-center p-8 bg-[#F7F8F3]">
            <div className="text-sm text-slate-600">Loading…</div>
          </main>
        </>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
