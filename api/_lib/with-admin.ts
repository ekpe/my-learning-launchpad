import type { VercelRequest, VercelResponse } from "@vercel/node";
import { auth, db } from "./firebase-admin";

export type AdminHandler = (
  req: VercelRequest,
  res: VercelResponse,
  uid: string
) => Promise<void>;

/**
 * Wraps a handler, verifying the Bearer token and checking for ADMIN role.
 * Usage: export default withAdmin(async (req, res, uid) => { ... })
 */
export function withAdmin(handler: AdminHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
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

    // Primary admin via env var (no DB read required — fast path)
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && decodedToken.email === adminEmail) {
      return handler(req, res, decodedToken.uid);
    }

    // Fallback: check Firestore role
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
