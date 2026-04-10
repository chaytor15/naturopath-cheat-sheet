import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { google } from "googleapis";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeMin = searchParams.get("timeMin");
    const timeMax = searchParams.get("timeMax");

    if (!timeMin || !timeMax) {
      return NextResponse.json({ error: "timeMin and timeMax are required" }, { status: 400 });
    }

    // Get calendar connection
    const { data: calendarConnection, error: connectionError } = await supabaseAdmin
      .from("calendar_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (connectionError || !calendarConnection) {
      return NextResponse.json({ events: [] }); // Return empty if not connected
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        access_token: calendarConnection.access_token,
        refresh_token: calendarConnection.refresh_token,
      });

      // Ensure token is valid (refreshes if expired)
      await oauth2Client.getAccessToken();
      const credentials = oauth2Client.credentials;
      if (!credentials?.access_token) {
        console.error("Google Calendar: no access token after refresh");
        return NextResponse.json({ events: [], error: "Calendar sync issue: could not get access token" });
      }

      if (credentials.access_token !== calendarConnection.access_token && credentials.expiry_date) {
        await supabaseAdmin
          .from("calendar_connections")
          .update({
            access_token: credentials.access_token,
            token_expires_at: new Date(credentials.expiry_date).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      const calendarResponse = await calendar.events.list({
        calendarId: calendarConnection.calendar_id || "primary",
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = (calendarResponse.data.items || []).map((event) => ({
        id: event.id,
        title: event.summary || "Untitled Event",
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location,
        description: event.description,
        hangoutLink: event.hangoutLink,
      }));

      return NextResponse.json({ events });
    } catch (calendarError: any) {
      console.error("Error fetching Google Calendar events:", calendarError);
      const message = calendarError?.message || "Unknown calendar error";
      return NextResponse.json({
        events: [],
        error: message.includes("401") || message.includes("invalid_grant")
          ? "Calendar sync issue: please reconnect your calendar"
          : "Calendar sync issue",
      });
    }
  } catch (err: any) {
    console.error("Calendar events API error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}




