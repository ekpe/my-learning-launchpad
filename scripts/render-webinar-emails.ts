/**
 * Renders every webinar email template to docs/webinar-email-samples/*.html
 * using obviously fake sample data, so copy can be reviewed in a browser
 * before anything is ever sent.   Run:  npx tsx scripts/render-webinar-emails.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.FIREBASE_PROJECT_ID ||= 'sample';
process.env.SITE_URL ||= 'https://www.mylearninglaunchpad.com';
const { renderEmail } = await import('../api/_lib/webinar.ts');
type EmailKind = Parameters<typeof renderEmail>[0];

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'webinar-email-samples');
mkdirSync(out, { recursive: true });

const event = {
  id: 'leading-ai-hype-to-strategy',
  title: 'Leading in the Age of AI: From Hype to Strategy',
  subtitle: 'What Every Leader Needs to Know About Generative AI, AI Agents, and the Future of Work',
  startsAt: '2030-01-15T18:00:00.000Z', // SAMPLE ONLY
  timezone: 'America/New_York',
  durationMinutes: 60,
  registrationStatus: 'open' as const,
  webinarStatus: 'scheduled' as const,
  capacity: null,
  meetUrl: 'https://meet.google.com/sample-only-link', // SAMPLE ONLY
  replayUrl: 'https://example.com/sample-replay', // SAMPLE ONLY
};

const kinds: EmailKind[] = ['confirmation', 'preview', 'reminder24', 'reminder1', 'update', 'followup-thanks', 'followup-pathways'];
for (const kind of kinds) {
  const r = renderEmail(kind, {
    firstName: 'Ngozi',
    event,
    marketingOptIn: true,
    unsubscribeUrl: 'https://www.mylearninglaunchpad.com/api/webinar?action=unsubscribe&id=SAMPLE&t=SAMPLE',
    recap: ['A sample takeaway about separating capability from hype', 'A sample takeaway about human accountability'],
  });
  const banner = `<div style="background:#fef3c7;color:#78350f;padding:10px 16px;font:14px Arial">SAMPLE RENDER (fake date, link and data). Subject: <strong>${r.subject.replace(/</g, '&lt;')}</strong></div>`;
  writeFileSync(join(out, `${kind}.html`), r.html.replace('<body style="margin:0;background:#f1f5f9">', `<body style="margin:0;background:#f1f5f9">${banner}`));
}
const waitlist = renderEmail('confirmation', { firstName: 'Ngozi', event: { ...event, startsAt: null, meetUrl: null }, marketingOptIn: false, unsubscribeUrl: null });
writeFileSync(join(out, 'confirmation-waitlist.html'), waitlist.html);
console.log(`Wrote ${kinds.length + 1} samples to ${out}`);
