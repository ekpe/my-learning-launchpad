/**
 * Minimal first-party consent store. Analytics (Google Analytics) stays off
 * until the visitor explicitly accepts; "Decline" is remembered too.
 *
 * Only a yes/no preference and a timestamp are stored — no personal data.
 */

const KEY = "mll_consent_v1";
const EVENT = "mll-consent-change";
const REOPEN_EVENT = "mll-consent-reopen";

export interface ConsentState {
  analytics: boolean;
  decidedAt: string;
}

export function getConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.analytics !== "boolean") return null;
    return parsed as ConsentState;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return getConsent()?.analytics === true;
}

export function setConsent(analytics: boolean): void {
  const state: ConsentState = { analytics, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: the in-memory event below still applies for this page view */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: state }));
}

export function onConsentChange(cb: (state: ConsentState) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ConsentState>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Lets the footer re-open the banner so people can change their mind. */
export function requestConsentReopen(): void {
  window.dispatchEvent(new Event(REOPEN_EVENT));
}

export function onConsentReopen(cb: () => void): () => void {
  window.addEventListener(REOPEN_EVENT, cb);
  return () => window.removeEventListener(REOPEN_EVENT, cb);
}
