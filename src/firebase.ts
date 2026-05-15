import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// All config comes from VITE_ environment variables.
// For local dev, add these to .env.local (copy from firebase-applet-config.json).
// For Vercel, set them in Project → Settings → Environment Variables.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error(
    '[firebase] Missing VITE_FIREBASE_PROJECT_ID.\n' +
    'Create a .env.local file with your VITE_FIREBASE_* variables.'
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const dbId = import.meta.env.VITE_FIRESTORE_DATABASE_ID;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
