"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthButton() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
    };

    sync();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      sync();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setBusy(true);

    // 1) sign out from supabase (local session)
    const { error } = await supabase.auth.signOut();
    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    // 2) remove any leftover supabase auth tokens in storage
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
          localStorage.removeItem(k);
        }
      }
      for (const k of Object.keys(sessionStorage)) {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {}

    // 3) hard refresh routing state
    router.replace("/login");
    router.refresh();
  };

  if (hasSession === null) return null;

  const pill =
    "pointer-events-auto inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-300 bg-white/70 hover:bg-white text-[11px] text-slate-700 tracking-[0.08em] uppercase";

  if (!hasSession) {
    return (
      <a href="/login" className={pill}>
        Sign in
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className={`${pill} ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
