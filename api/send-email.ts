import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions } from "./_lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not set — skipping");
    return res.json({ status: "skipped", message: "Email service not configured" });
  }

  const { to, subject, text, html, from } = req.body || {};
  if (!to || !subject || !text) {
    return res.status(400).json({ error: "Missing required fields: to, subject, text" });
  }

  const fromEmail = from || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  try {
    // Dynamic import avoids module-level crash if resend has ESM issues
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });

    if (error) {
      console.error("[Email] Resend error:", JSON.stringify(error));
      return res.status(500).json({ error: (error as any).message ?? JSON.stringify(error) });
    }

    console.log(`[Email] Sent to ${to} (id: ${data?.id})`);
    res.json({ status: "success", id: data?.id });
  } catch (err: any) {
    console.error("[Email] Crash:", err.message);
    res.status(500).json({ error: err.message });
  }
}
