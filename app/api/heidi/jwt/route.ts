import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Log the request for future replacement
    console.log(`[Heidi JWT] Request from user: ${user.id} at ${new Date().toISOString()}`);

    // Return mocked token for MVP
    // In production, this would generate a real JWT token for Heidi API
    const mockedToken = `heidi_mock_token_${user.id}_${Date.now()}`;

    return NextResponse.json({
      token: mockedToken,
      expiresIn: 3600, // 1 hour
    });
  } catch (error: any) {
    console.error("[Heidi JWT] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

