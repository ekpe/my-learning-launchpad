import { test } from "node:test";
import assert from "node:assert/strict";

const { courses } = await import("../src/data/courses.ts");
const track = await import("../src/lib/courseProgress.ts");
const live = await import("../src/lib/liveCourse.ts");

const v2 = courses.find((c) => c.id === "ai-strategy-leaders")!;
const KEYS = track.requiredKeys(v2);
const enr = (extra: Record<string, unknown> = {}) => ({ userId: "u", courseId: v2.id, status: "IN_PROGRESS", enrolledAt: null, progress: 0, completedLessons: [], ...extra }) as any;
const legacyCompleted = enr({ status: "COMPLETED", progress: 100, completedLessons: Array.from({ length: 35 }, (_, i) => `${Math.floor(i / 5)}_${i % 5}`) });

test("track: same-version enrollment uses its own fields", () => {
  const t = track.resolveTrack(v2, enr({ curriculumVersion: 2, completedLessons: ["0_0"] }));
  assert.equal(t.source, "primary");
  assert.equal(t.isLegacyEnrollment, false);
  assert.deepEqual(t.completedLessons, ["0_0"]);
});

test("track: an unstamped enrollment is version 1 and is legacy against the v2 course", () => {
  assert.equal(track.enrollmentVersion(enr()), 1);
  const t = track.resolveTrack(v2, legacyCompleted);
  assert.equal(t.isLegacyEnrollment, true);
  assert.equal(t.source, "none");
  assert.deepEqual(t.completedLessons, [], "old positional ids are NEVER read against the new structure");
  assert.equal(t.legacy?.status, "COMPLETED");
  assert.equal(t.legacy?.progress, 100);
});

test("track: before the course is published as v2, nothing changes for existing learners", () => {
  const liveV1 = { ...v2, curriculumVersion: undefined, curriculum: v2.curriculum };
  const t = track.resolveTrack(liveV1, legacyCompleted);
  assert.equal(t.isLegacyEnrollment, false);
  assert.equal(t.source, "primary");
  assert.equal(t.status, "COMPLETED");
});

test("track: a legacy learner who opts in has a SEPARATE record and keeps their original result", () => {
  const e = enr({ ...legacyCompleted, v2Progress: { completedLessons: ["0_0", "0_1"], progress: 8, status: "IN_PROGRESS", curriculumVersion: 2 } });
  const t = track.resolveTrack(v2, e);
  assert.equal(t.source, "v2Progress");
  assert.deepEqual(t.completedLessons, ["0_0", "0_1"]);
  assert.equal(t.legacy?.status, "COMPLETED");
});

test("progressUpdate: v2Progress writes dotted paths and never touches the original fields", () => {
  const e = enr({ ...legacyCompleted, v2Progress: { completedLessons: [], progress: 0, status: "IN_PROGRESS", curriculumVersion: 2 } });
  const t = track.resolveTrack(v2, e);
  const { fields, status } = track.progressUpdate(t, v2, ["0_0"]);
  assert.deepEqual(Object.keys(fields).sort(), ["v2Progress.completedLessons", "v2Progress.progress", "v2Progress.status"]);
  assert.equal(status, "IN_PROGRESS");
  assert.equal("status" in fields, false);
  assert.equal("completedLessons" in fields, false);
});

test("progressUpdate: primary track writes the top-level fields and detects completion", () => {
  const t = track.resolveTrack(v2, enr({ curriculumVersion: 2 }));
  const { fields, status, summary } = track.progressUpdate(t, v2, KEYS);
  assert.equal(status, "COMPLETED");
  assert.equal(summary.percent, 100);
  assert.deepEqual(Object.keys(fields).sort(), ["completedLessons", "progress", "status"]);
});

test("certificates: issued only on the primary track and never over an existing one", () => {
  const primary = track.resolveTrack(v2, enr({ curriculumVersion: 2 }));
  assert.equal(track.shouldIssueCertificate(primary, "COMPLETED", false), true);
  assert.equal(track.shouldIssueCertificate(primary, "COMPLETED", true), false, "existing certificate is kept");
  assert.equal(track.shouldIssueCertificate(primary, "IN_PROGRESS", false), false);
  const optedIn = track.resolveTrack(v2, enr({ ...legacyCompleted, v2Progress: { completedLessons: KEYS, progress: 100, status: "COMPLETED", curriculumVersion: 2 } }));
  assert.equal(track.shouldIssueCertificate(optedIn, "COMPLETED", true), false);
  assert.equal(track.shouldIssueCertificate(optedIn, "COMPLETED", false), false, "completing the new version never creates a second certificate");
});

test("no enrollment -> not started", () => {
  const t = track.resolveTrack(v2, null);
  assert.equal(t.status, "NOT_STARTED");
  assert.equal(t.source, "none");
});

test("live course gate: a launch-gated static course is never shown without a live record", () => {
  assert.equal(live.resolveCourse("ai-strategy-leaders", null), undefined);
  assert.equal(live.resolveCourse("ai-strategy-leaders", undefined), undefined);
  const liveRecord = { ...v2, duration: "Approximately 5 hours (Self-paced)", curriculumVersion: undefined } as any;
  assert.equal(live.resolveCourse("ai-strategy-leaders", liveRecord), liveRecord, "the live record always wins");
});

test("live course gate: paid courses still fall back to the static copy, and the catalog hides only gated ones", () => {
  assert.equal(live.resolveCourse("ai-strategy-intensive", null)?.id, "ai-strategy-intensive");
  const ids = live.publicStaticCourses().map((c) => c.id);
  assert.ok(!ids.includes("ai-strategy-leaders"));
  assert.equal(ids.length, courses.length - 1);
});
