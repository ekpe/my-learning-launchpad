/**
 * READ-ONLY dry run of the flagship progress migration against the real database.
 *
 *   FIREBASE_SERVICE_ACCOUNT_KEY='<service account JSON on one line>' npm run migration:dry-run
 *
 * It only ever runs the "dry-run" mode (which writes nothing; this is covered by tests). It cannot apply or revert:
 * those are admin-UI operations that need a typed confirmation. Needs a service-account key; without one it stops.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
if (!process.env.FIRESTORE_DATABASE_ID && process.env.VITE_FIRESTORE_DATABASE_ID) {
  process.env.FIRESTORE_DATABASE_ID = process.env.VITE_FIRESTORE_DATABASE_ID;
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error(
    "No FIREBASE_SERVICE_ACCOUNT_KEY in the environment, so this cannot read production data.\n" +
      "Set it for this one command (Firebase Console > Project settings > Service accounts), or run the dry run\n" +
      "from Admin > Courses > Launch readiness > Enrolled learners once the code is deployed.",
  );
  process.exit(2);
}

const { db, adminInitError } = await import("../api/_lib/firebase-admin.ts");
if (adminInitError || !db) {
  console.error(`Firebase Admin failed to initialise: ${adminInitError}`);
  process.exit(2);
}
const { migrateFlagshipProgress } = await import("../api/_lib/course-admin.ts");

const out = await migrateFlagshipProgress(db, { mode: "dry-run" }, () => new Date());
console.log(JSON.stringify(out.body, null, 2));
process.exit(out.status === 200 ? 0 : 1);
