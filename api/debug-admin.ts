/**
 * Temporary debug endpoint — remove before going live.
 * Hit /api/debug-admin to diagnose Firebase Admin init issues.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  const report: Record<string, any> = {
    FIREBASE_SERVICE_ACCOUNT_KEY_set: !!key,
    FIREBASE_SERVICE_ACCOUNT_KEY_length: key?.length ?? 0,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? "(not set)",
    VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID ?? "(not set)",
    FIRESTORE_DATABASE_ID: process.env.FIRESTORE_DATABASE_ID ?? "(not set)",
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "(not set)",
    NODE_VERSION: process.version,
  };

  if (key) {
    // Check for common problems
    report.key_starts_with = key.slice(0, 20);
    report.key_ends_with = key.slice(-20);
    report.has_literal_newlines = key.includes('\n') && !key.includes('\\n');
    report.has_escaped_newlines = key.includes('\\n');
    
    try {
      const parsed = JSON.parse(key);
      report.json_parse = "OK";
      report.parsed_type = parsed.type;
      report.parsed_project_id = parsed.project_id;
      report.parsed_client_email = parsed.client_email;
      report.has_private_key = !!parsed.private_key;
      report.private_key_starts = parsed.private_key?.slice(0, 30);
    } catch (e: any) {
      report.json_parse = `FAILED: ${e.message}`;
      // Try to find where parsing fails
      try {
        // Check if it has literal newlines that break JSON
        const fixed = key.replace(/\n/g, '\\n');
        JSON.parse(fixed);
        report.fix_suggestion = "Key has literal newlines — replace them with \\n before pasting into Vercel";
      } catch {
        report.fix_suggestion = "Key is not valid JSON even after newline fix — repaste from the downloaded .json file";
      }
    }
  }

  // Try to init Firebase Admin and report result
  try {
    const { adminInitError, db } = require("./_lib/firebase-admin");
    report.firebase_admin_init = adminInitError ? `FAILED: ${adminInitError}` : "OK";
    report.db_available = !!db;
  } catch (e: any) {
    report.firebase_admin_init = `IMPORT CRASHED: ${e.message}`;
  }

  res.json(report);
}
