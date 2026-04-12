import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only: does an auth.users row exist for this email? (service role)
 * Used after a "duplicate-shaped" signUp to avoid false "already exists" after admin delete / cooldown.
 *
 * Note: paginated scan — fine for small user bases; for large projects prefer a DB hook or filter API.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "server_misconfigured", registered: null },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof (body as { email: unknown }).email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const perPage = 1000;
  const maxPages = 50;

  try {
    for (let page = 1; page <= maxPages; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error || !data?.users) {
        return NextResponse.json(
          { error: "lookup_failed", registered: null },
          { status: 502 }
        );
      }

      const hit = data.users.some(
        (u) => (u.email ?? "").toLowerCase() === email
      );
      if (hit) {
        return NextResponse.json({ registered: true });
      }

      if (data.users.length < perPage) {
        break;
      }
    }

    return NextResponse.json({ registered: false });
  } catch {
    return NextResponse.json(
      { error: "lookup_failed", registered: null },
      { status: 502 }
    );
  }
}
