import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { auth, db, FieldValue, adminInitError } from "./_lib/firebase-admin.js";
import { handleOptions } from "./_lib/cors.js";

/**
 * Confirms a Stripe checkout session actually belongs to the caller and was
 * paid, then writes the enrollment with the Admin SDK (bypassing Firestore
 * rules, which deny client writes for paid courses). This is the only
 * server-verified path to a paid enrollment besides the Stripe webhook —
 * both write the same doc id, so whichever runs first wins and the other
 * is a no-op merge.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (adminInitError) {
    return res.status(503).json({ error: "Server configuration error", details: adminInitError });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: "Stripe not configured" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: missing Bearer token" });
  }

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(authHeader.split("Bearer ")[1]);
  } catch (err: any) {
    return res.status(401).json({ error: `Invalid token: ${err.message}` });
  }

  const { sessionId } = req.body || {};
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required" });
  }

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(402).json({ error: "Payment not completed" });
    }

    const { courseId, userId } = session.metadata || {};
    if (!courseId || !userId) {
      return res.status(400).json({ error: "Session is missing courseId/userId metadata" });
    }

    // The session must belong to the caller — otherwise someone could reuse
    // another shopper's (already-paid) session id to enroll their own account.
    if (userId !== decodedToken.uid) {
      return res.status(403).json({ error: "This checkout session does not belong to you" });
    }

    const enrollmentId = `${userId}_${courseId}`;
    await db.collection("enrollments").doc(enrollmentId).set(
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

    res.json({ success: true, courseId, status: "ENROLLED" });
  } catch (err: any) {
    console.error("[verify-enrollment] error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
