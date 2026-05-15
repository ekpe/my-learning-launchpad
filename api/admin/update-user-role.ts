import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_lib/firebase-admin";
import { withAdmin } from "../_lib/with-admin";
import { handleOptions } from "../_lib/cors";

export default withAdmin(async (req: VercelRequest, res: VercelResponse) => {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { uid, role } = req.body;
  if (!uid || !role) return res.status(400).json({ error: "uid and role are required" });

  const allowedRoles = ["ADMIN", "INSTRUCTOR", "STUDENT"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of ${allowedRoles.join(", ")}` });
  }

  try {
    await db.collection("users").doc(uid).update({ role });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
