import { UTM_KEYS, type UtmKey } from '../../api/_lib/webinar-shared';

/**
 * Campaign attribution for the webinar funnel.
 *
 * UTM parameters describe the *campaign*, not the person, so they are kept in
 * sessionStorage (cleared when the tab closes) and sent to the server with the
 * registration. Click IDs (fbclid, gclid, …) are deliberately NOT captured.
 */

const KEY = 'mll_attribution_v1';

export type Attribution = Partial<Record<UtmKey | 'landingUrl' | 'referrer', string>>;

function read(): Attribution | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/** Call once per page load on landing pages. A new UTM-tagged link replaces older attribution. */
export function captureAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const fromUrl: Attribution = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v) fromUrl[key] = v.slice(0, 200);
  }
  const hasUtm = Object.keys(fromUrl).length > 0;
  const existing = read();

  if (!hasUtm && existing) return existing;

  const next: Attribution = {
    ...fromUrl,
    landingUrl: (window.location.origin + window.location.pathname).slice(0, 500),
  };
  if (document.referrer) {
    try {
      const ref = new URL(document.referrer);
      // Referrer origin only; paths and queries can carry identifiers.
      if (ref.origin !== window.location.origin) next.referrer = ref.origin;
    } catch {
      /* ignore malformed referrer */
    }
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable; attribution still works for this page load */
  }
  return next;
}

export function getAttribution(): Attribution {
  return read() ?? {};
}

/** Appends the stored UTM parameters to an internal course link. */
export function withAttribution(path: string, content: string): string {
  const a = getAttribution();
  const q = new URLSearchParams();
  for (const key of UTM_KEYS) if (a[key]) q.set(key, a[key] as string);
  if (!q.has('utm_source')) q.set('utm_source', 'webinar_page');
  if (!q.has('utm_medium')) q.set('utm_medium', 'site');
  q.set('utm_content', content);
  return `${path}?${q.toString()}`;
}
