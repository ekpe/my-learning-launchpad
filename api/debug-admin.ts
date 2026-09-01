import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withAdmin } from "./_lib/with-admin";
import { handleOptions } from "./_lib/cors";

// Diagnostic report for Firebase Admin setup. Gated behind withAdmin so it
// isn't public — it discloses the service account's project id/client email
// and performs live Firestore/Auth calls. Token verification only needs the
// project id (not a working service account), so this stays reachable for a
// real admin even while diagnosing a broken FIREBASE_SERVICE_ACCOUNT_KEY.
export default withAdmin(async (req: VercelRequest, res: VercelResponse) => {
  if (handleOptions(req, res)) return;

  const report: Record<string, any> = {
    node_version: process.version,
    FIRESTORE_DATABASE_ID: process.env.FIRESTORE_DATABASE_ID ?? "(not set)",
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "(not set)",
    FIREBASE_SERVICE_ACCOUNT_KEY_set: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    FIREBASE_SERVICE_ACCOUNT_KEY_length: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length ?? 0,
  };

  // Step 2: try parsing the key
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (key) {
    try {
      const parsed = JSON.parse(key);
      report.key_parse = "OK";
      report.key_project_id = parsed.project_id;
      report.key_client_email = parsed.client_email;
    } catch (e: any) {
      report.key_parse = `FAILED: ${e.message}`;
    }
  }

  // Step 3: try importing firebase-admin
  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    report.firebase_admin_import = "OK";

    // Step 4: try initialising
    try {
      const parsed = JSON.parse(key!);
      const app = getApps().length
        ? getApps()[0]
        : initializeApp({ credential: cert(parsed) });
      report.firebase_admin_init = "OK";

      // Step 5: try a Firestore read
      try {
        const { getFirestore } = await import("firebase-admin/firestore");
        const dbId = process.env.FIRESTORE_DATABASE_ID;
        const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
        const snap = await db.collection("users").limit(1).get();
        report.firestore_read = `OK — ${snap.size} doc(s)`;
      } catch (e: any) {
        report.firestore_read = `FAILED: ${e.message}`;
      }

      // Step 6: try Auth
      try {
        const { getAuth } = await import("firebase-admin/auth");
        const result = await getAuth(app).listUsers(1);
        report.auth_list_users = `OK — ${result.users.length} user(s)`;
      } catch (e: any) {
        report.auth_list_users = `FAILED: ${e.message}`;
      }

    } catch (e: any) {
      report.firebase_admin_init = `FAILED: ${e.message}`;
    }
  } catch (e: any) {
    report.firebase_admin_import = `FAILED: ${e.message}`;
  }

  res.json(report);
});
