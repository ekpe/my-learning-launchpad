import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { db, FieldValue } from "./_lib/firebase-admin";

/**
 * IMPORTANT: Vercel must forward the raw request body for signature verification.
 * Add this export so Vercel skips its default body parsing for this route.
 */
export const config = { api: { bodyParser: false } };

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey) return res.status(500).json({ error: "Stripe not configured" });
  if (!webhookSecret) {
    // Refuse rather than trust an unverified body — without this, anyone
    // could POST a forged "checkout.session.completed" event and grant
    // themselves a free enrollment. Fail loud so misconfiguration is
    // obvious instead of silently accepting unauthenticated events.
    console.error("[Webhook] STRIPE_WEBHOOK_SECRET not set — refusing to process unverified events");
    return res.status(503).json({ error: "Webhook not configured: STRIPE_WEBHOOK_SECRET missing" });
  }

  const stripe = new Stripe(secretKey);
  const sig = req.headers["stripe-signature"] as string;
  const rawBody = await getRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { courseId, userId } = session.metadata || {};

    if (courseId && userId && session.payment_status === "paid") {
      try {
        await db
          .collection("enrollments")
          .doc(`${userId}_${courseId}`)
          .set(
            {
              userId,
              courseId,
              status: "ENROLLED",
              enrolledAt: FieldValue.serverTimestamp(),
              progress: 0,
              paymentId: session.id,
            },
            { merge: true }
          );
        console.log(`[Webhook] Enrollment created: user=${userId} course=${courseId}`);
      } catch (err: any) {
        console.error("[Webhook] Failed to create enrollment:", err.message);
        // Return 500 so Stripe will retry
        return res.status(500).json({ error: "Failed to create enrollment" });
      }
    }
  }

  res.json({ received: true });
}
