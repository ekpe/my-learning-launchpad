import type { VercelRequest, VercelResponse } from "@vercel/node";
import { auth, db } from "../_lib/firebase-admin";
import { withAdmin } from "../_lib/with-admin";
import { handleOptions } from "../_lib/cors";

export default withAdmin(async (req: VercelRequest, res: VercelResponse) => {
  if (handleOptions(req, res)) return;
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const uid = req.query.uid as string;
  if (!uid) return res.status(400).json({ error: "uid query param is required" });

  // Delete from Firebase Auth (best-effort — ignore user-not-found)
  try {
    await auth.deleteUser(uid);
    console.log(`[Admin] Deleted user ${uid} from Auth`);
  } catch (err: any) {
    if (err.code !== "auth/user-not-found") {
      console.error(`[Admin] Auth delete failed for ${uid}:`, err.message);
      // Don't abort — still delete from Firestore
    }
  }

  // Delete Firestore document
  try {
    await db.collection("users").doc(uid).delete();
    console.log(`[Admin] Deleted user ${uid} from Firestore`);
  } catch (err: any) {
    console.error(`[Admin] Firestore delete failed for ${uid}:`, err.message);
    return res.status(500).json({ error: err.message });
  }

  res.json({ success: true });
});
