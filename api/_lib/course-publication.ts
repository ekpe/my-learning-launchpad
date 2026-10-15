/**
 * Publication readiness for courses that use the launch gate. Pure and dependency-free so the admin API,
 * the admin UI and the tests all apply exactly the same rules.
 *
 * Lesson states:
 *   planned        nothing yet (or only metadata)
 *   in-production  an admin marked it as being produced, but there is no usable media yet
 *   ready          a valid media URL exists (for activities: the on-page content exists)
 *   published      ready AND explicitly signed off by an admin
 *
 * Readiness is derived from the actual media URL, never from the existence of metadata. An admin cannot mark a
 * lesson "published" without media: it is downgraded and flagged.
 */

/** Typed by an admin to confirm irreversible-looking actions. Shared so the UI and the API agree. */
export const PUBLISH_CONFIRM_TOKEN = 'PUBLISH-COURSE';
export const MIGRATION_CONFIRM_TOKEN = 'MIGRATE-FLAGSHIP-V2';

export type LessonState = 'planned' | 'in-production' | 'ready' | 'published';
export const LESSON_STATES: LessonState[] = ['planned', 'in-production', 'ready', 'published'];

export interface TopicLike {
  id?: string;
  title: string;
  kind?: 'lesson' | 'activity';
  optional?: boolean;
  videoUrl?: string;
  description?: string;
  output?: string;
  productionStatus?: 'planned' | 'in-production' | 'published';
}

export interface ModuleLike {
  module: string;
  topics: TopicLike[];
}

/** An https URL with a real host. http, javascript:, data: and bare words do not count as media. */
export function isValidMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || /\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}

const hasText = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

export interface LessonAssessment {
  state: LessonState;
  /** What is still missing for this lesson to be published. Empty when published. */
  needs: string[];
  /** Problems that do not change the state but should be looked at. */
  warnings: string[];
}

export function assessTopic(t: TopicLike): LessonAssessment {
  const warnings: string[] = [];
  const needs: string[] = [];
  const claimed = t.productionStatus;

  if (t.kind === 'activity') {
    const content = hasText(t.description) && hasText(t.output);
    if (!content) needs.push('activity text (description and Action Card output) is missing');
    if (claimed === 'published' && !content) warnings.push('Marked published but the activity content is missing.');
    const state: LessonState = !content ? (claimed === 'in-production' || claimed === 'published' ? 'in-production' : 'planned') : claimed === 'published' ? 'published' : 'ready';
    if (state === 'ready') needs.push('awaiting publish sign-off');
    return { state, needs, warnings };
  }

  const valid = isValidMediaUrl(t.videoUrl);
  if (hasText(t.videoUrl) && !valid) warnings.push('Video URL is not a valid https link, so it is ignored.');
  if (!valid) needs.push('no valid video URL');
  if (claimed === 'published' && !valid) warnings.push('Marked published but there is no valid video URL.');

  let state: LessonState;
  if (valid) state = claimed === 'published' ? 'published' : 'ready';
  else state = claimed === 'in-production' || claimed === 'published' ? 'in-production' : 'planned';
  if (state === 'ready') needs.push('awaiting publish sign-off');
  return { state, needs, warnings };
}

export interface ReadinessLesson {
  moduleIndex: number;
  topicIndex: number;
  id?: string;
  title: string;
  kind: 'lesson' | 'activity';
  optional: boolean;
  state: LessonState;
  needs: string[];
  warnings: string[];
  videoUrl?: string;
}

export interface ReadinessReport {
  courseId: string;
  /** True only when every REQUIRED lesson and activity is published. Optional topics never matter. */
  launchReady: boolean;
  requiredTotal: number;
  counts: Record<LessonState, number>;
  lessons: ReadinessLesson[];
  blockers: string[];
}

export function buildReadiness(courseId: string, curriculum: ModuleLike[] | undefined): ReadinessReport {
  const lessons: ReadinessLesson[] = [];
  (curriculum ?? []).forEach((m, mi) =>
    (m.topics ?? []).forEach((t, ti) => {
      const a = assessTopic(t);
      lessons.push({
        moduleIndex: mi,
        topicIndex: ti,
        id: t.id,
        title: t.title,
        kind: t.kind === 'activity' ? 'activity' : 'lesson',
        optional: !!t.optional,
        state: a.state,
        needs: a.needs,
        warnings: a.warnings,
        videoUrl: isValidMediaUrl(t.videoUrl) ? t.videoUrl.trim() : undefined,
      });
    }),
  );

  const required = lessons.filter((l) => !l.optional);
  const counts: Record<LessonState, number> = { planned: 0, 'in-production': 0, ready: 0, published: 0 };
  required.forEach((l) => (counts[l.state] += 1));

  const blockers = required
    .filter((l) => l.state !== 'published')
    .map((l) => `${l.title}: ${l.needs.join('; ') || l.state}`);
  if (required.length === 0) blockers.push('The course has no required lessons.');

  return {
    courseId,
    launchReady: required.length > 0 && blockers.length === 0,
    requiredTotal: required.length,
    counts,
    lessons,
    blockers,
  };
}

/**
 * Combines a static (source-controlled) course with the admin-managed draft so a re-sync can never erase
 * uploaded media or production state. Matching is by stable topic id, then by title as a fallback.
 * Static content wins for everything else (titles, copy, durations, structure).
 */
export function mergeDraftMedia<T extends { curriculum?: ModuleLike[] }>(incoming: T, existing: { curriculum?: ModuleLike[] } | null | undefined): T {
  if (!existing?.curriculum || !incoming.curriculum) return incoming;
  const byId = new Map<string, TopicLike>();
  const byTitle = new Map<string, TopicLike>();
  for (const m of existing.curriculum) for (const t of m.topics ?? []) {
    if (t.id) byId.set(t.id, t);
    byTitle.set(t.title, t);
  }
  const curriculum = incoming.curriculum.map((m) => ({
    ...m,
    topics: m.topics.map((t) => {
      const prev = (t.id && byId.get(t.id)) || byTitle.get(t.title);
      if (!prev) return t;
      const merged: any = { ...t };
      if (!hasText(t.videoUrl) && hasText(prev.videoUrl)) merged.videoUrl = prev.videoUrl;
      if (prev.productionStatus && !t.productionStatus) merged.productionStatus = prev.productionStatus;
      const prevAny = prev as any;
      if (!hasText((t as any).materialUrl) && hasText(prevAny.materialUrl)) merged.materialUrl = prevAny.materialUrl;
      return merged;
    }),
  }));
  return { ...incoming, curriculum };
}
