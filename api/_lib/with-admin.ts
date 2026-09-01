import type { VercelRequest, VercelResponse } from "@vercel/node";
import { auth, db, adminInitError } from "./firebase-admin.js";

export type AdminHandler = (
  req: VercelRequest,
  res: VercelResponse,
  uid: string
) => Promise<void | VercelResponse>;

export function withAdmin(handler: AdminHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Return a clear JSON error if Admin SDK failed to init (missing service account key)
    if (adminInitError) {
      return res.status(503).json({
        error: "Server configuration error",
        details: adminInitError,
        hint: "Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel → Project Settings → Environment Variables",
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: missing Bearer token" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    let decodedToken: Awaited<ReturnType<typeof auth.verifyIdToken>>;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (err: any) {
      return res.status(401).json({ error: `Invalid token: ${err.message}` });
    }

    // Fast path: env-var admin check (no DB read)
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && decodedToken.email === adminEmail) {
      return handler(req, res, decodedToken.uid);
    }

    // Fallback: Firestore role check
    try {
      const userDoc = await db.collection("users").doc(decodedToken.uid).get();
      if (userDoc.data()?.role !== "ADMIN") {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }
    } catch (err: any) {
      return res.status(500).json({ error: `DB error: ${err.message}` });
    }

    return handler(req, res, decodedToken.uid);
  };
}
