import { FieldPath } from "firebase-admin/firestore";
import { FieldValue } from "./firebase-admin.js";
import {
  REGISTRATIONS,
  getDb,
  getResend,
  loadEvent,
  registrationDocId,
  renderCustom,
  renderEmail,
  reminderTimes,
  scheduleReminders,
  sendRendered,
  sleep,
  unsubscribeUrl,
  type DeliveryState,
  type EmailContext,
  type EmailKind,
} from "./webinar.js";
import { createHash } from "node:crypto";
import { EMAIL_RE } from "./webinar-shared.js";

/**
 * Bulk admin operations for webinar registrants. Resend allows ~2 requests per
 * second by default, so each call works within a time budget and returns a
 * cursor; the admin UI keeps calling until `nextCursor` is null.
 */

const BUDGET_MS = 7_000;
const PACE_MS = Number(process.env.WEBINAR_PACE_MS ?? 550);

type Result = { status: number; body: Record<string, unknown> };
const fail = (status: number, error: string): Result => ({ status, body: { error } });

async function page(eventId: string, cursor: string | null, limit = 50) {
  let q: FirebaseFirestore.Query = getDb()
    .collection(REGISTRATIONS)
    .where("eventId", "==", eventId)
    .orderBy(FieldPath.documentId())
    .limit(limit);
  if (cursor) q = q.startAfter(cursor);
  return q.get();
}

function validEventId(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9-]{1,80}$/.test(id);
}

const REG_STATUSES = ["open", "closed", "waitlist"];
const WEBINAR_STATUSES = ["scheduled", "live", "completed", "cancelled"];

function validTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const iso = (v: any): string | null => (v && typeof v.toDate === "function" ? v.toDate().toISOString() : null);

/** Event config (public + private) and its registrants, for the admin tab. */
export async function getWebinar(query: any): Promise<Result> {
  const eventId = query.eventId;
  if (!validEventId(eventId)) return fail(400, "eventId is required");
  const [pub, priv] = await Promise.all([
    getDb().collection("webinars").doc(eventId).get(),
    getDb().collection("webinarPrivate").doc(eventId).get(),
  ]);
  const snap = await getDb().collection(REGISTRATIONS).where("eventId", "==", eventId).orderBy(FieldPath.documentId()).limit(2000).get();
  const registrations = snap.docs.map((d) => {
    const r = d.data();
    return {
      id: d.id,
      type: r.type,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      organization: r.organization,
      role: r.role,
      sector: r.sector,
      country: r.country,
      marketingOptIn: !!r.marketingOptIn,
      attended: !!r.attended,
      attribution: r.attribution ?? {},
      delivery: r.delivery ?? {},
      createdAt: iso(r.createdAt),
    };
  });
  return {
    status: 200,
    body: { exists: pub.exists, public: pub.exists ? pub.data() : null, private: priv.exists ? priv.data() : null, registrations },
  };
}

/** Validates and saves the public + private halves of an event. */
export async function saveWebinar(body: any): Promise<Result> {
  if (!validEventId(body.eventId)) return fail(400, "eventId must be lowercase letters, numbers and hyphens");
  const p = body.public ?? {};
  const q = body.private ?? {};

  const startsAt = p.startsAt ? String(p.startsAt) : null;
  if (startsAt && Number.isNaN(new Date(startsAt).getTime())) return fail(400, "startsAt is not a valid date");
  if (!validTimeZone(p.timezone)) return fail(400, "timezone must be a valid IANA time zone, e.g. America/New_York");
  if (!REG_STATUSES.includes(p.registrationStatus)) return fail(400, "registrationStatus is invalid");
  if (!WEBINAR_STATUSES.includes(p.webinarStatus)) return fail(400, "webinarStatus is invalid");
  const duration = Number(p.durationMinutes);
  if (!(duration >= 5 && duration <= 600)) return fail(400, "durationMinutes must be between 5 and 600");
  const capacity = p.capacity === null || p.capacity === "" || p.capacity === undefined ? null : Number(p.capacity);
  if (capacity !== null && !(Number.isInteger(capacity) && capacity > 0)) return fail(400, "capacity must be a positive whole number or empty");
  if (p.registrationStatus === "open" && !startsAt) return fail(400, "Set a date and time before opening registration (use 'waitlist' until then).");

  for (const key of ["meetUrl", "replayUrl", "worksheetUrl"] as const) {
    const v = q[key];
    if (v) {
      try {
        if (new URL(String(v)).protocol !== "https:") throw new Error();
      } catch {
        return fail(400, `${key} must be a valid https:// URL`);
      }
    }
  }

  const agenda = Array.isArray(p.agenda)
    ? p.agenda
        .filter((a: any) => a && typeof a.time === "string" && typeof a.title === "string" && a.time.trim() && a.title.trim())
        .slice(0, 12)
        .map((a: any) => ({ time: a.time.trim().slice(0, 40), title: a.title.trim().slice(0, 120) }))
    : [];

  await getDb().collection("webinars").doc(body.eventId).set(
    {
      title: String(p.title ?? "").trim().slice(0, 200),
      subtitle: String(p.subtitle ?? "").trim().slice(0, 300),
      startsAt,
      timezone: p.timezone,
      durationMinutes: duration,
      registrationStatus: p.registrationStatus,
      webinarStatus: p.webinarStatus,
      replayAvailable: p.replayAvailable === true,
      capacity,
      platform: "Google Meet",
      agenda,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await getDb().collection("webinarPrivate").doc(body.eventId).set(
    {
      meetUrl: q.meetUrl ? String(q.meetUrl) : "",
      replayUrl: q.replayUrl ? String(q.replayUrl) : "",
      worksheetUrl: q.worksheetUrl ? String(q.worksheetUrl) : "",
      calendarEventId: String(q.calendarEventId ?? "").trim().slice(0, 200),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { status: 200, body: { success: true } };
}

/** Cancel old reminders and schedule new ones using the event's current date. */
export async function rescheduleReminders(body: any): Promise<Result> {
  if (!validEventId(body.eventId)) return fail(400, "eventId is required");
  const event = await loadEvent(body.eventId);
  if (!event) return fail(404, "Webinar not found");
  const resend = await getResend();
  if (!resend) return fail(503, "Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).");

  const started = Date.now();
  const snap = await page(event.id, body.cursor ?? null);
  let processed = 0;
  let failed = 0;
  let last: string | null = null;
  let exhausted = snap.size < 50;

  for (const doc of snap.docs) {
    if (Date.now() - started > BUDGET_MS) {
      exhausted = false;
      break;
    }
    const d = doc.data();
    last = doc.id;
    const ready = !!event.startsAt && event.registrationStatus !== "waitlist" && event.webinarStatus !== "cancelled";
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    for (const kind of ["reminder24", "reminder1"] as const) {
      const prev: DeliveryState | undefined = d.delivery?.[kind];
      if (prev?.status === "scheduled" && prev.id) {
        await resend.emails.cancel(prev.id).catch(() => undefined);
        await sleep(PACE_MS);
        update[`delivery.${kind}`] = { status: "cancelled" } satisfies DeliveryState;
      }
    }

    if (ready) {
      update.type = "registration";
      const out = await scheduleReminders(resend, event, { email: d.email, firstName: d.firstName, marketingOptIn: !!d.marketingOptIn }, doc.id);
      if (out.reminder24) update["delivery.reminder24"] = out.reminder24;
      if (out.reminder1) update["delivery.reminder1"] = out.reminder1;
      if (out.reminder24?.status === "failed" || out.reminder1?.status === "failed") failed++;
      await sleep(PACE_MS);
    }
    await doc.ref.update(update);
    processed++;
  }

  const nextCursor = exhausted ? null : last;
  return { status: 200, body: { processed, failed, nextCursor, times: event.startsAt ? reminderTimes(event.startsAt) : {} } };
}

const TEMPLATE_KINDS: EmailKind[] = ["preview", "update", "followup-thanks", "followup-pathways"];
const PROMOTIONAL: EmailKind[] = ["followup-pathways"];

/** Sends (or counts, when dryRun) one of the manual follow-up templates. */
export async function broadcast(body: any): Promise<Result> {
  if (!validEventId(body.eventId)) return fail(400, "eventId is required");
  const template = body.template as EmailKind;
  if (!TEMPLATE_KINDS.includes(template)) return fail(400, `template must be one of ${TEMPLATE_KINDS.join(", ")}`);
  const event = await loadEvent(body.eventId);
  if (!event) return fail(404, "Webinar not found");

  const promo = PROMOTIONAL.includes(template);
  const includeInterest = template === "update" || promo;
  const dryRun = body.dryRun !== false;
  const recap: string[] = Array.isArray(body.recap)
    ? body.recap.filter((r: unknown) => typeof r === "string").map((r: string) => r.trim().slice(0, 300)).filter(Boolean).slice(0, 8)
    : [];

  const eligible = (d: FirebaseFirestore.DocumentData) =>
    (d.type === "registration" || (includeInterest && d.type === "interest")) && (!promo || d.marketingOptIn === true);

  if (dryRun) {
    let total = 0;
    let alreadySent = 0;
    let cursor: string | null = null;
    for (;;) {
      const snap = await page(event.id, cursor, 300);
      for (const doc of snap.docs) {
        const d = doc.data();
        if (!eligible(d)) continue;
        total++;
        if (d.delivery?.[`broadcast_${template}`]?.status === "sent") alreadySent++;
      }
      if (snap.size < 300) break;
      cursor = snap.docs[snap.docs.length - 1].id;
    }
    return { status: 200, body: { dryRun: true, template, promotional: promo, recipients: total, alreadySent, toSend: total - alreadySent } };
  }

  if (body.confirm !== true) return fail(400, "Set confirm: true to send.");
  if (promo && !unsubscribeUrl("0".repeat(32))) return fail(503, "WEBINAR_TOKEN_SECRET is not set, so promotional emails (which require an unsubscribe link) are disabled.");
  const resend = await getResend();
  if (!resend) return fail(503, "Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).");

  const started = Date.now();
  const snap = await page(event.id, body.cursor ?? null);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let last: string | null = null;
  let exhausted = snap.size < 50;

  for (const doc of snap.docs) {
    if (Date.now() - started > BUDGET_MS) {
      exhausted = false;
      break;
    }
    last = doc.id;
    const d = doc.data();
    if (!eligible(d) || d.delivery?.[`broadcast_${template}`]?.status === "sent") {
      skipped++;
      continue;
    }
    const ctx: EmailContext = { firstName: d.firstName, event, marketingOptIn: !!d.marketingOptIn, unsubscribeUrl: unsubscribeUrl(doc.id), recap };
    const r = await sendRendered(resend, d.email, renderEmail(template, ctx));
    await doc.ref.update({
      [`delivery.broadcast_${template}`]: r.id
        ? ({ status: "sent", id: r.id, at: new Date().toISOString() } satisfies DeliveryState)
        : ({ status: "failed", error: r.error } satisfies DeliveryState),
      updatedAt: FieldValue.serverTimestamp(),
    });
    r.id ? sent++ : failed++;
    await sleep(PACE_MS);
  }
  return { status: 200, body: { dryRun: false, template, sent, failed, skipped, nextCursor: exhausted ? null : last } };
}

const AUDIENCES = ["registrants", "registrants+waitlist", "promotional"] as const;
type Audience = (typeof AUDIENCES)[number];

const httpsUrl = (v: unknown): v is string => {
  try {
    return typeof v === "string" && new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Sends an admin-written message. Three modes, always in this order of caution:
 *   test:true      one copy to testTo (subject prefixed [TEST]); records nothing
 *   dryRun (default) counts recipients; sends nothing
 *   dryRun:false + confirm:true   sends in resumable batches; each person gets a given message at most once
 * "Once" is keyed on a hash of the message content, so re-running never double-sends but an edited message is a new message.
 */
export async function sendCustom(body: any): Promise<Result> {
  if (!validEventId(body.eventId)) return fail(400, "eventId is required");
  const subject = typeof body.subject === "string" ? body.subject.replace(/[\r\n]+/g, " ").trim() : "";
  const message = typeof body.message === "string" ? body.message.replace(/\r\n/g, "\n").trim() : "";
  if (!subject || subject.length > 120) return fail(400, "Subject is required (up to 120 characters).");
  if (!message || message.length > 5000) return fail(400, "Message is required (up to 5000 characters).");
  const buttonLabel = typeof body.buttonLabel === "string" ? body.buttonLabel.trim() : "";
  const buttonUrl = typeof body.buttonUrl === "string" ? body.buttonUrl.trim() : "";
  if (buttonLabel || buttonUrl) {
    if (!buttonLabel || buttonLabel.length > 40) return fail(400, "Button text is required with a link (up to 40 characters).");
    if (!httpsUrl(buttonUrl)) return fail(400, "The button link must be a valid https:// URL.");
  }
  const audience: Audience = AUDIENCES.includes(body.audience) ? body.audience : "registrants";
  const promotional = audience === "promotional";
  const includeDetails = body.includeDetails === true;

  const event = await loadEvent(body.eventId);
  if (!event) return fail(404, "Webinar not found");
  if (includeDetails && !event.startsAt) return fail(400, "Set the webinar date before including date, time and join details.");

  const msg = { subject, message, includeDetails, buttonLabel: buttonLabel || undefined, buttonUrl: buttonUrl || undefined, promotional };
  const key = `broadcast_custom_${createHash("sha256").update(JSON.stringify([subject, message, includeDetails, buttonLabel, buttonUrl, audience])).digest("hex").slice(0, 12)}`;

  // 1) test copy
  if (body.test === true) {
    if (!EMAIL_RE.test(String(body.testTo ?? "").trim().toLowerCase())) return fail(400, "Enter a valid email address for the test.");
    const resend = await getResend();
    if (!resend) return fail(503, "Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).");
    const ctx: EmailContext = { firstName: "Test", event, marketingOptIn: promotional, unsubscribeUrl: promotional ? unsubscribeUrl("0".repeat(32)) : null };
    const r = await sendRendered(resend, String(body.testTo).trim().toLowerCase(), { ...renderCustom(ctx, msg), subject: `[TEST] ${subject}` });
    return r.id ? { status: 200, body: { test: true, sent: 1 } } : fail(502, r.error ?? "The test email could not be sent.");
  }

  const eligible = (d: FirebaseFirestore.DocumentData) => {
    if (promotional) return d.type === "registration" && d.marketingOptIn === true;
    return d.type === "registration" || (audience === "registrants+waitlist" && d.type === "interest");
  };

  // 2) dry run
  if (body.dryRun !== false) {
    let total = 0;
    let alreadySent = 0;
    let cursor: string | null = null;
    for (;;) {
      const snap = await page(event.id, cursor, 300);
      for (const doc of snap.docs) {
        const d = doc.data();
        if (!eligible(d)) continue;
        total++;
        if (d.delivery?.[key]?.status === "sent") alreadySent++;
      }
      if (snap.size < 300) break;
      cursor = snap.docs[snap.docs.length - 1].id;
    }
    return { status: 200, body: { dryRun: true, audience, promotional, recipients: total, alreadySent, toSend: total - alreadySent } };
  }

  // 3) send
  if (body.confirm !== true) return fail(400, "Set confirm: true to send.");
  if (promotional && !unsubscribeUrl("0".repeat(32))) return fail(503, "WEBINAR_TOKEN_SECRET is not set, so promotional emails (which require an unsubscribe link) are disabled.");
  const resend = await getResend();
  if (!resend) return fail(503, "Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).");

  const started = Date.now();
  const snap = await page(event.id, body.cursor ?? null);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let last: string | null = null;
  let exhausted = snap.size < 50;

  for (const doc of snap.docs) {
    if (Date.now() - started > BUDGET_MS) {
      exhausted = false;
      break;
    }
    last = doc.id;
    const d = doc.data();
    if (!eligible(d) || d.delivery?.[key]?.status === "sent") {
      skipped++;
      continue;
    }
    const ctx: EmailContext = { firstName: d.firstName, event, marketingOptIn: !!d.marketingOptIn, unsubscribeUrl: unsubscribeUrl(doc.id) };
    const r = await sendRendered(resend, d.email, renderCustom(ctx, msg));
    await doc.ref.update({
      [`delivery.${key}`]: r.id ? ({ status: "sent", id: r.id, at: new Date().toISOString() } satisfies DeliveryState) : ({ status: "failed", error: r.error } satisfies DeliveryState),
      updatedAt: FieldValue.serverTimestamp(),
    });
    r.id ? sent++ : failed++;
    await sleep(PACE_MS);
  }
  return { status: 200, body: { dryRun: false, audience, sent, failed, skipped, nextCursor: exhausted ? null : last } };
}

/** Pulls the latest delivery event for each stored Resend email id. */
export async function refreshDelivery(body: any): Promise<Result> {
  if (!validEventId(body.eventId)) return fail(400, "eventId is required");
  const resend = await getResend();
  if (!resend) return fail(503, "Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).");

  const started = Date.now();
  const snap = await page(body.eventId, body.cursor ?? null);
  let checked = 0;
  let last: string | null = null;
  let exhausted = snap.size < 50;

  for (const doc of snap.docs) {
    if (Date.now() - started > BUDGET_MS) {
      exhausted = false;
      break;
    }
    last = doc.id;
    const delivery = doc.data().delivery ?? {};
    const update: Record<string, unknown> = {};
    for (const [key, state] of Object.entries<DeliveryState>(delivery)) {
      if (!state?.id || state.status === "cancelled") continue;
      const { data, error } = await resend.emails.get(state.id);
      await sleep(PACE_MS);
      if (!error && data) update[`delivery.${key}.lastEvent`] = (data as any).last_event ?? "unknown";
    }
    if (Object.keys(update).length) await doc.ref.update(update);
    checked++;
  }
  return { status: 200, body: { checked, nextCursor: exhausted ? null : last } };
}

/** Marks registrants as attended from a pasted list of emails (e.g. a Meet attendance report). */
export async function markAttended(body: any): Promise<Result> {
  if (!validEventId(body.eventId)) return fail(400, "eventId is required");
  const raw: unknown[] = Array.isArray(body.emails) ? body.emails : [];
  const emails = [...new Set(raw.filter((e): e is string => typeof e === "string").map((e) => e.trim().toLowerCase()).filter(Boolean))].slice(0, 2000);
  if (!emails.length) return fail(400, "emails is required");

  let matched = 0;
  const unmatched: string[] = [];
  for (const email of emails) {
    const ref = getDb().collection(REGISTRATIONS).doc(registrationDocId(body.eventId, email));
    const snap = await ref.get();
    if (snap.exists) {
      await ref.update({ attended: true, attendedMarkedAt: FieldValue.serverTimestamp() });
      matched++;
    } else {
      unmatched.push(email);
    }
  }
  return { status: 200, body: { matched, unmatched: unmatched.slice(0, 100), unmatchedCount: unmatched.length } };
}
