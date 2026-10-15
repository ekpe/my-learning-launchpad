import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeDb } from "./helpers/fake-firestore.ts";

process.env.FIREBASE_PROJECT_ID = "test-project";

const ca = await import("../api/_lib/course-admin.ts");
const mig = await import("../api/_lib/flagship-migration.ts");
const { courses } = await import("../src/data/courses.ts");

const stamp = () => ({ toDate: () => new Date("2026-10-14T00:00:00Z") });
const topic = (title: string, extra: Record<string, unknown> = {}) => ({ title, ...extra });
const course = (id: string, topics: any[], extra: Record<string, unknown> = {}) => ({ id, title: id, curriculum: [{ module: "M", topics }], ...extra });

// ── sync (normal courses) ────────────────────────────────────────────────────

test("sync: first write has nothing to archive", async () => {
  const db = createFakeDb();
  const r = await ca.syncCourseList(db, [course("c1", [topic("a")])], stamp);
  assert.equal(r.synced, 1);
  assert.deepEqual(r.archived, []);
  assert.equal(db.all("courseArchive").length, 0);
});

test("sync: a changed curriculum is archived in full before it is replaced", async () => {
  const db = createFakeDb();
  db.seed("courses", "c1", course("c1", [topic("old")]));
  const r = await ca.syncCourseList(db, [course("c1", [topic("new")])], stamp);
  assert.equal(r.synced, 1);
  assert.equal(r.archived.length, 1);
  const archived = db.all("courseArchive")[0] as any;
  assert.equal(archived.courseId, "c1");
  assert.equal(archived.course.curriculum[0].topics[0].title, "old");
  assert.equal((db.raw("courses", "c1") as any).curriculum[0].topics[0].title, "new");
});

test("sync: an unchanged curriculum creates no archive", async () => {
  const db = createFakeDb();
  db.seed("courses", "c1", course("c1", [topic("same")]));
  const r = await ca.syncCourseList(db, [course("c1", [topic("same")])], stamp);
  assert.equal(r.archived.length, 0);
  assert.equal(db.all("courseArchive").length, 0);
});

test("sync: refuses to drop media URLs unless explicitly confirmed", async () => {
  const db = createFakeDb();
  db.seed("courses", "c1", course("c1", [topic("a", { videoUrl: "https://v/1" }), topic("b", { materialUrl: "https://m/2" })]));
  const incoming = course("c1", [topic("a", { videoUrl: "" }), topic("b")]);

  const blocked = await ca.syncCourseList(db, [incoming], stamp);
  assert.equal(blocked.synced, 0);
  assert.deepEqual(blocked.blocked[0].lostMedia.sort(), ["https://m/2", "https://v/1"]);
  assert.equal((db.raw("courses", "c1") as any).curriculum[0].topics[0].videoUrl, "https://v/1", "live record untouched");
  assert.equal(db.all("courseArchive").length, 0);

  const ok = await ca.syncCourseList(db, [incoming], stamp, { confirmMediaReplacement: ["c1"] });
  assert.equal(ok.synced, 1);
  assert.equal(ok.archived.length, 1);
  assert.equal((db.all("courseArchive")[0] as any).course.curriculum[0].topics[0].videoUrl, "https://v/1", "media preserved in the archive");
});

test("sync: keeping the same media URLs is not treated as loss", async () => {
  const db = createFakeDb();
  db.seed("courses", "c1", course("c1", [topic("a", { videoUrl: "https://v/1" })]));
  const r = await ca.syncCourseList(db, [course("c1", [topic("renamed", { videoUrl: "https://v/1" })])], stamp);
  assert.equal(r.blocked.length, 0);
  assert.equal(r.synced, 1);
});

// ── launch gate: drafts, readiness, publish ─────────────────────────────────

const FID = mig.FLAGSHIP_COURSE_ID;
const gated = (topics: any[], extra: Record<string, unknown> = {}) => course("g1", topics, { launchGate: true, curriculumVersion: 2, ...extra });
const goodUrl = "https://cdn.example.com/lesson-1.mp4";

test("gate: syncing a gated course writes a DRAFT and never touches the live course", async () => {
  const db = createFakeDb();
  db.seed("courses", "g1", course("g1", [topic("v1 lesson")]));
  const before = JSON.stringify(db.raw("courses", "g1"));
  const r = await ca.syncCourseList(db, [gated([topic("v2 lesson")])], stamp);
  assert.deepEqual(r.drafted, ["g1"]);
  assert.equal(r.synced, 0);
  assert.equal(JSON.stringify(db.raw("courses", "g1")), before, "live course unchanged");
  assert.equal((db.raw("courseDrafts", "g1") as any).course.curriculum[0].topics[0].title, "v2 lesson");
  assert.equal(db.all("courseArchive").length, 0);
});

test("gate: re-syncing keeps uploaded media and production status in the draft while updating copy", async () => {
  const db = createFakeDb();
  await ca.syncCourseList(db, [gated([topic("L1", { id: "a", videoUrl: "" })])], stamp);
  await ca.saveDraftCurriculum(db, { courseId: "g1", curriculum: [{ module: "M", topics: [{ id: "a", title: "L1", videoUrl: goodUrl, productionStatus: "published" }] }] }, stamp);

  const next = gated([topic("L1 retitled", { id: "a", videoUrl: "", description: "new copy" })], { title: "New course title" });
  await ca.syncCourseList(db, [next], stamp);
  const d = (db.raw("courseDrafts", "g1") as any).course;
  assert.equal(d.title, "New course title");
  assert.equal(d.curriculum[0].topics[0].title, "L1 retitled");
  assert.equal(d.curriculum[0].topics[0].description, "new copy");
  assert.equal(d.curriculum[0].topics[0].videoUrl, goodUrl, "uploaded media survived the sync");
  assert.equal(d.curriculum[0].topics[0].productionStatus, "published");
});

test("draft save: needs an existing draft, validates input, stores derived duration", async () => {
  const db = createFakeDb();
  const cur = [{ module: "M", topics: [{ title: "x" }] }];
  assert.equal((await ca.saveDraftCurriculum(db, { courseId: "g1", curriculum: cur }, stamp)).status, 404);
  await ca.syncCourseList(db, [gated([topic("x")])], stamp);
  assert.equal((await ca.saveDraftCurriculum(db, { courseId: "g1", curriculum: [] }, stamp)).status, 400);
  assert.equal((await ca.saveDraftCurriculum(db, { courseId: "g1", curriculum: [{ module: "M", topics: [{ nope: 1 }] }] }, stamp)).status, 400);
  const ok = await ca.saveDraftCurriculum(db, { courseId: "g1", curriculum: cur, duration: "90 minutes total" }, stamp);
  assert.equal(ok.status, 200);
  assert.equal((db.raw("courseDrafts", "g1") as any).course.duration, "90 minutes total");
});

test("readiness: derived from real media URLs, never from metadata", async () => {
  const db = createFakeDb();
  await ca.syncCourseList(db, [gated([
    topic("planned lesson", { kind: "lesson" }),
    topic("claims published, no media", { kind: "lesson", productionStatus: "published" }),
    topic("bad url", { kind: "lesson", videoUrl: "not a url", productionStatus: "published" }),
    topic("http only", { kind: "lesson", videoUrl: "http://insecure.example.com/v.mp4" }),
    topic("ready", { kind: "lesson", videoUrl: goodUrl }),
    topic("published", { kind: "lesson", videoUrl: goodUrl, productionStatus: "published" }),
    topic("activity", { kind: "activity", description: "d", output: "o", productionStatus: "published" }),
    topic("optional extra", { kind: "lesson", optional: true }),
  ])], stamp);
  const out = await ca.courseReadiness(db, { courseId: "g1" });
  const b = out.body as any;
  const state = Object.fromEntries(b.lessons.map((l: any) => [l.title, l.state]));
  assert.equal(state["planned lesson"], "planned");
  assert.equal(state["claims published, no media"], "in-production", "cannot be published without media");
  assert.equal(state["bad url"], "in-production");
  assert.equal(state["http only"], "planned");
  assert.equal(state["ready"], "ready");
  assert.equal(state["published"], "published");
  assert.equal(state["activity"], "published");
  assert.equal(b.launchReady, false);
  assert.equal(b.requiredTotal, 7, "optional lesson excluded");
  assert.ok(b.lessons.find((l: any) => l.title === "claims published, no media").warnings.length > 0);
  assert.equal(b.source, "draft");
});

test("readiness: unknown course 404; reachability is advisory and uses HEAD", async () => {
  const db = createFakeDb();
  assert.equal((await ca.courseReadiness(db, { courseId: "nope" })).status, 404);
  await ca.syncCourseList(db, [gated([topic("a", { kind: "lesson", videoUrl: goodUrl, productionStatus: "published" })])], stamp);
  const calls: string[] = [];
  const fake = (async (url: string, init: any) => {
    calls.push(`${init.method} ${url}`);
    return { ok: false, status: 404 } as any;
  }) as any;
  const out = await ca.courseReadiness(db, { courseId: "g1", verify: "1" }, fake);
  assert.deepEqual(calls, [`HEAD ${goodUrl}`]);
  assert.equal((out.body as any).reachability[goodUrl], "unreachable");
  assert.equal((out.body as any).launchReady, true, "an unreachable link is a warning, not a silent pass or a hard fail");
  assert.ok((out.body as any).warnings.length === 1);
});

const readyDraft = () => gated([
  topic("L1", { id: "a", kind: "lesson", videoUrl: goodUrl, productionStatus: "published" }),
  topic("A1", { id: "b", kind: "activity", description: "d", output: "o", productionStatus: "published" }),
]);

test("publish: requires the confirmation token and an existing draft", async () => {
  const db = createFakeDb();
  assert.equal((await ca.publishCourse(db, { courseId: "g1" }, stamp)).status, 400);
  assert.equal((await ca.publishCourse(db, { courseId: "g1", confirm: ca.PUBLISH_CONFIRM_TOKEN }, stamp)).status, 404);
});

test("publish: BLOCKED while any required lesson lacks media or approval; live course untouched", async () => {
  const db = createFakeDb();
  db.seed("courses", "g1", course("g1", [topic("v1 lesson")]));
  const before = JSON.stringify(db.raw("courses", "g1"));
  await ca.syncCourseList(db, [gated([topic("L1", { kind: "lesson" }), topic("A1", { kind: "activity", description: "d", output: "o" })])], stamp);
  const out = await ca.publishCourse(db, { courseId: "g1", confirm: ca.PUBLISH_CONFIRM_TOKEN }, stamp);
  assert.equal(out.status, 409);
  assert.equal((out.body.blockers as string[]).length, 2);
  assert.equal(JSON.stringify(db.raw("courses", "g1")), before);
  assert.equal(db.all("courseArchive").length, 0);
});

test("publish: succeeds only when every required lesson is ready AND approved; archives the old live version", async () => {
  const db = createFakeDb();
  db.seed("courses", "g1", course("g1", [topic("v1 lesson")]));
  db.seed("enrollments", `u_g1`, { userId: "u", courseId: "g1", status: "IN_PROGRESS", completedLessons: ["0_0"], progress: 50 });
  const enrBefore = JSON.stringify(db.raw("enrollments", "u_g1"));
  await ca.syncCourseList(db, [readyDraft()], stamp);

  const out = await ca.publishCourse(db, { courseId: "g1", confirm: ca.PUBLISH_CONFIRM_TOKEN }, stamp);
  assert.equal(out.status, 200);
  const live = db.raw("courses", "g1") as any;
  assert.equal(live.curriculumVersion, 2);
  assert.equal(live.launchGate, true);
  assert.ok(live.publishedAt);
  assert.equal(live.curriculum[0].topics[0].videoUrl, goodUrl);
  assert.equal((db.all("courseArchive")[0] as any).course.curriculum[0].topics[0].title, "v1 lesson", "previous live version archived");
  assert.equal(JSON.stringify(db.raw("enrollments", "u_g1")), enrBefore, "publishing never touches learner records");
});

test("publish: will not drop media that exists only in the live course unless confirmed", async () => {
  const db = createFakeDb();
  db.seed("courses", "g1", course("g1", [topic("old", { videoUrl: "https://old.example.com/keep.mp4" })]));
  await ca.syncCourseList(db, [readyDraft()], stamp);
  const blocked = await ca.publishCourse(db, { courseId: "g1", confirm: ca.PUBLISH_CONFIRM_TOKEN }, stamp);
  assert.equal(blocked.status, 409);
  assert.deepEqual(blocked.body.lostMedia, ["https://old.example.com/keep.mp4"]);
  const ok = await ca.publishCourse(db, { courseId: "g1", confirm: ca.PUBLISH_CONFIRM_TOKEN, confirmMediaReplacement: true }, stamp);
  assert.equal(ok.status, 200);
});

test("dispatcher routes course-* admin operations and ignores others", async () => {
  const db = createFakeDb();
  assert.equal(await ca.handleCourseAdminOp(db, { method: "GET", resource: "users" }, stamp), null);
  const r = await ca.handleCourseAdminOp(db, { method: "GET", resource: "course-draft-get", query: { courseId: "g1" } }, stamp);
  assert.equal(r!.status, 200);
  assert.equal((r!.body as any).exists, false);
  assert.equal((await ca.handleCourseAdminOp(db, { method: "GET", resource: "course-publish" }, stamp)), null, "wrong method is not routed");
});

// ── learner progress migration ───────────────────────────────────────────────

const enrollment = (uid: string, status: string, completed: string[], extra: Record<string, unknown> = {}) => ({
  userId: uid, courseId: FID, status, completedLessons: completed, progress: Math.round((completed.length / 35) * 100), ...extra,
});
const cert = (uid: string) => ({ userId: uid, courseId: FID, courseTitle: "AI Strategy for Leaders", userName: uid, certificateId: `CERT_${uid}_${FID}`, issuedAt: stamp() });
const ALL_V1 = mig.V1_TO_V2.map((r) => r.oldId);

function seeded() {
  const db = createFakeDb();
  db.seed("enrollments", `a_${FID}`, enrollment("a", "ENROLLED", []));
  db.seed("enrollments", `b_${FID}`, enrollment("b", "IN_PROGRESS", ["0_0", "0_1", "0_2", "0_3", "1_0"]));
  db.seed("enrollments", `c_${FID}`, enrollment("c", "COMPLETED", ALL_V1, { progress: 100 }));
  db.seed("certificates", `CERT_c_${FID}`, cert("c"));
  db.seed("enrollments", `e_${FID}`, enrollment("e", "COMPLETED", ALL_V1, { progress: 100 })); // completed, certificate missing
  db.seed("enrollments", `f_${FID}`, enrollment("f", "IN_PROGRESS", ["0_0", "9_9"])); // contains an id that never existed
  db.seed("certificates", `CERT_f_${FID}`, cert("f")); // certificate but not completed
  db.seed("enrollments", "d_ai-strategy-intensive", { userId: "d", courseId: "ai-strategy-intensive", status: "IN_PROGRESS", completedLessons: ["0_0"], progress: 10 });
  return db;
}
const snapshot = (db: any) => JSON.stringify([db.all("enrollments"), db.all("certificates")]);
const APPLY = { mode: "apply", confirm: "MIGRATE-FLAGSHIP-V2" } as const;
const REVERT = { mode: "revert", confirm: "MIGRATE-FLAGSHIP-V2" } as const;

test("migration dry run: reports the required figures and writes nothing", async () => {
  const db = seeded();
  const before = snapshot(db);
  const out = await ca.migrateFlagshipProgress(db, {}, stamp);
  const r = out.body as any;
  assert.equal(out.status, 200);
  assert.equal(r.mode, "dry-run");
  assert.equal(r.total, 5, "paid-course enrollments are not counted");
  assert.equal(r.completedLearners, 2);
  assert.equal(r.partialLearners, 2);
  assert.equal(r.notStartedLearners, 1);
  assert.equal(r.unmappable.learners, 1, "learner b completed v1 lesson 0_3 (optional in v2)");
  assert.equal(r.unmappable.unknownLessonIds, 1, "9_9 does not exist in v1");
  assert.equal(r.certificates.completedWithCertificate, 1);
  assert.equal(r.certificates.completedMissingCertificate, 1);
  assert.equal(r.certificates.certificateWithoutCompletion, 1);
  assert.equal(snapshot(db), before);
});

test("migration: apply and revert require the confirmation token; only the flagship is allowed", async () => {
  const db = seeded();
  for (const mode of ["apply", "revert"] as const) assert.equal((await ca.migrateFlagshipProgress(db, { mode }, stamp)).status, 400);
  assert.equal((await ca.migrateFlagshipProgress(db, { courseId: "ai-strategy-intensive" }, stamp)).status, 400);
});

test("migration: learners who COMPLETED the original course keep status, progress, completedLessons and certificate", async () => {
  const db = seeded();
  const cBefore = db.raw("enrollments", `c_${FID}`) as any;
  const certBefore = JSON.stringify(db.raw("certificates", `CERT_c_${FID}`));
  await ca.migrateFlagshipProgress(db, APPLY, stamp);

  const c = db.raw("enrollments", `c_${FID}`) as any;
  assert.equal(c.status, "COMPLETED");
  assert.equal(c.progress, 100);
  assert.deepEqual(c.completedLessons, cBefore.completedLessons, "no v2 completions are fabricated");
  assert.equal(c.completedLessons.length, 35);
  assert.equal(c.curriculumVersion, 1, "original version is stated explicitly");
  assert.equal(c.v2Progress, undefined, "no new-curriculum record unless the learner opts in");
  assert.equal(JSON.stringify(db.raw("certificates", `CERT_c_${FID}`)), certBefore);
  assert.equal(db.all("certificates").length, 2, "no certificate was created or removed");
});

test("migration: partly-complete learners are remapped, with their original progress backed up", async () => {
  const db = seeded();
  await ca.migrateFlagshipProgress(db, APPLY, stamp);

  const a = db.raw("enrollments", `a_${FID}`) as any;
  assert.deepEqual(a.completedLessons, []);
  assert.equal(a.status, "ENROLLED");
  assert.equal(a.curriculumVersion, 2);

  const b = db.raw("enrollments", `b_${FID}`) as any;
  assert.deepEqual(b.completedLessons, ["0_0", "0_1", "0_2", "1_0"]);
  assert.equal(b.status, "IN_PROGRESS");
  assert.deepEqual(b.legacyCompletedLessons, ["0_0", "0_1", "0_2", "0_3", "1_0"]);
  assert.ok(b.progress > 0 && b.progress < 100);

  const f = db.raw("enrollments", `f_${FID}`) as any;
  assert.deepEqual(f.legacyCompletedLessons, ["0_0", "9_9"], "unmappable ids are kept, not discarded");
});

test("migration: never touches paid-course enrollments", async () => {
  const db = seeded();
  const before = JSON.stringify(db.raw("enrollments", "d_ai-strategy-intensive"));
  await ca.migrateFlagshipProgress(db, APPLY, stamp);
  assert.equal(JSON.stringify(db.raw("enrollments", "d_ai-strategy-intensive")), before);
});

test("migration: apply is idempotent", async () => {
  const db = seeded();
  await ca.migrateFlagshipProgress(db, APPLY, stamp);
  const once = snapshot(db);
  const again = await ca.migrateFlagshipProgress(db, APPLY, stamp);
  assert.equal((again.body as any).changed, 0);
  assert.equal(snapshot(db), once);
});

test("migration: revert restores moved learners exactly; completed learners were never changed", async () => {
  const db = seeded();
  const original = Object.fromEntries(db.all("enrollments").map((e: any) => [e.id, { c: e.completedLessons, p: e.progress, s: e.status }]));
  await ca.migrateFlagshipProgress(db, APPLY, stamp);
  const out = await ca.migrateFlagshipProgress(db, REVERT, stamp);
  assert.equal((out.body as any).reverted, 3, "a, b and f were moved");
  for (const e of db.all("enrollments") as any[]) {
    assert.deepEqual({ c: e.completedLessons, p: e.progress, s: e.status }, original[e.id], e.id);
  }
});

test("migration: paginates past one page of enrollments", async () => {
  const db = createFakeDb();
  for (let i = 0; i < 650; i++) db.seed("enrollments", `u${String(i).padStart(4, "0")}_${FID}`, enrollment(`u${i}`, "ENROLLED", []));
  const out = await ca.migrateFlagshipProgress(db, APPLY, stamp);
  assert.equal((out.body as any).total, 650);
  assert.equal((out.body as any).changed, 650);
});

test("static flagship order matches the v2 id order used by the migration", () => {
  const f = courses.find((c) => c.id === FID)!;
  assert.deepEqual(f.curriculum.flatMap((m) => m.topics.map((t) => t.id)), mig.FLAGSHIP_V2_ORDER);
});
