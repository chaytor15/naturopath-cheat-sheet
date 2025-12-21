// app/api/stripe/portal/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.stripe_customer_id) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error("Missing NEXT_PUBLIC_APP_URL");

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/settings`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("Portal error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to create portal session" },
      { status: 500 }
    );
  }
}

