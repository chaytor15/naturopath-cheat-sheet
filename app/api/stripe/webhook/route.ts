import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10" as any,
});


export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("webhook signature verify failed", err?.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ✅ When checkout completes, flip plan to paid
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const supabaseUserId =
        (session.client_reference_id as string | null) ||
        (session.metadata?.supabase_user_id as string | undefined);

      if (!supabaseUserId) {
        console.warn("No supabase user id found on session");
        return NextResponse.json({ received: true });
      }

      // Optionally store stripe customer id too
      const stripeCustomerId =
        typeof session.customer === "string" ? session.customer : null;

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          plan: "paid",
          stripe_customer_id: stripeCustomerId ?? undefined,
        })
        .eq("id", supabaseUserId);

      if (error) {
        console.error("Failed updating profile plan", error);
        return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }

      return NextResponse.json({ received: true });
    }

    // Optional: handle cancellations later (not required for MVP)
    // if (event.type === "customer.subscription.deleted") { ... set plan free ... }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("webhook handler error", e);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}
