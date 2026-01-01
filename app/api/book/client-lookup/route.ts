import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, practitionerId } = body;

    if (!email || !practitionerId) {
      return NextResponse.json(
        { error: "email and practitionerId are required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Look up client by email
    const { data, error } = await supabase
      .from("clients")
      .select("id, first_name, last_name, full_name, email, phone")
      .eq("user_id", practitionerId)
      .ilike("email", email)
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" - that's okay
      console.error("Error looking up client:", error);
      return NextResponse.json(
        { error: "Failed to look up client" },
        { status: 500 }
      );
    }

    return NextResponse.json({ client: data || null });
  } catch (err: any) {
    console.error("Client lookup API error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to look up client" },
      { status: 500 }
    );
  }
}

