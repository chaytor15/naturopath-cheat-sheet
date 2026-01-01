import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const practitionerId = searchParams.get("practitionerId");

    if (!practitionerId) {
      return NextResponse.json(
        { error: "practitionerId is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("consult_type_pricing")
      .select("consult_type, name, duration_minutes, price, is_custom, display_order")
      .eq("practitioner_id", practitionerId)
      .eq("enabled", true)
      .order("display_order")
      .order("consult_type");

    if (error) {
      console.error("Error fetching consult types:", error);
      return NextResponse.json(
        { error: "Failed to fetch consult types" },
        { status: 500 }
      );
    }

    // If no data, return default types
    if (!data || data.length === 0) {
      return NextResponse.json([
        {
          consult_type: "initial",
          name: "Initial Consultation",
          duration_minutes: 60,
          price: 150,
          is_custom: false,
          display_order: 0,
        },
        {
          consult_type: "follow-up",
          name: "Follow-up Consultation",
          duration_minutes: 30,
          price: 100,
          is_custom: false,
          display_order: 1,
        },
        {
          consult_type: "check-in",
          name: "Check-in",
          duration_minutes: 15,
          price: 50,
          is_custom: false,
          display_order: 2,
        },
      ]);
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Consult types API error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch consult types" },
      { status: 500 }
    );
  }
}

