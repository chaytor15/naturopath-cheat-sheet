"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const signUp = async () => {
    setBusy(true);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // ✅ confirm email link will come back to callback, which we route to /login
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSent(true);
    setMessage(
      "✅ Account created. Please check your email and click the confirmation link, then return here to sign in."
    );
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[#F7F8F3]">
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
        <h1 className="text-2xl font-semibold mb-1 text-slate-900">Create your tonic account</h1>
        <p className="text-[12px] text-slate-600 mb-4">
          Start with email. You’ll verify via a link.
        </p>

        {message && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            {message}
          </div>
        )}

        {sent ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
              Check your inbox for <b>{email}</b> and click the verification link.
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
                onChange={(e) => setEmail(e.target.value)}
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
