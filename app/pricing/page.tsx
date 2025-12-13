"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const PLAN_KEY = "tonic_plan"; // local dev plan flag: "free" | "paid"
const PENDING_LOCKED_CONDITION_KEY = "tonic_pending_locked_condition"; // optional: used to resume locked selection
const DEFAULT_RETURN_TO = "/"; // or "/workspace" if that's your real route

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Optional: allow /pricing?returnTo=/whatever
  const returnTo = useMemo(() => {
    const rt = searchParams.get("returnTo");
    return rt && rt.startsWith("/") ? rt : DEFAULT_RETURN_TO;
  }, [searchParams]);

  // Optional: if you want to pass condition context through querystring later
  // e.g. /pricing?lockedConditionId=123&lockedConditionName=Endometriosis
  const lockedConditionId = searchParams.get("lockedConditionId");
  const lockedConditionName = searchParams.get("lockedConditionName");

  const handleDevUpgrade = () => {
    if (typeof window === "undefined") return;

    // Simulate successful payment
    localStorage.setItem(PLAN_KEY, "paid");

    // Optional: stash what they tried to unlock (so success page can resume)
    // If your HomePage already sets this key when a locked item is clicked, you can remove this.
    if (lockedConditionId) {
      localStorage.setItem(
        PENDING_LOCKED_CONDITION_KEY,
        JSON.stringify({
          id: lockedConditionId,
          name: lockedConditionName ?? "",
          returnTo,
        })
      );
    }

    // Mimic Stripe success return
    router.push(`/upgrade/success?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const handleResetToFree = () => {
    if (typeof window === "undefined") return;

    localStorage.setItem(PLAN_KEY, "free");
    // leave pending condition alone (handy for retesting), or clear it:
    // localStorage.removeItem(PENDING_LOCKED_CONDITION_KEY);

    router.push(returnTo);
  };

  return (
    <main className="min-h-screen bg-[#F7F8F3] text-slate-900">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#72B01D]">
            Pricing
          </p>

          <h1 className="mt-2 text-2xl font-semibold text-[#2E332B]">
            Upgrade to Pro
          </h1>

          <p className="mt-2 text-sm text-slate-700">
            This is a <b>dev simulation</b> of the upgrade flow. Clicking upgrade
            will mark your account as <b>paid</b> locally and send you to a
            success page (like Stripe would).
          </p>

          {(lockedConditionName || lockedConditionId) && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                You tried to unlock
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {lockedConditionName || `Condition ID: ${lockedConditionId}`}
              </p>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-200 bg-[#F0F3EB] p-4">
            <ul className="text-sm text-slate-800 space-y-2">
              <li>🔓 Unlock all locked health concerns</li>
              <li>🧪 Build full formulas without limits</li>
              <li>📄 Export PDFs</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleDevUpgrade}
              className="w-full px-4 py-3 rounded-xl bg-[#72B01D] hover:bg-[#6AA318] text-white font-semibold border border-[#72B01D]"
            >
              Upgrade (dev)
            </button>

            <button
              type="button"
              onClick={() => router.push(returnTo)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
            >
              Not now
            </button>

            <button
              type="button"
              onClick={handleResetToFree}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-600"
              title="For testing the upgrade loop again"
            >
              Reset to Free (dev)
            </button>
          </div>

          <p className="mt-4 text-[11px] text-slate-500">
            Return target: <span className="font-mono">{returnTo}</span>
          </p>
        </div>
      </div>
    </main>
  );
}
