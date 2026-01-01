import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete calendar connection
    const { error } = await supabaseAdmin
      .from("calendar_connections")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Error disconnecting calendar:", error);
      return NextResponse.json(
        { error: "Failed to disconnect calendar" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Calendar disconnect error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to disconnect calendar" },
      { status: 500 }
    );
  }
}

