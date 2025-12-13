import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10" as any,
});


export async function POST(req: Request) {
  try {
    const { priceId } = (await req.json()) as { priceId?: string };

    if (!priceId) {
      return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // We expect the client to send the Supabase access token
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon);
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user = userRes.user;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/upgrade/success`,
      cancel_url: `${appUrl}/pricing?canceled=1`,

      // The key thing: link Stripe event → Supabase user
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,

      // optional: also include metadata (handy for debugging)
      metadata: {
        supabase_user_id: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("checkout error", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
