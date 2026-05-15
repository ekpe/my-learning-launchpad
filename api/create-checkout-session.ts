import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { handleOptions } from "./_lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: "Stripe not configured" });

  const stripe = new Stripe(secretKey);
  const { courseId, courseName, price, userId } = req.body;

  if (!courseId || !courseName || price == null || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const origin = req.headers.origin || process.env.APP_URL || "";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: courseName },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&courseId=${courseId}`,
      cancel_url: `${origin}/course/${courseId}`,
      metadata: { courseId, userId },
    });

    res.json({ id: session.id, url: session.url });
  } catch (err: any) {
    console.error("[Stripe] create-checkout-session error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
