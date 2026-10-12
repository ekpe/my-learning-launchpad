import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowRight, CalendarPlus, CheckCircle2, Download } from 'lucide-react';
import { buildIcs, formatEventWhen, googleCalendarUrl } from '../../../api/_lib/webinar-shared';
import { DEFAULT_EVENT_ID, FLAGSHIP_COURSE_ID, SITE_CONTACT_EMAIL } from '../../config/webinar';
import { useWebinarConfig } from '../../hooks/useWebinarConfig';
import { usePageMeta } from '../../hooks/usePageMeta';
import { withAttribution } from '../../services/attribution';
import { trackWebinar } from '../../services/webinarAnalytics';

interface ThankYouState {
  eventId?: string;
  firstName?: string;
  mode?: 'registration' | 'interest';
  emailStatus?: string;
}

const CALENDAR_LOCATION = 'Online (Google Meet): your joining link is in your confirmation email';

/**
 * Shown only after the server confirms the registration. Registration details
 * arrive via router state, so opening this URL directly (or sharing it) never
 * claims that someone is registered. The private Meet link is never shown here;
 * it only goes out in the confirmation email.
 */
export const WebinarThankYou = () => {
  const location = useLocation();
  const nav = (location.state ?? null) as ThankYouState | null;
  const registered = !!nav?.mode;
  const { config } = useWebinarConfig(nav?.eventId || DEFAULT_EVENT_ID);

  usePageMeta({
    title: registered ? "You're Registered | MyLearningLaunchpad" : 'Webinar registration | MyLearningLaunchpad',
    description: 'Webinar registration confirmation.',
    path: '/webinar/thank-you',
    noindex: true,
  });

  const emailOk = nav?.emailStatus === 'sent';
  const hasDate = !!config?.startsAt && nav?.mode === 'registration';

  const downloadIcs = () => {
    if (!config?.startsAt) return;
    const ics = buildIcs({
      uid: `${config.id}@mylearninglaunchpad.com`,
      title: config.title,
      startsAtIso: config.startsAt,
      durationMinutes: config.durationMinutes,
      description: config.subtitle,
      location: CALENDAR_LOCATION,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'webinar.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!registered) {
    return (
      <main id="main" className="bg-slate-50 pb-24 pt-32">
        <div className="mx-auto max-w-xl px-6 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Looking for your confirmation?</h1>
          <p className="mt-4 text-lg text-slate-700">
            If you registered, your confirmation and joining details are in your email inbox. Otherwise, you can register
            for free below.
          </p>
          <Link
            to="/webinar#register"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-navy-900 px-7 py-3.5 font-bold text-white hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900"
          >
            Go to registration <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="bg-slate-50 pb-24 pt-28 sm:pt-32">
      <div className="mx-auto max-w-2xl px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-9 w-9 text-green-700" aria-hidden="true" />
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {nav!.mode === 'interest' ? "You're on the List!" : "You're Registered!"}
            </h1>
          </div>
          <p className="mt-4 text-lg text-slate-700">
            {nav!.firstName ? `Thanks, ${nav!.firstName}. ` : ''}
            {nav!.mode === 'interest'
              ? "We'll email you as soon as the date for this masterclass is confirmed."
              : 'Your seat is reserved for:'}
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-lg font-bold text-slate-900">{config?.title ?? 'Leading in the Age of AI: From Hype to Strategy'}</p>
            {hasDate && config?.startsAt && (
              <p className="mt-1 text-slate-700">
                {formatEventWhen(config.startsAt, config.timezone)} · {config.durationMinutes} minutes · Live on Google Meet
              </p>
            )}
          </div>

          {emailOk ? (
            <div className="mt-6" role="status">
              <h2 className="text-lg font-bold text-slate-900">Check your email</h2>
              <p className="mt-2 leading-relaxed text-slate-700">
                We've sent a confirmation to your inbox
                {nav!.mode === 'registration' ? ' with your Google Meet joining link and a calendar invitation' : ''}. If you
                don't see it within a few minutes, check your spam or promotions folder, and consider adding{' '}
                {SITE_CONTACT_EMAIL} to your contacts.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950" role="alert">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">
                Your registration is saved, but we couldn't send the confirmation email just now. Please write to{' '}
                <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-semibold underline">{SITE_CONTACT_EMAIL}</a> and
                we'll send your details.
              </p>
            </div>
          )}

          {nav!.mode === 'registration' && (
            <div className="mt-8">
              <h2 className="text-lg font-bold text-slate-900">How to join</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed text-slate-700">
                <li>Open your confirmation email. It contains your private Google Meet link.</li>
                <li>A few minutes before the start, click the link and join from a browser or the Google Meet app.</li>
              </ol>
            </div>
          )}

          {hasDate && config?.startsAt && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={googleCalendarUrl({
                  title: config.title,
                  startsAtIso: config.startsAt,
                  durationMinutes: config.durationMinutes,
                  description: config.subtitle,
                  location: CALENDAR_LOCATION,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-navy-900 px-6 py-3 font-semibold text-navy-900 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900"
              >
                <CalendarPlus className="h-5 w-5" aria-hidden="true" /> Add to Google Calendar
              </a>
              <button
                type="button"
                onClick={downloadIcs}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900"
              >
                <Download className="h-5 w-5" aria-hidden="true" /> Download .ics file
              </button>
            </div>
          )}
        </div>

        {/* Soft next step — never required for the webinar. */}
        <div className="mt-8 rounded-3xl border border-navy-900/15 bg-white p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-slate-900">While You Wait, Explore Our Free AI Strategy for Leaders Course</h2>
          <p className="mt-3 text-lg leading-relaxed text-slate-700">
            A self-paced foundation in AI leadership, free to start whenever you like. It's optional, and you don't need it
            to attend the webinar.
          </p>
          <Link
            to={withAttribution(`/course/${FLAGSHIP_COURSE_ID}`, 'webinar_thank_you')}
            onClick={() => trackWebinar('free_course_click', { event_id: nav?.eventId, course_id: FLAGSHIP_COURSE_ID, placement: 'thank_you' })}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-navy-900 px-7 py-3.5 font-bold text-white hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900"
          >
            Explore the free course <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
};
