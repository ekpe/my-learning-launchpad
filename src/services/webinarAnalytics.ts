import { sendGaEvent } from './analyticsService';
import { getAttribution } from './attribution';

export type WebinarEventName =
  | 'webinar_page_view'
  | 'webinar_registration_start'
  | 'webinar_registration_complete'
  | 'webinar_registration_error'
  | 'free_course_click'
  | 'paid_course_click';

export interface WebinarEventParams {
  event_id?: string;
  mode?: string;
  placement?: string;
  course_id?: string;
  error_code?: string;
}

/**
 * Webinar funnel events go to Google Analytics only, only with consent, and
 * only with the whitelisted, non-personal parameters above (never an email
 * address, name or any other form value).
 *
 * `dedupeKey` keeps an event from firing twice in one tab session (page
 * refreshes, React StrictMode double-effects, double clicks). The key is only
 * recorded when GA actually accepted the event, so a visitor who consents
 * later in the session isn't permanently silenced.
 */
export function trackWebinar(name: WebinarEventName, params: WebinarEventParams = {}, dedupeKey?: string): void {
  const storageKey = dedupeKey ? `mll_evt_${name}_${dedupeKey}` : null;
  try {
    if (storageKey && sessionStorage.getItem(storageKey)) return;
  } catch {
    /* storage unavailable: fall through and send */
  }

  const a = getAttribution();
  const sent = sendGaEvent(name, {
    ...params,
    utm_source: a.utm_source,
    utm_medium: a.utm_medium,
    utm_campaign: a.utm_campaign,
    utm_content: a.utm_content,
  });

  if (sent && storageKey) {
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
  }
}
