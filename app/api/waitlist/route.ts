// app/api/waitlist/route.ts - API route for waitlist submissions
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, practice_type } = body;

    // Validate required fields
    if (!email || !name || !practice_type) {
      return NextResponse.json(
        { error: "Email, name, and practice type are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existing } = await supabaseAdmin
      .from("waitlist_leads")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "This email is already on the waitlist" },
        { status: 409 }
      );
    }

    // Insert new lead
    const { data, error } = await supabaseAdmin
      .from("waitlist_leads")
      .insert({
        email: email.toLowerCase().trim(),
        name: name.trim(),
        practice_type: practice_type,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting waitlist lead:", error);
      return NextResponse.json(
        { error: "Failed to join waitlist. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Successfully joined waitlist", data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Waitlist API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

