# My Learning Launchpad

An AI executive education platform built with React, Firebase, Stripe, and SendGrid.

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
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → Add endpoint → `https://yoursite.com/api/stripe-webhook` |
| `SENDGRID_API_KEY` | SendGrid Dashboard → Settings → API Keys |
| `ADMIN_EMAIL` + `VITE_ADMIN_EMAIL` | Your admin email address |

### 3. Deploy

```bash
git push origin main   # Vercel auto-deploys on push
```

### 4. Configure Stripe Webhook

After first deployment, go to Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://your-vercel-url.vercel.app/api/stripe-webhook`
- Events: `checkout.session.completed`

Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET` in Vercel.

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
│   ├── create-checkout-session.ts
│   ├── checkout-session.ts
│   ├── stripe-webhook.ts
│   ├── send-email.ts
│   ├── auth-login.ts
│   └── admin/
│       ├── users.ts
│       ├── create-user.ts
│       ├── update-user-role.ts
│       ├── delete-user.ts
│       └── upload.ts
│
├── server.ts              # Express server (local dev only)
└── vercel.json            # Vercel config
```

---

## Email Provider Recommendation

Consider migrating from SendGrid to **[Resend](https://resend.com)** — it has a simpler API, React Email component library for beautiful transactional emails, and better free tier (3,000/month). The `send-email` API endpoint is the only file to change.

## File Storage

The admin file upload now uses **Firebase Storage** instead of local disk (which doesn't persist on serverless). Make sure `FIREBASE_STORAGE_BUCKET` is set in your Vercel env vars.
