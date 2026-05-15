import { initializeApp, getApps, getApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export function getAdminApp(): App {
  if (getApps().length > 0) return getApp();

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return initializeApp({ credential: cert(serviceAccount) });
    } catch (e: any) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_KEY is set but could not be parsed as JSON: ${e.message}. ` +
        `Make sure the value in Vercel is the full service account JSON on a single line.`
      );
    }
  }

  // Fallback: project ID only (works for Firestore reads with open rules, not Auth admin ops)
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error(
      "Firebase Admin SDK not configured. " +
      "Set FIREBASE_SERVICE_ACCOUNT_KEY in your Vercel environment variables. " +
      "Get it from Firebase Console → Project Settings → Service Accounts → Generate new private key."
    );
  }

  console.warn(
    "[firebase-admin] No FIREBASE_SERVICE_ACCOUNT_KEY found — falling back to project ID only. " +
    "Auth admin operations (createUser, verifyIdToken) will fail."
  );
  return initializeApp({ projectId });
}

export let db: ReturnType<typeof getFirestore>;
export let auth: ReturnType<typeof getAuth>;
export let adminInitError: string | null = null;

try {
  const app = getAdminApp();
  const dbId = process.env.FIRESTORE_DATABASE_ID;
  db = dbId ? getFirestore(app, dbId) : getFirestore(app);
  auth = getAuth(app);
} catch (e: any) {
  adminInitError = e.message;
  console.error("[firebase-admin] Initialization failed:", e.message);
  // Assign dummies so imports don't crash — handlers must check adminInitError
  db = null as any;
  auth = null as any;
}

export { FieldValue };
