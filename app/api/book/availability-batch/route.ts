import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptToken } from "@/lib/calendar/encryption";
import { refreshAccessToken, listEvents } from "@/lib/calendar/google";
import { fromZonedTime } from "date-fns-tz";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { practitionerId, date, timeSlots, consultType, durationMinutes } = body;

    if (!practitionerId || !date || !timeSlots || !Array.isArray(timeSlots)) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Get clinic settings for timezone
    const { data: clinicSettings } = await supabaseAdmin
      .from("clinic_settings")
      .select("timezone")
      .eq("user_id", practitionerId)
      .single();

    const clinicTimezone = clinicSettings?.timezone || 'UTC';

    // Fetch all bookings and consultations once
    const [bookingsResult, consultationsResult] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, start_time, end_time, status")
        .eq("practitioner_id", practitionerId)
        .in("status", ["pending", "confirmed"]),
      supabase
        .from("consultations")
        .select("id, start_time, end_time")
        .eq("user_id", practitionerId),
    ]);

    const bookings = bookingsResult.data || [];
    const consultations = consultationsResult.data || [];

    // Fetch Google Calendar events once if connected
    let googleEvents: any[] = [];
    try {
      const { data: calendarConnection } = await supabaseAdmin
        .from("calendar_connections")
        .select("*")
        .eq("user_id", practitionerId)
        .eq("provider", "google")
        .eq("sync_enabled", true)
        .maybeSingle();

      if (calendarConnection) {
        let accessToken = decryptToken(calendarConnection.access_token);
        let refreshToken = calendarConnection.refresh_token
          ? decryptToken(calendarConnection.refresh_token)
          : undefined;

        const now = new Date();
        const expiresAt = calendarConnection.token_expires_at
          ? new Date(calendarConnection.token_expires_at)
          : null;

        if (expiresAt && now >= expiresAt && refreshToken) {
          const newTokens = await refreshAccessToken(refreshToken);
          accessToken = newTokens.access_token;
        }

        // Get events for the entire day in clinic timezone
        // Create dates for start and end of day in clinic timezone, then convert to UTC
        const dayStartStr = `${date}T00:00:00`;
        const dayEndStr = `${date}T23:59:59`;
        
        // Create naive dates (as UTC) then convert from clinic timezone
        const dayStartNaive = new Date(dayStartStr + 'Z');
        const dayEndNaive = new Date(dayEndStr + 'Z');
        
        // Convert clinic timezone day boundaries to UTC
        const dayStartUTC = fromZonedTime(dayStartNaive, clinicTimezone);
        const dayEndUTC = fromZonedTime(dayEndNaive, clinicTimezone);
        
        const timeMin = dayStartUTC.toISOString();
        const timeMax = dayEndUTC.toISOString();

        googleEvents = await listEvents(
          accessToken,
          refreshToken,
          timeMin,
          timeMax,
          calendarConnection.calendar_id || "primary"
        );
      }
    } catch (calendarError) {
      console.error("Error fetching Google Calendar events:", calendarError);
    }

    // Check each timeslot
    const availabilityMap: Record<string, boolean> = {};

    for (const slotTime of timeSlots) {
      const [hours, minutes] = slotTime.split(':').map(Number);
      
      // Parse the date components
      const [year, month, day] = date.split('-').map(Number);
      
      // Create a Date object in UTC with the components we want
      // This represents the "wall clock time" we want (year, month, day, hour, minute)
      // We'll create it as if these components are in UTC, then fromZonedTime will
      // interpret them as if they're in clinic timezone
      const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
      
      // fromZonedTime: takes the date's UTC time, formats it in clinic timezone to get components,
      // then treats those components as if they're in clinic timezone and converts to UTC
      // But we want the opposite - we want to treat (year, month, day, hour, minute) as clinic timezone
      // So we need to work backwards: what UTC time, when formatted in clinic timezone, gives us these components?
      
      // Calculate the timezone offset for this date
      // Create a test date at midnight UTC to determine the offset
      const testDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: clinicTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        day: '2-digit',
      });
      const testParts = formatter.formatToParts(testDate);
      const clinicMidnightHour = parseInt(testParts.find(p => p.type === 'hour')?.value || '0');
      const clinicMidnightDay = parseInt(testParts.find(p => p.type === 'day')?.value || day.toString());
      
      // Calculate offset: if UTC midnight shows as hour X in clinic timezone,
      // then clinic is UTC+X (or UTC+X-24 if day changed)
      let offsetFromUTC = clinicMidnightHour;
      if (parseInt(clinicMidnightDay) !== day) {
        // Day changed - clinic is ahead (positive offset) or behind (negative)
        if (parseInt(clinicMidnightDay) > day) {
          // Next day in clinic = clinic is ahead of UTC
          offsetFromUTC = clinicMidnightHour - 24;
        } else {
          // Previous day in clinic = clinic is behind UTC  
          offsetFromUTC = clinicMidnightHour + 24;
        }
      }
      
      // Adjust the UTC date: if clinic is UTC+13 and we want 10:00 clinic time,
      // we need 10:00 - 13 = -3:00 UTC = 21:00 previous day UTC
      const targetUTC = hours - offsetFromUTC;
      const adjustedHour = ((targetUTC % 24) + 24) % 24;
      // Calculate day offset: if targetUTC is negative, we need to go back days
      const dayOffset = targetUTC < 0 ? Math.floor(targetUTC / 24) : 0;
      const adjustedDay = day + dayOffset;
      const startDateUTC = new Date(Date.UTC(year, month - 1, adjustedDay, adjustedHour, minutes, 0));
      const endDateUTC = new Date(startDateUTC.getTime() + (durationMinutes * 60 * 1000));

      const startTimeISO = startDateUTC.toISOString();
      const endTimeISO = endDateUTC.toISOString();
      
      // Debug logging
      console.log(`Slot ${slotTime} in ${clinicTimezone}:`, {
        offsetFromUTC,
        adjustedHour,
        adjustedDay,
        startUTC: startTimeISO,
        endUTC: endTimeISO,
      });

      // Check bookings
      const hasBookingConflict = bookings.some((booking) => {
        if (!booking.start_time || !booking.end_time) return false;
        const bookingStart = new Date(booking.start_time).toISOString();
        const bookingEnd = new Date(booking.end_time).toISOString();
        return startTimeISO < bookingEnd && endTimeISO > bookingStart;
      });

      // Check consultations
      const hasConsultConflict = consultations.some((consult) => {
        if (!consult.start_time || !consult.end_time) return false;
        const consultStart = new Date(consult.start_time).toISOString();
        const consultEnd = new Date(consult.end_time).toISOString();
        return startTimeISO < consultEnd && endTimeISO > consultStart;
      });

      // Check Google Calendar events (properly handle timezone)
      const hasCalendarConflict = googleEvents.some((event) => {
        if (!event.start || !event.end) return false;
        
        const eventStart = event.start.dateTime || event.start.date;
        const eventEnd = event.end.dateTime || event.end.date;
        if (!eventStart || !eventEnd) return false;
        
        try {
          // Google Calendar events include timezone info
          // If dateTime is provided, it may or may not include timezone offset
          // If timeZone field is provided, the dateTime is in that timezone
          let eventStartUTC: Date;
          let eventEndUTC: Date;
          
          if (event.start.dateTime) {
            // dateTime is provided - check if it has timezone info
            const eventStartStr = eventStart as string;
            const eventTimezone = event.start.timeZone;
            
            // If dateTime includes timezone offset (ends with Z or +/-), parse directly
            if (eventStartStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(eventStartStr)) {
              eventStartUTC = new Date(eventStartStr);
            } else if (eventTimezone) {
              // dateTime is in the specified timezone, convert to UTC
              // Parse the dateTime string to get components
              const dateTimeMatch = eventStartStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
              if (dateTimeMatch) {
                const [, year, month, day, hour, minute, second] = dateTimeMatch.map(Number);
                
                // Calculate timezone offset for this date (same logic as clinic timezone)
                const testDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
                const formatter = new Intl.DateTimeFormat('en-US', {
                  timeZone: eventTimezone,
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                  day: '2-digit',
                });
                const testParts = formatter.formatToParts(testDate);
                const eventMidnightHour = parseInt(testParts.find(p => p.type === 'hour')?.value || '0');
                const eventMidnightDay = parseInt(testParts.find(p => p.type === 'day')?.value || day.toString());
                
                let offsetFromUTC = eventMidnightHour;
                if (parseInt(eventMidnightDay) !== day) {
                  if (parseInt(eventMidnightDay) > day) {
                    offsetFromUTC = eventMidnightHour - 24;
                  } else {
                    offsetFromUTC = eventMidnightHour + 24;
                  }
                }
                
                // Convert event timezone time to UTC
                const targetUTC = hour - offsetFromUTC;
                const adjustedHour = ((targetUTC % 24) + 24) % 24;
                const dayOffset = targetUTC < 0 ? Math.floor(targetUTC / 24) : 0;
                const adjustedDay = day + dayOffset;
                eventStartUTC = new Date(Date.UTC(year, month - 1, adjustedDay, adjustedHour, minute, second || 0));
              } else {
                // Fallback to old method if parsing fails
                const eventStartDate = new Date(eventStartStr);
                eventStartUTC = fromZonedTime(eventStartDate, eventTimezone);
              }
            } else {
              // No timezone info, assume UTC
              eventStartUTC = new Date(eventStartStr + 'Z');
            }
          } else {
            // All-day event (date only)
            eventStartUTC = new Date(eventStart + 'T00:00:00Z');
          }
          
          if (event.end.dateTime) {
            const eventEndStr = eventEnd as string;
            const eventTimezone = event.end.timeZone;
            
            if (eventEndStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(eventEndStr)) {
              eventEndUTC = new Date(eventEndStr);
            } else if (eventTimezone) {
              // Same logic for end time
              const dateTimeMatch = eventEndStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
              if (dateTimeMatch) {
                const [, year, month, day, hour, minute, second] = dateTimeMatch.map(Number);
                
                const testDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
                const formatter = new Intl.DateTimeFormat('en-US', {
                  timeZone: eventTimezone,
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                  day: '2-digit',
                });
                const testParts = formatter.formatToParts(testDate);
                const eventMidnightHour = parseInt(testParts.find(p => p.type === 'hour')?.value || '0');
                const eventMidnightDay = parseInt(testParts.find(p => p.type === 'day')?.value || day.toString());
                
                let offsetFromUTC = eventMidnightHour;
                if (parseInt(eventMidnightDay) !== day) {
                  if (parseInt(eventMidnightDay) > day) {
                    offsetFromUTC = eventMidnightHour - 24;
                  } else {
                    offsetFromUTC = eventMidnightHour + 24;
                  }
                }
                
                const targetUTC = hour - offsetFromUTC;
                const adjustedHour = ((targetUTC % 24) + 24) % 24;
                const dayOffset = targetUTC < 0 ? Math.floor(targetUTC / 24) : 0;
                const adjustedDay = day + dayOffset;
                eventEndUTC = new Date(Date.UTC(year, month - 1, adjustedDay, adjustedHour, minute, second || 0));
              } else {
                const eventEndDate = new Date(eventEndStr);
                eventEndUTC = fromZonedTime(eventEndDate, eventTimezone);
              }
            } else {
              eventEndUTC = new Date(eventEndStr + 'Z');
            }
          } else {
            // All-day event (date only) - end is exclusive, so use next day
            const endDate = new Date(eventEnd as string);
            endDate.setDate(endDate.getDate() + 1);
            eventEndUTC = new Date(endDate.toISOString().split('T')[0] + 'T00:00:00Z');
          }
          
          const eventStartISO = eventStartUTC.toISOString();
          const eventEndISO = eventEndUTC.toISOString();
          
          // Debug logging
          console.log('Google Calendar event:', {
            summary: event.summary,
            dateTime: eventStart,
            timeZone: event.start.timeZone,
            parsedUTC: eventStartISO,
            slotStartUTC: startTimeISO,
            slotEndUTC: endTimeISO,
            conflicts: startTimeISO < eventEndISO && endTimeISO > eventStartISO,
          });
          
          return startTimeISO < eventEndISO && endTimeISO > eventStartISO;
        } catch (e) {
          console.error("Error processing calendar event:", e, event);
          return false;
        }
      });

      availabilityMap[slotTime] = !hasBookingConflict && !hasConsultConflict && !hasCalendarConflict;
    }

    return NextResponse.json({ availability: availabilityMap }, { status: 200 });
  } catch (err: any) {
    console.error("Batch availability API error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to check availability" },
      { status: 500 }
    );
  }
}

