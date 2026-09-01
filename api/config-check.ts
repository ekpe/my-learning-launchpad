import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminInitError } from "./_lib/firebase-admin.js";
import { handleOptions } from "./_lib/cors.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  const checks = {
    firebaseAdmin: !adminInitError,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    resend: !!process.env.RESEND_API_KEY,
    adminEmail: !!process.env.ADMIN_EMAIL,
    firestoreDbId: !!process.env.FIRESTORE_DATABASE_ID,
  };

  const allOk = Object.values(checks).every(Boolean);

  res.status(allOk ? 200 : 503).json({
    ok: allOk,
    checks,
    ...(adminInitError ? { firebaseAdminError: adminInitError } : {}),
  });
}
