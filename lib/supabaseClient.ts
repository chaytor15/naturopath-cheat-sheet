// lib/supabaseClient.ts
// Use @supabase/ssr browser client so the session is stored in cookies the Edge proxy
// and createServerClient can read. Plain createClient() keeps the session in localStorage
// only, which causes “logged in” UI + endless /login redirects for protected routes.
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
}

if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable");
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
