import type { RegistrationStatus, WebinarStatus } from '../../api/_lib/webinar-shared';

/**
 * Webinar page defaults. Event-specific details (date, status, capacity,
 * agenda overrides, replay flag) live in Firestore `webinars/{eventId}` and are
 * edited from Admin → Webinars, so changing them never needs a code change.
 * The private Google Meet link lives in `webinarPrivate/{eventId}` and is never
 * sent to the browser.
 */

export const DEFAULT_EVENT_ID: string = import.meta.env?.VITE_WEBINAR_EVENT_ID || 'leading-ai-hype-to-strategy';

export const FLAGSHIP_COURSE_ID = 'ai-strategy-leaders';
export const PATHWAY_COURSE_IDS = [
  'ai-strategy-intensive',
  'ai-strategy-certification',
  'enterprise-ai-implementation',
  'leading-agentic-ai',
];

export const SITE_CONTACT_EMAIL = 'info@mylearninglaunchpad.com';

export interface AgendaItem {
  time: string;
  title: string;
}

export const DEFAULT_AGENDA: AgendaItem[] = [
  { time: '0–10 min', title: 'The AI Leadership Challenge' },
  { time: '10–25 min', title: 'From Generative AI to Agentic AI' },
  { time: '25–40 min', title: 'Where AI Creates Real Value' },
  { time: '40–50 min', title: 'Your Practical AI Leadership Next Step' },
  { time: '50–60 min', title: 'Live Q&A and Learning Pathways' },
];

export interface WebinarConfig {
  id: string;
  title: string;
  subtitle: string;
  startsAt: string | null;
  timezone: string;
  durationMinutes: number;
  registrationStatus: RegistrationStatus;
  webinarStatus: WebinarStatus;
  replayAvailable: boolean;
  agenda: AgendaItem[];
}

export const DEFAULT_TITLE = 'Leading in the Age of AI: From Hype to Strategy';
export const DEFAULT_SUBTITLE =
  'What Every Leader Needs to Know About Generative AI, AI Agents, and the Future of Work';

export function normalizeWebinar(id: string, data: Record<string, any>): WebinarConfig {
  const agenda: AgendaItem[] = Array.isArray(data.agenda)
    ? data.agenda
        .filter((a: any) => a && typeof a.time === 'string' && typeof a.title === 'string')
        .map((a: any) => ({ time: a.time, title: a.title }))
    : [];
  return {
    id,
    title: typeof data.title === 'string' && data.title ? data.title : DEFAULT_TITLE,
    subtitle: typeof data.subtitle === 'string' && data.subtitle ? data.subtitle : DEFAULT_SUBTITLE,
    startsAt: typeof data.startsAt === 'string' && data.startsAt ? data.startsAt : null,
    timezone: typeof data.timezone === 'string' && data.timezone ? data.timezone : 'UTC',
    durationMinutes: Number(data.durationMinutes) > 0 ? Number(data.durationMinutes) : 60,
    registrationStatus: ['open', 'closed', 'waitlist'].includes(data.registrationStatus) ? data.registrationStatus : 'waitlist',
    webinarStatus: ['scheduled', 'live', 'completed', 'cancelled'].includes(data.webinarStatus) ? data.webinarStatus : 'scheduled',
    replayAvailable: data.replayAvailable === true,
    agenda: agenda.length ? agenda : DEFAULT_AGENDA,
  };
}

export type FormMode = 'registration' | 'interest' | 'closed';

/** What the registration section should offer, derived only from real configuration. */
export function formModeFor(c: WebinarConfig): FormMode {
  if (c.registrationStatus === 'closed' || c.webinarStatus === 'completed' || c.webinarStatus === 'cancelled') return 'closed';
  if (!c.startsAt || c.registrationStatus === 'waitlist') return 'interest';
  return 'registration';
}

export function ctaLabelFor(mode: FormMode | 'unavailable'): string {
  if (mode === 'registration') return 'Reserve My Free Seat';
  if (mode === 'interest') return 'Join the Waitlist';
  return 'Registration Unavailable';
}
