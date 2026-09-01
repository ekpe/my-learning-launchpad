import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions } from "./_lib/cors.js";
import { auth, db } from "./_lib/firebase-admin.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT = 200;
const MAX_BODY = 20000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length < 320 && EMAIL_RE.test(value);
}

function clientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return raw?.split(",")[0].trim() || "unknown";
}

// Bounds automated abuse of the public (unauthenticated) path — e.g. a script
// hammering the contact form to blast mail to arbitrary addresses. Backed by
// Firestore so the limit holds across serverless cold starts/instances.
async function checkRateLimit(key: string): Promise<boolean> {
  const ref = db.collection("emailRateLimits").doc(key);
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as { count: number; windowStart: number }) : null;
    if (!data || now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      tx.set(ref, { count: 1, windowStart: now });
      return true;
    }
    if (data.count >= RATE_LIMIT_MAX) return false;
    tx.set(ref, { count: data.count + 1, windowStart: data.windowStart });
    return true;
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not set — skipping");
    return res.json({ status: "skipped", message: "Email service not configured" });
  }

  const { context, to, subject, text, html } = req.body || {};
  if (!subject || !text) {
    return res.status(400).json({ error: "Missing required fields: subject, text" });
  }
  if (subject.length > MAX_SUBJECT || text.length > MAX_BODY || (html && html.length > MAX_BODY)) {
    return res.status(400).json({ error: "subject/text/html exceeds allowed length" });
  }

  let recipient: string;

  if (context === "self") {
    // Account-notification emails (welcome, enrollment, progress, etc.) may
    // only ever go to the caller's own verified address — the client's `to`
    // is never trusted, which rules out using this endpoint to email a
    // third party under an authenticated account.
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: missing Bearer token" });
    }
    try {
      const decoded = await auth.verifyIdToken(authHeader.split("Bearer ")[1]);
      if (!decoded.email) return res.status(400).json({ error: "Account has no email address" });
      recipient = decoded.email;
    } catch (err: any) {
      return res.status(401).json({ error: `Invalid token: ${err.message}` });
    }
  } else if (context === "public") {
    // Public flows (contact form, lead-magnet download) legitimately need
    // to email an address a logged-out visitor typed in — validate it and
    // rate-limit by IP so the endpoint can't be scripted into a bulk relay.
    if (!isValidEmail(to)) {
      return res.status(400).json({ error: "A valid `to` address is required" });
    }
    const allowed = await checkRateLimit(clientIp(req));
    if (!allowed) {
      return res.status(429).json({ error: "Too many requests — please try again later" });
    }
    recipient = to;
  } else {
    return res.status(400).json({ error: "context must be 'self' or 'public'" });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  try {
    // Dynamic import avoids module-level crash if resend has ESM issues
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: recipient,
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });

    if (error) {
      console.error("[Email] Resend error:", JSON.stringify(error));
      return res.status(500).json({ error: (error as any).message ?? JSON.stringify(error) });
    }

    console.log(`[Email] Sent to ${recipient} (id: ${data?.id})`);
    res.json({ status: "success", id: data?.id });
  } catch (err: any) {
    console.error("[Email] Crash:", err.message);
    res.status(500).json({ error: err.message });
  }
}
