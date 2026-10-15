import { courses as staticCourses } from '../data/courses';
import type { Course } from '../types';

/**
 * What learners are allowed to see for a course.
 *  - The Firestore ("live") record always wins when it exists.
 *  - Otherwise the source-controlled copy is a fallback, EXCEPT for launch-gated courses: their static copy is a
 *    draft until it has been through the readiness check and published, so it is never shown on its own.
 */
export function resolveCourse(id: string, liveCourse?: Course | null, source: Course[] = staticCourses): Course | undefined {
  if (liveCourse) return liveCourse;
  const fallback = source.find((c) => c.id === id);
  return fallback?.launchGate ? undefined : fallback;
}

/** The static courses that may be shown without a live record. */
export const publicStaticCourses = (source: Course[] = staticCourses) => source.filter((c) => !c.launchGate);
