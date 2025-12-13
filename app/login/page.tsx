"use client";

import { useEffect, useMemo, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [origin, setOrigin] = useState("");

  const verified = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("verified") === "1";
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // If already signed in (or once sign-in completes), route to /app
  useEffect(() => {
    if (!origin) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/app");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/app");
    });

    return () => sub.subscription.unsubscribe();
  }, [origin, router]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[#F7F8F3]">
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
        <h1 className="text-2xl font-semibold mb-1 text-slate-900">
          Sign in to tonic
        </h1>
        <p className="text-[12px] text-slate-600 mb-4">
          Sign in with Google or email.
        </p>

        {verified && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            ✅ Email verified. You can sign in now.
          </div>
        )}

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
          <div className="[&_*]:!font-sans">
            <Auth
              supabaseClient={supabase}
              providers={[]} // no Google here (custom button above)
              redirectTo={`${origin}/auth/callback`}
              view="sign_in"
              showLinks={false} // ✅ we place reset link ourselves
              appearance={{
                theme: ThemeSupa,
                style: {
                  button: {
                    borderRadius: "12px",
                    height: "44px",
                    fontWeight: "600",
                  },
                  input: {
                    borderRadius: "12px",
                    height: "44px",
                  },
                  label: {
                    fontSize: "12px",
                    color: "#334155",
                  },
                  anchor: {
                    color: "#334155",
                  },
                },
              }}
            />
          </div>
        ) : (
          <div className="text-sm text-slate-600">Loading…</div>
        )}

        {/* Create account button (only) */}
        <a
          href="/signup"
          className="mt-4 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Create an account
        </a>

        {/* Reset password link under Create account */}
        <a
          href="/forgot"
          className="mt-2 block text-center text-[12px] text-slate-600 hover:text-slate-900"
        >
          Forgot your password?
        </a>
      </div>
    </main>
  );
}
