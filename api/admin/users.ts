import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_lib/firebase-admin";
import { withAdmin } from "../_lib/with-admin";
import { handleOptions } from "../_lib/cors";

export default withAdmin(async (req: VercelRequest, res: VercelResponse) => {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }));
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
