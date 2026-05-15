import type { VercelRequest, VercelResponse } from "@vercel/node";
import sgMail from "@sendgrid/mail";
import { handleOptions } from "./_lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn("[Email] SENDGRID_API_KEY not configured — skipping");
    return res.json({ status: "skipped", message: "Email service not configured" });
  }

  sgMail.setApiKey(apiKey);

  const { to, subject, text, html, from } = req.body;
  if (!to || !subject || !text) {
    return res.status(400).json({ error: "Missing required fields: to, subject, text" });
  }

  const fromEmail =
    from || process.env.SENDGRID_FROM_EMAIL || "info@mylearninglaunchpad.com";

  try {
    await sgMail.send({ to, from: fromEmail, subject, text, html });
    console.log(`[Email] Sent to ${to}: ${subject}`);
    res.json({ status: "success" });
  } catch (err: any) {
    console.error("[Email] SendGrid error:", err.message, err.response?.body);
    res.status(500).json({
      error: err.message,
      details: err.response?.body,
    });
  }
}
