/**
 * Local end-to-end harness (NOT shipped): runs the real /api/webinar handler
 * on an in-memory Firestore with Resend intercepted, so the real UI can be
 * exercised in a browser without credentials or sending any email.
 *
 *   npx tsx tests/helpers/dev-harness.ts            # API on :3100
 *   API_PROXY=http://localhost:3100 npm run dev     # Vite forwards /api to it
 *
 * Debug endpoints: GET /__debug/mail, GET /__debug/registrations
 */
import express from "express";
import { createFakeDb, installResendMock } from "./fake-firestore.ts";

process.env.FIREBASE_PROJECT_ID = "harness";
process.env.RESEND_API_KEY = "re_harness";
process.env.RESEND_FROM_EMAIL = "info@example.test";
process.env.WEBINAR_TOKEN_SECRET = "harness-secret";
process.env.SITE_URL = "http://localhost:5173";

const { default: webinar } = await import("../../api/webinar.ts");
const lib = await import("../../api/_lib/webinar.ts");

const db = createFakeDb();
lib.__setDbForTests(db);
const mail = installResendMock();

const startsAt = new Date(Date.now() + 10 * 86_400_000).toISOString();
db.seed("webinars", "leading-ai-hype-to-strategy", {
  title: "Leading in the Age of AI: From Hype to Strategy",
  subtitle: "What Every Leader Needs to Know About Generative AI, AI Agents, and the Future of Work",
  startsAt,
  timezone: "America/New_York",
  durationMinutes: 60,
  registrationStatus: "open",
  webinarStatus: "scheduled",
});
db.seed("webinarPrivate", "leading-ai-hype-to-strategy", { meetUrl: "https://meet.google.com/harness-test-link" });

const app = express();
app.use(express.json());
app.all("/api/webinar", (req, res) => webinar(req as any, res as any));
app.get("/__debug/mail", (_req, res) =>
  res.json(mail.sends().map((s) => ({ to: s.body.to, subject: s.body.subject, scheduled_at: s.body.scheduled_at, hasIcs: !!s.body.attachments?.length })))
);
app.get("/__debug/registrations", (_req, res) => res.json(db.all("webinarRegistrations")));
app.listen(3100, () => console.log(`[harness] API on http://localhost:3100  (event starts ${startsAt})`));
