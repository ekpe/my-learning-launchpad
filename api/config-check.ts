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

  // Webinar funnel settings. Reported for visibility but kept out of `ok` so
  // the existing health signal doesn't change meaning.
  const webinar = {
    fromEmail: !!(process.env.WEBINAR_FROM_EMAIL || process.env.RESEND_FROM_EMAIL),
    tokenSecret: !!process.env.WEBINAR_TOKEN_SECRET, // required for promotional email unsubscribe links
  };

  res.status(allOk ? 200 : 503).json({
    ok: allOk,
    checks,
    webinar,
    ...(adminInitError ? { firebaseAdminError: adminInitError } : {}),
  });
}
