import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// In development the local config JSON is used.
// In production (Vercel) the VITE_ env vars are used — the JSON is git-ignored.
const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// If none of the VITE_ vars are set, fall back to the local config JSON.
// This keeps the dev workflow unchanged (no .env.local required locally).
let localConfig: Record<string, string> = {};
try {
  // Vite resolves this at build time; in prod the file is absent and the import is tree-shaken.
  localConfig = (await import('../firebase-applet-config.json' /* @vite-ignore */)).default;
} catch {
  // Expected in production — env vars take over
}

const firebaseConfig = envConfig.apiKey ? envConfig : localConfig;

const app = initializeApp(firebaseConfig as any);
export const auth = getAuth(app);

const dbId: string | undefined =
  (localConfig as any)?.firestoreDatabaseId ||
  import.meta.env.VITE_FIRESTORE_DATABASE_ID;

export const db =
  dbId && dbId !== (firebaseConfig as any).projectId
    ? getFirestore(app, dbId)
    : getFirestore(app);
