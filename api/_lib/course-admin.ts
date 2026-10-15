/**
 * Admin operations that touch course curriculum or enrolled learners' progress.
 * Everything takes the Firestore handle as a parameter so tests (and the local harness) can use the in-memory fake.
 *
 *  - syncCourseList: the "Sync Static Data" write. Normal courses are archived before being replaced and are
 *    protected from silently losing media links. Courses with launchGate:true never reach learners from a
 *    sync: they are written to courseDrafts/{id}, merging in any media already uploaded there.
 *  - draft / readiness / publish: the launch gate. A gated course goes live only when every required lesson has
 *    a valid media URL AND is explicitly published (see course-publication.ts).
 *  - migrateFlagshipProgress: dry-run-first v1 -> v2 progress migration, reversible. Learners who completed the
 *    original course keep their status, progress, certificate and curriculum version untouched.
 */
import { FieldPath } from "firebase-admin/firestore";
import {
  FLAGSHIP_COURSE_ID,
  FLAGSHIP_V2_VERSION,
  V1_TO_V2,
  remapCompletedLessons,
} from "./flagship-migration.js";
import { detailsFromCourse, validateCourseDetails } from "./course-details.js";
import {
  MIGRATION_CONFIRM_TOKEN,
  PUBLISH_CONFIRM_TOKEN,
  buildReadiness,
  isValidMediaUrl,
  mergeDraftMedia,
  type ReadinessReport,
} from "./course-publication.js";

type Db = any;
type Stamp = () => unknown;
type OpResult = { status: number; body: Record<string, unknown> };

export const DRAFTS = "courseDrafts";
export const ARCHIVE = "courseArchive";
export { PUBLISH_CONFIRM_TOKEN, MIGRATION_CONFIRM_TOKEN };

// ── helpers ──────────────────────────────────────────────────────────────────

/** Every non-empty video/material URL in a curriculum. */
export function mediaUrls(curriculum: any): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(curriculum)) return out;
  for (const m of curriculum)
    for (const t of m?.topics ?? []) {
      if (typeof t?.videoUrl === "string" && t.videoUrl.trim()) out.add(t.videoUrl.trim());
      if (typeof t?.materialUrl === "string" && t.materialUrl.trim()) out.add(t.materialUrl.trim());
    }
  return out;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const cleanJson = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const iso = (v: any): string | null => (v && typeof v.toDate === "function" ? v.toDate().toISOString() : null);

// ── archive + write (shared by sync and publish) ─────────────────────────────

export interface WriteOutcome {
  status: "written" | "blocked";
  archivedId?: string;
  lostMedia?: string[];
}

/** Replaces courses/{id}. Archives what it replaces and refuses to drop media links unless confirmed. */
export async function archiveAndWriteLive(
  db: Db,
  course: any,
  stamp: Stamp,
  opts: { confirmMediaReplacement?: boolean; now?: () => Date; reason: string },
): Promise<WriteOutcome> {
  const now = opts.now ?? (() => new Date());
  const ref = db.collection("courses").doc(course.id);
  const existing = await ref.get();
  let archivedId: string | undefined;

  if (existing.exists) {
    const prev = existing.data();
    if (!sameJson(prev?.curriculum, course.curriculum)) {
      const incoming = mediaUrls(course.curriculum);
      const lostMedia = [...mediaUrls(prev?.curriculum)].filter((u) => !incoming.has(u));
      if (lostMedia.length > 0 && !opts.confirmMediaReplacement) return { status: "blocked", lostMedia };

      archivedId = `${course.id}__${now().toISOString().replace(/[:.]/g, "-")}`;
      await db.collection(ARCHIVE).doc(archivedId).set({ courseId: course.id, archivedAt: stamp(), reason: opts.reason, course: prev });
    }
  }
  await ref.set({ ...course, updatedAt: stamp() }, { merge: true });
  return { status: "written", archivedId };
}

// ── sync ─────────────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  archived: string[];
  /** Gated courses saved as drafts instead of going live. */
  drafted: string[];
  /** Courses NOT written because they would discard media URLs that exist only in Firestore. */
  blocked: { id: string; lostMedia: string[] }[];
  errors: string[];
}

export async function syncCourseList(
  db: Db,
  courses: any[],
  stamp: Stamp,
  opts: { confirmMediaReplacement?: string[]; now?: () => Date } = {},
): Promise<SyncResult> {
  const confirm = new Set(opts.confirmMediaReplacement ?? []);
  const result: SyncResult = { synced: 0, archived: [], drafted: [], blocked: [], errors: [] };

  for (const course of courses) {
    if (!course?.id) {
      result.errors.push(`Course missing id: ${course?.title}`);
      continue;
    }
    try {
      if (course.launchGate === true) {
        // Never straight to learners. Keep whatever media/production state is already in the draft.
        const ref = db.collection(DRAFTS).doc(course.id);
        const existing = await ref.get();
        const merged = mergeDraftMedia(cleanJson(course), existing.exists ? existing.data()?.course : null);
        await ref.set({ courseId: course.id, course: merged, updatedAt: stamp(), source: "static-sync" }, { merge: true });
        result.drafted.push(course.id);
        continue;
      }
      const out = await archiveAndWriteLive(db, course, stamp, {
        confirmMediaReplacement: confirm.has(course.id),
        now: opts.now,
        reason: "pre-sync",
      });
      if (out.status === "blocked") {
        result.blocked.push({ id: course.id, lostMedia: out.lostMedia! });
        continue;
      }
      if (out.archivedId) result.archived.push(out.archivedId);
      result.synced++;
    } catch (e: any) {
      result.errors.push(`${course.id}: ${e.message}`);
    }
  }
  return result;
}

// ── drafts ───────────────────────────────────────────────────────────────────

export async function getDraft(db: Db, courseId: string): Promise<OpResult> {
  if (!courseId) return { status: 400, body: { error: "courseId is required" } };
  const snap = await db.collection(DRAFTS).doc(courseId).get();
  if (!snap.exists) return { status: 200, body: { exists: false } };
  const d = snap.data();
  return { status: 200, body: { exists: true, course: d.course, updatedAt: iso(d.updatedAt), publishedAt: iso(d.publishedAt) } };
}

export async function saveDraftCurriculum(db: Db, body: any, stamp: Stamp): Promise<OpResult> {
  const { courseId, curriculum, duration, plannedDuration } = body ?? {};
  if (!courseId || typeof courseId !== "string") return { status: 400, body: { error: "courseId is required" } };
  if (!Array.isArray(curriculum) || curriculum.length === 0 || curriculum.length > 30)
    return { status: 400, body: { error: "curriculum must be a non-empty array of modules" } };
  for (const m of curriculum) {
    if (typeof m?.module !== "string" || !Array.isArray(m?.topics) || m.topics.length > 100)
      return { status: 400, body: { error: "every module needs a title and a topics array" } };
    for (const t of m.topics) if (typeof t?.title !== "string") return { status: 400, body: { error: "every topic needs a title" } };
  }
  const ref = db.collection(DRAFTS).doc(courseId);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, body: { error: "No draft exists yet. Run Sync Static Data first to create it." } };

  const course = { ...snap.data().course, curriculum: cleanJson(curriculum) };
  if (typeof duration === "string") course.duration = duration;
  if (plannedDuration && typeof plannedDuration === "object") course.plannedDuration = cleanJson(plannedDuration);
  await ref.set({ ...snap.data(), course, updatedAt: stamp(), source: "admin-editor" });
  return { status: 200, body: { ok: true } };
}

// ── course details (landing-page content) ────────────────────────────────────

/**
 * Edits the content shown on the course card and course page. Only the fields in course-details.ts are accepted
 * (anything else is rejected), so this can never alter curriculum, pricing, access or learner records.
 *  - target "live": takes effect for visitors immediately, no redeploy. The previous values of the fields that
 *    changed are kept in courseArchive so an edit can be undone. If the live course is a published launch-gated
 *    course, the draft is updated too so a later publish cannot silently undo the edit.
 *  - target "draft": for a launch-gated course that is not published yet; visitors see it only after publish.
 */
export async function saveCourseDetails(
  db: Db,
  body: { courseId?: string; target?: string; fields?: unknown },
  stamp: Stamp,
  opts: { now?: () => Date } = {},
): Promise<OpResult> {
  const courseId = body?.courseId;
  if (!courseId || typeof courseId !== "string") return { status: 400, body: { error: "courseId is required" } };
  const target = body.target ?? "live";
  if (target !== "live" && target !== "draft") return { status: 400, body: { error: 'target must be "live" or "draft"' } };

  const v = validateCourseDetails(body.fields);
  if (!v.ok) return { status: 400, body: { error: "Some fields need attention.", errors: v.errors } };
  const now = opts.now ?? (() => new Date());

  if (target === "draft") {
    const ref = db.collection(DRAFTS).doc(courseId);
    const snap = await ref.get();
    if (!snap.exists) return { status: 404, body: { error: "No draft exists yet. Run Sync Static Data first." } };
    const d = snap.data();
    // Compare with what the form would have shown (unset == empty; outcomes fall back to learningObjectives).
    const shown = detailsFromCourse(d.course) as any;
    const changed = Object.keys(v.fields).filter((k) => !sameJson(shown[k], (v.fields as any)[k]));
    await ref.set({ ...d, course: { ...d.course, ...v.fields }, updatedAt: stamp(), source: "admin-details" });
    return { status: 200, body: { ok: true, target, changed } };
  }

  const ref = db.collection("courses").doc(courseId);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, body: { error: "Course not found" } };
  const live = snap.data();
  const shown = detailsFromCourse(live) as any;
  const changed = Object.keys(v.fields).filter((k) => !sameJson(shown[k], (v.fields as any)[k]));
  if (changed.length === 0) return { status: 200, body: { ok: true, target, changed: [], archived: null } };

  const previous: Record<string, unknown> = {};
  for (const k of changed) previous[k] = live[k] ?? null;
  const archivedId = `${courseId}__${now().toISOString().replace(/[:.]/g, "-")}__details`;
  await db.collection(ARCHIVE).doc(archivedId).set({ courseId, archivedAt: stamp(), reason: "pre-details-edit", previous });

  await ref.set({ ...v.fields, updatedAt: stamp() }, { merge: true });

  if (live.launchGate === true) {
    const dref = db.collection(DRAFTS).doc(courseId);
    const dsnap = await dref.get();
    if (dsnap.exists) {
      const d = dsnap.data();
      await dref.set({ ...d, course: { ...d.course, ...v.fields }, updatedAt: stamp(), source: "admin-details" });
    }
  }
  return { status: 200, body: { ok: true, target, changed, archived: archivedId } };
}

// ── readiness ────────────────────────────────────────────────────────────────

export type Reachability = "ok" | "unreachable" | "unknown";

/** Best-effort HEAD request per media URL. Advisory only: hosts that refuse HEAD report "unknown", not failure. */
export async function checkReachability(urls: string[], fetchImpl: typeof fetch = fetch): Promise<Record<string, Reachability>> {
  const out: Record<string, Reachability> = {};
  await Promise.all(
    urls.map(async (u) => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      try {
        const r = await fetchImpl(u, { method: "HEAD", signal: ctl.signal, redirect: "follow" });
        out[u] = r.ok ? "ok" : r.status === 403 || r.status === 405 || r.status === 429 ? "unknown" : "unreachable";
      } catch {
        out[u] = "unreachable";
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return out;
}

export async function courseReadiness(
  db: Db,
  query: { courseId?: string; verify?: string },
  fetchImpl?: typeof fetch,
): Promise<OpResult> {
  const courseId = query.courseId;
  if (!courseId) return { status: 400, body: { error: "courseId is required" } };

  const [draftSnap, liveSnap] = await Promise.all([db.collection(DRAFTS).doc(courseId).get(), db.collection("courses").doc(courseId).get()]);
  const draft = draftSnap.exists ? draftSnap.data() : null;
  const live = liveSnap.exists ? liveSnap.data() : null;
  if (!draft && !live) return { status: 404, body: { error: "Course not found" } };

  const source = draft ? "draft" : "live";
  const curriculum = (draft ? draft.course?.curriculum : live?.curriculum) ?? [];
  const report: ReadinessReport & { reachability?: Record<string, Reachability> } = buildReadiness(courseId, curriculum);

  const warnings: string[] = [];
  if (query.verify === "1") {
    const urls = report.lessons.filter((l) => !l.optional && l.videoUrl).map((l) => l.videoUrl!);
    report.reachability = await checkReachability([...new Set(urls)], fetchImpl);
    for (const [u, r] of Object.entries(report.reachability)) if (r === "unreachable") warnings.push(`Could not reach ${u}`);
  }

  return {
    status: 200,
    body: {
      ...report,
      source,
      warnings,
      live: live ? { exists: true, curriculumVersion: live.curriculumVersion ?? 1, launchGate: !!live.launchGate, publishedAt: iso(live.publishedAt) } : { exists: false },
      draftUpdatedAt: draft ? iso(draft.updatedAt) : null,
    },
  };
}

// ── publish ──────────────────────────────────────────────────────────────────

export async function publishCourse(
  db: Db,
  body: { courseId?: string; confirm?: string; confirmMediaReplacement?: boolean },
  stamp: Stamp,
  opts: { now?: () => Date } = {},
): Promise<OpResult> {
  const courseId = body?.courseId;
  if (!courseId) return { status: 400, body: { error: "courseId is required" } };
  if (body.confirm !== PUBLISH_CONFIRM_TOKEN) return { status: 400, body: { error: `Confirmation required. Send confirm: "${PUBLISH_CONFIRM_TOKEN}".` } };

  const ref = db.collection(DRAFTS).doc(courseId);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, body: { error: "No draft to publish. Run Sync Static Data first." } };
  const draft = snap.data();

  const report = buildReadiness(courseId, draft.course?.curriculum);
  if (!report.launchReady) {
    return { status: 409, body: { error: "Not ready to publish: required lessons are missing content.", blockers: report.blockers, counts: report.counts } };
  }

  // Defence in depth: re-validate every media URL server-side, independent of what the editor claimed.
  const bad = report.lessons.filter((l) => !l.optional && l.kind === "lesson" && !isValidMediaUrl(l.videoUrl));
  if (bad.length) return { status: 409, body: { error: "Invalid media URL on a required lesson.", blockers: bad.map((l) => l.title) } };

  const out = await archiveAndWriteLive(db, { ...cleanJson(draft.course), launchGate: true, publishedAt: stamp() }, stamp, {
    confirmMediaReplacement: !!body.confirmMediaReplacement,
    now: opts.now,
    reason: "pre-publish",
  });
  if (out.status === "blocked") return { status: 409, body: { error: "Publishing would remove media links that exist only in the live course.", lostMedia: out.lostMedia } };

  await ref.set({ ...draft, publishedAt: stamp() });
  return { status: 200, body: { ok: true, published: true, archived: out.archivedId ?? null } };
}

// ── flagship progress migration ──────────────────────────────────────────────

export type MigrationMode = "dry-run" | "apply" | "revert";

export interface MigrationReport {
  mode: MigrationMode;
  courseId: string;
  /** Enrollments on this course. */
  total: number;
  /** Status COMPLETED on the original curriculum. They keep status, progress, completedLessons and certificate. */
  completedLearners: number;
  /** Started but not finished (status IN_PROGRESS, or at least one completed lesson). */
  partialLearners: number;
  notStartedLearners: number;
  alreadyV2: number;
  /** Completed learners already carrying an explicit version stamp. */
  alreadyStamped: number;
  unmappable: {
    /** Partial learners who completed v1 lessons that have no v2 equivalent (kept in legacyCompletedLessons). */
    learners: number;
    lessons: number;
    /** Completed lesson ids that do not exist in the v1 structure at all (bad data). */
    unknownLessonIds: number;
  };
  certificates: {
    completedWithCertificate: number;
    /** Completed learners with no certificate document. Nothing is created for them. */
    completedMissingCertificate: number;
    /** A certificate exists but the enrollment is not COMPLETED. Never overwritten or deleted. */
    certificateWithoutCompletion: number;
  };
  changed: number;
  reverted: number;
  sample: { id: string; status: string; before: string[]; after: string[] | null; action: string }[];
}

const V1_IDS = new Set(V1_TO_V2.map((r) => r.oldId));

export async function migrateFlagshipProgress(
  db: Db,
  input: { mode?: MigrationMode; confirm?: string; courseId?: string },
  stamp: Stamp,
): Promise<OpResult> {
  const mode: MigrationMode = input.mode ?? "dry-run";
  const courseId = input.courseId ?? FLAGSHIP_COURSE_ID;
  if (courseId !== FLAGSHIP_COURSE_ID) return { status: 400, body: { error: "Only the flagship course can be migrated." } };
  if (!["dry-run", "apply", "revert"].includes(mode)) return { status: 400, body: { error: "mode must be dry-run, apply or revert" } };
  if (mode !== "dry-run" && input.confirm !== MIGRATION_CONFIRM_TOKEN)
    return { status: 400, body: { error: `Confirmation required. Send confirm: "${MIGRATION_CONFIRM_TOKEN}" after reviewing a dry run.` } };

  const report: MigrationReport = {
    mode, courseId, total: 0, completedLearners: 0, partialLearners: 0, notStartedLearners: 0, alreadyV2: 0, alreadyStamped: 0,
    unmappable: { learners: 0, lessons: 0, unknownLessonIds: 0 },
    certificates: { completedWithCertificate: 0, completedMissingCertificate: 0, certificateWithoutCompletion: 0 },
    changed: 0, reverted: 0, sample: [],
  };
  const note = (id: string, status: string, before: string[], after: string[] | null, action: string) => {
    if (report.sample.length < 10) report.sample.push({ id, status, before, after, action });
  };

  let cursor: string | undefined;
  for (;;) {
    let q = db.collection("enrollments").where("courseId", "==", courseId).orderBy(FieldPath.documentId()).limit(300);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const e = doc.data();
      report.total++;
      const before: string[] = Array.isArray(e.completedLessons) ? e.completedLessons : [];

      if (mode === "revert") {
        // Only learners this migration moved (they carry legacy* backups). Completed learners were never changed.
        if (e.curriculumVersion === FLAGSHIP_V2_VERSION && Array.isArray(e.legacyCompletedLessons) && e.migratedAt) {
          await doc.ref.update({
            completedLessons: e.legacyCompletedLessons,
            progress: e.legacyProgress ?? 0,
            status: e.legacyStatus ?? "ENROLLED",
            curriculumVersion: 1,
            migrationRevertedAt: stamp(),
          });
          report.reverted++;
        }
        continue;
      }

      const completed = e.status === "COMPLETED";
      const certSnap = await db.collection("certificates").doc(`CERT_${e.userId}_${courseId}`).get();
      if (completed) {
        report.completedLearners++;
        if (certSnap.exists) report.certificates.completedWithCertificate++;
        else report.certificates.completedMissingCertificate++;
      } else if (certSnap.exists) {
        report.certificates.certificateWithoutCompletion++;
      }

      if (e.curriculumVersion === FLAGSHIP_V2_VERSION) {
        report.alreadyV2++;
        continue;
      }

      if (completed) {
        // Original achievement is preserved exactly. The only write is an explicit "this is version 1" stamp.
        if (typeof e.curriculumVersion === "number") {
          report.alreadyStamped++;
          note(doc.id, e.status, before, null, "none (already stamped)");
          continue;
        }
        note(doc.id, e.status, before, null, "stamp curriculumVersion=1 only");
        if (mode === "apply") {
          await doc.ref.update({ curriculumVersion: 1, versionStampedAt: stamp() });
          report.changed++;
        }
        continue;
      }

      const unknown = before.filter((id) => !V1_IDS.has(id));
      report.unmappable.unknownLessonIds += unknown.length;
      const r = remapCompletedLessons(before);
      const unmapped = r.notCarried.filter((id) => V1_IDS.has(id));
      if (unmapped.length > 0) {
        report.unmappable.learners++;
        report.unmappable.lessons += unmapped.length;
      }
      const isPartial = e.status === "IN_PROGRESS" || before.length > 0;
      if (isPartial) report.partialLearners++;
      else report.notStartedLearners++;

      const after = r.newCompleted;
      const progress = Math.round((after.length / 24) * 100);
      const status = after.length > 0 ? "IN_PROGRESS" : e.status === "IN_PROGRESS" ? "IN_PROGRESS" : "ENROLLED";
      note(doc.id, e.status, before, after, "remap to v2");

      if (mode === "apply") {
        await doc.ref.update({
          completedLessons: after,
          progress,
          status,
          curriculumVersion: FLAGSHIP_V2_VERSION,
          legacyCompletedLessons: before,
          legacyProgress: typeof e.progress === "number" ? e.progress : 0,
          legacyStatus: e.status ?? "ENROLLED",
          migratedAt: stamp(),
        });
        report.changed++;
      }
    }
    cursor = snap.docs[snap.docs.length - 1].id;
    if (snap.docs.length < 300) break;
  }

  return { status: 200, body: { ok: true, ...report } };
}

// ── single dispatcher used by api/admin.ts, server.ts and the local harness ──

export async function handleCourseAdminOp(
  db: Db,
  req: { method: string; resource: string; query?: Record<string, any>; body?: any },
  stamp: Stamp,
  deps: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<OpResult | null> {
  const { method, resource } = req;
  const q = req.query ?? {};
  if (method === "GET" && resource === "course-draft-get") return getDraft(db, String(q.courseId ?? ""));
  if (method === "GET" && resource === "course-readiness") return courseReadiness(db, { courseId: q.courseId && String(q.courseId), verify: q.verify && String(q.verify) }, deps.fetch);
  if (method === "POST" && resource === "course-details-save") return saveCourseDetails(db, req.body, stamp, { now: deps.now });
  if (method === "POST" && resource === "course-draft-save") return saveDraftCurriculum(db, req.body, stamp);
  if (method === "POST" && resource === "course-publish") return publishCourse(db, req.body, stamp, { now: deps.now });
  if (method === "POST" && resource === "course-migrate-progress") return migrateFlagshipProgress(db, req.body ?? {}, stamp);
  return null;
}
