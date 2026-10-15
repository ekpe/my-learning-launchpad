import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { actionCardId, applySave, type ActionCardDoc, type SaveDecision } from '../lib/actionCardLogic';

const refFor = (uid: string, courseId: string) => doc(db, 'actionCards', actionCardId(uid, courseId));

/** Live view of the signed-in learner's own card. The security rules only ever allow the owner to read it. */
export function subscribeActionCard(
  uid: string,
  courseId: string,
  onData: (card: ActionCardDoc | null) => void,
  onError: (err: unknown) => void,
): () => void {
  return onSnapshot(
    refFor(uid, courseId),
    (snap) => onData(snap.exists() ? (snap.data() as ActionCardDoc) : null),
    onError,
  );
}

/**
 * Saves ONE output. Runs in a transaction so the revision check and the write are atomic: if another
 * device saved a newer answer in the meantime, nothing is written and the caller gets the conflict.
 */
export async function saveActionOutput(uid: string, courseId: string, key: string, text: string, baseRev: number): Promise<SaveDecision> {
  const ref = refFor(uid, courseId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists() ? (snap.data() as ActionCardDoc) : null;
    const decision = applySave(existing, key, text, baseRev);
    if (!decision.ok) return decision;

    // Keep the other outputs exactly as stored (including their own timestamps); stamp only the one that changed.
    const outputs: Record<string, unknown> = { ...(existing?.outputs ?? {}) };
    outputs[decision.key] = { text: decision.text, rev: decision.rev, updatedAt: serverTimestamp() };
    tx.set(ref, { userId: uid, courseId, outputs, updatedAt: serverTimestamp() });
    return decision;
  });
}
