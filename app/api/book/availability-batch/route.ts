import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { format, parseISO, setHours, setMinutes, isWithinInterval } from "date-fns";

export const runtime = "nodejs";

// Helper to convert local time in a timezone to UTC
// Uses the same approach as the create route
function convertToUTC(dateTimeString: string, timezone: string): Date {
  // Parse the date-time string (format: "YYYY-MM-DDTHH:mm:ss")
  const [datePart, timePart] = dateTimeString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = (timePart || '00:00:00').split(':').map(Number);
  
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
  const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  
  // Calculate offset: difference between desired time and what UTC timezone shows
  const desiredTime = hour * 60 + minute;
  const tzTime = tzHour * 60 + tzMinute;
  const offsetMinutes = desiredTime - tzTime;
  
  // Adjust the UTC date by the offset
  return new Date(tempDate.getTime() - offsetMinutes * 60000);
}

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

    // Get clinic settings (timezone, business hours, buffer time)
    const { data: clinicSettings, error: settingsError } = await supabaseAdmin
      .from("clinic_settings")
      .select("timezone, business_hours, buffer_time_minutes")
      .eq("user_id", practitionerId)
      .single();

    if (settingsError && settingsError.code !== "PGRST116") {
      console.error("Error fetching clinic settings:", settingsError);
      return NextResponse.json({ error: "Failed to fetch clinic settings" }, { status: 500 });
    }

    const clinicTimezone = clinicSettings?.timezone || "Australia/Sydney";
    const businessHours = clinicSettings?.business_hours || {};
    const bufferMinutes = clinicSettings?.buffer_time_minutes ?? 15;
    
    // Validate timezone
    if (!clinicTimezone || typeof clinicTimezone !== 'string') {
      return NextResponse.json({ error: "Invalid timezone configuration" }, { status: 500 });
    }

    // Get existing bookings for the day
    // Convert start and end of day from clinic timezone to UTC
    let startOfDayUTC: Date;
    let endOfDayUTC: Date;
    try {
      startOfDayUTC = convertToUTC(`${date}T00:00:00`, clinicTimezone);
      endOfDayUTC = convertToUTC(`${date}T23:59:59`, clinicTimezone);
    } catch (error) {
      console.error("Error converting timezone:", error);
      return NextResponse.json({ error: "Invalid date or timezone" }, { status: 400 });
    }

    const { data: existingBookings, error: bookingsError } = await supabaseAdmin
      .from("bookings")
      .select("start_time, end_time")
      .eq("practitioner_id", practitionerId)
      .in("status", ["pending", "confirmed"])
      .gte("start_time", startOfDayUTC.toISOString())
      .lte("start_time", endOfDayUTC.toISOString());

    if (bookingsError) {
      console.error("Error fetching existing bookings:", bookingsError);
      return NextResponse.json({ error: "Failed to fetch existing bookings" }, { status: 500 });
    }

    // Get Google Calendar events for the day
    let googleCalendarEvents: Array<{ start: Date; end: Date }> = [];
    
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

        await oauth2Client.getAccessToken();
        const credentials = oauth2Client.credentials;
        if (credentials?.access_token && credentials.access_token !== calendarConnection.access_token && credentials.expiry_date) {
          await supabaseAdmin
            .from("calendar_connections")
            .update({
              access_token: credentials.access_token,
              token_expires_at: new Date(credentials.expiry_date).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", practitionerId);
        }

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        const calendarResponse = await calendar.events.list({
          calendarId: calendarConnection.calendar_id || "primary",
          timeMin: startOfDayUTC.toISOString(),
          timeMax: endOfDayUTC.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        });

        if (calendarResponse.data.items) {
          const timedEvents = calendarResponse.data.items
            .filter((event) => event.start?.dateTime && event.end?.dateTime)
            .map((event) => ({
              start: new Date(event.start!.dateTime!),
              end: new Date(event.end!.dateTime!),
            }));

          const allDayRanges: Array<{ start: Date; end: Date }> = [];
          for (const event of calendarResponse.data.items) {
            const startDate = event.start?.date;
            const endDate = event.end?.date;
            if (!startDate) continue;
            if (event.start?.dateTime) continue;

            const eventStart = startDate;
            const eventEnd = endDate || startDate;
            if (eventEnd < eventStart) continue;

            const checkDate = date;
            if (checkDate >= eventStart && checkDate < eventEnd) {
              try {
                const dayStart = convertToUTC(`${checkDate}T00:00:00`, clinicTimezone);
                const dayEnd = convertToUTC(`${checkDate}T23:59:59`, clinicTimezone);
                allDayRanges.push({ start: dayStart, end: dayEnd });
              } catch {
                // skip this event if conversion fails
              }
            }
          }

          googleCalendarEvents = [...timedEvents, ...allDayRanges];
        }
      } catch (calendarError: any) {
        console.error("Error fetching Google Calendar events:", calendarError);
        // Don't fail the entire request if calendar fetch fails
        // Just log and continue with database bookings only
      }
    }

    // Combine database bookings and Google Calendar events
    const allBlockedTimes: Array<{ start: Date; end: Date }> = [
      ...(existingBookings || []).map((booking) => ({
        start: new Date(booking.start_time),
        end: new Date(booking.end_time),
      })),
      ...googleCalendarEvents,
    ];

    const availability: Record<string, boolean> = {};
    const dayOfWeek = format(parseISO(date), "EEEE").toLowerCase(); // e.g., "monday"
    const dayBusinessHours = businessHours && typeof businessHours === 'object' ? businessHours[dayOfWeek] : null;

    for (const time of timeSlots) {
      let isAvailable = true;

      // Check against business hours
      if (!dayBusinessHours || !dayBusinessHours.enabled || !dayBusinessHours.start || !dayBusinessHours.end) {
        isAvailable = false;
      } else {
        try {
          const slotStart = setMinutes(setHours(parseISO(date), parseInt(time.split(":")[0])), parseInt(time.split(":")[1]));
          const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

          const [startHour, startMin] = dayBusinessHours.start.split(":").map(Number);
          const [endHour, endMin] = dayBusinessHours.end.split(":").map(Number);
          
          const businessStart = setMinutes(setHours(parseISO(date), startHour), startMin);
          const businessEnd = setMinutes(setHours(parseISO(date), endHour), endMin);

          if (!isWithinInterval(slotStart, { start: businessStart, end: businessEnd }) ||
              !isWithinInterval(slotEnd, { start: businessStart, end: businessEnd })) {
            isAvailable = false;
          }
        } catch (error) {
          console.error("Error checking business hours:", error);
          isAvailable = false;
        }
      }

      // Check against all blocked times (database bookings + Google Calendar events)
      if (isAvailable) {
        let proposedBookingStart: Date;
        try {
          proposedBookingStart = convertToUTC(`${date}T${time}:00`, clinicTimezone);
        } catch (error) {
          console.error("Error converting booking time:", error);
          isAvailable = false;
          availability[time] = isAvailable;
          continue;
        }
        const proposedBookingEnd = new Date(proposedBookingStart.getTime() + durationMinutes * 60000);

        for (const blocked of allBlockedTimes) {
          // Apply buffer time to blocked events
          const blockedStart = new Date(blocked.start);
          blockedStart.setMinutes(blockedStart.getMinutes() - bufferMinutes);
          const blockedEnd = new Date(blocked.end);
          blockedEnd.setMinutes(blockedEnd.getMinutes() + bufferMinutes);

          // Check for overlap (with buffer applied)
          if (
            (proposedBookingStart < blockedEnd && proposedBookingEnd > blockedStart)
          ) {
            isAvailable = false;
            break;
          }
        }
      }

      availability[time] = isAvailable;
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


