import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_EVENT_ID, normalizeWebinar, type WebinarConfig } from '../config/webinar';

export type WebinarConfigState =
  | { status: 'loading'; config: null }
  | { status: 'ready'; config: WebinarConfig }
  | { status: 'missing'; config: null }
  | { status: 'error'; config: null };

/**
 * Live public config for a webinar (Firestore `webinars/{eventId}`).
 * "missing" means no event has been created yet; "error" usually means the
 * Firestore rules haven't been deployed. In both cases the page does not
 * invent a schedule and does not offer a registration form.
 */
export function useWebinarConfig(eventId: string = DEFAULT_EVENT_ID): WebinarConfigState {
  const [state, setState] = useState<WebinarConfigState>({ status: 'loading', config: null });

  useEffect(() => {
    // Dev-only preview seam (compiled out of production builds): lets the page be
    // exercised in every state without a live Firestore document.
    if (import.meta.env.DEV) {
      try {
        // ?preview=open|waitlist|closed|missing  (remembered for the tab so the thank-you page matches)
        const preset = new URLSearchParams(window.location.search).get('preview');
        const day = 86_400_000;
        const presets: Record<string, object> = {
          open: { startsAt: new Date(Date.now() + 10 * day).toISOString(), timezone: 'America/New_York', registrationStatus: 'open', webinarStatus: 'scheduled' },
          waitlist: { startsAt: null, registrationStatus: 'waitlist', webinarStatus: 'scheduled' },
          closed: { startsAt: new Date(Date.now() + 10 * day).toISOString(), timezone: 'America/New_York', registrationStatus: 'closed', webinarStatus: 'scheduled' },
          missing: { missing: true },
        };
        if (preset && presets[preset]) sessionStorage.setItem('mll_webinar_mock', JSON.stringify(presets[preset]));
        if (preset === 'off') sessionStorage.removeItem('mll_webinar_mock');
        const mock = sessionStorage.getItem('mll_webinar_mock');
        if (mock) {
          const parsed = JSON.parse(mock);
          setState(parsed.missing ? { status: 'missing', config: null } : { status: 'ready', config: normalizeWebinar(eventId, parsed) });
          return;
        }
      } catch {
        /* ignore malformed mock */
      }
    }
    setState({ status: 'loading', config: null });
    return onSnapshot(
      doc(db, 'webinars', eventId),
      (snap) => {
        setState(
          snap.exists()
            ? { status: 'ready', config: normalizeWebinar(eventId, snap.data()) }
            : { status: 'missing', config: null }
        );
      },
      (err) => {
        console.error('[webinar] Could not load event configuration:', err.code);
        setState({ status: 'error', config: null });
      }
    );
  }, [eventId]);

  return state;
}
