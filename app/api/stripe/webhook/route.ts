// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err?.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const supabaseUserId = session.metadata?.supabase_user_id;
      const customerId =
        typeof session.customer === "string" ? session.customer : null;

      if (!supabaseUserId) {
        console.error("Missing supabase_user_id in session metadata");
        return NextResponse.json({ received: true }, { status: 200 });
      }

      const updatePayload: Record<string, any> = { plan: "paid" };
      if (customerId) updatePayload.stripe_customer_id = customerId;

      const { error: updateErr } = await supabaseAdmin
        .from("profiles")
        .update(updatePayload)
        .eq("id", supabaseUserId);

      if (updateErr) {
        console.error("Failed to update profile plan:", updateErr);
        return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
