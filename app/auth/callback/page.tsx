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

const VERIFY_OTP_TYPES = new Set([
  "signup",
  "email",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
]);

function normalizeVerifyType(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  return VERIFY_OTP_TYPES.has(t) ? t : null;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const typeFromHash = getHashParam("type");
        const typeFromQuery = getSearchParam("type");
        const intent = typeFromHash || typeFromQuery;

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

          router.replace("/onboarding?verified=1");
          router.refresh();
          return;
        }

        const token_hash = getSearchParam("token_hash");
        const verifyType = normalizeVerifyType(getSearchParam("type"));
        if (token_hash && verifyType) {
          const { error } = await supabase.auth.verifyOtp({
            type: verifyType as
              | "signup"
              | "email"
              | "recovery"
              | "invite"
              | "magiclink"
              | "email_change",
            token_hash,
          });
          if (error) throw error;

          if (intent === "recovery") {
            router.replace("/auth/reset");
            router.refresh();
            return;
          }

          router.replace("/onboarding?verified=1");
          router.refresh();
          return;
        }

        // PKCE: @supabase/ssr client runs detectSessionInUrl on init and exchanges the code
        // using the cookie-stored verifier. Wait briefly, then read session — avoid calling
        // exchangeCodeForSession twice (second call clears verifier → "code verifier" errors).
        await new Promise((r) => setTimeout(r, 150));
        if (!alive) return;

        let {
          data: { session },
        } = await supabase.auth.getSession();

        const code = getSearchParam("code");
        if (!session && code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          session = data.session;
        }

        if (!alive) return;

        if (!session) {
          const errDesc = getSearchParam("error_description");
          const errCode = getSearchParam("error");
          if (errDesc || errCode) {
            setMsg(
              `Sign-in failed: ${errDesc || errCode || "Unknown error"}. Try signing in again.`
            );
            return;
          }
          setMsg(
            "This link is missing a valid session. If you opened an email on another device, open it in the same browser where you signed up, or sign in with email and password. You can also ask your admin to resend the confirmation link."
          );
          return;
        }

        if (intent === "recovery") {
          router.replace("/auth/reset");
          router.refresh();
          return;
        }

        router.replace("/onboarding?verified=1");
        router.refresh();
      } catch (e: unknown) {
        console.error("Auth callback error:", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        if (
          message.toLowerCase().includes("code verifier") ||
          message.toLowerCase().includes("verifier")
        ) {
          setMsg(
            "This sign-in link must be opened in the same browser where you started Google sign-in or sign-up. Alternatively, sign in with email and password."
          );
        } else {
          setMsg(`Sign-in failed: ${message}`);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  return <div className="p-6 text-sm text-slate-700">{msg}</div>;
}
