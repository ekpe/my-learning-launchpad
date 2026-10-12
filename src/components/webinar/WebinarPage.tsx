import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  CalendarClock,
  ChartColumn,
  Check,
  ChevronDown,
  Clock,
  FlaskConical,
  GraduationCap,
  HeartHandshake,
  Landmark,
  Lightbulb,
  Presentation,
  Rocket,
  Settings,
  ShieldCheck,
  Target,
  Ticket,
  TrendingUp,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { courses } from '../../data/courses';
import {
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

// Optimized copies of the portrait (the original is ~6 MB). WebP first, JPEG fallback.
const PHOTO_WEBP = '/images/prof_ekpe_okorafor-1100.webp';
const PHOTO_JPG = '/images/prof_ekpe_okorafor-1100.jpg';
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
    <h2 id={id} className="text-balance text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">
      {children}
    </h2>
  </div>
);

/** "Leading in the Age of AI: From Hype to Strategy" → three lines with the middle one in gold. Other titles render plainly. */
function HeroTitle({ title }: { title: string }) {
  const m = /^(.*?)(Age of AI:)s*(.*)$/i.exec(title);
  if (!m || !m[1].trim()) return <>{title}</>;
  return (
    <>
      <span className="block">{m[1].trim()}</span>
      <span className="block text-gold-400">{m[2]}</span>
      <span className="mt-1 block text-[0.62em] leading-tight">{m[3]}</span>
    </>
  );
}

const SECTORS: { key: string; label: string; Icon: LucideIcon; className?: string; tint: string }[] = [
  { key: 'academia', label: 'Academia', Icon: GraduationCap, className: 'col-span-2', tint: 'from-[#2c4f86] via-[#183a73] to-[#0b1f47]' },
  { key: 'government', label: 'Government', Icon: Landmark, tint: 'from-[#35609a] to-[#10294f]' },
  { key: 'smes-startups', label: 'SMEs & Startups', Icon: Rocket, tint: 'from-[#84591f] to-[#2b1d0c]' },
  { key: 'nonprofits', label: 'Nonprofits', Icon: HeartHandshake, tint: 'from-[#6d5424] to-[#231a09]' },
  { key: 'research', label: 'Research', Icon: FlaskConical, tint: 'from-[#1f5a78] to-[#0b2236]' },
  { key: 'education-professionals', label: 'Education & Professionals', Icon: Users, className: 'col-span-2', tint: 'from-[#3a4f8f] via-[#233a73] to-[#0c1d45]' },
];

/**
 * Gradient + icon tile. To use a real photo, drop a file at /public/images/webinar/<key>.jpg
 * (e.g. academia.jpg); it layers over the gradient automatically. Without a file the tile stays as is.
 */
function SectorTile({ s }: { s: (typeof SECTORS)[number] }) {
  return (
    <li className={`relative isolate min-h-[7.5rem] overflow-hidden bg-gradient-to-br ${s.tint} ${s.className ?? ''}`}>
      <s.Icon aria-hidden="true" className="absolute right-5 top-1/2 h-16 w-16 -translate-y-1/2 text-white/15" />
      <img
        src={`/images/webinar/${s.key}.jpg`}
        alt=""
        loading="lazy"
        onError={(e) => e.currentTarget.remove()}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-navy-950/10 to-transparent" />
      <span className="absolute bottom-3 left-4 text-xs font-bold uppercase tracking-wider text-white sm:left-5 lg:left-8 lg:text-[0.8rem]">{s.label}</span>
    </li>
  );
}

const PHOTO_FADE =
  'linear-gradient(to right, transparent 0%, #000 20%, #000 80%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 12%, #000 74%, transparent 100%)';
const photoMask: React.CSSProperties = {
  WebkitMaskImage: PHOTO_FADE,
  WebkitMaskComposite: 'source-in',
  maskImage: PHOTO_FADE,
  maskComposite: 'intersect',
};

const JOURNEY_ICONS: Record<string, LucideIcon> = {
  'ai-strategy-leaders': BookOpen,
  'ai-strategy-intensive': Presentation,
  'ai-strategy-certification': Award,
  'enterprise-ai-implementation': Settings,
  'leading-agentic-ai': Bot,
};

const splitTitle = (t: string): [string, string] => {
  const i = t.indexOf(':');
  return i < 0 ? [t, ''] : [t.slice(0, i).trim(), t.slice(i + 1).trim()];
};

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
      image: [`${SITE}${PHOTO_JPG}`],
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

const OUTCOMES: { title: string; body: string; Icon: LucideIcon }[] = [
  { title: 'Understand the AI Shift', body: 'What has changed from generative AI to agentic AI, and why it matters.', Icon: Lightbulb },
  { title: 'Separate Capability from Hype', body: 'Recognize what AI can do versus what it can do reliably.', Icon: ChartColumn },
  { title: 'Spot Opportunities', body: 'Identify where AI might create practical value in your organization.', Icon: Target },
  { title: 'Lead Responsible Adoption', body: 'Understand the importance of human judgment, oversight, and accountability.', Icon: ShieldCheck },
  { title: 'Define Your Next Step', body: 'Leave with a practical direction for your AI leadership journey.', Icon: TrendingUp },
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
      <section aria-labelledby="hero-title" className="relative overflow-hidden bg-navy-950 pt-20 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_28%,rgba(24,58,115,0.65),transparent_62%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_8%_90%,rgba(233,164,45,0.12),transparent_48%)]" />
        </div>

        <div className="relative mx-auto grid max-w-[88rem] gap-8 px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 lg:px-8">
          {/* Copy */}
          <div className="py-6 lg:py-10 lg:pr-2">
            <p className="inline-flex items-center gap-2.5 rounded-full bg-gold-500 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-navy-950 sm:text-sm">
              <Video className="h-5 w-5 shrink-0" aria-hidden="true" />
              Free live AI leadership masterclass
            </p>
            <h1 id="hero-title" className="mt-5 text-balance text-5xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl xl:text-[3.7rem]">
              <HeroTitle title={config?.title ?? DEFAULT_TITLE} />
            </h1>
            <p className="mt-5 max-w-xl text-lg font-semibold leading-snug text-white">{config?.subtitle ?? DEFAULT_SUBTITLE}</p>
            <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-slate-200">
              AI is transforming how organizations operate. But with new tools, AI agents, and constant technology
              announcements, how do you separate real opportunity from hype?
            </p>
            <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-slate-200">
              Join Prof. Ekpe Okorafor for a practical, leadership-focused masterclass designed to help you understand
              the AI shift, recognize strategic opportunities, and identify your next step.
            </p>

            <ul className="mt-6 flex max-w-xl flex-wrap gap-x-5 gap-y-4">
              {(
                [
                  [Ticket, 'Free', 'admission'],
                  [Clock, '60', 'minutes'],
                  [Video, 'Live', 'online'],
                  [Users, 'No technical', 'background required'],
                ] as [LucideIcon, string, string][]
              ).map(([Icon, line1, line2]) => (
                <li key={line1} className="flex items-center gap-2.5">
                  <Icon className="h-7 w-7 shrink-0 text-gold-400" aria-hidden="true" />
                  <span className="text-[0.72rem] font-bold uppercase leading-tight tracking-wide text-white">
                    {line1}
                    <br />
                    {line2}
                  </span>
                </li>
              ))}
            </ul>

            {/* Real date/time only when configured — never a fictitious one. */}
            <div className="mt-6 inline-flex max-w-xl items-start gap-3 rounded-2xl border border-gold-500/40 bg-white/5 px-5 py-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" aria-hidden="true" />
              <div>
                {config?.startsAt ? (
                  <>
                    <p className="font-semibold text-white">{formatEventWhen(config.startsAt, config.timezone)}</p>
                    {visitorLocal && <p className="mt-1 text-sm text-slate-300">Your local time: {visitorLocal}</p>}
                  </>
                ) : state.status === 'loading' ? (
                  <p className="text-slate-300">Loading event details…</p>
                ) : (
                  <>
                    <p className="font-semibold text-white">Date and time to be announced</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {mode === 'interest'
                        ? 'Join the waitlist and we will email you as soon as the date is confirmed.'
                        : 'Check back soon for the schedule.'}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <a
                ref={heroCtaRef}
                href="#register"
                className="inline-flex shrink-0 items-center justify-center gap-3 whitespace-nowrap rounded-full bg-gold-500 px-8 py-3.5 text-lg font-extrabold text-navy-950 shadow-lg shadow-black/30 transition-colors hover:bg-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {ctaLabel}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </a>
              <Link
                to="/#courses"
                className="whitespace-nowrap text-base font-semibold text-white underline decoration-gold-400 underline-offset-4 hover:text-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Explore the AI Leadership Academy
              </Link>
            </div>
          </div>

          {/* Portrait, instructor card and sector collage */}
          <div className="pb-8 lg:relative lg:min-h-[34rem] lg:pb-0">
            <div className="relative h-80 sm:h-[26rem] lg:absolute lg:inset-y-0 lg:left-0 lg:h-auto lg:w-[58%]" style={photoMask}>
              <picture>
                <source type="image/webp" srcSet={PHOTO_WEBP} />
                <img
                  src={PHOTO_JPG}
                  alt="Prof. Ekpe Okorafor"
                  width={1100}
                  height={971}
                  fetchPriority="high"
                  className="h-full w-full object-cover object-[50%_22%]"
                />
              </picture>
              <span aria-hidden="true" className="absolute inset-0 bg-navy-700/45 mix-blend-multiply" />
              <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_50%_56%_at_50%_46%,transparent_52%,rgba(5,15,38,0.94)_100%)]" />
              <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy-950/55 via-transparent to-transparent" />
            </div>

            <div className="relative z-20 -mt-6 rounded-2xl border border-white/10 bg-navy-950/85 p-5 shadow-2xl backdrop-blur lg:absolute lg:bottom-6 lg:left-[1%] lg:mt-0 lg:w-[56%]">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-gold-400">With</p>
              <p className="mt-1 text-2xl font-bold text-white">Prof. Ekpe Okorafor</p>
              <p className="mt-2 text-sm text-slate-200">Professor · AI Researcher · Industry Practitioner</p>
              <p className="text-sm text-slate-200">Founder &amp; Lead Instructor, MyLearningLaunchpad</p>
            </div>

            <ul
              aria-label="Leaders this masterclass is for"
              className="mt-6 grid grid-cols-2 gap-1 lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:w-[46%] lg:grid-rows-4 lg:[clip-path:polygon(9%_0,100%_0,100%_100%,0_100%)]"
            >
              {SECTORS.map((s) => (
                <SectorTile key={s.key} s={s} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 2 — Outcomes strip */}
      <section aria-labelledby="learn-title" className="bg-cream py-14 text-navy-950">
        <div className="mx-auto grid max-w-[88rem] gap-10 px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:px-8">
          <div>
            <h2 id="learn-title" className="text-3xl font-extrabold leading-tight tracking-tight">
              What You'll Walk Away With
            </h2>
            <span aria-hidden="true" className="mt-4 block h-0.5 w-12 bg-gold-500" />
          </div>
          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
            {OUTCOMES.map((o) => (
              <li key={o.title} className="lg:border-l lg:border-slate-300/80 lg:px-6 lg:first:border-l-0 lg:first:pl-0">
                <o.Icon className="h-9 w-9 text-gold-600" aria-hidden="true" />
                <h3 className="mt-3 text-lg font-bold leading-snug">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{o.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3 — Journey strip */}
      <section aria-labelledby="journey-title" className="bg-navy-900 py-14 text-white">
        <div className="mx-auto grid max-w-[88rem] gap-10 px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-center lg:px-8">
          <div>
            <h2 id="journey-title" className="text-balance text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              Your AI Leadership Journey Doesn't End with the Webinar
            </h2>
            <span aria-hidden="true" className="mt-4 block h-0.5 w-12 bg-gold-500" />
            <p className="mt-4 text-sm leading-relaxed text-slate-200">
              Continue building your capabilities with our practical courses designed for leaders.
            </p>
          </div>
          <ul className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
            {[flagship, ...pathways].filter(Boolean).map((c) => {
              const isFree = c!.id === FLAGSHIP_COURSE_ID;
              const [name, tagline] = splitTitle(c!.title);
              const Icon = JOURNEY_ICONS[c!.id] ?? BookOpen;
              return (
                <li key={c!.id}>
                  <Link
                    to={withAttribution(`/course/${c!.id}`, 'webinar_page_journey')}
                    onClick={() =>
                      trackWebinar(isFree ? 'free_course_click' : 'paid_course_click', { event_id: DEFAULT_EVENT_ID, course_id: c!.id, placement: 'journey' })
                    }
                    className={`group relative flex h-full flex-col rounded-xl border p-4 transition-colors hover:border-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                      isFree ? 'border-gold-500/80 bg-navy-800' : 'border-white/15 bg-navy-800/50'
                    }`}
                  >
                    {isFree && (
                      <span className="absolute -top-2.5 left-3 rounded bg-gold-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-navy-950">
                        Free course
                      </span>
                    )}
                    <span className="flex items-start gap-3">
                      <Icon className="h-8 w-8 shrink-0 text-gold-400" aria-hidden="true" />
                      <span className="font-bold leading-snug text-white">{name}</span>
                    </span>
                    <span className="mt-2 text-xs leading-snug text-slate-300">
                      {isFree ? 'From Generative AI to the Agentic Enterprise' : tagline}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 4 — Instructor */}
      <section aria-labelledby="instructor-title" className="bg-cream py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Eyebrow>Meet your instructor</Eyebrow>
          <h2 id="instructor-title" className="text-balance text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">
            Learn from Someone Who Works Across Academia, Research, and Industry
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-700">
            <strong className="text-slate-900">Prof. Ekpe Okorafor</strong> is a professor, AI researcher, and experienced
            industry AI strategy practitioner, and the founder and lead instructor of MyLearningLaunchpad.
          </p>
          <ul className="mx-auto mt-6 inline-block space-y-3 text-left text-lg text-slate-800">
            {['Academia and executive education', 'AI research and innovation', 'Industry AI strategy and transformation'].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-gold-600" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-slate-600">This webinar is an independent MyLearningLaunchpad AI Leadership Academy session.</p>
        </div>
      </section>

      {/* 5 — Registration */}
      <section id="register" aria-labelledby="register-title" className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-10 text-center">
            <h2 id="register-title" className="text-balance text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">
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
                  className="font-semibold text-navy-900 underline underline-offset-2"
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
                <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-semibold text-navy-900 underline underline-offset-2">
                  {SITE_CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 6 — FAQ */}
      <section aria-labelledby="faq-title" className="bg-cream py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <SectionHeading eyebrow="Questions" id="faq-title">
            Frequently Asked Questions
          </SectionHeading>
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {faqs.map((f) => (
              <details key={f.q} className="group px-6 py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-left text-lg font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-900 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                </summary>
                <p className="pb-5 leading-relaxed text-slate-700">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 7 — Final CTA */}
      <section id="final-cta" aria-labelledby="final-title" className="bg-navy-950 py-20 text-white sm:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 id="final-title" className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            The Future of AI Leadership Starts with <span className="text-gold-400">Clarity.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-200">
            Join the free masterclass and discover a practical path from AI curiosity to confident leadership.
          </p>
          <a
            href="#register"
            className="mt-8 inline-flex items-center justify-center gap-3 rounded-full bg-gold-500 px-9 py-4 text-lg font-extrabold text-navy-950 transition-colors hover:bg-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {ctaLabel}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* Sticky mobile CTA */}
      {showSticky && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy-950/95 p-3 backdrop-blur sm:hidden">
          <a
            href="#register"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-base font-extrabold text-navy-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {ctaLabel}
          </a>
        </div>
      )}
    </main>
  );
};
