// app/api/stripe/checkout/route.ts
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
      .select("id, email, stripe_customer_id, plan")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.plan === "paid") {
      return NextResponse.json({ error: "Already paid" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const priceId = process.env.STRIPE_PRICE_ID;

    if (!appUrl) throw new Error("Missing NEXT_PUBLIC_APP_URL");
    if (!priceId) throw new Error("Missing STRIPE_PRICE_ID");

    let customerId = profile.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email ?? user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });

      customerId = customer.id;

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);

      if (updateErr) {
        return NextResponse.json(
          { error: "Failed to store stripe_customer_id" },
          { status: 500 }
        );
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/app?stripe=success`,
      cancel_url: `${appUrl}/app?stripe=cancel`,
      metadata: { supabase_user_id: user.id },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Checkout failed" },
      { status: 500 }
    );
  }
}
