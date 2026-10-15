import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeDb } from "./helpers/fake-firestore.ts";

process.env.FIREBASE_PROJECT_ID = "test-project";

const d = await import("../api/_lib/course-details.ts");
const ca = await import("../api/_lib/course-admin.ts");
const { courses } = await import("../src/data/courses.ts");

const stamp = () => ({ toDate: () => new Date("2026-10-15T00:00:00Z") });
const base = { title: "T", description: "D", duration: "90 minutes total", audience: "Leaders" };

test("validation: a normal edit is accepted and trimmed", () => {
  const r = d.validateCourseDetails({ title: "  New title  ", subtitle: "Sub", outcomes: [" a ", "", "b"], benefits: ["x"] });
  assert.equal(r.ok, true);
  assert.equal(r.fields.title, "New title");
  assert.deepEqual(r.fields.outcomes, ["a", "b"], "blank lines are dropped");
});

test("validation: required fields cannot be emptied; limits are enforced", () => {
  for (const k of ["title", "description", "duration", "audience"]) {
    const r = d.validateCourseDetails({ [k]: "   " });
    assert.equal(r.ok, false, k);
    assert.ok((r.errors as any)[k], k);
  }
  assert.equal(d.validateCourseDetails({ subtitle: "x".repeat(161) }).ok, false);
  assert.equal(d.validateCourseDetails({ subtitle: "" }).ok, true, "optional fields may be cleared");
  assert.equal(d.validateCourseDetails({ outcomes: Array(11).fill("a") }).ok, false);
  assert.equal(d.validateCourseDetails({ outcomes: ["x".repeat(201)] }).ok, false);
});

test("validation: only landing-page fields; anything else is rejected, not ignored", () => {
  for (const bad of ["curriculum", "price", "isFree", "launchGate", "curriculumVersion", "order", "id", "assignment", "nextStepCourseIds"]) {
    const r = d.validateCourseDetails({ title: "ok", [bad]: bad === "curriculum" ? [] : 1 });
    assert.equal(r.ok, false, bad);
    assert.match((r.errors as any)._, new RegExp(bad));
  }
  assert.equal(d.validateCourseDetails(null).ok, false);
  assert.equal(d.validateCourseDetails({}).ok, false);
  assert.equal(d.validateCourseDetails([]).ok, false);
});

test("validation: image must be https or a site path; wrong types rejected", () => {
  for (const ok of ["", "https://cdn.example.com/a.jpg", "/images/a.jpg"]) assert.equal(d.validateCourseDetails({ image: ok }).ok, true, ok);
  for (const bad of ["http://x.com/a.jpg", "javascript:alert(1)", "//evil.com/a.jpg", "data:image/png;base64,AAAA", "not a url", "a b"]) assert.equal(d.validateCourseDetails({ image: bad }).ok, false, bad);
  assert.equal(d.validateCourseDetails({ title: 5 }).ok, false);
  assert.equal(d.validateCourseDetails({ outcomes: "one line" }).ok, false);
});

test("form values: outcomes fall back to learningObjectives (as the course page does)", () => {
  assert.deepEqual(d.detailsFromCourse({ learningObjectives: ["a"] }).outcomes, ["a"]);
  assert.deepEqual(d.detailsFromCourse({ outcomes: ["b"], learningObjectives: ["a"] }).outcomes, ["b"]);
  assert.equal(d.detailsFromCourse(null).title, "");
});

test("the real flagship's current copy passes the same rules (so it can be opened and saved unchanged)", () => {
  const f = courses.find((c) => c.id === "ai-strategy-leaders")!;
  assert.equal(d.validateCourseDetails(d.detailsFromCourse(f)).ok, true);
  for (const c of courses) assert.equal(d.validateCourseDetails(d.detailsFromCourse(c)).ok, true, c.id);
});

// ── saving ───────────────────────────────────────────────────────────────────

const seedLive = (db: any, extra: Record<string, unknown> = {}) =>
  db.seed("courses", "c1", { id: "c1", ...base, curriculum: [{ module: "M", topics: [{ title: "t", videoUrl: "https://v.example.com/1" }] }], price: 99, isFree: false, order: 3, ...extra });

test("save live: updates only the edited fields, immediately, and leaves everything else untouched", async () => {
  const db = createFakeDb();
  seedLive(db);
  const before = db.raw("courses", "c1") as any;
  const out = await ca.saveCourseDetails(db, { courseId: "c1", fields: { title: "Fresh title", subtitle: "A subtitle" } }, stamp);
  assert.equal(out.status, 200);
  assert.deepEqual((out.body.changed as string[]).sort(), ["subtitle", "title"]);
  const after = db.raw("courses", "c1") as any;
  assert.equal(after.title, "Fresh title");
  assert.equal(after.subtitle, "A subtitle");
  for (const k of ["curriculum", "price", "isFree", "order", "description", "id"]) assert.deepEqual(after[k], before[k], `${k} unchanged`);
});

test("save live: keeps the previous values so an edit can be undone; no-op saves write nothing", async () => {
  const db = createFakeDb();
  seedLive(db);
  const out = await ca.saveCourseDetails(db, { courseId: "c1", fields: { title: "Fresh title" } }, stamp, { now: () => new Date("2026-10-15T10:00:00Z") });
  const arch = db.all("courseArchive");
  assert.equal(arch.length, 1);
  assert.equal((arch[0] as any).reason, "pre-details-edit");
  assert.deepEqual((arch[0] as any).previous, { title: "T" });
  assert.equal(out.body.archived, (arch[0] as any).id);

  const same = await ca.saveCourseDetails(db, { courseId: "c1", fields: { title: "Fresh title" } }, stamp);
  assert.deepEqual(same.body.changed, []);
  assert.equal(db.all("courseArchive").length, 1, "nothing changed, nothing archived");
});

test("save: rejects bad input with per-field errors and writes nothing", async () => {
  const db = createFakeDb();
  seedLive(db);
  const before = JSON.stringify(db.raw("courses", "c1"));
  const out = await ca.saveCourseDetails(db, { courseId: "c1", fields: { title: "", image: "http://x.com/a.jpg", price: 0 } }, stamp);
  assert.equal(out.status, 400);
  assert.ok((out.body.errors as any).title);
  assert.ok((out.body.errors as any).image);
  assert.equal(JSON.stringify(db.raw("courses", "c1")), before);
  assert.equal(db.all("courseArchive").length, 0);
  assert.equal((await ca.saveCourseDetails(db, { courseId: "nope", fields: { title: "x" } }, stamp)).status, 404);
  assert.equal((await ca.saveCourseDetails(db, { fields: { title: "x" } }, stamp)).status, 400);
  assert.equal((await ca.saveCourseDetails(db, { courseId: "c1", target: "evil", fields: { title: "x" } }, stamp)).status, 400);
});

test("save draft: needs a draft, writes only the draft, live stays as visitors see it", async () => {
  const db = createFakeDb();
  seedLive(db);
  assert.equal((await ca.saveCourseDetails(db, { courseId: "c1", target: "draft", fields: { title: "Draft title" } }, stamp)).status, 404);
  await ca.syncCourseList(db, [{ id: "c1", ...base, launchGate: true, curriculumVersion: 2, curriculum: [{ module: "M", topics: [{ title: "t" }] }] }], stamp);
  const liveBefore = JSON.stringify(db.raw("courses", "c1"));
  const out = await ca.saveCourseDetails(db, { courseId: "c1", target: "draft", fields: { title: "Draft title", benefits: ["One", "Two"] } }, stamp);
  assert.equal(out.status, 200);
  assert.equal((db.raw("courseDrafts", "c1") as any).course.title, "Draft title");
  assert.deepEqual((db.raw("courseDrafts", "c1") as any).course.benefits, ["One", "Two"]);
  assert.equal(JSON.stringify(db.raw("courses", "c1")), liveBefore);
});

test("save live on a PUBLISHED launch-gated course also updates the draft, so a later publish cannot undo it", async () => {
  const db = createFakeDb();
  seedLive(db, { launchGate: true, curriculumVersion: 2 });
  db.seed("courseDrafts", "c1", { courseId: "c1", course: { id: "c1", ...base, launchGate: true, curriculum: [] } });
  await ca.saveCourseDetails(db, { courseId: "c1", fields: { title: "Edited after launch" } }, stamp);
  assert.equal((db.raw("courses", "c1") as any).title, "Edited after launch");
  assert.equal((db.raw("courseDrafts", "c1") as any).course.title, "Edited after launch");
});

test("save live on an UNpublished gated course leaves the draft alone", async () => {
  const db = createFakeDb();
  seedLive(db); // live v1: no launchGate
  db.seed("courseDrafts", "c1", { courseId: "c1", course: { id: "c1", ...base, title: "Draft v2 title", launchGate: true, curriculum: [] } });
  await ca.saveCourseDetails(db, { courseId: "c1", fields: { title: "Quick fix to the live page" } }, stamp);
  assert.equal((db.raw("courseDrafts", "c1") as any).course.title, "Draft v2 title");
});

test("the dispatcher routes course-details-save (POST only)", async () => {
  const db = createFakeDb();
  seedLive(db);
  const r = await ca.handleCourseAdminOp(db, { method: "POST", resource: "course-details-save", body: { courseId: "c1", fields: { title: "Via dispatcher" } } }, stamp);
  assert.equal(r!.status, 200);
  assert.equal(await ca.handleCourseAdminOp(db, { method: "GET", resource: "course-details-save" }, stamp), null);
});

test("save: re-submitting what the form already showed is not an edit (unset == empty, outcomes fall back to learningObjectives)", async () => {
  const db = createFakeDb();
  seedLive(db, { learningObjectives: ["A", "B"] });
  const shown = d.detailsFromCourse(db.raw("courses", "c1"));
  const out = await ca.saveCourseDetails(db, { courseId: "c1", fields: shown }, stamp);
  assert.deepEqual(out.body.changed, []);
  assert.equal(db.all("courseArchive").length, 0);
  assert.equal((db.raw("courses", "c1") as any).outcomes, undefined, "no phantom fields were created");
});
