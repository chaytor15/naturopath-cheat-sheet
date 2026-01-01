import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Helper to convert local time in a timezone to UTC
// Uses a simple approach: create date components, then use Intl to get UTC equivalent
function convertTimezoneToUTC(date: string, time: string, timezone: string, durationMinutes: number): { start: Date; end: Date } {
  // Parse components
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  
  // Create an ISO string representing this time (treating as UTC temporarily)
  const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
  const tempDate = new Date(isoString);
  
  // Get what this UTC time represents in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(tempDate);
  const tzYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const tzMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0');
  const tzDay = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  
  // Calculate offset: difference between desired time and what UTC timezone shows
  const desiredTime = hour * 60 + minute;
  const tzTime = tzHour * 60 + tzMinute;
  const offsetMinutes = desiredTime - tzTime;
  
  // Adjust the UTC date by the offset
  const startUTC = new Date(tempDate.getTime() - offsetMinutes * 60000);
  const endUTC = new Date(startUTC.getTime() + durationMinutes * 60000);
  
  return { start: startUTC, end: endUTC };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      practitionerId,
      consultType,
      startTime, // Legacy: ISO string
      endTime, // Legacy: ISO string
      date, // New: date string "YYYY-MM-DD"
      time, // New: time string "HH:MM"
      durationMinutes, // New: duration in minutes
      clientName,
      clientEmail,
      clientPhone,
      clientId,
      notes,
      timezone,
    } = body;

    // Support both old format (startTime/endTime) and new format (date/time/timezone)
    if (!practitionerId || !consultType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!clientEmail && !clientId) {
      return NextResponse.json(
        { error: "Client email or ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Get clinic timezone if not provided
    let clinicTimezone = timezone;
    if (!clinicTimezone) {
      const { data: clinicSettings } = await supabaseAdmin
        .from("clinic_settings")
        .select("timezone")
        .eq("user_id", practitionerId)
        .single();
      clinicTimezone = clinicSettings?.timezone || "Australia/Sydney";
    }

    // Convert to UTC - support new format (date/time/timezone) or legacy (startTime/endTime ISO strings)
    let startTimeUTC: Date;
    let endTimeUTC: Date;
    
    if (date && time && durationMinutes) {
      // New format: date, time, and timezone provided
      const { start, end } = convertTimezoneToUTC(date, time, clinicTimezone, durationMinutes);
      startTimeUTC = start;
      endTimeUTC = end;
    } else if (startTime && endTime) {
      // Legacy format: ISO strings (assumed to be in UTC or need conversion)
      startTimeUTC = new Date(startTime);
      endTimeUTC = new Date(endTime);
    } else {
      return NextResponse.json(
        { error: "Missing date/time information" },
        { status: 400 }
      );
    }

    // Get or create client
    let finalClientId = clientId;
    if (!finalClientId && clientEmail) {
      // Look up existing client
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", practitionerId)
        .ilike("email", clientEmail)
        .limit(1)
        .single();

      if (existingClient) {
        finalClientId = existingClient.id;
      } else {
        // Create new client
        const nameParts = (clientName || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const { data: newClient, error: createError } = await supabase
          .from("clients")
          .insert({
            user_id: practitionerId,
            first_name: firstName,
            last_name: lastName,
            full_name: clientName || "",
            email: clientEmail,
            phone: clientPhone || null,
          })
          .select("id")
          .single();

        if (createError) {
          console.error("Error creating client:", createError);
          return NextResponse.json(
            { error: "Failed to create client" },
            { status: 500 }
          );
        }

        finalClientId = newClient.id;
      }
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        practitioner_id: practitionerId,
        client_id: finalClientId,
        consult_type: consultType,
        start_time: startTimeUTC.toISOString(),
        end_time: endTimeUTC.toISOString(),
        status: "pending",
        notes: notes || null,
        client_name: clientName || null,
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
      })
      .select("id")
      .single();

    if (bookingError) {
      console.error("Error creating booking:", bookingError);
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 }
      );
    }

    // Create Google Calendar event if calendar is connected
    let calendarEventId = null;
    let googleMeetLink = null;

    const { data: calendarConnection } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("user_id", practitionerId)
      .single();

    if (calendarConnection?.access_token) {
      try {
        const { google } = await import("googleapis");
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
          access_token: calendarConnection.access_token,
          refresh_token: calendarConnection.refresh_token,
        });

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        // Get consult type name
        const { data: consultTypeData } = await supabaseAdmin
          .from("consult_type_pricing")
          .select("name")
          .eq("practitioner_id", practitionerId)
          .eq("consult_type", consultType)
          .single();

        const consultTypeName = consultTypeData?.name || consultType;

        // Create calendar event with Google Meet
        const event = {
          summary: `${consultTypeName} - ${clientName || "Client"}`,
          description: notes || `Consultation booking for ${clientName || "client"}`,
          start: {
            dateTime: startTimeUTC.toISOString(),
            timeZone: clinicTimezone,
          },
          end: {
            dateTime: endTimeUTC.toISOString(),
            timeZone: clinicTimezone,
          },
          attendees: clientEmail ? [{ email: clientEmail }] : [],
          conferenceData: {
            createRequest: {
              requestId: booking.id,
              conferenceSolutionKey: {
                type: "hangoutsMeet",
              },
            },
          },
        };

        const calendarResponse = await calendar.events.insert({
          calendarId: calendarConnection.calendar_id || "primary",
          requestBody: event,
          conferenceDataVersion: 1,
        });

        calendarEventId = calendarResponse.data.id || null;
        googleMeetLink = calendarResponse.data.hangoutLink || null;

        // Update booking with calendar event ID and Meet link
        await supabase
          .from("bookings")
          .update({
            calendar_event_id: calendarEventId,
            google_meet_link: googleMeetLink,
          })
          .eq("id", booking.id);
      } catch (calendarError: any) {
        console.error("Error creating calendar event:", calendarError);
        // Don't fail the booking if calendar creation fails
      }
    }

    // Get practitioner and clinic details for email
    const { data: practitionerProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", practitionerId)
      .single();

    const { data: clinicSettings } = await supabaseAdmin
      .from("clinic_settings")
      .select("timezone, email_templates")
      .eq("user_id", practitionerId)
      .single();

    // Send confirmation emails (this would use your email service)
    // For now, we'll just return success
    // In production, you'd call your email service here
    // TODO: Implement email sending with templates from clinicSettings.email_templates

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      clientId: finalClientId,
      calendarEventId,
      googleMeetLink,
    });
  } catch (err: any) {
    console.error("Create booking API error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to create booking" },
      { status: 500 }
    );
  }
}

