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

    const { error } = await supabase.auth.signOut();
    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) localStorage.removeItem(k);
      }
      for (const k of Object.keys(sessionStorage)) {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) sessionStorage.removeItem(k);
      }
    } catch {}

    router.replace("/login");
    router.refresh();
  };

  if (hasSession === null) return null;

  // ✅ Match your Create button styling
  const greenPill =
    "pointer-events-auto inline-flex items-center gap-2 px-3 py-2 text-[11px] font-semibold rounded-lg border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white tracking-[0.08em] uppercase";

  if (!hasSession) {
    return (
      <a href="/login" className={greenPill}>
        Sign in
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className={`${greenPill} ${busy ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
