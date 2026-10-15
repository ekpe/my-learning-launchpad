import { useCallback, useEffect, useRef, useState } from 'react';
import { saveActionOutput, subscribeActionCard } from '../services/actionCard';
import { ACTION_CARD_KEYS, MAX_OUTPUT_CHARS, savedOutputCount, type ActionCardDoc, type ActionCardKey, type SectionState } from '../lib/actionCardLogic';

export interface SectionDraft {
  text: string;
  /** Revision of the server copy this draft started from (0 = nothing saved yet). */
  baseRev: number;
  state: SectionState;
  message?: string;
  /** Set when state === 'conflict': the newer answer found on the server. */
  remote?: { text: string; rev: number };
}

type Drafts = Record<ActionCardKey, SectionDraft>;

const blank = (): Drafts =>
  Object.fromEntries(ACTION_CARD_KEYS.map((k) => [k, { text: '', baseRev: 0, state: 'empty' } as SectionDraft])) as Drafts;

const AUTOSAVE_MS = 1500;

const friendlyError = (err: any): string => {
  const code = String(err?.code ?? '');
  if (code.includes('permission-denied')) return 'Your Action Card can only be saved while you are signed in and enrolled in this course.';
  if (code.includes('unavailable') || code.includes('failed-precondition') || err?.message?.toLowerCase?.().includes('offline'))
    return "We couldn't reach the server. Your text is still here. Check your connection and press Save to retry.";
  return "We couldn't save this just now. Your text is still here. Press Save to try again.";
};

/**
 * Live, per-learner Action Card.
 *  - restores saved answers on any device (Firestore snapshot),
 *  - saves each of the six sections independently (own revision, transactional stale-write check),
 *  - never overwrites an answer saved elsewhere without the learner choosing to,
 *  - keeps unsaved text on screen when a save fails.
 */
export function useActionCard(uid: string | undefined, courseId: string | undefined) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remote, setRemote] = useState<ActionCardDoc | null>(null);
  const [drafts, setDrafts] = useState<Drafts>(blank);
  // The ref is the source of truth for handlers; it is updated synchronously (never inside a state updater) so a
  // handler that patches and then immediately saves sees its own change.
  const draftsRef = useRef<Drafts>(drafts);
  const timers = useRef<Partial<Record<ActionCardKey, ReturnType<typeof setTimeout>>>>({});

  const patch = useCallback((key: ActionCardKey, next: Partial<SectionDraft>) => {
    const merged = { ...draftsRef.current, [key]: { ...draftsRef.current[key], ...next } };
    draftsRef.current = merged;
    setDrafts(merged);
  }, []);

  // Subscribe to the learner's own card.
  useEffect(() => {
    if (!uid || !courseId) return;
    setLoaded(false);
    setLoadError(null);
    return subscribeActionCard(
      uid,
      courseId,
      (card) => {
        setLoadError(null);
        setRemote(card);
        {
          const prev = draftsRef.current;
          const next = { ...prev };
          for (const k of ACTION_CARD_KEYS) {
            const r = card?.outputs?.[k];
            const cur = prev[k];
            const remoteRev = r?.rev ?? 0;
            const untouched = cur.state === 'empty' || cur.state === 'saved';
            if (untouched) {
              next[k] = { text: r?.text ?? '', baseRev: remoteRev, state: r?.text ? 'saved' : 'empty' };
            } else if (cur.state !== 'saving' && remoteRev > cur.baseRev) {
              // Unsaved local edits AND a newer answer elsewhere: never overwrite either silently.
              next[k] = { ...cur, state: 'conflict', remote: { text: r?.text ?? '', rev: remoteRev } };
            }
          }
          draftsRef.current = next;
          setDrafts(next);
        }
        setLoaded(true);
      },
      (err: any) => {
        setLoadError(
          String(err?.code ?? '').includes('permission-denied')
            ? 'We could not open your Action Card. Please make sure you are signed in and enrolled in this course.'
            : "We couldn't load your saved Action Card. Check your connection and refresh the page.",
        );
        setLoaded(true);
      },
    );
  }, [uid, courseId]);

  const save = useCallback(
    async (key: ActionCardKey) => {
      if (!uid || !courseId) return;
      const cur = draftsRef.current[key];
      if (cur.state === 'saving' || cur.state === 'conflict') return;
      clearTimeout(timers.current[key]);
      const sentText = cur.text;
      patch(key, { state: 'saving', message: undefined });
      try {
        const res = await saveActionOutput(uid, courseId, key, sentText, cur.baseRev);
        if (res.ok) {
          const nowText = draftsRef.current[key].text;
          // If the learner kept typing while this save was in flight, stay dirty (and save again).
          patch(key, { baseRev: res.rev, state: nowText === sentText ? (sentText ? 'saved' : 'empty') : 'dirty', message: undefined });
          if (nowText !== sentText) timers.current[key] = setTimeout(() => void save(key), AUTOSAVE_MS);
        } else {
          // (strictNullChecks is off in this project, so narrow explicitly)
          const failed = res as Exclude<typeof res, { ok: true }>;
          if (failed.reason === 'conflict') patch(key, { state: 'conflict', remote: failed.remote, message: undefined });
          else patch(key, { state: 'error', message: failed.message });
        }
      } catch (err) {
        patch(key, { state: 'error', message: friendlyError(err) });
      }
    },
    [uid, courseId, patch],
  );

  const setText = useCallback(
    (key: ActionCardKey, text: string) => {
      const clipped = text.slice(0, MAX_OUTPUT_CHARS);
      const cur = draftsRef.current[key];
      // While a save is in flight (or a conflict is open) only the text changes; the save handler re-checks afterwards.
      if (cur.state === 'conflict' || cur.state === 'saving') {
        patch(key, { text: clipped });
        return;
      }
      patch(key, { text: clipped, state: 'dirty', message: undefined });
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => void save(key), AUTOSAVE_MS);
    },
    [patch, save],
  );

  /** Conflict choice A: discard my edit and take the newer answer. */
  const takeNewer = useCallback(
    (key: ActionCardKey) => {
      const r = draftsRef.current[key].remote;
      if (!r) return;
      patch(key, { text: r.text, baseRev: r.rev, state: r.text ? 'saved' : 'empty', remote: undefined, message: undefined });
    },
    [patch],
  );

  /** Conflict choice B: keep my text and replace the newer answer (rebase on the newer revision, then save). */
  const keepMine = useCallback(
    (key: ActionCardKey) => {
      const r = draftsRef.current[key].remote;
      if (!r) return;
      patch(key, { baseRev: r.rev, state: 'dirty', remote: undefined, message: undefined });
      void save(key);
    },
    [patch, save],
  );

  // Warn before closing the tab with unsaved work, and flush on leaving the screen.
  useEffect(() => {
    const unsaved = () => ACTION_CARD_KEYS.some((k) => ['dirty', 'saving', 'error'].includes(draftsRef.current[k].state));
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsaved()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      for (const k of ACTION_CARD_KEYS) {
        clearTimeout(timers.current[k]);
        if (draftsRef.current[k].state === 'dirty') void save(k);
      }
    };
  }, [save]);

  return { loaded, loadError, drafts, remote, savedCount: savedOutputCount(remote), setText, save, takeNewer, keepMine };
}
