import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.FIREBASE_PROJECT_ID = "test-project";

const { courses } = await import("../src/data/courses.ts");
const { courseDuration, moduleDuration } = await import("../src/lib/courseDuration.ts");
const { computeProgress, nextRequiredKey, requiredKeys } = await import("../src/lib/courseProgress.ts");
const mig = await import("../api/_lib/flagship-migration.ts");

const readJson = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const flagship = courses.find((c) => c.id === "ai-strategy-leaders")!;

const PER_MODULE = [
  { video: 12, activity: 3 },
  { video: 12, activity: 3 },
  { video: 12, activity: 3 },
  { video: 12, activity: 3 },
  { video: 10, activity: 2 },
  { video: 14, activity: 4 },
];

test("flagship is free, has six modules in the approved order", () => {
  assert.equal(flagship.isFree, true);
  assert.equal(flagship.curriculum.length, 6);
  assert.deepEqual(flagship.curriculum.map((m) => m.phase), ["Understand", "Anticipate", "Identify", "Redesign", "Govern", "Execute"]);
  assert.equal(flagship.curriculumVersion, 2);
  assert.equal(flagship.trackLabel, "AI Leadership Foundations");
});

test("planned durations total 72 video + 18 activity = 90 minutes", () => {
  const d = courseDuration(flagship);
  assert.equal(d.videoMinutes, 72);
  assert.equal(d.activityMinutes, 18);
  assert.equal(d.totalMinutes, 90);
  assert.equal(d.complete, true);
});

test("each module matches its planned video/activity budget", () => {
  flagship.curriculum.forEach((m, i) => {
    const d = moduleDuration(m);
    assert.equal(d.videoMinutes, PER_MODULE[i].video, `module ${i + 1} video`);
    assert.equal(d.activityMinutes, PER_MODULE[i].activity, `module ${i + 1} activity`);
  });
});

test("durations are labelled as planned and the headline matches the computed total", () => {
  assert.equal(flagship.durationStatus, "planned");
  assert.match(flagship.duration, /^90 minutes/);
});

test("no five-hour wording remains in active flagship marketing", () => {
  const { curriculum, optionalResources, ...marketing } = flagship;
  const text = JSON.stringify(marketing) + JSON.stringify(curriculum);
  assert.doesNotMatch(text, /5 hours|five hours|five-hour|5-hour|Executive Track/i);
});

test("every topic has a unique stable id, a description and a planned duration", () => {
  const ids = flagship.curriculum.flatMap((m) => m.topics.map((t) => t.id));
  assert.equal(ids.length, 24);
  assert.equal(new Set(ids).size, 24);
  assert.deepEqual(ids, mig.FLAGSHIP_V2_ORDER);
  for (const m of flagship.curriculum) for (const t of m.topics) {
    assert.ok(t.description, `${t.id} description`);
    assert.ok(typeof t.plannedMinutes === "number", `${t.id} plannedMinutes`);
  }
});

test("videos are never faked: every required lesson URL is empty until media exists", () => {
  for (const m of flagship.curriculum) for (const t of m.topics) assert.ok(!t.videoUrl, `${t.id} must not have an invented video URL`);
});

test("optional resources are unpublished placeholders and cannot affect duration or completion", () => {
  assert.ok((flagship.optionalResources ?? []).length > 0);
  for (const r of flagship.optionalResources ?? []) {
    assert.equal(r.available, false);
    assert.ok(!r.url);
  }
  const withOptional = { curriculum: [...flagship.curriculum, { module: "Extra", topics: [{ title: "Bonus", optional: true, kind: "lesson" as const, plannedMinutes: 60 }] }] };
  assert.equal(courseDuration(withOptional).totalMinutes, 90);
  assert.equal(requiredKeys(withOptional).length, 24);
});

test("paid courses are byte-for-byte unchanged from the frozen fixture", () => {
  const frozen = readJson("./fixtures/paid-courses.frozen.json");
  for (const f of frozen) {
    const now = courses.find((c) => c.id === f.id);
    assert.deepEqual(JSON.parse(JSON.stringify(now)), f, `${f.id} changed`);
  }
  assert.equal(courses.filter((c) => !c.isFree).length, frozen.length);
  assert.equal(new Set(courses.map((c) => c.id)).size, courses.length, "no duplicate course records");
});

test("progress counts required topics only and ignores stale or unknown ids", () => {
  assert.equal(requiredKeys(flagship).length, 24);
  assert.equal(computeProgress(flagship, []).percent, 0);
  assert.equal(computeProgress(flagship, ["0_0", "0_1", "9_9", "x"]).completed, 2);
  const all = requiredKeys(flagship);
  const full = computeProgress(flagship, [...all, "6_5"]);
  assert.equal(full.percent, 100);
  assert.equal(full.isComplete, true);
  assert.equal(nextRequiredKey(flagship, all), null);
  assert.equal(nextRequiredKey(flagship, ["0_0"]), "0_1");
});

test("migration map covers every v1 lesson exactly once and matches the archived live backup", () => {
  const live = readJson("../docs/archive/ai-strategy-leaders.live-firestore-2026-10-14.json");
  const v1: { id: string; title: string }[] = [];
  (live.curriculum ?? live.data?.curriculum).forEach((m: any, i: number) => m.topics.forEach((t: any, j: number) => v1.push({ id: `${i}_${j}`, title: t.title })));
  assert.equal(v1.length, 35);
  assert.deepEqual(mig.V1_TO_V2.map((r) => r.oldId), v1.map((t) => t.id));
  for (const t of v1) assert.equal(mig.V1_TO_V2.find((r) => r.oldId === t.id)!.oldTitle, t.title);
});

test("migration map targets only real v2 topics, every v2 topic is accounted for", () => {
  const targets = new Set(mig.V1_TO_V2.filter((r) => r.newId).map((r) => r.newId));
  for (const id of targets) assert.ok(mig.FLAGSHIP_V2_ORDER.includes(id as string), `${id} is a v2 topic`);
  const unmapped = mig.FLAGSHIP_V2_ORDER.filter((id) => !targets.has(id));
  assert.deepEqual(unmapped.sort(), mig.NEW_IN_V2.map((n) => n.newId).sort());
  for (const r of mig.V1_TO_V2) {
    if (r.status === "optional" || r.status === "archived") assert.equal(r.carry, false);
    if (r.newId?.endsWith("-a")) assert.equal(r.carry, false, "activities are never auto-completed");
  }
});

test("v2 position helper agrees with the real curriculum", () => {
  flagship.curriculum.forEach((m, mi) => m.topics.forEach((t, ti) => assert.equal(mig.v2PositionOf(t.id!), `${mi}_${ti}`)));
});

test("progress remap never invents completion", () => {
  assert.deepEqual(mig.remapCompletedLessons([]).newCompleted, []);
  // Lessons 1.1-1.3 done -> m1-l1..l3 carried (0_0,0_1,0_2); the v1 self-assessment is not carried.
  const r = mig.remapCompletedLessons(["0_0", "0_1", "0_2", "0_3"]);
  assert.deepEqual(r.newCompleted, ["0_0", "0_1", "0_2"]);
  assert.deepEqual(r.notCarried, ["0_3"]);
  // Merged lesson needs ALL sources: only 3.3 done -> m3-l3 not carried.
  assert.deepEqual(mig.remapCompletedLessons(["2_2"]).newCompleted, []);
  assert.deepEqual(mig.remapCompletedLessons(["2_2", "2_3"]).newCompleted, ["2_2"]);
  // Activities never auto-complete, even when every v1 activity was done.
  const acts = mig.remapCompletedLessons(["0_3", "1_4", "2_4", "3_4", "4_4", "6_0", "6_1", "6_2", "6_3", "6_4"]);
  assert.deepEqual(acts.newCompleted, []);
  // A fully-complete v1 learner does NOT become fully complete in v2 (new activities remain).
  const all = mig.V1_TO_V2.map((r) => r.oldId);
  const full = mig.remapCompletedLessons(all).newCompleted;
  assert.ok(computeProgress(flagship, full).percent < 100);
  for (const k of full) assert.ok(requiredKeys(flagship).includes(k));
});
