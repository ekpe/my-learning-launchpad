import { formModeFor, type WebinarConfig } from '../config/webinar';

/**
 * The site-wide webinar announcement (top bar and "Webinar" menu link).
 * It shows only what is true right now: a scheduled, open, future event with its real date, or a waitlist with
 * no date. A closed, finished, cancelled, missing or already-started event shows nothing, and no date is ever invented.
 */
export type Announcement =
  | { mode: 'open'; title: string; when: string }
  | { mode: 'waitlist'; title: string };

export function shortWhen(iso: string, timeZone: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}

export function announcementFor(config: WebinarConfig | null | undefined, nowMs: number = Date.now()): Announcement | null {
  if (!config) return null;
  if (config.webinarStatus !== 'scheduled') return null; // live, completed and cancelled events are not promoted
  const mode = formModeFor(config);
  if (mode === 'closed') return null;
  if (mode === 'interest') return { mode: 'waitlist', title: config.title };
  if (!config.startsAt || new Date(config.startsAt).getTime() <= nowMs) return null;
  return { mode: 'open', title: config.title, when: shortWhen(config.startsAt, config.timezone) };
}

/** Public marketing pages only: not lessons, the dashboard, admin, or the webinar's own pages. */
export function showsAnnouncementOn(pathname: string): boolean {
  if (pathname === '/') return true;
  if (/^\/course\/[^/]+\/?$/.test(pathname)) return true;
  return false;
}

export const ANNOUNCEMENT_HREF = '/webinar?utm_source=site&utm_medium=announcement&utm_content=bar';
export const NAV_HREF = '/webinar?utm_source=site&utm_medium=nav&utm_content=menu';
