import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions } from "./_lib/cors.js";
import { FieldValue, adminInitError } from "./_lib/firebase-admin.js";
import { CONSENT_VERSION, escapeHtml, validateRegistration } from "./_lib/webinar-shared.js";
import {
  REGISTRATIONS,
  checkRateLimit,
  getDb,
  getResend,
  loadEvent,
  newPublicRef,
  registrationDocId,
  renderEmail,
  scheduleReminders,
  sendRendered,
  unsubscribeUrl,
  verifyToken,
  type DeliveryState,
} from "./_lib/webinar.js";

/**
 * /api/webinar?action=register     POST  — validate, store, send confirmation, schedule reminders
 * /api/webinar?action=unsubscribe  GET   — one-click withdrawal of promotional consent
 *
 * Public config is read straight from Firestore by the page (webinars/{id});
 * the private join link (webinarPrivate/{id}) is only ever read here.
 */

const MIN_FILL_MS = 1500;
const CONFIRMATION_RESEND_COOLDOWN_MS = 60 * 60 * 1000;

function clientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return raw?.split(",")[0].trim() || "unknown";
}

async function register(req: VercelRequest, res: VercelResponse) {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  // Honeypot: real people never see or fill this field. Pretend success so bots learn nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return res.json({ ok: true, ref: "0".repeat(12), mode: "registration", emailStatus: "sent" });
  }
  const startedAt = Number(body.formStartedAt);
  if (!startedAt || Date.now() - startedAt < MIN_FILL_MS) {
    return res.status(400).json({ error: "That was submitted too quickly. Please try again.", code: "too_fast" });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!/^[a-z0-9-]{1,80}$/.test(eventId)) return res.status(400).json({ error: "Unknown webinar.", code: "bad_event" });

  const result = validateRegistration(body);
  if (!result.ok || !result.value) {
    return res.status(400).json({ error: "Please check the highlighted fields.", code: "validation", fields: result.errors });
  }
  const reg = result.value;

  if (!(await checkRateLimit(`reg:${clientIp(req)}`, 10, 10 * 60 * 1000))) {
    return res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again.", code: "rate_limited" });
  }

  const event = await loadEvent(eventId);
  if (!event) return res.status(404).json({ error: "This webinar could not be found.", code: "not_found" });
  if (event.registrationStatus === "closed" || event.webinarStatus === "cancelled" || event.webinarStatus === "completed") {
    return res.status(409).json({ error: "Registration for this webinar is closed.", code: "closed" });
  }

  const type: "registration" | "interest" =
    !event.startsAt || event.registrationStatus === "waitlist" ? "interest" : "registration";

  if (type === "registration" && event.capacity) {
    const count = await getDb()
      .collection(REGISTRATIONS)
      .where("eventId", "==", eventId)
      .where("type", "==", "registration")
      .count()
      .get();
    if (count.data().count >= event.capacity) {
      return res.status(409).json({ error: "This session is full.", code: "full" });
    }
  }

  const docId = registrationDocId(eventId, reg.email);
  const ref = getDb().collection(REGISTRATIONS).doc(docId);
  const publicRef = newPublicRef();
  const now = FieldValue.serverTimestamp();

  let duplicate = false;
  try {
    await ref.create({
      eventId,
      type,
      publicRef,
      firstName: reg.firstName,
      lastName: reg.lastName,
      email: reg.email,
      organization: reg.organization,
      role: reg.role,
      sector: reg.sector,
      country: reg.country,
      marketingOptIn: reg.marketingOptIn,
      consent: {
        textVersion: CONSENT_VERSION,
        marketing: reg.marketingOptIn,
        ...(reg.marketingOptIn ? { marketingAt: now } : {}),
        eventLogisticsAt: now,
      },
      attribution: reg.attribution,
      attended: false,
      delivery: {},
      createdAt: now,
      updatedAt: now,
    });
  } catch (e: any) {
    if (e?.code === 6 || /already exists/i.test(e?.message ?? "")) duplicate = true;
    else throw e;
  }

  const resend = await getResend();
  const ctxFor = (marketingOptIn: boolean) => ({
    firstName: reg.firstName,
    event,
    marketingOptIn,
    unsubscribeUrl: unsubscribeUrl(docId),
  });

  if (duplicate) {
    // Same response shape as a new registration so the form can't be used to
    // discover who is registered. Re-send the confirmation at most once an hour.
    const existing = (await ref.get()).data() ?? {};
    const update: Record<string, unknown> = { updatedAt: now };
    if (reg.marketingOptIn && !existing.marketingOptIn) {
      update.marketingOptIn = true;
      update["consent.marketing"] = true;
      update["consent.marketingAt"] = now;
      update["consent.textVersion"] = CONSENT_VERSION;
    }
    let emailStatus = "sent";
    const lastMs = Number(existing.lastConfirmationAtMs) || 0;
    if (resend && Date.now() - lastMs > CONFIRMATION_RESEND_COOLDOWN_MS) {
      const r = await sendRendered(resend, reg.email, renderEmail("confirmation", ctxFor(!!existing.marketingOptIn || reg.marketingOptIn)));
      if (r.id) {
        update["delivery.confirmation"] = { status: "sent", id: r.id, at: new Date().toISOString() } satisfies DeliveryState;
        update.lastConfirmationAtMs = Date.now();
      } else {
        emailStatus = "failed";
      }
    }
    await ref.update(update);
    return res.json({ ok: true, ref: existing.publicRef ?? publicRef, mode: existing.type ?? type, emailStatus });
  }

  const delivery: Record<string, DeliveryState> = {};
  if (!resend) {
    delivery.confirmation = { status: "not_configured" };
  } else {
    const r = await sendRendered(resend, reg.email, renderEmail("confirmation", ctxFor(reg.marketingOptIn)));
    delivery.confirmation = r.id
      ? { status: "sent", id: r.id, at: new Date().toISOString() }
      : { status: "failed", error: r.error };
    if (r.id && type === "registration") {
      Object.assign(delivery, await scheduleReminders(resend, event, reg, docId));
    }
  }
  await ref.update({
    delivery,
    ...(delivery.confirmation.status === "sent" ? { lastConfirmationAtMs: Date.now() } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return res.json({ ok: true, ref: publicRef, mode: type, emailStatus: delivery.confirmation.status });
}

async function unsubscribe(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  const t = String(req.query.t ?? "");
  const page = (title: string, message: string, status = 200) =>
    res
      .status(status)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .setHeader("Cache-Control", "no-store")
      .send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head><body style="font-family:Arial,sans-serif;max-width:480px;margin:15vh auto;padding:0 20px;color:#0f172a"><h1 style="font-size:22px">${escapeHtml(title)}</h1><p style="line-height:1.6">${escapeHtml(message)}</p></body></html>`
      );

  if (!/^[a-f0-9]{32}$/.test(id) || !verifyToken(id, t)) {
    return page("Link not valid", "This unsubscribe link is invalid or has expired. Reply to any of our emails and we'll remove you manually.", 400);
  }
  const ref = getDb().collection(REGISTRATIONS).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({
      marketingOptIn: false,
      "consent.marketing": false,
      "consent.marketingWithdrawnAt": FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  return page("You're unsubscribed", "You won't receive promotional emails from us. You'll still receive essential messages about any webinar you registered for.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (adminInitError) {
    console.error("[webinar] Firebase Admin unavailable:", adminInitError);
    return res.status(503).json({ error: "Registration is temporarily unavailable. Please try again shortly." });
  }

  const action = String(req.query.action ?? "");
  try {
    if (req.method === "POST" && action === "register") return await register(req, res);
    if (req.method === "GET" && action === "unsubscribe") return await unsubscribe(req, res);
    return res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error(`[webinar] ${action} failed:`, err?.message, err?.stack);
    return res.status(500).json({ error: "Something went wrong on our side. Please try again." });
  }
}
