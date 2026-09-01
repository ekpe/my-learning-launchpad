# My Learning Launchpad

An AI executive education platform built with React, Firebase, Stripe, and Resend.

---

## Local Development

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev          # Vite dev server (frontend only)
npm run dev:server   # Express server with Vite middleware (full-stack locally)
```

The app runs on `http://localhost:3000` when using `dev:server`.
`firebase-applet-config.json` is used automatically when running locally (do not commit it).

---

## Vercel Deployment

### 1. Connect your repo to Vercel

Push to GitHub, then import the repo in the [Vercel Dashboard](https://vercel.com/new).

### 2. Set Environment Variables

In **Project → Settings → Environment Variables**, add every variable from `.env.example`.  
The critical ones are:

| Variable | Where to get it |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Console → Project Settings → Service Accounts → Generate new private key. Paste the entire JSON as one line. |
| `FIREBASE_WEB_API_KEY` | Same as `apiKey` in `firebase-applet-config.json` |
| `VITE_FIREBASE_*` | From `firebase-applet-config.json` |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API Keys |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Same page |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → Add endpoint → `https://yoursite.com/api/stripe-webhook`. **Required** — the webhook refuses to process events without it, and course prices/enrollment are only ever trusted from server-verified sources. |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `RESEND_FROM_EMAIL` | A sender address on a domain verified in Resend |
| `ADMIN_EMAIL` + `VITE_ADMIN_EMAIL` | Your admin email address |

`GET /api/config-check` reports which of these are missing after you deploy.

### 3. Deploy

```bash
git push origin main   # Vercel auto-deploys on push
```

### 4. Configure Stripe Webhook

After first deployment, go to Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://your-vercel-url.vercel.app/api/stripe-webhook`
- Events: `checkout.session.completed`

Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET` in Vercel.

### 5. Sync courses to Firestore

Course price and `isFree` status are read from Firestore, not trusted from the browser — checkout and free-enrollment both fail closed if a course doesn't exist there. From the Admin Dashboard, use **Sync Courses** to push `src/data/courses.ts` into the `courses` collection before testing purchases.

---

## Architecture

```
/
├── src/                   # React frontend (Vite SPA)
│   ├── components/
│   ├── contexts/          # AuthContext (Firebase Auth)
│   ├── services/          # emailService, analyticsService
│   └── firebase.ts        # Client SDK init
│
├── api/                   # Vercel Serverless Functions
│   ├── _lib/
│   │   ├── firebase-admin.ts   # Admin SDK (server-only)
│   │   ├── with-admin.ts       # Auth middleware
│   │   └── cors.ts
│   ├── create-checkout-session.ts  # Looks up price/title from Firestore — never trusts the client
│   ├── verify-enrollment.ts        # Confirms a paid Stripe session and writes the enrollment
│   ├── stripe-webhook.ts           # Authoritative async enrollment path; requires STRIPE_WEBHOOK_SECRET
│   ├── send-email.ts               # context: 'self' (caller's own verified email) or 'public' (rate-limited)
│   ├── auth-login.ts
│   ├── admin.ts                    # All /api/admin?resource=... routes (single function — Hobby plan's 12-function cap)
│   ├── debug-admin.ts              # Admin-only diagnostics for the Firebase Admin setup
│   ├── config-check.ts             # Reports which required env vars are missing
│   └── health.ts
│
├── server.ts              # Express server (local dev only) — mirrors the routes above
└── vercel.json            # Vercel config
```

**Enrollment integrity:** the client never writes a paid enrollment directly. Firestore rules only allow a client-side enrollment `create` when the referenced course is flagged `isFree`; paid enrollments are written exclusively by `stripe-webhook.ts` or `verify-enrollment.ts`, both of which use the Admin SDK (bypassing rules) after independently confirming payment with Stripe.

## File Storage

The admin file upload uses **Firebase Storage** in production (which doesn't persist on serverless) and local disk under `uploads/` in `dev:server`. Make sure `FIREBASE_STORAGE_BUCKET` is set in your Vercel env vars.
