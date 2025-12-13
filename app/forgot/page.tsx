"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendReset = async () => {
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[#F7F8F3]">
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
        <h1 className="text-2xl font-semibold mb-1 text-slate-900">
          Reset your password
        </h1>
        <p className="text-[12px] text-slate-600 mb-4">
          We’ll email you a secure reset link.
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {sent ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            ✅ If an account exists for <b>{email}</b>, you’ll receive a password
            reset email shortly.
          </div>
        ) : (
          <>
            <label className="block text-[11px] mb-1 text-slate-700 font-medium">
              Email address
            </label>
            <input
              type="email"
              className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm mb-4"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <button
              type="button"
              onClick={sendReset}
              disabled={busy || !email}
              className="w-full rounded-xl bg-[#72B01D] px-4 py-3 text-white text-sm font-semibold hover:bg-[#6AA318] transition disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}

        <a
          href="/login"
          className="mt-4 block text-center text-[12px] text-slate-600 hover:text-slate-900"
        >
          Back to sign in
        </a>
      </div>
    </main>
  );
}
