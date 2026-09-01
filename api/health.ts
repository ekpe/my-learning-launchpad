import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions } from "./_lib/cors.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  res.json({ status: "ok", timestamp: new Date().toISOString() });
}
