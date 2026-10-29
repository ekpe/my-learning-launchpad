/**
 * Pure, dependency-free webinar helpers shared by the browser (src/) and the
 * serverless functions (api/). Keep this file free of imports so both sides
 * (and the test runner) can load it without any bundler assumptions.
 */

export const SECTORS = [
  "Government / Public sector",
  "Small or medium-sized business",
  "University / Academia",
  "Nonprofit / Development",
  "Startup / Entrepreneurship",
  "Research / Innovation",
  "Education / Technology",
  "Large organization / Corporate",
  "Other",
] as const;

/** Bump when the consent wording shown next to the form changes. */
export const CONSENT_VERSION = "webinar-v1";

export const LIMITS = {
  firstName: 80,
  lastName: 80,
  email: 254,
  organization: 120,
  role: 120,
  country: 80,
  utm: 200,
  url: 500,
} as const;

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

export type RegistrationStatus = "open" | "closed" | "waitlist";
export type WebinarStatus = "scheduled" | "live" | "completed" | "cancelled";

export interface RegistrationInput {
  firstName: string;
  lastName?: string;
  email: string;
  organization?: string;
  role?: string;
  sector?: string;
  country?: string;
  marketingOptIn?: boolean;
  attribution?: Partial<Record<UtmKey | "landingUrl" | "referrer", string>>;
}

export interface CleanRegistration {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  role: string;
  sector: string;
  country: string;
  marketingOptIn: boolean;
  attribution: Partial<Record<UtmKey | "landingUrl" | "referrer", string>>;
}

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  value?: CleanRegistration;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function validateRegistration(raw: any): ValidationResult {
  const errors: Record<string, string> = {};
  const input = raw && typeof raw === "object" ? raw : {};

  const firstName = clean(input.firstName, LIMITS.firstName);
  if (!firstName) errors.firstName = "Please enter your first name.";

  const email = clean(input.email, LIMITS.email + 1).toLowerCase();
  if (!email) errors.email = "Please enter your email address.";
  else if (email.length > LIMITS.email || !EMAIL_RE.test(email)) errors.email = "Please enter a valid email address.";

  const sector = clean(input.sector, 80);
  if (sector && !(SECTORS as readonly string[]).includes(sector)) errors.sector = "Please choose a sector from the list.";

  const attribution: CleanRegistration["attribution"] = {};
  const a = input.attribution && typeof input.attribution === "object" ? input.attribution : {};
  for (const key of UTM_KEYS) {
    const v = clean(a[key], LIMITS.utm);
    if (v) attribution[key] = v;
  }
  const landingUrl = clean(a.landingUrl, LIMITS.url);
  if (landingUrl) attribution.landingUrl = landingUrl;
  const referrer = clean(a.referrer, LIMITS.url);
  if (referrer) attribution.referrer = referrer;

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    errors,
    value: {
      firstName,
      lastName: clean(input.lastName, LIMITS.lastName),
      email,
      organization: clean(input.organization, LIMITS.organization),
      role: clean(input.role, LIMITS.role),
      sector,
      country: clean(input.country, LIMITS.country),
      // Strictly boolean true — never infer consent from truthy strings.
      marketingOptIn: input.marketingOptIn === true,
      attribution,
    },
  };
}

// ── Time helpers ─────────────────────────────────────────────────────────────

function partsInZone(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(date)) if (p.type !== "literal") map[p.type] = Number(p.value);
  return map;
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a wall-clock "YYYY-MM-DDTHH:mm" in an IANA zone to a UTC ISO string. */
export function zonedLocalToUtcIso(local: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error("Expected local time as YYYY-MM-DDTHH:mm");
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes handle offsets that change across the guess (DST edges).
  let ts = guess - zoneOffsetMs(new Date(guess), timeZone);
  ts = guess - zoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts).toISOString();
}

/** Convert a UTC ISO string to wall-clock "YYYY-MM-DDTHH:mm" in an IANA zone. */
export function utcIsoToZonedLocal(iso: string, timeZone: string): string {
  const p = partsInZone(new Date(iso), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/** "Tuesday, November 10, 2026 at 2:00 PM EST" — in the event's own timezone. */
export function formatEventWhen(iso: string, timeZone: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

// ── Calendar helpers ─────────────────────────────────────────────────────────

const icsStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsFold(line: string): string {
  // RFC 5545: lines longer than 75 octets are folded with CRLF + space.
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (size + len > limit) {
      out.push(current);
      current = ch;
      size = len;
    } else {
      current += ch;
      size += len;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

export interface IcsEvent {
  uid: string;
  title: string;
  startsAtIso: string;
  durationMinutes: number;
  description?: string;
  location?: string;
  url?: string;
  nowIso?: string;
}

export function buildIcs(e: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyLearningLaunchpad//Webinar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsStamp(e.nowIso ?? new Date().toISOString())}`,
    `DTSTART:${icsStamp(e.startsAtIso)}`,
    `DTEND:${icsStamp(addMinutesIso(e.startsAtIso, e.durationMinutes))}`,
    `SUMMARY:${icsEscape(e.title)}`,
  ];
  if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
  if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  lines.push(
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Webinar starts in 15 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  );
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: Omit<IcsEvent, "uid" | "nowIso">): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsStamp(e.startsAtIso)}/${icsStamp(addMinutesIso(e.startsAtIso, e.durationMinutes))}`,
  });
  if (e.description) params.set("details", e.description);
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
