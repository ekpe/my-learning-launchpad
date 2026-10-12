// One command to view the webinar funnel locally with NO credentials and NO real email:
//   npm run webinar:local
// Starts (1) the real /api/webinar handler on an in-memory database with Resend intercepted,
// and (2) the Vite dev server forwarding /api to it. Data resets whenever you stop it.
import { spawn } from 'node:child_process';

const run = (cmd, args, env = {}) =>
  spawn(cmd, args, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });

const api = run('npx', ['tsx', 'tests/helpers/dev-harness.ts']);
const web = run('node', ['-e', '"import(\'vite\').then(v=>v.createServer({server:{port:5173,strictPort:true}})).then(s=>s.listen())"'], {
  API_PROXY: 'http://localhost:3100',
});

setTimeout(() => {
  console.log(`
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Webinar funnel (local, in-memory, no real email)                      │
  │                                                                        │
  │  Open page:      http://localhost:5173/webinar?preview=open            │
  │  Waitlist mode:  http://localhost:5173/webinar?preview=waitlist        │
  │  Closed:         http://localhost:5173/webinar?preview=closed          │
  │  No event yet:   http://localhost:5173/webinar?preview=missing         │
  │  With UTMs:      http://localhost:5173/webinar?preview=open&utm_source=linkedin&utm_campaign=test
  │                                                                        │
  │  Emails "sent": http://localhost:3100/__debug/mail                     │
  │  Registrations: http://localhost:3100/__debug/registrations            │
  └──────────────────────────────────────────────────────────────────────┘
`);
}, 6000);

const stop = () => { api.kill(); web.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
