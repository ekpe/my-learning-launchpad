import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createFakeDb, installResendMock, mockReq, mockRes, type FakeDb } from "./helpers/fake-firestore.ts";

// Environment must be in place before the API modules load.
process.env.FIREBASE_PROJECT_ID = "test-project";
process.env.RESEND_API_KEY = "re_test_key";
process.env.RESEND_FROM_EMAIL = "info@example.test";
process.env.WEBINAR_TOKEN_SECRET = "test-secret";
process.env.WEBINAR_PACE_MS = "0";
process.env.SITE_URL = "https://www.mylearninglaunchpad.com";

const { default: handler } = await import("../api/webinar.ts");
const lib = await import("../api/_lib/webinar.ts");
const admin = await import("../api/_lib/webinar-admin.ts");

const EVENT = "test-event";
const MEET = "https://meet.google.com/abc-defg-hij";
const DAY = 86_400_000;

let db: FakeDb;
let mail: ReturnType<typeof installResendMock>;
let startsAt: string;

function seedEvent(over: Record<string, unknown> = {}) {
  startsAt = new Date(Date.now() + 10 * DAY).toISOString();
  db.seed("webinars", EVENT, {
    title: "Leading in the Age of AI: From Hype to Strategy",
    subtitle: "Test subtitle",
    startsAt,
    timezone: "America/New_York",
    durationMinutes: 60,
    registrationStatus: "open",
    webinarStatus: "scheduled",
    capacity: null,
    ...over,
  });
  db.seed("webinarPrivate", EVENT, { meetUrl: MEET });
}

beforeEach(() => {
  db = createFakeDb();
  lib.__setDbForTests(db);
  mail = installResendMock();
  seedEvent();
  process.env.RESEND_API_KEY = "re_test_key";
});
afterEach(() => mail.restore());

function body(over: Record<string, unknown> = {}) {
  return {
    eventId: EVENT,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    organization: "Analytical Engines",
    sector: "University / Academia",
    country: "UK",
    marketingOptIn: false,
    formStartedAt: Date.now() - 10_000,
    website: "",
    attribution: { utm_source: "linkedin", utm_medium: "paid-social", utm_campaign: "fall-launch", landingUrl: "https://www.mylearninglaunchpad.com/webinar" },
    ...over,
  };
}

async function register(b: Record<string, unknown> = body(), headers?: Record<string, string>) {
  const res = mockRes();
  await handler(mockReq({ method: "POST", query: { action: "register" }, body: b, headers }), res);
  return res;
}

const registrations = () => db.all("webinarRegistrations");

// ── Rejections ───────────────────────────────────────────────────────────────

test("invalid input is rejected server-side with per-field errors and nothing is stored", async () => {
  const res = await register(body({ email: "not-an-email", firstName: "" }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "validation");
  assert.ok(res.body.fields.email && res.body.fields.firstName);
  assert.equal(registrations().length, 0);
  assert.equal(mail.sends().length, 0);
});

test("honeypot submissions look successful to bots but store and send nothing", async () => {
  const res = await register(body({ website: "http://spam.example" }));
  assert.equal(res.statusCode, 200);
  assert.equal(registrations().length, 0);
  assert.equal(mail.sends().length, 0);
});

test("submissions faster than a human could fill the form are refused", async () => {
  const res = await register(body({ formStartedAt: Date.now() - 100 }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "too_fast");
  assert.equal(registrations().length, 0);
});

test("unknown event -> 404; malformed event id -> 400", async () => {
  assert.equal((await register(body({ eventId: "nope" }))).statusCode, 404);
  assert.equal((await register(body({ eventId: "../etc" }))).statusCode, 400);
});

test("closed registration is refused and nothing is stored", async () => {
  seedEvent({ registrationStatus: "closed" });
  const res = await register();
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "closed");
  assert.equal(registrations().length, 0);
});

test("completed and cancelled webinars refuse registration", async () => {
  for (const webinarStatus of ["completed", "cancelled"]) {
    seedEvent({ webinarStatus });
    assert.equal((await register()).statusCode, 409, webinarStatus);
  }
});

test("a real capacity limit is enforced", async () => {
  seedEvent({ capacity: 1 });
  assert.equal((await register(body({ email: "one@example.com" }))).statusCode, 200);
  const second = await register(body({ email: "two@example.com" }));
  assert.equal(second.statusCode, 409);
  assert.equal(second.body.code, "full");
  assert.equal(registrations().length, 1);
});

test("registration attempts are rate limited per IP", async () => {
  let last = 200;
  for (let i = 0; i < 11; i++) last = (await register(body({ email: `u${i}@example.com` }))).statusCode;
  assert.equal(last, 429);
  assert.equal(registrations().length, 10);
});

// ── Successful registration ──────────────────────────────────────────────────

test("successful registration stores consent, event id and attribution", async () => {
  const res = await register();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.mode, "registration");
  assert.equal(res.body.emailStatus, "sent");

  const [r] = registrations();
  assert.equal(r.eventId, EVENT);
  assert.equal(r.email, "ada@example.com");
  assert.equal(r.type, "registration");
  assert.equal(r.marketingOptIn, false, "marketing consent must default to false");
  assert.equal(r.consent.marketing, false);
  assert.equal(r.consent.textVersion, "webinar-v1");
  assert.ok(r.consent.eventLogisticsAt.toDate() instanceof Date);
  assert.equal(r.attribution.utm_source, "linkedin");
  assert.equal(r.attribution.utm_campaign, "fall-launch");
  assert.equal(r.attended, false);
});

test("explicit marketing opt-in is recorded with a timestamp", async () => {
  await register(body({ marketingOptIn: true }));
  const [r] = registrations();
  assert.equal(r.marketingOptIn, true);
  assert.ok(r.consent.marketingAt.toDate() instanceof Date);
});

test("the public response and stored public config never contain the Meet link", async () => {
  const res = await register();
  assert.ok(!JSON.stringify(res.body).includes("meet.google.com"));
  assert.ok(!JSON.stringify(db.raw("webinars", EVENT)).includes("meet.google.com"));
});

test("confirmation email: recipient, joining link, calendar link and .ics attachment", async () => {
  await register();
  const [confirmation] = mail.sends();
  assert.equal(confirmation.body.to, "ada@example.com");
  assert.match(confirmation.body.subject, /You're registered/);
  assert.equal(confirmation.body.scheduled_at, undefined, "confirmation is sent immediately");
  assert.ok(confirmation.body.text.includes(MEET), "plain text carries the Meet link");
  assert.ok(confirmation.body.html.includes(MEET), "html carries the Meet link");
  assert.ok(confirmation.body.html.includes("Ada"));
  assert.ok(confirmation.body.text.includes("calendar.google.com/calendar/render"));
  assert.ok(confirmation.body.text.includes("info@mylearninglaunchpad.com"), "contact info for assistance");
  assert.match(confirmation.body.text, /E[SD]T/, "event time is shown with its time zone");

  const att = confirmation.body.attachments[0];
  assert.equal(att.filename, "webinar.ics");
  const ics = Buffer.from(att.content, "base64").toString("utf8");
  assert.match(ics, /BEGIN:VCALENDAR/);
  const dt = startsAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  assert.ok(ics.includes(`DTSTART:${dt}`), "ICS start equals the configured UTC instant");
  assert.ok(ics.replace(/\r\n /g, "").includes(MEET));
});

test("24h and 1h reminders are scheduled at the right instants and recorded", async () => {
  await register();
  const sends = mail.sends();
  assert.equal(sends.length, 3);
  const start = new Date(startsAt).getTime();
  const [, r24, r1] = sends;
  assert.equal(new Date(r24.body.scheduled_at).getTime(), start - 24 * 3_600_000);
  assert.equal(new Date(r1.body.scheduled_at).getTime(), start - 3_600_000);
  assert.match(r24.body.subject, /Tomorrow/);
  assert.match(r1.body.subject, /Starting soon/);
  assert.ok(r24.body.text.includes(MEET) && r1.body.text.includes(MEET));

  const [reg] = registrations();
  assert.equal(reg.delivery.confirmation.status, "sent");
  assert.equal(reg.delivery.reminder24.status, "scheduled");
  assert.equal(reg.delivery.reminder1.status, "scheduled");
  assert.ok(reg.delivery.reminder24.id);
});

test("reminders whose send time has already passed are skipped, not sent late", async () => {
  seedEvent({ startsAt: new Date(Date.now() + 30 * 60_000).toISOString() });
  await register();
  assert.equal(mail.sends().length, 1, "only the confirmation");
  const [reg] = registrations();
  assert.equal(reg.delivery.reminder24.status, "skipped");
  assert.equal(reg.delivery.reminder1.status, "skipped");
});

test("attendee-supplied names are HTML-escaped in emails", async () => {
  await register(body({ firstName: `<script>alert(1)</script>` }));
  const [c] = mail.sends();
  assert.ok(!c.body.html.includes("<script>alert(1)</script>"));
  assert.ok(c.body.html.includes("&lt;script&gt;"));
});

// ── Waitlist / interest mode ─────────────────────────────────────────────────

test("without a configured date the form is an honest waitlist: no date, no ICS, no reminders", async () => {
  seedEvent({ startsAt: null, registrationStatus: "waitlist" });
  const res = await register();
  assert.equal(res.body.mode, "interest");
  const [r] = registrations();
  assert.equal(r.type, "interest");
  const sends = mail.sends();
  assert.equal(sends.length, 1);
  assert.match(sends[0].body.subject, /on the list/i);
  assert.equal(sends[0].body.attachments, undefined);
  assert.ok(!sends[0].body.text.includes(MEET));
});

// ── Duplicates ───────────────────────────────────────────────────────────────

test("duplicate registration is safe: one record, same response shape, no extra reminders", async () => {
  const first = await register();
  const second = await register(body({ firstName: "Different" }));
  assert.equal(registrations().length, 1);
  assert.deepEqual(Object.keys(second.body).sort(), Object.keys(first.body).sort());
  assert.equal(second.body.ref, first.body.ref);
  assert.equal(registrations()[0].firstName, "Ada", "original details are not overwritten");
  assert.equal(mail.sends().length, 3, "no second confirmation inside the cool-down, and no duplicate reminders");
});

test("duplicate email address with different casing/whitespace is still a duplicate", async () => {
  await register();
  await register(body({ email: "  ADA@Example.com " }));
  assert.equal(registrations().length, 1);
});

test("a lost confirmation can be re-sent after the cool-down, without re-scheduling reminders", async () => {
  await register();
  const id = registrations()[0].id;
  db.patch("webinarRegistrations", id, { lastConfirmationAtMs: Date.now() - 2 * 3_600_000 });
  await register();
  const sends = mail.sends();
  assert.equal(sends.length, 4);
  assert.match(sends[3].body.subject, /You're registered/);
  assert.equal(sends[3].body.scheduled_at, undefined);
});

test("opting in on a repeat submission upgrades consent but opting out never silently downgrades it", async () => {
  await register();
  await register(body({ marketingOptIn: true }));
  assert.equal(registrations()[0].marketingOptIn, true);
  await register(body({ marketingOptIn: false }));
  assert.equal(registrations()[0].marketingOptIn, true);
});

// ── Honest failure reporting ─────────────────────────────────────────────────

test("when email isn't configured the registration is saved and the response says so", async () => {
  delete process.env.RESEND_API_KEY;
  const res = await register();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.emailStatus, "not_configured");
  assert.equal(registrations()[0].delivery.confirmation.status, "not_configured");
  assert.equal(mail.sends().length, 0);
});

test("when Resend rejects the send, the registration is kept, the failure is reported, and no reminders are scheduled", async () => {
  mail.restore();
  mail = installResendMock(() =>
    new Response(JSON.stringify({ name: "validation_error", message: "The from domain is not verified", statusCode: 403 }), {
      status: 403,
      headers: { "content-type": "application/json" },
    })
  );
  const res = await register();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.emailStatus, "failed");
  assert.equal(registrations().length, 1);
  assert.equal(registrations()[0].delivery.confirmation.status, "failed");
  assert.match(registrations()[0].delivery.confirmation.error, /not verified/);
  assert.equal(mail.sends().length, 1);
});

// ── Unsubscribe ──────────────────────────────────────────────────────────────

test("unsubscribe link withdraws promotional consent; forged or mismatched tokens are rejected", async () => {
  await register(body({ marketingOptIn: true }));
  const id = registrations()[0].id;

  const bad = mockRes();
  await handler(mockReq({ query: { action: "unsubscribe", id, t: "forged" } }), bad);
  assert.equal(bad.statusCode, 400);
  assert.equal(registrations()[0].marketingOptIn, true);

  const otherToken = lib.signToken("f".repeat(32))!;
  const mismatch = mockRes();
  await handler(mockReq({ query: { action: "unsubscribe", id, t: otherToken } }), mismatch);
  assert.equal(mismatch.statusCode, 400);

  const ok = mockRes();
  await handler(mockReq({ query: { action: "unsubscribe", id, t: lib.signToken(id)! } }), ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(registrations()[0].marketingOptIn, false);
  assert.equal(registrations()[0].consent.marketing, false);
  assert.ok(registrations()[0].consent.marketingWithdrawnAt);
});

// ── Admin operations ─────────────────────────────────────────────────────────

test("saving an event validates it and refuses to open registration without a date", async () => {
  const base = { timezone: "UTC", durationMinutes: 60, registrationStatus: "open", webinarStatus: "scheduled" };
  assert.equal((await admin.saveWebinar({ eventId: EVENT, public: { ...base, startsAt: null }, private: {} })).status, 400);
  assert.equal((await admin.saveWebinar({ eventId: EVENT, public: { ...base, startsAt: startsAt, timezone: "Mars/Base" }, private: {} })).status, 400);
  assert.equal((await admin.saveWebinar({ eventId: EVENT, public: { ...base, startsAt }, private: { meetUrl: "http://insecure.example" } })).status, 400);
  const ok = await admin.saveWebinar({ eventId: EVENT, public: { ...base, startsAt, title: "T" }, private: { meetUrl: MEET } });
  assert.equal(ok.status, 200);
  assert.equal(db.raw("webinarPrivate", EVENT)!.meetUrl, MEET);
  assert.equal(db.raw("webinars", EVENT)!.platform, "Google Meet");
  assert.ok(!("meetUrl" in db.raw("webinars", EVENT)!), "the Meet link is stored only in the private document");
});

test("rescheduling cancels old reminders and schedules new ones for the new time", async () => {
  await register();
  mail.calls.length = 0;
  const newStart = new Date(Date.now() + 20 * DAY).toISOString();
  db.patch("webinars", EVENT, { startsAt: newStart });
  const out = await admin.rescheduleReminders({ eventId: EVENT });
  assert.equal(out.status, 200);
  assert.equal(out.body.processed, 1);
  assert.equal(out.body.nextCursor, null);
  assert.equal(mail.cancels().length, 2);
  const sends = mail.sends();
  assert.equal(sends.length, 2);
  assert.equal(new Date(sends[0].body.scheduled_at).getTime(), new Date(newStart).getTime() - 24 * 3_600_000);
  const [reg] = registrations();
  assert.equal(reg.delivery.reminder24.status, "scheduled");
  assert.equal(reg.delivery.reminder24.scheduledAt, new Date(new Date(newStart).getTime() - 24 * 3_600_000).toISOString());
});

test("setting a date upgrades waitlist sign-ups to registrations and schedules their reminders", async () => {
  seedEvent({ startsAt: null, registrationStatus: "waitlist" });
  await register();
  assert.equal(registrations()[0].type, "interest");
  seedEvent();
  mail.calls.length = 0;
  await admin.rescheduleReminders({ eventId: EVENT });
  assert.equal(registrations()[0].type, "registration");
  assert.equal(mail.sends().length, 2);
});

test("promotional broadcasts reach only opted-in people; a dry run sends nothing", async () => {
  await register(body({ email: "yes@example.com", marketingOptIn: true }));
  await register(body({ email: "no@example.com", marketingOptIn: false }));
  mail.calls.length = 0;

  const dry = await admin.broadcast({ eventId: EVENT, template: "followup-pathways" });
  assert.equal(dry.body.dryRun, true);
  assert.equal(dry.body.recipients, 1);
  assert.equal(mail.sends().length, 0);

  const refused = await admin.broadcast({ eventId: EVENT, template: "followup-pathways", dryRun: false });
  assert.equal(refused.status, 400, "sending requires explicit confirmation");
  assert.equal(mail.sends().length, 0);

  const sent = await admin.broadcast({ eventId: EVENT, template: "followup-pathways", dryRun: false, confirm: true });
  assert.equal(sent.body.sent, 1);
  const [mailOut] = mail.sends();
  assert.equal(mailOut.body.to, "yes@example.com");
  assert.ok(mailOut.body.html.includes("api/webinar?action=unsubscribe"), "promotional mail carries an unsubscribe link");
  assert.ok(mailOut.body.text.includes("utm_campaign=test-event"), "course links keep webinar attribution");

  const again = await admin.broadcast({ eventId: EVENT, template: "followup-pathways", dryRun: false, confirm: true });
  assert.equal(again.body.sent, 0, "re-running never double-sends");
});

test("the post-webinar thank-you only includes the course invitation for opted-in people", async () => {
  await register(body({ email: "yes@example.com", marketingOptIn: true }));
  await register(body({ email: "no@example.com", marketingOptIn: false }));
  mail.calls.length = 0;
  await admin.broadcast({ eventId: EVENT, template: "followup-thanks", dryRun: false, confirm: true, recap: ["A takeaway"] });
  const byTo = Object.fromEntries(mail.sends().map((s) => [s.body.to, s.body]));
  assert.ok(byTo["yes@example.com"].html.includes("Enroll in the Free AI Strategy for Leaders Course"));
  assert.ok(!byTo["no@example.com"].html.includes("Enroll in the Free"));
  assert.ok(byTo["no@example.com"].html.includes("A takeaway"));
});

test("attendance is only recorded for people the admin lists, never inferred", async () => {
  await register(body({ email: "here@example.com" }));
  await register(body({ email: "absent@example.com" }));
  const out = await admin.markAttended({ eventId: EVENT, emails: ["HERE@example.com", "stranger@example.com"] });
  assert.equal(out.body.matched, 1);
  assert.equal(out.body.unmatchedCount, 1);
  const byEmail = Object.fromEntries(registrations().map((r) => [r.email, r.attended]));
  assert.deepEqual(byEmail, { "here@example.com": true, "absent@example.com": false });
});

test("admin view returns registrants, including delivery state, and keeps the Meet link separate", async () => {
  await register();
  const out = await admin.getWebinar({ eventId: EVENT });
  assert.equal((out.body.registrations as any[]).length, 1);
  assert.equal((out.body.registrations as any[])[0].delivery.confirmation.status, "sent");
  assert.equal((out.body.private as any).meetUrl, MEET);
  assert.ok(!("meetUrl" in (out.body.public as any)));
});
