// @ts-nocheck
// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // Next versions differ: cookies() can be sync or async. Normalize to an object.
  const cookieStoreMaybe = cookies();
  const cookieStore =
    typeof (cookieStoreMaybe as any)?.then === "function"
      ? await (cookieStoreMaybe as any)
      : cookieStoreMaybe;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const v = cookieStore.get?.(name);
        return typeof v === "string" ? v : v?.value;
      },

      set(name: string, value: string, options: any) {
        // Next’s cookieStore typing differs by version; this call form is widely supported.
        cookieStore.set?.(name, value, options);
      },

      remove(name: string) {
        // Prefer delete() if available
        try {
          cookieStore.delete?.(name);
        } catch {
          // Fallback: expire it
          cookieStore.set?.(name, "", { maxAge: 0 });
        }
      },
    },
  });
}
