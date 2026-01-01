import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { practitionerId, date, timeSlots, consultType, durationMinutes } = body;

    if (!practitionerId || !date || !timeSlots || !consultType || !durationMinutes) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get clinic settings for timezone
    const { data: clinicSettings } = await supabaseAdmin
      .from("clinic_settings")
      .select("timezone, business_hours")
      .eq("user_id", practitionerId)
      .single();

    const timezone = clinicSettings?.timezone || "Australia/Sydney";

    // Get existing bookings for the date
    const dateStart = new Date(`${date}T00:00:00`);
    const dateEnd = new Date(`${date}T23:59:59`);
    
    // Convert to UTC for database query
    const dateStartUTC = new Date(dateStart.toLocaleString("en-US", { timeZone: timezone }));
    const dateEndUTC = new Date(dateEnd.toLocaleString("en-US", { timeZone: timezone }));

    const { data: existingBookings } = await supabaseAdmin
      .from("bookings")
      .select("start_time, end_time, status")
      .eq("practitioner_id", practitionerId)
      .gte("start_time", dateStartUTC.toISOString())
      .lte("start_time", dateEndUTC.toISOString())
      .in("status", ["pending", "confirmed"]);

    // Check availability for each time slot
    const availability: Record<string, boolean> = {};
    
    for (const slot of timeSlots) {
      const [hours, minutes] = slot.split(":").map(Number);
      const slotStart = new Date(`${date}T${slot}:00`);
      
      // Convert to UTC
      const slotStartUTC = new Date(slotStart.toLocaleString("en-US", { timeZone: "UTC" }));
      const slotEndUTC = new Date(slotStartUTC.getTime() + durationMinutes * 60000);

      // Check for conflicts
      const hasConflict = existingBookings?.some((booking) => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);
        
        return (
          (slotStartUTC >= bookingStart && slotStartUTC < bookingEnd) ||
          (slotEndUTC > bookingStart && slotEndUTC <= bookingEnd) ||
          (slotStartUTC <= bookingStart && slotEndUTC >= bookingEnd)
        );
      });

      availability[slot] = !hasConflict;
    }

    return NextResponse.json({ availability });
  } catch (err: any) {
    console.error("Availability batch API error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to check availability" },
      { status: 500 }
    );
  }
}

