import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Attempting to disconnect calendar for user:", user.id);

    // Check if connection exists first
    const { data: existingConnection, error: checkError } = await supabaseAdmin
      .from("calendar_connections")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking calendar connection:", checkError);
      return NextResponse.json(
        { error: "Failed to check calendar connection" },
        { status: 500 }
      );
    }

    if (!existingConnection) {
      console.log("No calendar connection found for user:", user.id);
      return NextResponse.json({ success: true, message: "No connection to disconnect" });
    }

    // Delete calendar connection
    const { error } = await supabaseAdmin
      .from("calendar_connections")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Error disconnecting calendar:", error);
      return NextResponse.json(
        { error: `Failed to disconnect calendar: ${error.message}` },
        { status: 500 }
      );
    }

    console.log("Successfully disconnected calendar for user:", user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Calendar disconnect error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to disconnect calendar" },
      { status: 500 }
    );
  }
}


