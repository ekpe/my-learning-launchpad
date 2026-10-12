# Webinar registration funnel

Free live masterclass **“Leading in the Age of AI: From Hype to Strategy”** (Google Meet) → registration on
MyLearningLaunchpad → confirmation email → attendance → free *AI Strategy for Leaders* course → paid programs.

MyLearningLaunchpad owns registration. Visitors never register on Google Meet.

```
/webinar  →  POST /api/webinar?action=register  →  /webinar/thank-you  →  confirmation email  →  Google Meet
```

## What was built

| Area | Where |
|---|---|
| Landing page (10 sections, sticky mobile CTA, FAQ, JSON-LD) | `src/components/webinar/WebinarPage.tsx` |
| Registration form (full version near the bottom, compact **sign-up card** beside the hero on screens ≥1024px) | `src/components/webinar/RegistrationForm.tsx` |
| Thank-you page (`noindex`) | `src/components/webinar/WebinarThankYou.tsx` |
| Privacy & cookie policy (**draft**, see blockers) | `src/components/PrivacyPolicy.tsx` |
| Consent banner + gate for Google Analytics | `src/components/ConsentBanner.tsx`, `src/services/consent.ts`, `src/services/analyticsService.ts` |
| UTM capture, funnel events | `src/services/attribution.ts`, `src/services/webinarAnalytics.ts` |
| Registration API (validate, store, email, schedule reminders, unsubscribe) | `api/webinar.ts` |
| Email templates, Resend helpers, tokens, rate limit | `api/_lib/webinar.ts` |
| Shared validation / time zone / ICS helpers (client **and** server) | `api/_lib/webinar-shared.ts` |
| Admin operations | `api/_lib/webinar-admin.ts` (routed through the existing `api/admin.ts`) |
| Admin UI (new **Webinars** tab) | `src/components/admin/WebinarAdmin.tsx` |
| Social tags for crawlers | `scripts/prerender-webinar.mjs` (post-build) |
| Tests | `tests/*.test.ts` (`npm test`) |
| Email copy review | `docs/webinar-email-samples/*.html` (`npx tsx scripts/render-webinar-emails.ts`) |

The function count stays within the Vercel Hobby limit: one new function (`api/webinar.ts`), 10 of 12 total.

## Data model (Firestore)

| Collection | Contents | Who can access |
|---|---|---|
| `webinars/{eventId}` | **Public** schedule: title, subtitle, `startsAt` (UTC), `timezone`, duration, `registrationStatus`, `webinarStatus`, `capacity`, agenda, `replayAvailable` | Anyone can read; nobody can write from a browser |
| `webinarPrivate/{eventId}` | **Private**: `meetUrl`, `replayUrl`, `calendarEventId` | Server only |
| `webinarRegistrations/{id}` | One per event + email (hashed id): details, consent record, UTMs, delivery status, `attended` | Server only |
| `webinarRateLimits/{key}` | Per-IP counters | Server only |

All writes go through `/api/admin` (Admin SDK), so webinar admin works with `ADMIN_EMAIL` and does not depend on the admin’s
Firestore `role` document. **You must deploy the updated `firestore.rules`** (see Deployment).

## Setup (first webinar)

1. **Environment variables** (Vercel → Settings → Environment Variables; see `.env.example`):

   | Variable | Required | Purpose |
   |---|---|---|
   | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | yes (already used by the site) | Sending. The sender domain must be verified in Resend, otherwise Resend rejects mail to real recipients. |
   | `WEBINAR_TOKEN_SECRET` | for promotional email | Signs unsubscribe links. Without it, promotional emails are refused (confirmations and reminders still work). |
   | `SITE_URL` | recommended | Base URL for email links / social tags. Defaults to `https://www.mylearninglaunchpad.com`. |
   | `WEBINAR_FROM_EMAIL`, `WEBINAR_CONTACT_EMAIL` | optional | Override sender / support address in webinar mail. |
   | `VITE_WEBINAR_EVENT_ID` | optional | Event the page loads (default `leading-ai-hype-to-strategy`). |
   | `WEBINAR_OG_IMAGE` | optional | Social image (build time). Defaults to the instructor photo. |

   `GET /api/config-check` reports `webinar.fromEmail` and `webinar.tokenSecret`.
2. **Deploy Firestore rules:** `npx firebase deploy --only firestore:rules`
3. **Create the event:** sign in as admin → `/admin` → **Webinars** → fill in the details → **Save event**.
   - No date yet? Leave the date empty and registration on **Waitlist**. The page then shows “Date and time to be announced” and a
     waitlist form; it never invents a date.
   - Paste the **Google Meet URL** (private; only goes into emails). Prefer an existing Calendar event’s Meet link.
   - When the date is set: choose **Open**, **Save**, then **Reschedule reminders** (this also promotes waitlist sign-ups to registrations).
4. Share `/webinar` with UTM parameters, e.g.
   `https://www.mylearninglaunchpad.com/webinar?utm_source=linkedin&utm_medium=paid-social&utm_campaign=fall-launch&utm_content=ad-a`

## Configurable without code changes (Admin → Webinars)

Title, subtitle, date/start time + time zone, duration, registration status (Open / Waitlist / Closed), webinar status
(Scheduled / Live / Completed / Cancelled), capacity (only if a real limit exists), agenda, Meet URL, Calendar event ID (reference
only), replay URL and the “replay confirmed” flag. Course CTA targets are the existing `/course/:id` pages.

## Emails

| # | Template | How it is sent | Audience |
|---|---|---|---|
| 1 | Confirmation (+ `.ics`, Google Calendar link, Meet link) | **Automatic**, immediately after the server stores the registration | Registrant |
| 2 | “What we’ll cover” preview | Manual (Admin → Manual emails) | All registrants |
| 3 | 24-hour reminder | **Automatic**: scheduled at registration time via Resend `scheduledAt` | Registrant |
| 4 | 1-hour reminder | **Automatic**: scheduled at registration time via Resend `scheduledAt` | Registrant |
| – | Updated details (date/link changed) | Manual | Registrants and waitlist |
| 5 | Thank-you (+ replay, key takeaways you type in) | Manual. The course invitation is included **only for opted-in** recipients | All registrants |
| 6 | Learning pathways (free flagship + paid programs, **no prices**) | Manual, **promotional**: opted-in only, with unsubscribe link | Opted-in |

Rules the code enforces: marketing consent is never pre-checked and is stored with a timestamp and consent-text version;
promotional mail goes only to opted-in people and always carries a signed unsubscribe link; sending requires an explicit
confirmation and re-running never double-sends; the Meet link is never returned by any public endpoint, stored in public data,
shown on the landing or thank-you page, or sent to analytics.

**Rescheduling:** changing the date does *not* move already-scheduled reminders. Use **Reschedule reminders** (cancels each
registrant’s pending reminders and creates new ones from the saved date), then send the **Updated details** email.

**Resend limits to know:** default API rate is ~2 requests/second, so bulk actions run in short, resumable batches (the admin UI
loops automatically). A registration makes up to 3 send calls. On Resend’s free plan (≈100 emails/day) an ad campaign can hit the
daily cap quickly. Check your plan before launch.

## Google Meet: host checklist

- Create the meeting from the organizer’s Google Calendar (so the Meet link and calendar event match) and paste that Meet URL in admin.
- Host controls on; set joining to **“Anyone with the link can join”** only if you accept un-vetted guests, otherwise use host approval for entry.
- Turn off participant screen sharing and chat/mic abuse as appropriate; mute on entry; use Q&A (if your plan supports it) over open chat.
- Add a **co-host/moderator** for sessions with significant attendance.
- Recording and attendance reports depend on your Google Workspace plan. **Verify in your account** rather than assuming.
- Announce at the start that the session is being recorded (if it is).

## Attendance

Registration, link clicks and email opens do not mean attendance. After the session, paste the emails of people who actually joined
(from the Meet attendance report if your plan provides one, or your own notes) into **Attendance reconciliation**.
Unmatched emails are reported back; nobody is marked attended automatically.

## Replay workflow (only if your plan supports recording)

1. Record, and tell participants at the start. 2. Review the recording. 3. Publish an approved version and paste the URL in admin,
tick **Replay confirmed available** (this updates the public FAQ). 4. Send **Thank-you** (includes the replay link).
The landing page never promises a replay until you set that flag.

## Analytics and consent

- Google Analytics now loads **only after a visitor accepts** the consent banner (this is site-wide). Before consent there is no
  `dataLayer`, no Google script and no `_ga` cookies. Declining is remembered; the footer’s “Cookie settings” reopens the choice.
- Events: `webinar_page_view`, `webinar_registration_start`, `webinar_registration_complete`, `webinar_registration_error`,
  `free_course_click`, `paid_course_click`. Parameters are whitelisted: event id, mode, placement, course id, error code, UTMs. **Never**
  emails, names or form values. Page views, registration-start and completion are de-duplicated per tab session (refreshing does not re-fire).
- UTMs are kept in `sessionStorage` (tab-lifetime) and stored with the registration. Click IDs (`fbclid`, `gclid`) are deliberately dropped.
  Course links on the page and in emails carry the UTMs forward. No Meta/LinkedIn pixels are installed.
- Also changed: LeadMagnet events no longer send an email address to Google Analytics.

## Testing report

Run `npm test` (Node’s built-in runner, no new dependencies), `npm run lint`, `npm run build`.

| Check | Result |
|---|---|
| Unit: validation, time zones/DST, ICS, Google Calendar URL, HTML escaping | 13 pass |
| Integration (real handlers, in-memory Firestore, Resend intercepted): validation, honeypot, too-fast, closed/cancelled/completed, capacity, rate limit, consent + UTM storage, confirmation payload (Meet link, `.ics` DTSTART = configured instant), reminders at exactly −24h/−1h and skipped when past, waitlist mode, duplicates (safe, same response shape, re-send cool-down, consent upgrade only), email not configured, Resend failure reported honestly, unsubscribe token checks, admin save validation, reschedule, promo audience filtering, dry-run vs confirmed send, attendance | 30 pass |
| Config/catalog drift: email course titles = `courses.ts`; client/server constants agree; form mode logic | 5 pass |
| Browser (real UI → real handler → in-memory DB): empty submit validation; successful registration → thank-you; UTM persistence; `fbclid` dropped; opt-in recorded; direct visit to thank-you does **not** claim registration; backend outage shows an error with no false success; waitlist/closed/completed/no-config states; sticky CTA behaviour; no horizontal scroll; consent gating; analytics dedupe on refresh; no PII in `dataLayer` | pass |
| Accessibility (axe-core 4.10, WCAG 2.2 A/AA + best-practice) on `/webinar` | 0 violations (after fixing 3 issues in the shared navbar/footer); 14 “incomplete” contrast checks computed manually, all ≥ 8.1:1 |
| `tsc --noEmit`, `vite build` + prerender | pass |

**Not verified (cannot be from this environment):** real Resend delivery and domain verification; Resend’s `scheduledAt` against the live
API and its allowed window; real Firestore and deployed rules; `.ics` rendering in Google/Outlook/Apple Calendar; LinkedIn Post Inspector /
Facebook Sharing Debugger previews; a physical phone; Google Meet host/attendance features on your Workspace plan; Vercel function timeouts
on a large bulk send.

## Deployment (do not do until approved)

1. Merge/push → Vercel builds (`vite build && node scripts/prerender-webinar.mjs`).
2. `npx firebase deploy --only firestore:rules` (deploy **after** the code is live, as with earlier rule changes).
3. Set the env vars above; confirm `/api/config-check`.
4. Create the event in Admin → Webinars; run a **test registration with your own email** and confirm: email arrives, `.ics` opens, time/time zone are right,
   the Meet link works, and the two reminders appear as *scheduled* in the Resend dashboard.
5. Paste `/webinar` into LinkedIn Post Inspector and Facebook Sharing Debugger.
6. Only then run campaigns.

## Launch blockers / unresolved decisions

1. **Privacy policy text** is a draft pending legal review (`POLICY_REVIEWED = false` shows a notice). **Terms of Service** still links to `#`.
2. **Resend plan / sender domain**: confirm the domain is verified and the daily limit fits expected registrations.
3. **`WEBINAR_TOKEN_SECRET`** must be set before any promotional email.
4. **Event details** (date, time zone, Meet link) are not configured. The page runs in waitlist mode until you add them.
5. **Instructor bio** uses only the positioning supplied (professor, AI researcher, industry AI strategy practitioner). Add verified credentials if wanted. A 1200×630 branded share image is better than the portrait.
6. **Social profile links** in the footer are still `#`.
7. Attendance reporting and recording depend on your Workspace plan; verify.
8. Not automated: emails 2, 5, 6 (and “updated details”) are one-click manual sends by design until reminders have been proven in production.
9. Existing issue found (not changed): anonymous page-view writes to Firestore `analytics` are denied by current rules, so only signed-in users are logged first-party; and GA receives two `page_view`s per navigation (automatic + manual).
