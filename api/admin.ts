/**
 * Consolidated admin handler — all /api/admin/* routes go through here.
 * This keeps the Vercel Hobby plan under the 12-function limit.
 *
 * Routes handled:
 *   GET    /api/admin?resource=users
 *   POST   /api/admin?resource=create-user
 *   POST   /api/admin?resource=update-user-role
 *   DELETE /api/admin?resource=delete-user&uid=:uid
 *   POST   /api/admin?resource=upload
 *   POST   /api/admin?resource=sync-users
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { auth, db, FieldValue, adminInitError } from "./_lib/firebase-admin";
import { withAdmin } from "./_lib/with-admin";
import { handleOptions } from "./_lib/cors";
import { getStorage } from "firebase-admin/storage";
import { getAdminApp } from "./_lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

export const config = { api: { bodyParser: false } };

// ── Helpers ──────────────────────────────────────────────────────────────────

async function parseJsonBody(req: VercelRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function parseMultipart(req: VercelRequest): Promise<{ data: Buffer; mimeType: string; originalName: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("binary");
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (!boundaryMatch) return reject(new Error("No multipart boundary found"));

      const boundary = "--" + boundaryMatch[1];
      const parts = body.split(boundary).slice(1, -1);
      for (const part of parts) {
        const [headerSection, ...bodyParts] = part.split("\r\n\r\n");
        if (headerSection.toLowerCase().includes('name="file"')) {
          const nameMatch = headerSection.match(/filename="([^"]+)"/i);
          const ctMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
          resolve({
            data: Buffer.from(bodyParts.join("\r\n\r\n").replace(/\r\n$/, ""), "binary"),
            mimeType: ctMatch?.[1]?.trim() ?? "application/octet-stream",
            originalName: nameMatch?.[1] ?? "upload",
          });
          return;
        }
      }
      reject(new Error("No file field found in multipart body"));
    });
    req.on("error", reject);
  });
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function getUsers(req: VercelRequest, res: VercelResponse) {
  const snapshot = await db.collection("users").get();
  res.json(snapshot.docs.map((d) => ({ uid: d.id, ...d.data() })));
}

async function createUser(req: VercelRequest, res: VercelResponse) {
  const { email, password, displayName, role = "STUDENT" } = await parseJsonBody(req);
  if (!email || !password || !displayName)
    return res.status(400).json({ error: "email, password and displayName are required" });

  const allowedRoles = ["ADMIN", "INSTRUCTOR", "STUDENT"];
  if (!allowedRoles.includes(role))
    return res.status(400).json({ error: `role must be one of ${allowedRoles.join(", ")}` });

  const userRecord = await auth.createUser({ email, password, displayName });
  await db.collection("users").doc(userRecord.uid).set({
    uid: userRecord.uid, email, displayName, role,
    createdAt: FieldValue.serverTimestamp(),
  });
  res.json({ uid: userRecord.uid });
}

async function updateUserRole(req: VercelRequest, res: VercelResponse) {
  const { uid, role } = await parseJsonBody(req);
  if (!uid || !role) return res.status(400).json({ error: "uid and role are required" });
  const allowedRoles = ["ADMIN", "INSTRUCTOR", "STUDENT"];
  if (!allowedRoles.includes(role))
    return res.status(400).json({ error: `role must be one of ${allowedRoles.join(", ")}` });
  await db.collection("users").doc(uid).update({ role });
  res.json({ success: true });
}

async function deleteUser(req: VercelRequest, res: VercelResponse) {
  const uid = req.query.uid as string;
  if (!uid) return res.status(400).json({ error: "uid query param is required" });
  try { await auth.deleteUser(uid); } catch (e: any) {
    if (e.code !== "auth/user-not-found") console.error(`[admin] Auth delete failed:`, e.message);
  }
  await db.collection("users").doc(uid).delete();
  res.json({ success: true });
}

async function uploadFile(req: VercelRequest, res: VercelResponse) {
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!storageBucket) return res.status(500).json({ error: "FIREBASE_STORAGE_BUCKET not configured" });

  const { data, mimeType, originalName } = await parseMultipart(req);
  const ext = originalName.split(".").pop() ?? "bin";
  const filePath = `uploads/${Date.now()}-${uuidv4()}.${ext}`;
  const bucket = getStorage(getAdminApp()).bucket(storageBucket);
  const file = bucket.file(filePath);
  await file.save(data, { contentType: mimeType, resumable: false });
  await file.makePublic();
  res.json({ url: `https://storage.googleapis.com/${storageBucket}/${filePath}`, filename: filePath });
}

async function syncUsers(req: VercelRequest, res: VercelResponse) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  let nextPageToken: string | undefined;
  do {
    const result = await auth.listUsers(1000, nextPageToken);
    nextPageToken = result.pageToken;
    for (const user of result.users) {
      try {
        const docRef = db.collection("users").doc(user.uid);
        if ((await docRef.get()).exists()) { skipped.push(user.uid); continue; }
        await docRef.set({
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? user.email?.split("@")[0] ?? "User",
          role: adminEmail && user.email === adminEmail ? "ADMIN" : "STUDENT",
          createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : FieldValue.serverTimestamp(),
          lastLogin: user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime) : null,
          provider: user.providerData?.[0]?.providerId ?? "password",
          photoURL: user.photoURL ?? null,
        });
        created.push(user.email ?? user.uid);
      } catch (e: any) {
        errors.push(`${user.email ?? user.uid}: ${e.message}`);
      }
    }
  } while (nextPageToken);

  res.json({ success: true, created: created.length, skipped: skipped.length, errors: errors.length > 0 ? errors : undefined, createdUsers: created });
}

// ── Router ────────────────────────────────────────────────────────────────────

export default withAdmin(async (req: VercelRequest, res: VercelResponse) => {
  if (handleOptions(req, res)) return;

  if (adminInitError) {
    return res.status(503).json({
      error: "Firebase Admin not initialised",
      details: adminInitError,
      hint: "Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel environment variables.",
    });
  }

  const resource = req.query.resource as string;

  try {
    if (req.method === "GET" && resource === "users") return await getUsers(req, res);
    if (req.method === "POST" && resource === "create-user") return await createUser(req, res);
    if (req.method === "POST" && resource === "update-user-role") return await updateUserRole(req, res);
    if (req.method === "DELETE" && resource === "delete-user") return await deleteUser(req, res);
    if (req.method === "POST" && resource === "upload") return await uploadFile(req, res);
    if (req.method === "POST" && resource === "sync-users") return await syncUsers(req, res);

    return res.status(404).json({ error: `Unknown admin resource: ${resource}` });
  } catch (err: any) {
    console.error(`[admin] ${resource} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});
