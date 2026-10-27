import { test } from "node:test";
import assert from "node:assert/strict";

const a = await import("../src/lib/webinarAnnouncement.ts");
const { normalizeWebinar } = await import("../src/config/webinar.ts");

const NOW = Date.parse("2026-10-26T12:00:00Z");
const cfg = (extra: Record<string, unknown>) => normalizeWebinar("e", { title: "Leading in the Age of AI", timezone: "America/New_York", webinarStatus: "scheduled", registrationStatus: "open", startsAt: "2026-10-31T16:00:00.000Z", ...extra });

test("announces an open, scheduled, future webinar with its real date in the event's time zone", () => {
  const r = a.announcementFor(cfg({}), NOW);
  assert.equal(r?.mode, "open");
  assert.match((r as any).when, /Sat, Oct 31/);
  assert.match((r as any).when, /12:00 PM EDT/);
  assert.equal(r?.title, "Leading in the Age of AI");
});

test("a waitlist (no date yet) is announced without inventing a date", () => {
  const r = a.announcementFor(cfg({ startsAt: null, registrationStatus: "waitlist" }), NOW);
  assert.equal(r?.mode, "waitlist");
  assert.equal("when" in (r as object), false);
});

test("nothing is announced for closed, completed, cancelled, live, past or missing events", () => {
  assert.equal(a.announcementFor(cfg({ registrationStatus: "closed" }), NOW), null);
  assert.equal(a.announcementFor(cfg({ webinarStatus: "completed" }), NOW), null);
  assert.equal(a.announcementFor(cfg({ webinarStatus: "cancelled" }), NOW), null);
  assert.equal(a.announcementFor(cfg({ webinarStatus: "live" }), NOW), null);
  assert.equal(a.announcementFor(cfg({ startsAt: "2026-10-20T16:00:00.000Z" }), NOW), null, "already started");
  assert.equal(a.announcementFor(null, NOW), null);
  assert.equal(a.announcementFor(undefined, NOW), null);
});

test("the bar appears only on public marketing pages", () => {
  for (const p of ["/", "/course/ai-strategy-leaders", "/course/ai-strategy-leaders/"]) assert.equal(a.showsAnnouncementOn(p), true, p);
  for (const p of ["/webinar", "/webinar/thank-you", "/dashboard", "/admin", "/course/x/lesson/0/0", "/course/x/quiz/1", "/privacy", "/certificate/abc"]) assert.equal(a.showsAnnouncementOn(p), false, p);
});

test("announcement links go to the webinar page with tracking parameters", () => {
  for (const h of [a.ANNOUNCEMENT_HREF, a.NAV_HREF]) {
    assert.match(h, /^\/webinar\?/);
    assert.match(h, /utm_source=site/);
  }
});
