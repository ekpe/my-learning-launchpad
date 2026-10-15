/**
 * Pure rules for the persisted "My AI Leadership Action Card". The Firestore transaction in
 * src/services/actionCard.ts feeds the current server document through applySave, so the stale-write
 * check is atomic and unit-testable without Firebase.
 *
 * Storage: actionCards/{uid}_{courseId} = { userId, courseId, outputs: { m1..m6: { text, rev, updatedAt } }, updatedAt }
 * Each output has its own revision number so the six outputs are saved (and conflict) independently.
 */

export const ACTION_CARD_KEYS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'] as const;
export type ActionCardKey = (typeof ACTION_CARD_KEYS)[number];

/** Keep in step with firestore.rules (isValidActionOutput). One printed page must hold six answers. */
export const MAX_OUTPUT_CHARS = 800;

export interface StoredOutput {
  text: string;
  rev: number;
  updatedAt?: unknown;
}

export interface ActionCardDoc {
  userId: string;
  courseId: string;
  outputs: Partial<Record<ActionCardKey, StoredOutput>>;
  updatedAt?: unknown;
}

export const actionCardId = (uid: string, courseId: string) => `${uid}_${courseId}`;
export const keyForModule = (moduleIndex: number): ActionCardKey | null => ACTION_CARD_KEYS[moduleIndex] ?? null;

export type SaveDecision =
  | { ok: true; key: ActionCardKey; text: string; rev: number; outputs: Partial<Record<ActionCardKey, StoredOutput>> }
  | { ok: false; reason: 'conflict'; remote: { text: string; rev: number } }
  | { ok: false; reason: 'invalid'; message: string };

/**
 * Decide whether a save may proceed.
 * baseRev is the revision the learner's draft was based on (0 = nothing saved yet).
 * If the server already holds a different revision for that output, the save is refused so a stale device
 * can never overwrite a newer answer. The caller can then offer "use the newer one" or "keep mine",
 * and keep-mine simply re-saves with the remote revision as the new base.
 */
export function applySave(
  existing: Pick<ActionCardDoc, 'outputs'> | null | undefined,
  key: string,
  text: string,
  baseRev: number,
): SaveDecision {
  if (!(ACTION_CARD_KEYS as readonly string[]).includes(key)) return { ok: false, reason: 'invalid', message: 'Unknown Action Card section.' };
  if (typeof text !== 'string') return { ok: false, reason: 'invalid', message: 'Answer must be text.' };
  if (text.length > MAX_OUTPUT_CHARS) return { ok: false, reason: 'invalid', message: `Please keep this answer under ${MAX_OUTPUT_CHARS} characters so the card fits one page.` };

  const k = key as ActionCardKey;
  const current = existing?.outputs?.[k];
  const remoteRev = current?.rev ?? 0;
  if (remoteRev !== baseRev) return { ok: false, reason: 'conflict', remote: { text: current?.text ?? '', rev: remoteRev } };

  const rev = remoteRev + 1;
  return { ok: true, key: k, text, rev, outputs: { ...(existing?.outputs ?? {}), [k]: { text, rev } } };
}

export type SectionState = 'empty' | 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

/** How many of the six outputs have saved, non-empty content. Used for the Action Card progress indicator. */
export function savedOutputCount(doc: Pick<ActionCardDoc, 'outputs'> | null | undefined): number {
  return ACTION_CARD_KEYS.filter((k) => (doc?.outputs?.[k]?.text ?? '').trim().length > 0).length;
}
