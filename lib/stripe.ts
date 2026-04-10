// lib/stripe.ts
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/** Lazy init so `next build` can run without STRIPE_SECRET_KEY on Vercel. */
export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}
