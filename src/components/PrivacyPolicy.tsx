import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { requestConsentReopen } from '../services/consent';

/**
 * Set to true once a qualified person has reviewed and approved the wording
 * below (and the [bracketed] placeholders are filled in). Until then a visible
 * notice tells visitors this is a draft.
 */
const POLICY_REVIEWED = false;

const H2 = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <h2 id={id} className="mb-3 mt-12 text-2xl font-bold text-slate-900">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => <p className="mb-4 leading-relaxed text-slate-700">{children}</p>;
const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed text-slate-700">{children}</ul>
);

export const PrivacyPolicy = () => {
  usePageMeta({
    title: 'Privacy & Cookie Policy | MyLearningLaunchpad',
    description: 'How MyLearningLaunchpad collects, uses and protects personal information, including webinar registrations and cookies.',
    path: '/privacy',
  });

  return (
    <main id="main" className="bg-white pb-24 pt-28 sm:pt-32">
      <article className="mx-auto max-w-3xl px-6">
        {!POLICY_REVIEWED && (
          <div role="note" className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Draft pending legal review.</strong> This policy is a plain-language starting point and has not yet been
            reviewed by a legal professional. Items in [square brackets] still need to be completed.
          </div>
        )}

        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Privacy &amp; Cookie Policy</h1>
        <p className="mt-2 text-slate-600">Last updated: [date]</p>

        <P>
          This policy explains what personal information MyLearningLaunchpad (“we”, “us”) collects through
          mylearninglaunchpad.com, why we collect it, and the choices you have. We are operated by [legal entity name and
          registered address]. You can reach us at{' '}
          <a href="mailto:info@mylearninglaunchpad.com" className="font-semibold text-blue-900 underline">info@mylearninglaunchpad.com</a>.
        </P>

        <H2>What we collect</H2>
        <UL>
          <li>
            <strong>Webinar registration:</strong> your first name and email address (required), and optionally your last
            name, organization, role, sector and country. We also record when you registered, which consent options you
            selected, and the campaign link you arrived from (UTM parameters such as source and campaign).
          </li>
          <li>
            <strong>Accounts and learning:</strong> your name, email address, course enrollments, lesson and quiz progress,
            certificates, and forum posts.
          </li>
          <li>
            <strong>Contact and download forms:</strong> the details you submit and the message you send.
          </li>
          <li>
            <strong>Payments:</strong> paid courses are processed by Stripe. We do not receive or store your card number.
          </li>
          <li>
            <strong>Usage data:</strong> if you accept analytics, Google Analytics collects information about how you use the
            site (see “Cookies” below).
          </li>
        </UL>

        <H2>How we use it</H2>
        <UL>
          <li>To run the webinar: confirm your registration, send your joining details and calendar invitation, and send event reminders.</li>
          <li>To provide courses, certificates and support.</li>
          <li>
            To send you occasional updates about our courses and AI leadership learning <strong>only if you opt in</strong>.
            Opting in is separate from registering, and is never pre-selected.
          </li>
          <li>To understand which campaigns bring people to the site, and to keep the service secure and reliable.</li>
        </UL>

        <H2>Webinar emails and your choices</H2>
        <P>
          Registering means we will email you about that webinar (confirmation, joining instructions and reminders). These
          are service messages. Promotional emails are sent only if you ticked the optional box, and every promotional email
          includes an unsubscribe link. Unsubscribing stops promotional emails but not essential messages about a webinar you
          registered for.
        </P>

        <H2>Who we share it with</H2>
        <P>We use trusted service providers to operate the site. They process data on our behalf:</P>
        <UL>
          <li>Google (Firebase Authentication and Firestore, Google Meet for live sessions, and Google Analytics if you consent)</li>
          <li>Vercel (website hosting)</li>
          <li>Resend (sending email)</li>
          <li>Stripe (payment processing for paid courses)</li>
        </UL>
        <P>We do not sell your personal information. [Add any other recipients, and describe international transfers if applicable.]</P>

        <H2>How long we keep it</H2>
        <P>[Retention periods, for example: webinar registrations are kept for X months after the event unless you ask us to delete them sooner.]</P>

        <H2>Your rights</H2>
        <P>
          Depending on where you live, you may have the right to access, correct, delete or export your personal information,
          to object to or restrict certain processing, and to withdraw consent at any time. Write to us at the address above
          and we will respond. [Add region-specific wording as advised.]
        </P>

        <H2 id="cookies">Cookies and similar technologies</H2>
        <UL>
          <li>
            <strong>Analytics (optional):</strong> Google Analytics sets cookies named <code>_ga</code> and <code>_ga_*</code>{' '}
            only if you choose “Accept analytics”. If you decline, they are not set. You can change your choice at any time.
          </li>
          <li>
            <strong>Essential storage:</strong> we store your cookie choice, your sign-in session (Firebase) when you log in,
            and, for the current browser tab only, the campaign link parameters you arrived with.
          </li>
        </UL>
        <button
          type="button"
          onClick={requestConsentReopen}
          className="rounded-full border border-blue-900 px-5 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
        >
          Change my cookie choice
        </button>

        <H2>Changes to this policy</H2>
        <P>We will update this page when our practices change and revise the date above.</P>

        <p className="mt-12">
          <Link to="/" className="font-semibold text-blue-900 underline">Back to home</Link>
        </p>
      </article>
    </main>
  );
};
