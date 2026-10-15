import type { Course, CurriculumModule, CurriculumTopic } from '../types';

export interface ModuleDuration {
  videoMinutes: number;
  activityMinutes: number;
  totalMinutes: number;
}

export interface CourseDuration extends ModuleDuration {
  modules: ModuleDuration[];
  /** True only when every required topic carries a plannedMinutes value. */
  complete: boolean;
}

const isRequired = (t: CurriculumTopic) => !t.optional;

export function moduleDuration(m: CurriculumModule): ModuleDuration & { complete: boolean } {
  let videoMinutes = 0;
  let activityMinutes = 0;
  let complete = true;
  for (const t of m.topics) {
    if (!isRequired(t)) continue;
    if (typeof t.plannedMinutes !== 'number') {
      complete = false;
      continue;
    }
    if (t.kind === 'activity') activityMinutes += t.plannedMinutes;
    else videoMinutes += t.plannedMinutes;
  }
  return { videoMinutes, activityMinutes, totalMinutes: videoMinutes + activityMinutes, complete };
}

/** Planned runtime of the required path. Optional topics never count. These are plans, not measured runtimes. */
export function courseDuration(course: Pick<Course, 'curriculum'>): CourseDuration {
  const modules = course.curriculum.map(moduleDuration);
  const sum = (k: keyof ModuleDuration) => modules.reduce((n, m) => n + m[k], 0);
  return {
    videoMinutes: sum('videoMinutes'),
    activityMinutes: sum('activityMinutes'),
    totalMinutes: sum('totalMinutes'),
    modules,
    complete: modules.every((m) => m.complete),
  };
}

export const formatMinutes = (n: number) => `${n} min`;
