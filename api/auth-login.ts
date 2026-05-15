import type { VercelRequest, VercelResponse } from "@vercel/node";
import { auth } from "./_lib/firebase-admin";
import { handleOptions } from "./_lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  // Firebase REST Identity Toolkit — the only way to verify a password server-side
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FIREBASE_WEB_API_KEY not configured" });
  }

  try {
    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    const data: any = await signInRes.json();

    if (!signInRes.ok) {
      return res.status(signInRes.status).json({ error: data.error?.message || "Login failed" });
    }

    // Issue a custom token so the client can call signInWithCustomToken
    const customToken = await auth.createCustomToken(data.localId);
    res.json({ customToken, uid: data.localId });
  } catch (err: any) {
    console.error("[Auth] login error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
