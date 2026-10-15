import type { Course, Enrollment } from '../types';

/** Positional lesson id used by enrollments.completedLessons. Unchanged from v1 so routes/records stay compatible. */
export const lessonKey = (moduleIndex: number, lessonIndex: number) => `${moduleIndex}_${lessonIndex}`;

/** Positions of the topics a learner must finish. Optional topics are excluded. */
export function requiredKeys(course: Pick<Course, 'curriculum'>): string[] {
  const keys: string[] = [];
  (course.curriculum ?? []).forEach((m, mi) =>
    m.topics.forEach((t, ti) => {
      if (!t.optional) keys.push(lessonKey(mi, ti));
    }),
  );
  return keys;
}

export interface ProgressSummary {
  percent: number;
  completed: number;
  total: number;
  isComplete: boolean;
}

/**
 * Progress over required topics only. Ids that do not exist in the current curriculum (stale ids from an
 * older version) and optional topics are ignored, so they can neither inflate progress nor block completion.
 */
export function computeProgress(course: Pick<Course, 'curriculum'>, completedLessons: string[] = []): ProgressSummary {
  const required = requiredKeys(course);
  const done = new Set(completedLessons);
  const completed = required.filter((k) => done.has(k)).length;
  const total = required.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { percent, completed, total, isComplete: total > 0 && completed === total };
}

/** First required, not-yet-completed topic, or null when finished. */
export function nextRequiredKey(course: Pick<Course, 'curriculum'>, completedLessons: string[] = []): string | null {
  const done = new Set(completedLessons);
  return requiredKeys(course).find((k) => !done.has(k)) ?? null;
}

// ── curriculum versions ──────────────────────────────────────────────────────

/** Enrollments created before versioning have no stamp: they are version 1. */
export const enrollmentVersion = (e?: Pick<Enrollment, 'curriculumVersion'> | null) => e?.curriculumVersion ?? 1;
export const courseVersion = (c?: Pick<Course, 'curriculumVersion'> | null) => c?.curriculumVersion ?? 1;

export type TrackStatus = 'NOT_STARTED' | 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Track {
  /** Where this learner's current-curriculum progress lives. */
  source: 'primary' | 'v2Progress' | 'none';
  /** True when the enrollment was recorded against an older curriculum than the course now has. */
  isLegacyEnrollment: boolean;
  /** Completed lessons for the CURRENT curriculum only. Never contains ids from an older structure. */
  completedLessons: string[];
  status: TrackStatus;
  /** The learner's original (older-version) result, preserved untouched. Present only for legacy enrollments. */
  legacy?: { status: Enrollment['status']; progress: number; version: number };
}

/**
 * Resolves which progress record applies to the course as it is NOW.
 *  - same version: the enrollment's own fields;
 *  - older version + learner opted into the new curriculum: enrollment.v2Progress;
 *  - older version, not opted in: nothing for the new curriculum (their original result stays as-is).
 * Old completedLessons are NEVER interpreted against a newer structure, because they are positional.
 */
export function resolveTrack(course: Pick<Course, 'curriculum' | 'curriculumVersion'>, e: Enrollment | null | undefined): Track {
  if (!e) return { source: 'none', isLegacyEnrollment: false, completedLessons: [], status: 'NOT_STARTED' };
  const legacy = enrollmentVersion(e) < courseVersion(course);
  if (!legacy) {
    return { source: 'primary', isLegacyEnrollment: false, completedLessons: e.completedLessons ?? [], status: e.status };
  }
  const original = { status: e.status, progress: e.progress ?? 0, version: enrollmentVersion(e) };
  if (e.v2Progress) {
    return {
      source: 'v2Progress',
      isLegacyEnrollment: true,
      completedLessons: e.v2Progress.completedLessons ?? [],
      status: e.v2Progress.status,
      legacy: original,
    };
  }
  return { source: 'none', isLegacyEnrollment: true, completedLessons: [], status: 'NOT_STARTED', legacy: original };
}

/**
 * Firestore field updates for recording a newly completed lesson on the learner's active track.
 * Dotted paths keep the learner's original (legacy) fields untouched when writing to v2Progress.
 */
export function progressUpdate(
  track: Track,
  course: Pick<Course, 'curriculum'>,
  newCompleted: string[],
): { fields: Record<string, unknown>; summary: ProgressSummary; status: 'IN_PROGRESS' | 'COMPLETED' } {
  const summary = computeProgress(course, newCompleted);
  const status = summary.isComplete ? 'COMPLETED' : 'IN_PROGRESS';
  const fields =
    track.source === 'v2Progress'
      ? {
          'v2Progress.completedLessons': newCompleted,
          'v2Progress.progress': summary.percent,
          'v2Progress.status': status,
        }
      : { completedLessons: newCompleted, progress: summary.percent, status };
  return { fields, summary, status };
}

/**
 * A certificate is issued only on the primary track, and never over an existing one. A learner completing the
 * new curriculum after finishing an older version keeps the certificate they already hold.
 */
export const shouldIssueCertificate = (track: Track, status: string, certificateExists: boolean) =>
  track.source === 'primary' && status === 'COMPLETED' && !certificateExists;
