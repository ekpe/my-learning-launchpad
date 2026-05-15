import type { VercelRequest, VercelResponse } from "@vercel/node";
import { auth, db, FieldValue, adminInitError } from "../_lib/firebase-admin";
import { withAdmin } from "../_lib/with-admin";
import { handleOptions } from "../_lib/cors";

export default withAdmin(async (req: VercelRequest, res: VercelResponse) => {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (adminInitError) {
    return res.status(503).json({ error: "Firebase Admin not initialised", details: adminInitError });
  }

  const adminEmail = process.env.ADMIN_EMAIL || "";
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  try {
    // List all Firebase Auth users (handles pagination)
    let nextPageToken: string | undefined;
    do {
      const result = await auth.listUsers(1000, nextPageToken);
      nextPageToken = result.pageToken;

      for (const user of result.users) {
        try {
          const docRef = db.collection("users").doc(user.uid);
          const existing = await docRef.get();

          if (existing.exists()) {
            skipped.push(user.uid);
            continue;
          }

          const role = adminEmail && user.email === adminEmail ? "ADMIN" : "STUDENT";

          await docRef.set({
            uid: user.uid,
            email: user.email ?? "",
            displayName: user.displayName ?? user.email?.split("@")[0] ?? "User",
            role,
            createdAt: user.metadata.creationTime
              ? new Date(user.metadata.creationTime)
              : FieldValue.serverTimestamp(),
            lastLogin: user.metadata.lastSignInTime
              ? new Date(user.metadata.lastSignInTime)
              : null,
            provider: user.providerData?.[0]?.providerId ?? "password",
            photoURL: user.photoURL ?? null,
          });

          created.push(user.email ?? user.uid);
        } catch (err: any) {
          console.error(`[sync-users] Failed for ${user.uid}:`, err.message);
          errors.push(`${user.email ?? user.uid}: ${err.message}`);
        }
      }
    } while (nextPageToken);

    console.log(`[sync-users] created=${created.length} skipped=${skipped.length} errors=${errors.length}`);

    res.json({
      success: true,
      created: created.length,
      skipped: skipped.length,
      errors: errors.length > 0 ? errors : undefined,
      createdUsers: created,
    });
  } catch (err: any) {
    console.error("[sync-users] Fatal error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
