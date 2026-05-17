import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminInitError, db, auth } from "./_lib/firebase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const report: Record<string, any> = {
    FIREBASE_SERVICE_ACCOUNT_KEY_set: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    FIRESTORE_DATABASE_ID: process.env.FIRESTORE_DATABASE_ID ?? "(not set)",
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "(not set)",
    firebase_admin_init: adminInitError ? `FAILED: ${adminInitError}` : "OK",
    db_available: !!db,
    auth_available: !!auth,
  };

  // If Admin SDK loaded, try a real Firestore read
  if (!adminInitError && db) {
    try {
      const snap = await db.collection("users").limit(1).get();
      report.firestore_read = `OK — users collection has ${snap.size} doc(s) visible`;
    } catch (e: any) {
      report.firestore_read = `FAILED: ${e.message}`;
    }

    try {
      const result = await auth.listUsers(1);
      report.auth_list_users = `OK — ${result.users.length} user(s) returned`;
    } catch (e: any) {
      report.auth_list_users = `FAILED: ${e.message}`;
    }
  }

  res.json(report);
}
