import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Check, ChevronDown, Clock, MonitorPlay, Users } from 'lucide-react';
import { courses } from '../../data/courses';
import {
  DEFAULT_AGENDA,
  DEFAULT_EVENT_ID,
  DEFAULT_SUBTITLE,
  DEFAULT_TITLE,
  FLAGSHIP_COURSE_ID,
  PATHWAY_COURSE_IDS,
  SITE_CONTACT_EMAIL,
  ctaLabelFor,
  formModeFor,
  type WebinarConfig,
} from '../../config/webinar';
import { formatEventWhen } from '../../../api/_lib/webinar-shared';
import { useWebinarConfig } from '../../hooks/useWebinarConfig';
import { usePageMeta } from '../../hooks/usePageMeta';
import { captureAttribution, withAttribution } from '../../services/attribution';
import { trackWebinar } from '../../services/webinarAnalytics';
import { RegistrationForm } from './RegistrationForm';

const PHOTO = '/images/prof_ekpe_okorafor.jpg';
const SITE = 'https://www.mylearninglaunchpad.com';

const PAGE_DESCRIPTION =
  'A free 60-minute live masterclass with Prof. Ekpe Okorafor: what leaders need to know about generative AI, AI agents and the future of work. No technical background required.';

// ── Small building blocks ────────────────────────────────────────────────────

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-amber-800">{children}</p>
);

const SectionHeading = ({ eyebrow, children, id }: { eyebrow?: string; children: React.ReactNode; id?: string }) => (
  <div className="mx-auto mb-12 max-w-3xl text-center">
    {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
    <h2 id={id} className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
      {children}
    </h2>
  </div>
);

function useVisitorLocalTime(config: WebinarConfig | null): string | null {
  if (!config?.startsAt) return null;
  const visitorZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!visitorZone || visitorZone === config.timezone) return null;
  return formatEventWhen(config.startsAt, visitorZone);
}

function EventJsonLd({ config }: { config: WebinarConfig }) {
  useEffect(() => {
    // Only emit structured data for a real, scheduled, open event.
    if (!config.startsAt || config.webinarStatus !== 'scheduled' || config.registrationStatus !== 'open') return;
    const end = new Date(new Date(config.startsAt).getTime() + config.durationMinutes * 60_000).toISOString();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: config.title,
      description: PAGE_DESCRIPTION,
      startDate: config.startsAt,
      endDate: end,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      // The page URL, never the private Google Meet link.
      location: { '@type': 'VirtualLocation', url: `${SITE}/webinar` },
      image: [`${SITE}${PHOTO}`],
      organizer: { '@type': 'Organization', name: 'MyLearningLaunchpad', url: SITE },
      performer: { '@type': 'Person', name: 'Ekpe Okorafor' },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: `${SITE}/webinar` },
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [config.startsAt, config.webinarStatus, config.registrationStatus, config.durationMinutes, config.title]);
  return null;
}

/** Mobile-only bar that appears once the hero CTA scrolls away, and steps aside near the form, final CTA and footer. */
function useStickyCta(heroCtaRef: React.RefObject<HTMLElement | null>) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const blockers = new Set<Element>();
    let heroVisible = true;
    const update = () => setShow(!heroVisible && blockers.size === 0);

    const heroObs = new IntersectionObserver(([e]) => {
      heroVisible = e.isIntersecting;
      update();
    });
    if (heroCtaRef.current) heroObs.observe(heroCtaRef.current);

    const blockObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? blockers.add(e.target) : blockers.delete(e.target)));
      update();
    });
    ['register', 'final-cta'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) blockObs.observe(el);
    });
    const footer = document.querySelector('footer');
    if (footer) blockObs.observe(footer);

    return () => {
      heroObs.disconnect();
      blockObs.disconnect();
    };
  }, [heroCtaRef]);
  return show;
}

// ── Page ─────────────────────────────────────────────────────────────────────

const AUDIENCES = [
  'Government and public-sector leaders',
  'Small and medium-sized business owners and managers',
  'University and academic leaders',
  'Nonprofit and development-sector leaders',
  'Startup founders and entrepreneurs',
  'Research and innovation leaders',
  'Education and technology leaders',
  'Senior and mid-career professionals preparing to lead AI-enabled change',
];

const PROBLEMS = [
  'Too many AI tools and competing claims',
  'Pressure to adopt AI without a clear strategy',
  'Uncertainty about AI agents and autonomous systems',
  'Difficulty identifying worthwhile opportunities',
  'Concerns about trust, accountability, and workforce implications',
  'Limited time and resources for learning',
];

const OUTCOMES = [
  { title: 'Understand the AI Shift', body: 'What has changed from generative AI to agentic AI, and why it matters.' },
  { title: 'Separate Capability from Hype', body: 'Recognize what AI can do versus what it can do reliably.' },
  { title: 'Spot Opportunities', body: 'Identify where AI might create practical value in your organization.' },
  { title: 'Lead Responsible Adoption', body: 'Understand the importance of human judgment, oversight, and accountability.' },
  { title: 'Define Your Next Step', body: 'Leave with a practical direction for your AI leadership journey.' },
];

export const WebinarPage = () => {
  const state = useWebinarConfig(DEFAULT_EVENT_ID);
  const config = state.config;
  const mode = config ? formModeFor(config) : null;
  const heroCtaRef = useRef<HTMLAnchorElement>(null);
  const showSticky = useStickyCta(heroCtaRef);
  const visitorLocal = useVisitorLocalTime(config);

  usePageMeta({
    title: `${config?.title ?? DEFAULT_TITLE} | MyLearningLaunchpad`,
    description: PAGE_DESCRIPTION,
    path: '/webinar',
  });

  useEffect(() => {
    captureAttribution();
    trackWebinar('webinar_page_view', { event_id: DEFAULT_EVENT_ID }, DEFAULT_EVENT_ID);
  }, []);

  const ctaLabel = ctaLabelFor(mode ?? 'unavailable');
  const flagship = courses.find((c) => c.id === FLAGSHIP_COURSE_ID);
  const pathways = PATHWAY_COURSE_IDS.map((id) => courses.find((c) => c.id === id)).filter(Boolean) as typeof courses;

  const faqs: { q: string; a: string }[] = [
    { q: 'Is the webinar free?', a: 'Yes. Registration and attendance are free, and no payment details are needed.' },
    {
      q: 'Do I need a technical background?',
      a: 'No. This session is designed for leaders and aspiring leaders. No coding and no prior AI expertise are assumed.',
    },
    {
      q: 'Who should attend?',
      a: 'Leaders and aspiring leaders across government, small and medium-sized businesses, universities, nonprofits, startups, research and technology teams, and larger organizations.',
    },
    {
      q: 'How will I join?',
      a: 'The session runs live on Google Meet. After you register, we email you a confirmation with your joining link and a calendar invitation. You can join from a browser or the Google Meet app. If the date is not confirmed yet, we will email you as soon as it is.',
    },
    {
      q: 'Will there be a recording?',
      a: config?.replayAvailable
        ? 'Yes. Registrants will receive replay details by email.'
        : 'We will confirm after the session whether a recording will be available. Registrants will be told by email.',
    },
    {
      q: 'Do I have to enroll in a course?',
      a: 'No. The webinar stands on its own. At the end we share optional learning pathways, including a free self-paced course.',
    },
    {
      q: 'Can participants outside the United States attend?',
      a: 'Yes. Anyone with an internet connection can join from anywhere. The start time is shown in the event time zone, with your local time alongside, and calendar invitations adjust to your time zone automatically.',
    },
  ];

  return (
    <main id="main" className="bg-white text-slate-900">
      {config && <EventJsonLd config={config} />}

      {/* 1 — Hero */}
      <section aria-labelledby="hero-title" className="bg-gradient-to-b from-blue-50/70 to-white pb-16 pt-28 sm:pt-32 lg:pb-24">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem] xl:gap-14">
          <div>
            <Eyebrow>Free live AI leadership masterclass</Eyebrow>
            <h1 id="hero-title" className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
              {config?.title ?? DEFAULT_TITLE}
            </h1>
            <p className="mt-5 text-xl font-medium text-blue-900 xl:whitespace-nowrap xl:text-lg">{config?.subtitle ?? DEFAULT_SUBTITLE}</p>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-700">
              AI is transforming how organizations operate. But with new tools, AI agents, and constant technology
              announcements, how do you separate real opportunity from hype?
            </p>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-700">
              Join Prof. Ekpe Okorafor for a practical, leadership-focused masterclass designed to help you understand
              the AI shift, recognize strategic opportunities, and identify your next step.
            </p>

            <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-base font-medium text-slate-800">
              {[
                [Check, 'Free admission'],
                [Clock, '60 minutes'],
                [MonitorPlay, 'Live online'],
                [Users, 'No technical background required'],
              ].map(([Icon, text]: any) => (
                <li key={text} className="flex items-center gap-2.5">
                  <Icon className="h-5 w-5 shrink-0 text-blue-900" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>

            {/* Real date/time only when configured — never a fictitious one. */}
            <div className="mt-8 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-blue-900" aria-hidden="true" />
                <div>
                  {config?.startsAt ? (
                    <>
                      <p className="font-semibold text-slate-900">{formatEventWhen(config.startsAt, config.timezone)}</p>
                      {visitorLocal && <p className="mt-1 text-sm text-slate-600">Your local time: {visitorLocal}</p>}
                    </>
                  ) : state.status === 'loading' ? (
                    <p className="text-slate-600">Loading event details…</p>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-900">Date and time to be announced</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {mode === 'interest'
                          ? 'Join the waitlist and we will email you as soon as the date is confirmed.'
                          : 'Check back soon for the schedule.'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {/* On large screens the sign-up card sits beside the copy, so this button is only for smaller screens. */}
              <a
                ref={heroCtaRef}
                href="#register"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-900 px-8 py-4 text-base font-bold text-white shadow-lg shadow-blue-900/20 transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900 lg:hidden"
              >
                {ctaLabel}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </a>
              <Link
                to="/#courses"
                className="text-base font-semibold text-blue-900 underline underline-offset-4 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
              >
                Explore the AI Leadership Academy
              </Link>
            </div>
          </div>

          {/* Sign-up card: large screens only. Smaller screens use the button above and the form further down. */}
          <div className="hidden lg:block">
            {config && (mode === 'registration' || mode === 'interest') && (
              <RegistrationForm config={config} mode={mode} variant="compact" idPrefix="signup" />
            )}
            {config && mode === 'closed' && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl" role="status">
                <p className="text-lg font-bold text-slate-900">Registration for this session is closed.</p>
                <p className="mt-2 text-sm text-slate-700">The free self-paced course is open any time. See the pathways below.</p>
              </div>
            )}
            {(state.status === 'missing' || state.status === 'error') && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl" role="status">
                <p className="text-lg font-bold text-slate-900">Registration isn't open yet.</p>
                <p className="mt-2 text-sm text-slate-700">Please check back soon.</p>
              </div>
            )}
            {state.status === 'loading' && <div aria-hidden="true" className="h-[26rem] animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" />}
          </div>
        </div>
      </section>

      {/* 2 — The leadership problem */}
      <section aria-labelledby="problem-title" className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <SectionHeading id="problem-title">AI Is Moving Fast. Leadership Clarity Matters More Than Ever.</SectionHeading>
          <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {PROBLEMS.map((p) => (
              <li key={p} className="flex items-start gap-3 border-b border-slate-200 pb-4 text-lg text-slate-800">
                <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                {p}
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-12 max-w-3xl text-balance text-center text-2xl font-semibold leading-snug text-blue-900">
            You don't need to master every AI tool. You need a framework for making better AI leadership decisions.
          </p>
        </div>
      </section>

      {/* 3 — Outcomes */}
      <section aria-labelledby="learn-title" className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading eyebrow="What participants will learn" id="learn-title">
            What You'll Walk Away With
          </SectionHeading>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {OUTCOMES.map((o, i) => (
              <li key={o.title} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <span aria-hidden="true" className="text-sm font-bold tracking-widest text-amber-800">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-xl font-bold text-slate-900">{o.title}</h3>
                <p className="mt-2 leading-relaxed text-slate-700">{o.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 — Who should attend */}
      <section aria-labelledby="who-title" className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading eyebrow="Who should attend" id="who-title">
            Designed for Leaders Across Sectors
          </SectionHeading>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((a) => (
              <li key={a} className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-medium leading-snug text-slate-800">
                {a}
              </li>
            ))}
          </ul>
          <p className="mt-10 text-center text-xl font-semibold text-blue-900">No coding required. No AI expertise assumed.</p>
        </div>
      </section>

      {/* 5 — Agenda */}
      <section aria-labelledby="agenda-title" className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <SectionHeading eyebrow="The 60-minute agenda" id="agenda-title">
            A Focused Hour, Built Around You
          </SectionHeading>
          <ol className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {(config?.agenda ?? DEFAULT_AGENDA).map((item) => (
              <li key={item.time} className="flex flex-col gap-1 px-6 py-5 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="w-28 shrink-0 text-sm font-bold uppercase tracking-wide text-amber-800">{item.time}</span>
                <span className="text-lg font-semibold text-slate-900">{item.title}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-center text-sm text-slate-600">Agenda may be adjusted to fit the questions in the room.</p>
        </div>
      </section>

      {/* 6 — Instructor */}
      <section aria-labelledby="instructor-title" className="bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="mx-auto aspect-[4/5] max-w-xs overflow-hidden rounded-3xl bg-slate-200 shadow-xl">
              <img src={PHOTO} alt="Prof. Ekpe Okorafor" width={800} height={1000} loading="lazy" className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="lg:col-span-8">
            <Eyebrow>Meet your instructor</Eyebrow>
            <h2 id="instructor-title" className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Learn from Someone Who Works Across Academia, Research, and Industry
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-slate-700">
              <strong className="text-slate-900">Prof. Ekpe Okorafor</strong> is a professor, AI researcher, and
              experienced industry AI strategy practitioner, and the founder and lead instructor of MyLearningLaunchpad.
            </p>
            <ul className="mt-6 space-y-3 text-lg text-slate-800">
              {['Academia and executive education', 'AI research and innovation', 'Industry AI strategy and transformation'].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <Check className="mt-1 h-5 w-5 shrink-0 text-blue-900" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-600">
              This webinar is an independent MyLearningLaunchpad AI Leadership Academy session.
            </p>
          </div>
        </div>
      </section>

      {/* 7 — Continue learning */}
      <section aria-labelledby="journey-title" className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading eyebrow="Continue your learning" id="journey-title">
            Your AI Leadership Journey Doesn't End with the Webinar
          </SectionHeading>

          <div className="rounded-3xl border border-blue-900/15 bg-white p-8 shadow-sm sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-800">Free flagship course</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{flagship?.title ?? 'AI Strategy for Leaders'}</h3>
            <p className="mt-1 text-lg font-medium text-blue-900">From Generative AI to the Agentic Enterprise</p>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-700">
              A self-paced foundational course helping leaders understand AI capabilities, evaluate opportunities, and lead
              responsible adoption.
            </p>
            <Link
              to={withAttribution(`/course/${FLAGSHIP_COURSE_ID}`, 'webinar_page_flagship')}
              onClick={() => trackWebinar('free_course_click', { event_id: DEFAULT_EVENT_ID, course_id: FLAGSHIP_COURSE_ID, placement: 'journey' })}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-900 px-7 py-3.5 text-base font-bold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
            >
              Enroll in the Free Course
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>

          {pathways.length > 0 && (
            <div className="mt-10">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-600">Go deeper, when you're ready</h3>
              <ul className="grid gap-4 sm:grid-cols-2">
                {pathways.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={withAttribution(`/course/${c.id}`, 'webinar_page_pathway')}
                      onClick={() => trackWebinar('paid_course_click', { event_id: DEFAULT_EVENT_ID, course_id: c.id, placement: 'journey' })}
                      className="group flex h-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
                    >
                      <span className="font-semibold leading-snug text-slate-900">{c.title}</span>
                      <ArrowRight className="h-5 w-5 shrink-0 text-slate-500 transition-colors group-hover:text-blue-900" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* 8 — Registration */}
      <section id="register" aria-labelledby="register-title" className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-10 text-center">
            <h2 id="register-title" className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {mode === 'registration'
                ? 'Reserve Your Free Seat'
                : mode === 'interest'
                  ? 'Get Notified When the Date Is Set'
                  : 'Registration'}
            </h2>
            <p className="mt-4 text-lg text-slate-700">
              Join this practical masterclass and take the first step toward more confident AI leadership.
            </p>
          </div>

          {state.status === 'loading' && <p className="text-center text-slate-600" role="status">Loading…</p>}

          {config && (mode === 'registration' || mode === 'interest') && <RegistrationForm config={config} mode={mode} />}

          {config && mode === 'closed' && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center" role="status">
              <p className="text-lg font-semibold text-slate-900">Registration for this session is closed.</p>
              <p className="mt-2 text-slate-700">
                The free self-paced course is open any time.{' '}
                <Link
                  to={withAttribution(`/course/${FLAGSHIP_COURSE_ID}`, 'webinar_page_closed')}
                  onClick={() => trackWebinar('free_course_click', { event_id: DEFAULT_EVENT_ID, course_id: FLAGSHIP_COURSE_ID, placement: 'closed' })}
                  className="font-semibold text-blue-900 underline underline-offset-2"
                >
                  Explore AI Strategy for Leaders
                </Link>
                .
              </p>
            </div>
          )}

          {(state.status === 'missing' || state.status === 'error') && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center" role="status">
              <p className="text-lg font-semibold text-slate-900">Registration isn't open yet.</p>
              <p className="mt-2 text-slate-700">
                Please check back soon, or write to{' '}
                <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-semibold text-blue-900 underline underline-offset-2">
                  {SITE_CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 9 — FAQ */}
      <section aria-labelledby="faq-title" className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <SectionHeading eyebrow="Questions" id="faq-title">
            Frequently Asked Questions
          </SectionHeading>
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {faqs.map((f) => (
              <details key={f.q} className="group px-6 py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-left text-lg font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-900 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                </summary>
                <p className="pb-5 leading-relaxed text-slate-700">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 10 — Final CTA */}
      <section id="final-cta" aria-labelledby="final-title" className="bg-blue-950 py-20 text-white sm:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 id="final-title" className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            The Future of AI Leadership Starts with Clarity.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-blue-100">
            Join the free masterclass and discover a practical path from AI curiosity to confident leadership.
          </p>
          <a
            href="#register"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-blue-950 transition-colors hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {ctaLabel}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* Sticky mobile CTA */}
      {showSticky && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden">
          <a
            href="#register"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-900 px-6 py-3.5 text-base font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
          >
            {ctaLabel}
          </a>
        </div>
      )}
    </main>
  );
};
