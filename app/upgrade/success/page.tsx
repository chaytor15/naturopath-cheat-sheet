"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function UpgradeSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "paid" | "notyet">("checking");

  // Webhook can take a moment; we poll the DB plan a few times
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        if (!cancelled) setStatus("notyet");
        return;
      }

      for (let i = 0; i < 8; i++) {
        const { data, error } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .maybeSingle();

        if (!error && data?.plan === "paid") {
          if (!cancelled) {
            setStatus("paid");
            router.push("/app"); // ✅ always go to your workspace route
          }
          return;
        }

        await new Promise((r) => setTimeout(r, 600));
      }

      if (!cancelled) setStatus("notyet");
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-[#F7F8F3] text-slate-900 flex items-center justify-center">
      <div className="w-full max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#72B01D]">
            Payment successful
          </p>

          <h1 className="mt-2 text-2xl font-semibold text-[#2E332B]">
            You&apos;re on Pro 🎉
          </h1>

          {status === "checking" && (
            <p className="mt-3 text-sm text-slate-700">
              Finishing activation… one sec.
            </p>
          )}

          {status === "notyet" && (
            <>
              <p className="mt-3 text-sm text-slate-700">
                We haven’t seen your Pro status yet (webhook delay). Click below to go back to workspace anyway.
              </p>
              <button
                type="button"
                onClick={() => router.push("/app")}
                className="mt-5 w-full px-4 py-3 rounded-xl bg-[#72B01D] hover:bg-[#6AA318] text-white font-semibold border border-[#72B01D]"
              >
                Continue to workspace
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
