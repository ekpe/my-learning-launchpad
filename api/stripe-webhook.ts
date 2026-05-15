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

  const stripe = new Stripe(secretKey);
  const sig = req.headers["stripe-signature"] as string;
  const rawBody = await getRawBody(req);

  let event: Stripe.Event;

  if (webhookSecret) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    // Dev only — skip verification if secret not configured
    console.warn("[Webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature check");
    try {
      event = JSON.parse(rawBody.toString()) as Stripe.Event;
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
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
