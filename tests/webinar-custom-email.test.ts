import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createFakeDb, installResendMock, mockReq, mockRes, type FakeDb } from "./helpers/fake-firestore.ts";

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
const SHEET = "https://docs.google.com/document/d/abc123/copy";
const DAY = 86_400_000;

let db: FakeDb;
let mail: ReturnType<typeof installResendMock>;

function seedEvent(over: Record<string, unknown> = {}, priv: Record<string, unknown> = { meetUrl: MEET }) {
  db.seed("webinars", EVENT, {
    title: "Leading in the Age of AI: From Hype to Strategy",
    subtitle: "Test subtitle",
    startsAt: new Date(Date.now() + 10 * DAY).toISOString(),
    timezone: "America/New_York",
    durationMinutes: 60,
    registrationStatus: "open",
    webinarStatus: "scheduled",
    capacity: null,
    ...over,
  });
  db.seed("webinarPrivate", EVENT, priv);
}

beforeEach(() => {
  db = createFakeDb();
  lib.__setDbForTests(db);
  mail = installResendMock();
  seedEvent();
  process.env.WEBINAR_TOKEN_SECRET = "test-secret";
});
afterEach(() => mail.restore());

const body = (over: Record<string, unknown> = {}) => ({
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
  attribution: {},
  ...over,
});
async function register(b: Record<string, unknown> = body()) {
  const res = mockRes();
  await handler(mockReq({ method: "POST", query: { action: "register" }, body: b }), res);
  return res;
}
const regs = () => db.all("webinarRegistrations");

// ── worksheet link ───────────────────────────────────────────────────────────

test("worksheet link is saved privately, validated, and never put in the public document", async () => {
  const base = { title: "T", timezone: "America/New_York", durationMinutes: 60, registrationStatus: "open", webinarStatus: "scheduled", startsAt: new Date(Date.now() + DAY).toISOString() };
  assert.equal((await admin.saveWebinar({ eventId: EVENT, public: base, private: { worksheetUrl: "http://insecure.example/x" } })).status, 400);
  assert.equal((await admin.saveWebinar({ eventId: EVENT, public: base, private: { worksheetUrl: "not a url" } })).status, 400);
  const ok = await admin.saveWebinar({ eventId: EVENT, public: base, private: { meetUrl: MEET, worksheetUrl: SHEET } });
  assert.equal(ok.status, 200);
  assert.equal(db.raw("webinarPrivate", EVENT)!.worksheetUrl, SHEET);
  assert.ok(!("worksheetUrl" in db.raw("webinars", EVENT)!), "not in the public document");
  const got = await admin.getWebinar({ eventId: EVENT });
  assert.equal((got.body.private as any).worksheetUrl, SHEET);
});

test("with a worksheet set, the confirmation and both reminders carry it; without one, nothing changes", async () => {
  await register(body({ email: "plain@example.com" }));
  const plain = mail.sends().map((s) => s.body.html + s.body.text).join("");
  assert.ok(!plain.includes("worksheet"), "no worksheet text when none is configured");

  mail.calls.length = 0;
  seedEvent({}, { meetUrl: MEET, worksheetUrl: SHEET });
  await register(body({ email: "with@example.com" }));
  const sends = mail.sends().filter((s) => s.body.to === "with@example.com");
  assert.equal(sends.length, 3, "confirmation + 24h + 1h");
  for (const s of sends) {
    assert.ok(s.body.html.includes(SHEET), `${s.body.subject} has the worksheet link`);
    assert.ok(s.body.text.includes(SHEET), `${s.body.subject} (text) has the worksheet link`);
    assert.ok(s.body.html.includes("Open the worksheet"));
  }
});

test("rescheduling re-renders queued reminders, so people who registered earlier get the worksheet too", async () => {
  await register(body({ email: "early@example.com" }));
  seedEvent({}, { meetUrl: MEET, worksheetUrl: SHEET });
  mail.calls.length = 0;
  await admin.rescheduleReminders({ eventId: EVENT });
  const sends = mail.sends();
  assert.equal(sends.length, 2);
  assert.ok(sends.every((s) => s.body.html.includes(SHEET)));
});

test("the 'Updated details' and 'What we'll cover' messages include the worksheet", async () => {
  seedEvent({}, { meetUrl: MEET, worksheetUrl: SHEET });
  await register();
  mail.calls.length = 0;
  for (const template of ["update", "preview"]) await admin.broadcast({ eventId: EVENT, template, dryRun: false, confirm: true });
  assert.equal(mail.sends().length, 2);
  assert.ok(mail.sends().every((s) => s.body.html.includes(SHEET) && s.body.html.includes(MEET)));
});

// ── custom message ───────────────────────────────────────────────────────────

const msg = (over: Record<string, unknown> = {}) => ({ eventId: EVENT, subject: "A quick question before Saturday", message: "What is your biggest question?\n\nReply with A, B or C.", ...over });

test("custom message: input is validated", async () => {
  const bad = async (over: Record<string, unknown>) => (await admin.sendCustom(msg(over))).status;
  assert.equal(await bad({ subject: "  " }), 400);
  assert.equal(await bad({ subject: "x".repeat(121) }), 400);
  assert.equal(await bad({ message: "" }), 400);
  assert.equal(await bad({ message: "x".repeat(5001) }), 400);
  assert.equal(await bad({ buttonLabel: "Take the poll" }), 400, "a button needs a link");
  assert.equal(await bad({ buttonUrl: "https://forms.gle/abc" }), 400, "a link needs button text");
  assert.equal(await bad({ buttonLabel: "Go", buttonUrl: "http://insecure.example" }), 400);
  assert.equal(await bad({ buttonLabel: "Go", buttonUrl: "javascript:alert(1)" }), 400);
  assert.equal(await bad({ includeDetails: true, test: true, testTo: "me@example.com", buttonLabel: "Go", buttonUrl: "https://forms.gle/abc" }), 200);
  assert.equal((await admin.sendCustom({ ...msg(), eventId: "Bad ID!" })).status, 400);
  assert.equal((await admin.sendCustom({ ...msg(), eventId: "no-such-event" })).status, 404);
  db.seed("webinars", "dateless", { title: "T", startsAt: null, registrationStatus: "waitlist", webinarStatus: "scheduled", timezone: "UTC" });
  assert.equal((await admin.sendCustom({ ...msg(), eventId: "dateless", includeDetails: true })).status, 400, "no details to include without a date");
});

test("custom message: a test send goes to one address, is labelled, and records nothing", async () => {
  await register();
  mail.calls.length = 0;
  assert.equal((await admin.sendCustom(msg({ test: true, testTo: "not-an-email" }))).status, 400);
  const out = await admin.sendCustom(msg({ test: true, testTo: "Me@Example.com " }));
  assert.equal(out.status, 200);
  const sends = mail.sends();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].body.to, "me@example.com");
  assert.match(sends[0].body.subject, /^\[TEST\] A quick question/);
  assert.equal(regs()[0].delivery.broadcast_custom, undefined);
  assert.ok(!Object.keys(regs()[0].delivery).some((k) => k.startsWith("broadcast_custom")), "no delivery state recorded for a test");
});

test("custom message: a dry run counts the right people and sends nothing", async () => {
  await register(body({ email: "reg1@example.com", marketingOptIn: true }));
  await register(body({ email: "reg2@example.com", marketingOptIn: false }));
  seedEvent({ startsAt: null, registrationStatus: "waitlist" });
  await register(body({ email: "wait@example.com" }));
  seedEvent();
  mail.calls.length = 0;

  const base = await admin.sendCustom(msg());
  assert.equal(base.body.dryRun, true);
  assert.equal(base.body.recipients, 2, "registrants only by default");
  assert.equal((await admin.sendCustom(msg({ audience: "registrants+waitlist" }))).body.recipients, 3);
  assert.equal((await admin.sendCustom(msg({ audience: "promotional" }))).body.recipients, 1, "promotional: opted-in registrants only");
  assert.equal(mail.sends().length, 0);
});

test("custom message: sending needs confirmation, reaches everyone once, and an edited message is a new message", async () => {
  await register(body({ email: "a@example.com" }));
  await register(body({ email: "b@example.com" }));
  mail.calls.length = 0;

  assert.equal((await admin.sendCustom(msg({ dryRun: false }))).status, 400, "no confirm, no send");
  assert.equal(mail.sends().length, 0);

  const first = await admin.sendCustom(msg({ dryRun: false, confirm: true }));
  assert.equal(first.body.sent, 2);
  assert.deepEqual(mail.sends().map((s) => s.body.to).sort(), ["a@example.com", "b@example.com"]);

  const again = await admin.sendCustom(msg({ dryRun: false, confirm: true }));
  assert.equal(again.body.sent, 0, "re-running never double-sends");
  assert.equal(again.body.skipped, 2);
  assert.equal((await admin.sendCustom(msg())).body.alreadySent, 2, "the dry run reports who already has it");

  const edited = await admin.sendCustom(msg({ message: "A different message.", dryRun: false, confirm: true }));
  assert.equal(edited.body.sent, 2, "different content is a different message");
});

test("custom message: text is escaped, paragraphs and links render, details and button are optional extras", async () => {
  seedEvent({}, { meetUrl: MEET, worksheetUrl: SHEET });
  await register(body({ firstName: "<b>Eve</b>" }));
  mail.calls.length = 0;
  await admin.sendCustom(
    msg({
      message: 'First paragraph <script>alert(1)</script> & more.\nSame paragraph, next line.\n\nPoll: https://forms.gle/abc123).',
      includeDetails: true,
      buttonLabel: "Answer in 10 seconds",
      buttonUrl: "https://forms.gle/abc123",
      dryRun: false,
      confirm: true,
    })
  );
  const [s] = mail.sends();
  const html: string = s.body.html;
  assert.ok(!html.includes("<script>"), "message HTML is escaped");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<b>Eve</b>") && html.includes("&lt;b&gt;Eve"), "the recipient's name is escaped");
  assert.ok(html.includes("Same paragraph, next line.") && html.includes("<br/>"), "single line breaks are kept");
  assert.equal((html.match(/<p>/g) ?? []).length >= 3, true, "blank line starts a new paragraph");
  assert.ok(html.includes('<a href="https://forms.gle/abc123" style'), "links are clickable");
  assert.ok(html.includes("abc123</a>)"), "trailing punctuation stays outside the link");
  assert.ok(html.includes(MEET) && html.includes("Join on Google Meet"), "details include the Join link");
  assert.ok(html.includes(SHEET), "details include the worksheet");
  assert.ok(html.includes("Answer in 10 seconds"));
  assert.ok(s.body.text.includes("Answer in 10 seconds: https://forms.gle/abc123"));
  assert.ok(!html.includes("Unsubscribe"), "event information carries no promotional footer");
});

test("custom message: without the optional extras it is just your words", async () => {
  await register();
  mail.calls.length = 0;
  await admin.sendCustom(msg({ dryRun: false, confirm: true }));
  const [s] = mail.sends();
  assert.ok(!s.body.html.includes(MEET), "no join details unless asked");
  assert.ok(!s.body.html.includes("Join on Google Meet"));
  assert.ok(s.body.text.startsWith("Hi Ada,"));
});

test("custom message: promotional mode goes only to opted-in people, with an unsubscribe link, and needs the token secret", async () => {
  await register(body({ email: "yes@example.com", marketingOptIn: true }));
  await register(body({ email: "no@example.com", marketingOptIn: false }));
  mail.calls.length = 0;

  delete process.env.WEBINAR_TOKEN_SECRET;
  const refused = await admin.sendCustom(msg({ audience: "promotional", dryRun: false, confirm: true }));
  assert.equal(refused.status, 503);
  assert.equal(mail.sends().length, 0);

  process.env.WEBINAR_TOKEN_SECRET = "test-secret";
  const sent = await admin.sendCustom(msg({ audience: "promotional", dryRun: false, confirm: true }));
  assert.equal(sent.body.sent, 1);
  const [s] = mail.sends();
  assert.equal(s.body.to, "yes@example.com");
  assert.ok(s.body.html.includes("api/webinar?action=unsubscribe"));
  assert.ok(s.body.text.includes("Unsubscribe:"));
});

test("custom message: sending is unavailable when email is not configured", async () => {
  await register();
  const key = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    assert.equal((await admin.sendCustom(msg({ dryRun: false, confirm: true }))).status, 503);
    assert.equal((await admin.sendCustom(msg({ test: true, testTo: "me@example.com" }))).status, 503);
  } finally {
    process.env.RESEND_API_KEY = key;
  }
});
