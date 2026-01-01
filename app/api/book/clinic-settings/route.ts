import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

    const { data, error } = await supabaseAdmin
      .from("clinic_settings")
      .select("timezone, business_hours, advance_booking_days")
      .eq("user_id", practitionerId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" - that's okay, we'll return defaults
      console.error("Error fetching clinic settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch clinic settings" },
        { status: 500 }
      );
    }

    // Return defaults if no settings found
    return NextResponse.json({
      timezone: data?.timezone || "Australia/Sydney",
      business_hours: data?.business_hours || {
        monday: { start: "09:00", end: "17:00", enabled: true },
        tuesday: { start: "09:00", end: "17:00", enabled: true },
        wednesday: { start: "09:00", end: "17:00", enabled: true },
        thursday: { start: "09:00", end: "17:00", enabled: true },
        friday: { start: "09:00", end: "17:00", enabled: true },
        saturday: { start: "09:00", end: "13:00", enabled: false },
        sunday: { start: "09:00", end: "13:00", enabled: false },
      },
      advance_booking_days: data?.advance_booking_days || 30,
    });
  } catch (err: any) {
    console.error("Clinic settings API error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch clinic settings" },
      { status: 500 }
    );
  }
}

