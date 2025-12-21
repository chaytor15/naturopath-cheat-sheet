// app/app/upgrade/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const startCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        alert(data?.error ?? "Checkout failed");
        setLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      alert("Missing checkout URL");
    } catch (e: any) {
      alert(e?.message ?? "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Upgrade to Paid</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Unlock all body systems and conditions.
      </p>

      <button
        onClick={startCheckout}
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-black px-4 py-3 text-white disabled:opacity-60"
      >
        {loading ? "Redirecting…" : "Upgrade (Stripe Checkout)"}
      </button>

      <button
        onClick={() => router.push("/app")}
        className="mt-3 w-full rounded-xl border px-4 py-3"
      >
        Back to app
      </button>
    </div>
  );
}
