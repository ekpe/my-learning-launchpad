/**
 * Shared Firebase Admin initialisation.
 * Vercel may reuse the Node.js process across invocations, so we guard
 * against double-initialisation with getApps().
 */
import { initializeApp, getApps, getApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export function getAdminApp(): App {
  if (getApps().length > 0) return getApp();

  // Prefer a service-account JSON stored as an env var (recommended for Vercel).
  // Fall back to Application Default Credentials (works locally with `firebase login`).
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    return initializeApp({ credential: cert(serviceAccount) });
  }

  // ADC / emulator / Cloud Run
  return initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const app = getAdminApp();

const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID;
export const db = firestoreDatabaseId
  ? getFirestore(app, firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);
export { FieldValue };
