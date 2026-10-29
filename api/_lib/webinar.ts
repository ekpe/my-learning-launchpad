import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db as realDb, FieldValue } from "./firebase-admin.js";
import {
  addMinutesIso,
  buildIcs,
  escapeHtml,
  formatEventWhen,
  googleCalendarUrl,
} from "./webinar-shared.js";

// Test seam: lets tests swap in an in-memory Firestore. Production always uses the real one.
let dbOverride: any = null;
export function getDb(): typeof realDb {
  return dbOverride ?? realDb;
}
export function __setDbForTests(fake: unknown): void {
  dbOverride = fake;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_EVENT_ID = "leading-ai-hype-to-strategy";
export const FLAGSHIP_COURSE_ID = "ai-strategy-leaders";

/** Titles mirror src/data/courses.ts (a test keeps them in sync). */
export const PATHWAY_COURSES: { id: string; title: string }[] = [
  { id: "ai-strategy-intensive", title: "AI Strategy Intensive: From Clarity to Action" },
  { id: "ai-strategy-certification", title: "AI Strategy Certification: Designing Enterprise AI Roadmaps" },
  { id: "enterprise-ai-implementation", title: "Enterprise AI Implementation: From Strategy to Scalable Solutions" },
  { id: "leading-agentic-ai", title: "Leading in the Age of Agentic AI: The Future of Autonomous Enterprises" },
];

export const REGISTRATIONS = "webinarRegistrations";

export type EmailKind =
  | "confirmation"
  | "preview"
  | "reminder24"
  | "reminder1"
  | "update"
  | "followup-thanks"
  | "followup-pathways";

export interface WebinarEvent {
  id: string;
  title: string;
  subtitle: string;
  startsAt: string | null; // UTC ISO
  timezone: string;
  durationMinutes: number;
  registrationStatus: "open" | "closed" | "waitlist";
  webinarStatus: "scheduled" | "live" | "completed" | "cancelled";
  capacity: number | null;
  meetUrl: string | null; // private
  replayUrl: string | null; // private
  /** Optional one-page worksheet for the live session (private: only goes out in emails). */
  worksheetUrl: string | null;
}

export interface DeliveryState {
  status: string; // sent | scheduled | failed | not_configured | cancelled | skipped
  id?: string;
  at?: string;
  scheduledAt?: string;
  error?: string;
  lastEvent?: string;
}

// ── Environment ──────────────────────────────────────────────────────────────

export function siteUrl(): string {
  return (process.env.SITE_URL || process.env.APP_URL || "https://www.mylearninglaunchpad.com").replace(/\/$/, "");
}

export function contactEmail(): string {
  return process.env.WEBINAR_CONTACT_EMAIL || "info@mylearninglaunchpad.com";
}

export function fromAddress(): string | null {
  const raw = process.env.WEBINAR_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
  if (!raw) return null;
  return raw.includes("<") ? raw : `MyLearningLaunchpad <${raw}>`;
}

// ── Identity, tokens, rate limiting ──────────────────────────────────────────

/** Deterministic id so the same email can't register twice for one event. */
export function registrationDocId(eventId: string, email: string): string {
  return createHash("sha256").update(`${eventId}:${email.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

export function newPublicRef(): string {
  return randomBytes(6).toString("hex");
}

function tokenSecret(): string | null {
  return process.env.WEBINAR_TOKEN_SECRET || null;
}

export function signToken(id: string): string | null {
  const secret = tokenSecret();
  return secret ? createHmac("sha256", secret).update(id).digest("base64url") : null;
}

export function verifyToken(id: string, token: string): boolean {
  const expected = signToken(id);
  if (!expected || !token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(docId: string): string | null {
  const t = signToken(docId);
  return t ? `${siteUrl()}/api/webinar?action=unsubscribe&id=${docId}&t=${t}` : null;
}

export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const db = getDb();
  const ref = db.collection("webinarRateLimits").doc(key.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 200));
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as { count: number; windowStart: number }) : null;
    if (!data || now - data.windowStart > windowMs) {
      tx.set(ref, { count: 1, windowStart: now });
      return true;
    }
    if (data.count >= max) return false;
    tx.set(ref, { count: data.count + 1, windowStart: data.windowStart });
    return true;
  });
}

// ── Event loading ────────────────────────────────────────────────────────────

export async function loadEvent(eventId: string): Promise<WebinarEvent | null> {
  const db = getDb();
  const [pub, priv] = await Promise.all([
    db.collection("webinars").doc(eventId).get(),
    db.collection("webinarPrivate").doc(eventId).get(),
  ]);
  if (!pub.exists) return null;
  const p: any = pub.data() ?? {};
  const q: any = priv.exists ? priv.data() : {};
  return {
    id: eventId,
    title: p.title || "Leading in the Age of AI: From Hype to Strategy",
    subtitle: p.subtitle || "",
    startsAt: typeof p.startsAt === "string" && p.startsAt ? p.startsAt : null,
    timezone: p.timezone || "UTC",
    durationMinutes: Number(p.durationMinutes) > 0 ? Number(p.durationMinutes) : 60,
    registrationStatus: ["open", "closed", "waitlist"].includes(p.registrationStatus) ? p.registrationStatus : "waitlist",
    webinarStatus: ["scheduled", "live", "completed", "cancelled"].includes(p.webinarStatus) ? p.webinarStatus : "scheduled",
    capacity: Number(p.capacity) > 0 ? Number(p.capacity) : null,
    meetUrl: typeof q.meetUrl === "string" && q.meetUrl ? q.meetUrl : null,
    replayUrl: typeof q.replayUrl === "string" && q.replayUrl ? q.replayUrl : null,
    worksheetUrl: typeof q.worksheetUrl === "string" && q.worksheetUrl ? q.worksheetUrl : null,
  };
}

// ── Email rendering ──────────────────────────────────────────────────────────

export interface EmailContext {
  firstName: string;
  event: WebinarEvent;
  /** Whether this recipient opted in to promotional messages. */
  marketingOptIn: boolean;
  unsubscribeUrl: string | null;
  recap?: string[];
}

export interface Rendered {
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}

const NAVY = "#1e3a8a";

function courseLink(kind: EmailKind, eventId: string, courseId: string): string {
  const q = new URLSearchParams({ utm_source: "webinar", utm_medium: "email", utm_campaign: eventId, utm_content: kind });
  return `${siteUrl()}/course/${courseId}?${q.toString()}`;
}

function button(label: string, href: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:${NAVY};color:#ffffff;padding:13px 26px;border-radius:999px;text-decoration:none;font-weight:700;display:inline-block">${escapeHtml(label)}</a></p>`;
}

function detailsBlock(rows: [string, string][]): string {
  const body = rows
    .map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#64748b;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;color:#0f172a;font-weight:600">${v}</td></tr>`)
    .join("");
  return `<table role="presentation" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin:20px 0;width:100%"><tbody>${body}</tbody></table>`;
}

function wrap(innerHtml: string, ctx: EmailContext, promo: boolean): string {
  const unsub =
    promo && ctx.unsubscribeUrl
      ? `<p style="font-size:12px;color:#64748b;margin:0 4px"><a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:#64748b">Unsubscribe from promotional emails</a></p>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9"><div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:28px 20px;color:#0f172a;line-height:1.6">
<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
<p style="margin:0 0 18px;font-size:12px;letter-spacing:.14em;font-weight:700;color:${NAVY}">MYLEARNINGLAUNCHPAD AI LEADERSHIP ACADEMY</p>
${innerHtml}
</div>
<p style="font-size:12px;color:#64748b;margin:16px 4px">Questions? Reply to this email or write to <a href="mailto:${escapeHtml(contactEmail())}" style="color:#64748b">${escapeHtml(contactEmail())}</a>.</p>
${unsub}
</div></body></html>`;
}

/** Plain-text variant lines for the shared "when" details. */
function whenText(event: WebinarEvent): string | null {
  return event.startsAt ? formatEventWhen(event.startsAt, event.timezone) : null;
}

function joinHtml(event: WebinarEvent): string {
  return event.meetUrl
    ? `<a href="${escapeHtml(event.meetUrl)}" style="color:${NAVY}">${escapeHtml(event.meetUrl)}</a>`
    : "We will email you the Google Meet link before the session.";
}

function joinText(event: WebinarEvent): string {
  return event.meetUrl ?? "We will email you the Google Meet link before the session.";
}

const WORKSHEET_LEAD = "A one-page worksheet for the quiet-time activity. Print it, edit it online, or use a notebook.";

/** The worksheet call-to-action. Empty when the event has no worksheet, so existing emails are unchanged. */
function worksheetHtml(event: WebinarEvent): string {
  return event.worksheetUrl ? `<p style="margin:18px 0 0"><strong>Your worksheet</strong><br/>${escapeHtml(WORKSHEET_LEAD)}</p>${button("Open the worksheet", event.worksheetUrl)}` : "";
}

function worksheetText(event: WebinarEvent): string {
  return event.worksheetUrl ? `\nWorksheet: ${event.worksheetUrl}\n(${WORKSHEET_LEAD})\n` : "";
}

export function renderEmail(kind: EmailKind, ctx: EmailContext): Rendered {
  const { event } = ctx;
  const name = ctx.firstName || "there";
  const when = whenText(event);
  const hi = `<p>Hi ${escapeHtml(name)},</p>`;
  const sign = `<p style="margin-top:24px">Prof. Ekpe Okorafor<br/><span style="color:#64748b">MyLearningLaunchpad AI Leadership Academy</span></p>`;
  const flagship = courseLink(kind, event.id, FLAGSHIP_COURSE_ID);

  const calendarDescription = [
    event.subtitle,
    event.meetUrl ? `Join on Google Meet: ${event.meetUrl}` : "Your Google Meet link will be emailed to you before the session.",
  ]
    .filter(Boolean)
    .join("\n");

  const calendarLink =
    event.startsAt &&
    googleCalendarUrl({
      title: event.title,
      startsAtIso: event.startsAt,
      durationMinutes: event.durationMinutes,
      description: calendarDescription,
      location: event.meetUrl ?? "Online (Google Meet)",
    });

  const schedule = (): [string, string][] =>
    when
      ? [
          ["When", escapeHtml(when)],
          ["Length", `${event.durationMinutes} minutes, live online`],
          ["Join", joinHtml(event)],
        ]
      : [];

  switch (kind) {
    case "confirmation": {
      if (!event.startsAt) {
        const text = `Hi ${name},\n\nYou're on the list for "${event.title}". We haven't confirmed the date yet; we'll email you as soon as it's set. Registering does not commit you to anything.\n\nQuestions? ${contactEmail()}\n\nProf. Ekpe Okorafor\nMyLearningLaunchpad AI Leadership Academy`;
        const html = wrap(
          `<h1 style="font-size:22px;margin:0 0 12px">You're on the list</h1>${hi}<p>Thanks for your interest in <strong>${escapeHtml(event.title)}</strong>. The date isn't confirmed yet. We'll email you as soon as it's set, and there's nothing else you need to do.</p>${sign}`,
          ctx,
          false
        );
        return { subject: `You're on the list: ${event.title}`, text, html };
      }
      const ics = buildIcs({
        uid: `${event.id}@mylearninglaunchpad.com`,
        title: event.title,
        startsAtIso: event.startsAt,
        durationMinutes: event.durationMinutes,
        description: calendarDescription,
        location: event.meetUrl ?? "Online (Google Meet)",
      });
      const text = `Hi ${name},\n\nYou're registered for "${event.title}".\n\nWhen: ${when}\nLength: ${event.durationMinutes} minutes, live online\nJoin: ${joinText(event)}\n${worksheetText(event)}\nAdd to your calendar: ${calendarLink}\n(An invitation file is also attached.)\n\nQuestions? ${contactEmail()}\n\nProf. Ekpe Okorafor\nMyLearningLaunchpad AI Leadership Academy`;
      const html = wrap(
        `<h1 style="font-size:22px;margin:0 0 12px">You're registered</h1>${hi}<p>Your seat is reserved for <strong>${escapeHtml(event.title)}</strong>.</p>${detailsBlock(schedule())}${worksheetHtml(event)}<p>On the day, open the Google Meet link above a few minutes before the start. You don't need to install anything or create an account.</p>${button("Add to Google Calendar", calendarLink as string)}<p style="color:#64748b;font-size:14px">An .ics invitation is attached for other calendar apps. Please keep this email, since it contains your joining link.</p>${sign}`,
        ctx,
        false
      );
      return {
        subject: `You're registered: ${event.title}`,
        text,
        html,
        attachments: [{ filename: "webinar.ics", content: Buffer.from(ics).toString("base64"), contentType: "text/calendar; charset=utf-8; method=PUBLISH" }],
      };
    }

    case "preview": {
      const outcomes = [
        "What has changed from generative AI to agentic AI, and why it matters",
        "How to separate what AI can do from what it can do reliably",
        "Where AI might create practical value in your organization",
        "Why human judgment, oversight and accountability stay central",
        "A practical next step for your AI leadership journey",
      ];
      const text = `Hi ${name},\n\nA quick preview of ${event.title}${when ? ` (${when})` : ""}.\n\nWe'll cover:\n${outcomes.map((o) => `- ${o}`).join("\n")}\n\nNo technical background needed. Bring one workflow or decision from your organization to think about while we talk.\n${event.meetUrl ? `\nJoin: ${event.meetUrl}\n` : ""}${worksheetText(event)}\nProf. Ekpe Okorafor`;
      const html = wrap(
        `<h1 style="font-size:22px;margin:0 0 12px">What we'll cover</h1>${hi}<p>A quick preview of <strong>${escapeHtml(event.title)}</strong>:</p><ul>${outcomes.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul><p>No technical background is needed. Bring one workflow or decision from your organization to think about while we talk.</p>${when ? detailsBlock(schedule()) : ""}${worksheetHtml(event)}${sign}`,
        ctx,
        false
      );
      return { subject: `What we'll cover: ${event.title}`, text, html };
    }

    case "reminder24":
    case "reminder1": {
      const lead = kind === "reminder24" ? "starts in about 24 hours" : "starts in about 1 hour";
      const subject = kind === "reminder24" ? `Tomorrow: ${event.title}` : `Starting soon: ${event.title}`;
      const text = `Hi ${name},\n\nA reminder that "${event.title}" ${lead}.\n\nWhen: ${when}\nJoin: ${joinText(event)}\n${worksheetText(event)}\nProf. Ekpe Okorafor`;
      const html = wrap(
        `<h1 style="font-size:22px;margin:0 0 12px">${kind === "reminder24" ? "See you tomorrow" : "Starting in about an hour"}</h1>${hi}<p><strong>${escapeHtml(event.title)}</strong> ${lead}.</p>${detailsBlock(schedule())}${event.meetUrl ? button("Join on Google Meet", event.meetUrl) : ""}${worksheetHtml(event)}${sign}`,
        ctx,
        false
      );
      return { subject, text, html };
    }

    case "update": {
      const text = `Hi ${name},\n\nThe details for "${event.title}" have been updated.\n\nWhen: ${when ?? "To be confirmed"}\nJoin: ${joinText(event)}\n${worksheetText(event)}\nYour earlier reminders have been replaced with the new timing. Questions? ${contactEmail()}\n\nProf. Ekpe Okorafor`;
      const html = wrap(
        `<h1 style="font-size:22px;margin:0 0 12px">Updated webinar details</h1>${hi}<p>The details for <strong>${escapeHtml(event.title)}</strong> have changed. Please use the information below.</p>${detailsBlock(when ? schedule() : [["When", "To be confirmed"]])}${calendarLink ? button("Add updated time to Google Calendar", calendarLink as string) : ""}${worksheetHtml(event)}${sign}`,
        ctx,
        false
      );
      return { subject: `Updated details: ${event.title}`, text, html };
    }

    case "followup-thanks": {
      const recap = ctx.recap?.length ? ctx.recap : [];
      const promo = ctx.marketingOptIn;
      const text = `Hi ${name},\n\nThank you for joining "${event.title}".\n${recap.length ? `\nKey takeaways:\n${recap.map((r) => `- ${r}`).join("\n")}\n` : ""}${event.replayUrl ? `\nReplay: ${event.replayUrl}\n` : ""}${promo ? `\nA good next step is the free self-paced course, AI Strategy for Leaders: ${flagship}\n` : ""}\nProf. Ekpe Okorafor`;
      const html = wrap(
        `<h1 style="font-size:22px;margin:0 0 12px">Thank you for joining</h1>${hi}<p>Thank you for spending the time with us at <strong>${escapeHtml(event.title)}</strong>.</p>${recap.length ? `<p><strong>Key takeaways</strong></p><ul>${recap.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>` : ""}${event.replayUrl ? button("Watch the replay", event.replayUrl) : ""}${promo ? `<p>If you'd like to keep going, the free, self-paced course <strong>AI Strategy for Leaders</strong> turns these ideas into a practical 90-day action plan.</p>${button("Enroll in the Free AI Strategy for Leaders Course", flagship)}` : ""}${sign}`,
        ctx,
        promo
      );
      return { subject: `Thank you for joining: ${event.title}`, text, html };
    }

    case "followup-pathways": {
      const paths = PATHWAY_COURSES.map((c) => ({ ...c, url: courseLink(kind, event.id, c.id) }));
      const text = `Hi ${name},\n\nWhere to go next with the MyLearningLaunchpad AI Leadership Academy.\n\nStart here (free): AI Strategy for Leaders\n${flagship}\n\nGo deeper:\n${paths.map((p) => `- ${p.title}: ${p.url}`).join("\n")}\n\nProf. Ekpe Okorafor${ctx.unsubscribeUrl ? `\n\nUnsubscribe: ${ctx.unsubscribeUrl}` : ""}`;
      const html = wrap(
        `<h1 style="font-size:22px;margin:0 0 12px">Your AI leadership learning pathways</h1>${hi}<p>Start with the free foundation, then go deeper where it's useful for you.</p>${button("Free: AI Strategy for Leaders", flagship)}<p><strong>Go deeper</strong></p><ul>${paths.map((p) => `<li style="margin-bottom:8px"><a href="${escapeHtml(p.url)}" style="color:${NAVY}">${escapeHtml(p.title)}</a></li>`).join("")}</ul>${sign}`,
        ctx,
        true
      );
      return { subject: "Where to go next: your AI leadership pathways", text, html };
    }
  }
}

// ── Custom (admin-written) message ───────────────────────────────────────────

export interface CustomMessage {
  subject: string;
  /** Plain text. A blank line starts a new paragraph; https:// links become clickable. */
  message: string;
  /** Add the date, time and Join link (and the worksheet, if set). */
  includeDetails: boolean;
  buttonLabel?: string;
  buttonUrl?: string;
  /** Promotional messages carry the unsubscribe link and go only to opted-in recipients. */
  promotional: boolean;
}

/** Escapes text and turns https:// links into anchors. Trailing punctuation stays outside the link. */
export function linkifyEscaped(text: string): string {
  return escapeHtml(text).replace(/https:\/\/[^\s<]+/g, (m) => {
    const trail = (m.match(/[.,;:!?)]+$/) ?? [""])[0];
    const url = trail ? m.slice(0, -trail.length) : m;
    return `<a href="${url}" style="color:${NAVY}">${url}</a>${trail}`;
  });
}

export function renderCustom(ctx: EmailContext, msg: CustomMessage): Rendered {
  const { event } = ctx;
  const name = ctx.firstName || "there";
  const when = whenText(event);
  const paragraphs = msg.message.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  const body = paragraphs.map((p) => `<p>${linkifyEscaped(p).replace(/\n/g, "<br/>")}</p>`).join("");

  const rows: [string, string][] = when
    ? [["When", escapeHtml(when)], ["Length", `${event.durationMinutes} minutes, live online`], ["Join", joinHtml(event)]]
    : [];
  const details = msg.includeDetails && rows.length ? detailsBlock(rows) + (event.meetUrl ? button("Join on Google Meet", event.meetUrl) : "") + worksheetHtml(event) : "";
  const cta = msg.buttonLabel && msg.buttonUrl ? button(msg.buttonLabel, msg.buttonUrl) : "";
  const unsub = msg.promotional && ctx.unsubscribeUrl ? `\n\nUnsubscribe: ${ctx.unsubscribeUrl}` : "";

  const text =
    `Hi ${name},\n\n${paragraphs.join("\n\n")}` +
    (msg.includeDetails && when ? `\n\nWhen: ${when}\nJoin: ${joinText(event)}${worksheetText(event)}` : "") +
    (msg.buttonLabel && msg.buttonUrl ? `\n\n${msg.buttonLabel}: ${msg.buttonUrl}` : "") +
    `\n\nProf. Ekpe Okorafor${unsub}`;

  const html = wrap(
    `<p>Hi ${escapeHtml(name)},</p>${body}${details}${cta}<p style="margin-top:24px">Prof. Ekpe Okorafor<br/><span style="color:#64748b">MyLearningLaunchpad AI Leadership Academy</span></p>`,
    ctx,
    msg.promotional
  );
  return { subject: msg.subject.replace(/[\r\n]+/g, " ").trim(), text, html };
}

// ── Resend helpers ───────────────────────────────────────────────────────────

type ResendClient = InstanceType<(typeof import("resend"))["Resend"]>;

export async function getResend(): Promise<ResendClient | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !fromAddress()) return null;
  const { Resend } = await import("resend");
  return new Resend(key);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends (or schedules) one email; retries once when Resend rate-limits (2 req/s by default). */
export async function sendRendered(
  resend: ResendClient,
  to: string,
  rendered: Rendered,
  opts: { scheduledAt?: string } = {}
): Promise<{ id?: string; error?: string }> {
  const payload: any = {
    from: fromAddress()!,
    to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    replyTo: contactEmail(),
  };
  if (rendered.attachments) payload.attachments = rendered.attachments;
  if (opts.scheduledAt) payload.scheduledAt = opts.scheduledAt;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await resend.emails.send(payload);
    if (!error) return { id: data?.id };
    if ((error as any).name === "rate_limit_exceeded" && attempt === 0) {
      await sleep(1100);
      continue;
    }
    return { error: (error as any).message ?? "Unknown email error" };
  }
  return { error: "Email send failed" };
}

/** Reminder send times for an event, skipping any that are already (nearly) past. */
export function reminderTimes(startsAtIso: string, nowMs = Date.now()): { reminder24?: string; reminder1?: string } {
  const out: { reminder24?: string; reminder1?: string } = {};
  const minLead = 5 * 60_000;
  const t24 = addMinutesIso(startsAtIso, -24 * 60);
  const t1 = addMinutesIso(startsAtIso, -60);
  if (new Date(t24).getTime() - nowMs > minLead) out.reminder24 = t24;
  if (new Date(t1).getTime() - nowMs > minLead) out.reminder1 = t1;
  return out;
}

/** Schedules the 24h and 1h reminders for one registrant. */
export async function scheduleReminders(
  resend: ResendClient,
  event: WebinarEvent,
  reg: { email: string; firstName: string; marketingOptIn: boolean },
  docId: string
): Promise<{ reminder24?: DeliveryState; reminder1?: DeliveryState }> {
  if (!event.startsAt || event.webinarStatus === "cancelled") return {};
  const times = reminderTimes(event.startsAt);
  const ctx: EmailContext = { firstName: reg.firstName, event, marketingOptIn: reg.marketingOptIn, unsubscribeUrl: unsubscribeUrl(docId) };
  const out: { reminder24?: DeliveryState; reminder1?: DeliveryState } = {};
  for (const kind of ["reminder24", "reminder1"] as const) {
    const at = times[kind];
    if (!at) {
      out[kind] = { status: "skipped", error: "Send time already passed when scheduled" };
      continue;
    }
    const r = await sendRendered(resend, reg.email, renderEmail(kind, ctx), { scheduledAt: at });
    out[kind] = r.id ? { status: "scheduled", id: r.id, scheduledAt: at } : { status: "failed", error: r.error, scheduledAt: at };
  }
  return out;
}

export { FieldValue };
