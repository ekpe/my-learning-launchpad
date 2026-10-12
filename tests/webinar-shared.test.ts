import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateRegistration,
  zonedLocalToUtcIso,
  utcIsoToZonedLocal,
  buildIcs,
  googleCalendarUrl,
  formatEventWhen,
  escapeHtml,
  SECTORS,
} from "../api/_lib/webinar-shared.ts";

test("validation: requires first name and email", () => {
  const r = validateRegistration({});
  assert.equal(r.ok, false);
  assert.ok(r.errors.firstName);
  assert.ok(r.errors.email);
});

test("validation: rejects malformed emails", () => {
  for (const bad of ["a", "a@b", "a@b.", "a b@c.com", "@c.com", "x".repeat(260) + "@c.com"]) {
    assert.equal(validateRegistration({ firstName: "A", email: bad }).ok, false, bad);
  }
});

test("validation: normalizes and trims values", () => {
  const r = validateRegistration({
    firstName: "  Ada\u0000  ",
    email: "  ADA@Example.COM ",
    organization: "  Org   Name ",
  });
  assert.equal(r.ok, true);
  assert.equal(r.value!.firstName, "Ada");
  assert.equal(r.value!.email, "ada@example.com");
  assert.equal(r.value!.organization, "Org Name");
});

test("validation: marketing consent must be the boolean true", () => {
  const base = { firstName: "A", email: "a@b.co" };
  assert.equal(validateRegistration({ ...base }).value!.marketingOptIn, false);
  assert.equal(validateRegistration({ ...base, marketingOptIn: "true" }).value!.marketingOptIn, false);
  assert.equal(validateRegistration({ ...base, marketingOptIn: 1 }).value!.marketingOptIn, false);
  assert.equal(validateRegistration({ ...base, marketingOptIn: true }).value!.marketingOptIn, true);
});

test("validation: sector must come from the approved list", () => {
  const base = { firstName: "A", email: "a@b.co" };
  assert.equal(validateRegistration({ ...base, sector: SECTORS[0] }).ok, true);
  assert.equal(validateRegistration({ ...base, sector: "Made up" }).ok, false);
});

test("validation: keeps only known UTM keys and caps their length", () => {
  const r = validateRegistration({
    firstName: "A",
    email: "a@b.co",
    attribution: { utm_source: "linkedin", utm_evil: "x", utm_campaign: "y".repeat(500) },
  });
  assert.equal(r.value!.attribution.utm_source, "linkedin");
  assert.equal((r.value!.attribution as any).utm_evil, undefined);
  assert.equal(r.value!.attribution.utm_campaign!.length, 200);
});

test("time: local wall time converts to the right UTC instant across DST", () => {
  // New York: EST (UTC-5) in November, EDT (UTC-4) in July.
  assert.equal(zonedLocalToUtcIso("2026-11-10T14:00", "America/New_York"), "2026-11-10T19:00:00.000Z");
  assert.equal(zonedLocalToUtcIso("2026-07-15T14:00", "America/New_York"), "2026-07-15T18:00:00.000Z");
  // Lagos has no DST (UTC+1).
  assert.equal(zonedLocalToUtcIso("2026-11-10T14:00", "Africa/Lagos"), "2026-11-10T13:00:00.000Z");
  // UTC passthrough.
  assert.equal(zonedLocalToUtcIso("2026-11-10T14:00", "UTC"), "2026-11-10T14:00:00.000Z");
});

test("time: UTC -> zoned local round-trips", () => {
  const iso = zonedLocalToUtcIso("2026-03-08T12:30", "America/Chicago");
  assert.equal(utcIsoToZonedLocal(iso, "America/Chicago"), "2026-03-08T12:30");
});

test("time: event time is rendered in the event's timezone", () => {
  const text = formatEventWhen("2026-11-10T19:00:00.000Z", "America/New_York");
  assert.match(text, /November 10, 2026/);
  assert.match(text, /2:00\s?PM/);
  assert.match(text, /EST/);
});

test("ics: well-formed, CRLF terminated, UTC times, escaped text", () => {
  const ics = buildIcs({
    uid: "evt@mylearninglaunchpad.com",
    title: "Leading in the Age of AI; From Hype to Strategy",
    startsAtIso: "2026-11-10T19:00:00.000Z",
    durationMinutes: 60,
    description: "Line one\nLine two, with comma",
    location: "Online (Google Meet)",
    nowIso: "2026-10-01T00:00:00.000Z",
  });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(ics, /DTSTART:20261110T190000Z\r\n/);
  assert.match(ics, /DTEND:20261110T200000Z\r\n/);
  assert.match(ics, /SUMMARY:Leading in the Age of AI\\; From Hype to Strategy/);
  assert.match(ics, /DESCRIPTION:Line one\\nLine two\\, with comma/);
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
});

test("ics: long lines are folded, not truncated", () => {
  const long = "word ".repeat(60).trim();
  const ics = buildIcs({ uid: "x", title: "T", startsAtIso: "2026-11-10T19:00:00.000Z", durationMinutes: 60, description: long });
  const unfolded = ics.replace(/\r\n /g, "");
  assert.ok(unfolded.includes(`DESCRIPTION:${long}`));
});

test("google calendar url carries start/end in UTC", () => {
  const url = googleCalendarUrl({ title: "T", startsAtIso: "2026-11-10T19:00:00.000Z", durationMinutes: 60 });
  assert.match(url, /dates=20261110T190000Z%2F20261110T200000Z/);
});

test("escapeHtml neutralises markup in user-supplied names", () => {
  assert.equal(escapeHtml(`<img src=x onerror="a">`), "&lt;img src=x onerror=&quot;a&quot;&gt;");
});
