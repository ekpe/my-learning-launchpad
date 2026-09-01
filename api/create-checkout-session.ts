import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { db, adminInitError } from "./_lib/firebase-admin";
import { handleOptions } from "./_lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: "Stripe not configured" });
  if (adminInitError) {
    return res.status(503).json({ error: "Server configuration error", details: adminInitError });
  }

  const { courseId, userId } = req.body;
  if (!courseId || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Price and title come from Firestore, never from the client — trusting
    // a client-supplied price would let anyone check out for any amount.
    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (!courseSnap.exists) {
      return res.status(404).json({ error: "Course not found" });
    }
    const course = courseSnap.data()!;

    if (course.isFree) {
      return res.status(400).json({ error: "This course is free — enroll directly, no checkout needed" });
    }

    const price = Number(course.price);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(500).json({ error: "Course does not have a valid price configured" });
    }

    const stripe = new Stripe(secretKey);
    const origin = req.headers.origin || process.env.APP_URL || "";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: course.title || "Course" },
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
