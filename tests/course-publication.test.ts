import { test } from "node:test";
import assert from "node:assert/strict";

const pub = await import("../api/_lib/course-publication.ts");
const { courses } = await import("../src/data/courses.ts");

const lesson = (extra: Record<string, unknown> = {}) => ({ title: "L", kind: "lesson" as const, ...extra });

test("media URL validation: https with a real host only", () => {
  for (const ok of ["https://cdn.example.com/a.mp4", "https://youtu.be/abc", "https://vimeo.com/123", "  https://x.io/v  "]) assert.equal(pub.isValidMediaUrl(ok), true, ok);
  for (const bad of ["", "   ", "http://insecure.example.com/a.mp4", "javascript:alert(1)", "data:video/mp4;base64,AAAA", "ftp://x.com/a", "https://localhost/a", "not a url", "https://a b.com", undefined, null, 42])
    assert.equal(pub.isValidMediaUrl(bad as any), false, String(bad));
});

test("lesson states follow the media, not the metadata", () => {
  assert.equal(pub.assessTopic(lesson()).state, "planned");
  assert.equal(pub.assessTopic(lesson({ productionStatus: "in-production" })).state, "in-production");
  assert.equal(pub.assessTopic(lesson({ videoUrl: "https://a.example.com/v" })).state, "ready");
  assert.equal(pub.assessTopic(lesson({ videoUrl: "https://a.example.com/v", productionStatus: "published" })).state, "published");
  const lie = pub.assessTopic(lesson({ productionStatus: "published" }));
  assert.equal(lie.state, "in-production");
  assert.ok(lie.warnings.length > 0);
});

test("activities need on-page content, not media", () => {
  assert.equal(pub.assessTopic({ title: "A", kind: "activity" }).state, "planned");
  assert.equal(pub.assessTopic({ title: "A", kind: "activity", description: "d", output: "o" }).state, "ready");
  assert.equal(pub.assessTopic({ title: "A", kind: "activity", description: "d", output: "o", productionStatus: "published" }).state, "published");
  assert.equal(pub.assessTopic({ title: "A", kind: "activity", description: "d", productionStatus: "published" }).state, "in-production");
});

test("the real flagship, as shipped in source, is NOT launch-ready (no media exists yet)", () => {
  const f = courses.find((c) => c.id === "ai-strategy-leaders")!;
  assert.equal(f.launchGate, true);
  const r = pub.buildReadiness(f.id, f.curriculum as any);
  assert.equal(r.launchReady, false);
  assert.equal(r.requiredTotal, 24);
  assert.equal(r.counts.published, 0);
  assert.equal(r.counts.planned, 18, "18 lessons have no video");
  assert.equal(r.counts.ready, 6, "the 6 activities have their on-page content but are awaiting sign-off");
  assert.equal(r.blockers.length, 24);
});

test("a course with no required lessons is never ready", () => {
  assert.equal(pub.buildReadiness("x", []).launchReady, false);
  assert.equal(pub.buildReadiness("x", undefined).launchReady, false);
  assert.equal(pub.buildReadiness("x", [{ module: "M", topics: [lesson({ optional: true })] }]).launchReady, false);
});

test("ready only when EVERY required lesson is published; optional topics never matter", () => {
  const url = "https://cdn.example.com/v.mp4";
  const topics = [lesson({ videoUrl: url, productionStatus: "published" }), lesson({ title: "opt", optional: true })];
  assert.equal(pub.buildReadiness("x", [{ module: "M", topics }]).launchReady, true);
  topics[0] = lesson({ videoUrl: url });
  assert.equal(pub.buildReadiness("x", [{ module: "M", topics }]).launchReady, false, "ready but not approved is not enough");
});

test("mergeDraftMedia: keeps uploaded media and production state, lets static copy win elsewhere", () => {
  const existing = { curriculum: [{ module: "M", topics: [{ id: "a", title: "old", videoUrl: "https://x.example.com/v", productionStatus: "published" as const, materialUrl: "https://x.example.com/m.pdf" }] }] };
  const incoming = { curriculum: [{ module: "M2", topics: [{ id: "a", title: "new title", videoUrl: "", description: "fresh" }] }] };
  const merged = pub.mergeDraftMedia(incoming, existing as any);
  const t = merged.curriculum![0].topics[0] as any;
  assert.equal(t.title, "new title");
  assert.equal(t.description, "fresh");
  assert.equal(t.videoUrl, "https://x.example.com/v");
  assert.equal(t.productionStatus, "published");
  assert.equal(t.materialUrl, "https://x.example.com/m.pdf");
  assert.equal(merged.curriculum![0].module, "M2");
});

test("mergeDraftMedia: a newly supplied static URL wins over the draft; no draft is a no-op", () => {
  const existing = { curriculum: [{ module: "M", topics: [{ id: "a", title: "t", videoUrl: "https://old.example.com/v" }] }] };
  const incoming = { curriculum: [{ module: "M", topics: [{ id: "a", title: "t", videoUrl: "https://new.example.com/v" }] }] };
  assert.equal((pub.mergeDraftMedia(incoming, existing as any).curriculum![0].topics[0] as any).videoUrl, "https://new.example.com/v");
  assert.equal(pub.mergeDraftMedia(incoming, null), incoming);
});
