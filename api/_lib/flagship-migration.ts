/**
 * Version 1 → version 2 migration map for the free flagship course "AI Strategy for Leaders".
 *
 * v1 = original 7-module / 35-topic course (~5 hours), archived in docs/archive/.
 * v2 = approved 6-module / 24-topic, 90-minute course (src/data/courses.ts).
 *
 * Learner progress is stored by POSITION ("moduleIndex_lessonIndex"), so changing the structure would
 * silently misalign saved progress. This file is the single, reviewable source of truth for how an old
 * position translates to the new structure. Pure and dependency-free so the browser, the admin API and
 * the tests can all load it.
 *
 * Rules (deliberately conservative):
 *  - A v2 lesson is auto-completed ONLY when every v1 lesson that feeds it was completed
 *    (carry:true rows). Merged lessons therefore need all their sources.
 *  - Activities are NEVER auto-completed. The Action Card outputs are new artifacts the learner has not produced.
 *  - Lessons that are new in v2 are never auto-completed.
 */

export const FLAGSHIP_COURSE_ID = 'ai-strategy-leaders';
export const FLAGSHIP_V2_VERSION = 2;

/** v2 topic ids in positional order: 6 modules x 4 topics (3 lessons + 1 activity). */
export const FLAGSHIP_V2_ORDER: string[] = [
  'm1-l1', 'm1-l2', 'm1-l3', 'm1-a',
  'm2-l1', 'm2-l2', 'm2-l3', 'm2-a',
  'm3-l1', 'm3-l2', 'm3-l3', 'm3-a',
  'm4-l1', 'm4-l2', 'm4-l3', 'm4-a',
  'm5-l1', 'm5-l2', 'm5-l3', 'm5-a',
  'm6-l1', 'm6-l2', 'm6-l3', 'm6-a',
];

/** Positional progress id ("moduleIndex_lessonIndex") for a v2 topic id, or null if unknown. */
export function v2PositionOf(topicId: string): string | null {
  const i = FLAGSHIP_V2_ORDER.indexOf(topicId);
  return i < 0 ? null : `${Math.floor(i / 4)}_${i % 4}`;
}

export type MigrationStatus =
  | 'retained' // same lesson, shortened/reframed
  | 'merged' // folded into a v2 lesson or activity
  | 'optional' // preserved as an optional resource (published only when an asset exists)
  | 'archived'; // preserved as source material for future/paid programs

export interface MigrationRow {
  /** v1 positional id. */
  oldId: string;
  oldTitle: string;
  status: MigrationStatus;
  /** v2 topic this row feeds (absent for optional/archived). */
  newId?: string;
  /** Does completing this v1 lesson count toward auto-completing the v2 topic? */
  carry: boolean;
  note: string;
}

export const V1_TO_V2: MigrationRow[] = [
  // Module 1 → 1 (Understand)
  { oldId: '0_0', oldTitle: 'Lesson 1.1 — Why This AI Moment Is Different', status: 'retained', newId: 'm1-l1', carry: true, note: 'Shortened to 4 min; leadership focus, not technical history.' },
  { oldId: '0_1', oldTitle: 'Lesson 1.2 — The AI Capability Ladder™', status: 'retained', newId: 'm1-l2', carry: true, note: 'Shortened to 4 min.' },
  { oldId: '0_2', oldTitle: 'Lesson 1.3 — What AI Can—and Cannot—Do', status: 'retained', newId: 'm1-l3', carry: true, note: 'Reframed as Capability → Reliability → Authority.' },
  { oldId: '0_3', oldTitle: 'Module 1 Activity — AI Leadership Self-Assessment', status: 'optional', carry: false, note: 'Kept as the optional extended AI Leadership Self-Assessment; replaced in the core by "My AI Leadership Starting Point".' },
  // Module 2 → 2 (Anticipate)
  { oldId: '1_0', oldTitle: 'Lesson 2.1 — Generative AI vs. Agentic AI', status: 'retained', newId: 'm2-l1', carry: true, note: 'Shortened to 4 min.' },
  { oldId: '1_1', oldTitle: 'Lesson 2.2 — Copilots, Assistants and Agents', status: 'optional', carry: false, note: 'Deeper taxonomy kept as an optional resource.' },
  { oldId: '1_2', oldTitle: 'Lesson 2.3 — The Autonomy Spectrum', status: 'retained', newId: 'm2-l2', carry: true, note: 'Now explicitly "not a maturity model"; 5 min.' },
  { oldId: '1_3', oldTitle: 'Lesson 2.4 — The Emerging Agentic Enterprise', status: 'archived', carry: false, note: 'Source material for future agentic-organization / paid programs.' },
  { oldId: '1_4', oldTitle: 'Module 2 Activity — The Delegation Exercise', status: 'merged', newId: 'm2-a', carry: false, note: 'Adapted into "My Delegation Decision" (new Action Card output; not auto-completed).' },
  // Module 3 → 3 (Identify)
  { oldId: '2_0', oldTitle: 'Lesson 3.1 — Stop Starting With the Technology', status: 'retained', newId: 'm3-l1', carry: true, note: 'Shortened to 4 min.' },
  { oldId: '2_1', oldTitle: 'Lesson 3.2 — The AI Value Map™', status: 'retained', newId: 'm3-l2', carry: true, note: 'Shortened to 4 min.' },
  { oldId: '2_2', oldTitle: 'Lesson 3.3 — Think Workflow, Not Use Case', status: 'merged', newId: 'm3-l3', carry: true, note: 'Merged into "Choose One High-Value Workflow".' },
  { oldId: '2_3', oldTitle: 'Lesson 3.4 — Prioritizing AI Opportunities', status: 'merged', newId: 'm3-l3', carry: true, note: 'Matrix criteria condensed; the detailed AI Opportunity Matrix™ is an optional resource.' },
  { oldId: '2_4', oldTitle: 'Module 3 Activity — Find Your Top Three AI Opportunities', status: 'merged', newId: 'm3-a', carry: false, note: 'Simplified into "My Priority Opportunity" (not auto-completed).' },
  // Module 4 → 4 (Redesign)
  { oldId: '3_0', oldTitle: "Lesson 4.1 — Don't Automate a Bad Process", status: 'retained', newId: 'm4-l1', carry: true, note: 'Shortened to 4 min.' },
  { oldId: '3_1', oldTitle: 'Lesson 4.2 — Human + AI Comparative Advantage', status: 'retained', newId: 'm4-l2', carry: true, note: 'Shortened to 4 min.' },
  { oldId: '3_2', oldTitle: 'Lesson 4.3 — The Human-Agent Operating Model™', status: 'merged', newId: 'm4-l3', carry: true, note: 'Roles folded into "Redesign One Workflow".' },
  { oldId: '3_3', oldTitle: 'Lesson 4.4 — Redesigning the Workflow', status: 'merged', newId: 'm4-l3', carry: true, note: 'Before/after demonstration retained.' },
  { oldId: '3_4', oldTitle: 'Module 4 Activity — Human + AI Workflow Canvas™', status: 'merged', newId: 'm4-a', carry: false, note: 'Simplified into "My Human + AI Workflow"; the full Canvas stays an optional downloadable tool.' },
  // Module 5 → 5 (Govern)
  { oldId: '4_0', oldTitle: 'Lesson 5.1 — The New Risk Equation', status: 'retained', newId: 'm5-l1', carry: true, note: 'Reframed as "Why Autonomy Changes the Risk"; 3 min.' },
  { oldId: '4_1', oldTitle: 'Lesson 5.2 — The AI Trust Stack™', status: 'retained', newId: 'm5-l2', carry: true, note: 'Taught as practical leadership questions.' },
  { oldId: '4_2', oldTitle: 'Lesson 5.3 — Matching Governance to Autonomy', status: 'merged', newId: 'm5-l3', carry: true, note: 'Folded into "Who Is Accountable?".' },
  { oldId: '4_3', oldTitle: 'Lesson 5.4 — Responsible AI as a Leadership Responsibility', status: 'merged', newId: 'm5-l3', carry: true, note: 'Detailed governance coverage condensed to oversight, gates, monitoring, ownership.' },
  { oldId: '4_4', oldTitle: 'Module 5 Activity — AI Governance Checklist', status: 'merged', newId: 'm5-a', carry: false, note: 'Simplified into "My Essential Safeguard"; the full checklist stays optional.' },
  // Module 6 → 6 (Execute)
  { oldId: '5_0', oldTitle: "Lesson 6.1 — Why AI Pilots Don't Scale", status: 'retained', newId: 'm6-l1', carry: true, note: 'Shortened to 4 min.' },
  { oldId: '5_1', oldTitle: 'Lesson 6.2 — The Enterprise AI Readiness Model™', status: 'retained', newId: 'm6-l2', carry: true, note: 'Now a concise diagnostic, 4 min.' },
  { oldId: '5_2', oldTitle: 'Lesson 6.3 — Build, Buy or Partner?', status: 'archived', carry: false, note: 'Source material for paid programs.' },
  { oldId: '5_3', oldTitle: 'Lesson 6.4 — Measuring AI Value', status: 'merged', newId: 'm6-l3', carry: true, note: 'Measurable outcomes folded into "Your First 90 Days".' },
  { oldId: '5_4', oldTitle: 'Lesson 6.5 — The Path to the AI-Native Enterprise', status: 'archived', carry: false, note: 'Source material for paid programs.' },
  // Capstone → final activity
  { oldId: '6_0', oldTitle: 'Part 1 — The Opportunity', status: 'merged', newId: 'm6-a', carry: false, note: 'Distilled into the cumulative Action Card.' },
  { oldId: '6_1', oldTitle: 'Part 2 — The Workflow', status: 'merged', newId: 'm6-a', carry: false, note: 'Distilled into the Action Card.' },
  { oldId: '6_2', oldTitle: 'Part 3 — Human + AI', status: 'merged', newId: 'm6-a', carry: false, note: 'Distilled into the Action Card.' },
  { oldId: '6_3', oldTitle: 'Part 4 — Governance', status: 'merged', newId: 'm6-a', carry: false, note: 'Distilled into the Action Card.' },
  { oldId: '6_4', oldTitle: 'Part 5 — Success Measures', status: 'merged', newId: 'm6-a', carry: false, note: 'Distilled into the Action Card.' },
  { oldId: '6_5', oldTitle: 'Part 6 — 90-Day Plan', status: 'merged', newId: 'm6-l3', carry: true, note: 'Content now taught in "Your First 90 Days"; the full 90-Day AI Leadership Action Plan stays an optional/extended resource.' },
];

/** v2 topics with no v1 source at all (every other v2 topic is fed by at least one row above). */
export const NEW_IN_V2: { newId: string; title: string }[] = [
  { newId: 'm1-a', title: 'Activity — My AI Leadership Starting Point' },
  { newId: 'm2-l3', title: 'Lesson 2.3 — Oversight, Command and Accountability' },
];

/** v1 lessons that must all be done before a given v2 lesson is auto-completed. */
export function requiredLegacyIds(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of V1_TO_V2) {
    if (!r.newId || !r.carry) continue;
    out.set(r.newId, [...(out.get(r.newId) ?? []), r.oldId]);
  }
  return out;
}

export interface RemapResult {
  /** v2 positional ids that can safely be carried over. */
  newCompleted: string[];
  /** v1 completed ids that have no v2 counterpart (optional/archived/activities) — kept in the backup, not lost. */
  notCarried: string[];
}

/**
 * Translate a learner's v1 completedLessons into v2 positional ids.
 * Never invents progress: a v2 lesson is carried only when ALL of its source v1 lessons are complete.
 */
export function remapCompletedLessons(oldCompleted: string[]): RemapResult {
  const done = new Set(oldCompleted);
  const newCompleted: string[] = [];
  for (const [newId, needs] of requiredLegacyIds()) {
    if (needs.every((id) => done.has(id))) {
      const pos = v2PositionOf(newId);
      if (pos) newCompleted.push(pos);
    }
  }
  newCompleted.sort();
  // v1 ids that did not contribute to any carried v2 lesson. They stay in legacyCompletedLessons (the backup).
  const used = new Set<string>();
  for (const [newId, needs] of requiredLegacyIds()) {
    const pos = v2PositionOf(newId);
    if (pos && newCompleted.includes(pos)) needs.forEach((id) => used.add(id));
  }
  return { newCompleted, notCarried: oldCompleted.filter((id) => !used.has(id)) };
}
