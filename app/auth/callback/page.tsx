"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function getSearchParam(name: string) {
  return new URL(window.location.href).searchParams.get(name);
}

function getHashParam(name: string) {
  const hash = window.location.hash?.replace(/^#/, "") ?? "";
  return new URLSearchParams(hash).get(name);
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    (async () => {
      try {
        // Detect intent from either hash or query params
        const typeFromHash = getHashParam("type");   // e.g. "recovery"
        const typeFromQuery = getSearchParam("type"); // sometimes present
        const intent = typeFromHash || typeFromQuery; // "recovery" | "signup" | null

        // 1) HASH FLOW
        const access_token = getHashParam("access_token");
        const refresh_token = getHashParam("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;

          if (intent === "recovery") {
            router.replace("/auth/reset");
            router.refresh();
            return;
          }

          // ✅ signup confirmation should land on login, not /app
          router.replace("/login?verified=1");
          router.refresh();
          return;
        }

        // 2) CODE FLOW (PKCE)
        const code = getSearchParam("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (error) throw error;

          if (intent === "recovery") {
            router.replace("/auth/reset");
            router.refresh();
            return;
          }

          // ✅ signup confirmation should land on login, not /app
          router.replace("/login?verified=1");
          router.refresh();
          return;
        }

        setMsg(
          "This link is missing required parameters. Please request a new email and try again."
        );
      } catch (e: any) {
        console.error("Auth callback error:", e);
        setMsg(`Sign-in failed: ${e?.message ?? "Unknown error"}`);
      }
    })();
  }, [router]);

  return <div className="p-6 text-sm text-slate-700">{msg}</div>;
}
