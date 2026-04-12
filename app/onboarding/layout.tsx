"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Prefer session from local cookie storage right after OAuth/email callback.
      // getUser() hits the network and can briefly return no user while cookies hydrate.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.user) {
        router.replace("/login?next=/onboarding");
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8F3] text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
