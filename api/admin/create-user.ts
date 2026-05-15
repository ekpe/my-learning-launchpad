import type { VercelRequest, VercelResponse } from "@vercel/node";
import { auth, db, FieldValue } from "../_lib/firebase-admin";
import { withAdmin } from "../_lib/with-admin";
import { handleOptions } from "../_lib/cors";

export default withAdmin(async (req: VercelRequest, res: VercelResponse) => {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, displayName, role = "STUDENT" } = req.body;

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: "email, password and displayName are required" });
  }

  const allowedRoles = ["ADMIN", "INSTRUCTOR", "STUDENT"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of ${allowedRoles.join(", ")}` });
  }

  try {
    // Use Admin SDK directly — no REST API workaround needed when a service account is configured
    const userRecord = await auth.createUser({ email, password, displayName });

    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`[Admin] Created user ${userRecord.uid} (${email}) with role ${role}`);
    res.json({ uid: userRecord.uid });
  } catch (err: any) {
    console.error("[Admin] create-user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
