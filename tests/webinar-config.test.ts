import { test } from "node:test";
import assert from "node:assert/strict";

process.env.FIREBASE_PROJECT_ID = "test-project";

const { courses } = await import("../src/data/courses.ts");
const server = await import("../api/_lib/webinar.ts");
const client = await import("../src/config/webinar.ts");

test("server pathway list matches the live course catalog (ids and titles)", () => {
  for (const p of server.PATHWAY_COURSES) {
    const c = courses.find((x) => x.id === p.id);
    assert.ok(c, `course ${p.id} exists in src/data/courses.ts`);
    assert.equal(c!.title, p.title, `title for ${p.id} has drifted from courses.ts`);
    assert.equal(c!.isFree, false, `${p.id} is a paid pathway`);
  }
});

test("flagship course exists and is free; client and server agree on ids", () => {
  const flagship = courses.find((c) => c.id === client.FLAGSHIP_COURSE_ID);
  assert.ok(flagship?.isFree);
  assert.equal(server.FLAGSHIP_COURSE_ID, client.FLAGSHIP_COURSE_ID);
  assert.deepEqual(client.PATHWAY_COURSE_IDS, server.PATHWAY_COURSES.map((p) => p.id));
  assert.equal(server.DEFAULT_EVENT_ID, client.DEFAULT_EVENT_ID);
});

test("form mode only ever reflects real configuration", () => {
  const base = client.normalizeWebinar("e", { startsAt: "2030-01-01T10:00:00.000Z", registrationStatus: "open" });
  assert.equal(client.formModeFor(base), "registration");
  assert.equal(client.formModeFor({ ...base, startsAt: null }), "interest", "no date -> waitlist, never a made-up date");
  assert.equal(client.formModeFor({ ...base, registrationStatus: "waitlist" }), "interest");
  assert.equal(client.formModeFor({ ...base, registrationStatus: "closed" }), "closed");
  assert.equal(client.formModeFor({ ...base, webinarStatus: "completed" }), "closed");
  assert.equal(client.formModeFor({ ...base, webinarStatus: "cancelled" }), "closed");
});

test("config normalization falls back safely on malformed Firestore data", () => {
  const c = client.normalizeWebinar("e", { startsAt: 42, registrationStatus: "bogus", durationMinutes: -5, agenda: "nope" });
  assert.equal(c.startsAt, null);
  assert.equal(c.registrationStatus, "waitlist");
  assert.equal(c.durationMinutes, 60);
  assert.equal(c.agenda, client.DEFAULT_AGENDA);
});

test("CTA label never promises a seat unless registration is really open", () => {
  assert.equal(client.ctaLabelFor("registration"), "Reserve My Free Seat");
  assert.notEqual(client.ctaLabelFor("interest"), "Reserve My Free Seat");
  assert.notEqual(client.ctaLabelFor("closed"), "Reserve My Free Seat");
  assert.notEqual(client.ctaLabelFor("unavailable"), "Reserve My Free Seat");
});
