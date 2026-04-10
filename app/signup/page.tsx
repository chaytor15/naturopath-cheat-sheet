"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getAuthCallbackUrl, getAuthRedirectOrigin } from "@/lib/authRedirect";
import { useRouter } from "next/navigation";

function duplicateSignupMessage(error: { message?: string; code?: string }): string | null {
  const m = (error.message || "").toLowerCase();
  const c = error.code || "";
  if (
    c === "user_already_exists" ||
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already exists") ||
    m.includes("email address is already")
  ) {
    return "An account with this email already exists. Please sign in instead.";
  }
  return null;
}

export default function SignupPage() {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(getAuthRedirectOrigin());
  }, []);

  const signUp = async () => {
    setBusy(true);
    setErrorBanner(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });

    setBusy(false);

    if (error) {
      const dup = duplicateSignupMessage(error);
      setErrorBanner(dup ?? error.message);
      return;
    }

    // Supabase often returns no user + no error when the email is already registered (anti-enumeration).
    if (!data.user) {
      setErrorBanner(
        "An account with this email already exists. Please sign in instead."
      );
      return;
    }

    setSent(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[#F7F8F3]">
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
        <h1 className="text-2xl font-semibold mb-1 text-slate-900">Create your tonic account</h1>
        <p className="text-[12px] text-slate-600 mb-4">
          Start with email. You’ll verify via a link.
        </p>

        {errorBanner && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900 space-y-3">
            <p>{errorBanner}</p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="w-full rounded-xl bg-[#2E332B] px-4 py-2.5 text-white text-[12px] font-semibold hover:bg-black transition"
            >
              Go to sign in
            </button>
          </div>
        )}

        {sent ? (
          <div className="space-y-3">
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
              onClick={() => router.replace("/login")}
              className="w-full rounded-xl bg-[#2E332B] px-4 py-3 text-white text-sm font-semibold hover:bg-black transition"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorBanner(null);
                }}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button
              type="button"
              onClick={signUp}
              disabled={!origin || busy || !email || !password}
              className="w-full rounded-xl bg-[#72B01D] px-4 py-3 text-white text-sm font-semibold hover:bg-[#6AA318] transition disabled:opacity-50"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              I already have an account
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
