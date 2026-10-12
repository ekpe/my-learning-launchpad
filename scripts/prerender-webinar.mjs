/**
 * Post-build step: writes dist/webinar/index.html — a copy of the SPA shell
 * with the webinar's <title>, description, canonical and Open Graph / Twitter
 * tags baked in. Social crawlers (LinkedIn, Facebook, X) don't run JavaScript,
 * so tags set from React would never be seen by them. The SPA still boots from
 * this file and takes over routing as normal.
 *
 * No event date is ever written here: the date lives in Firestore and is
 * managed from Admin → Webinars, so static metadata can't go stale or lie.
 *
 * Env (all optional): SITE_URL, WEBINAR_OG_IMAGE (path or absolute URL).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const SITE = (process.env.SITE_URL || 'https://www.mylearninglaunchpad.com').replace(/\/$/, '');
const TITLE = 'Leading in the Age of AI: From Hype to Strategy | MyLearningLaunchpad';
const OG_TITLE = 'Leading in the Age of AI: From Hype to Strategy — Free Live Masterclass';
const DESCRIPTION =
  'A free 60-minute live masterclass with Prof. Ekpe Okorafor: what leaders need to know about generative AI, AI agents and the future of work. No technical background required.';
const imageSetting = process.env.WEBINAR_OG_IMAGE || '/images/prof_ekpe_okorafor-1100.jpg';
const IMAGE = /^https?:\/\//.test(imageSetting) ? imageSetting : `${SITE}${imageSetting}`;
const URL_ = `${SITE}/webinar`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const tags = [
  `<meta name="description" content="${esc(DESCRIPTION)}" />`,
  `<meta name="robots" content="index, follow" />`,
  `<link rel="canonical" href="${esc(URL_)}" />`,
  `<meta property="og:type" content="website" />`,
  `<meta property="og:site_name" content="MyLearningLaunchpad" />`,
  `<meta property="og:title" content="${esc(OG_TITLE)}" />`,
  `<meta property="og:description" content="${esc(DESCRIPTION)}" />`,
  `<meta property="og:url" content="${esc(URL_)}" />`,
  `<meta property="og:image" content="${esc(IMAGE)}" />`,
  `<meta property="og:image:alt" content="Prof. Ekpe Okorafor, instructor of the Leading in the Age of AI masterclass" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${esc(OG_TITLE)}" />`,
  `<meta name="twitter:description" content="${esc(DESCRIPTION)}" />`,
  `<meta name="twitter:image" content="${esc(IMAGE)}" />`,
].join('\n    ');

const shell = await readFile(join(dist, 'index.html'), 'utf8');
if (!/<title>[^<]*<\/title>/.test(shell)) throw new Error('dist/index.html has no <title> to replace');

const html = shell.replace(/<title>[^<]*<\/title>/, `<title>${esc(TITLE)}</title>\n    ${tags}`);

await mkdir(join(dist, 'webinar'), { recursive: true });
await writeFile(join(dist, 'webinar', 'index.html'), html);
console.log(`[prerender] wrote dist/webinar/index.html (${URL_})`);
