/**
 * One-time archival of the ORIGINAL (v1) flagship course before the 90-minute restructure:
 *  - freezes the four paid courses as a fixture so tests can prove they were not changed
 *  - exports the v1 flagship source and verifies it equals the live Firestore backup
 * Run once, BEFORE editing src/data/courses.ts:   npx tsx scripts/archive-flagship-v1.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { courses } from '../src/data/courses.ts';

const paid = courses.filter((c: any) => c.id !== 'ai-strategy-leaders');
writeFileSync('tests/fixtures/paid-courses.frozen.json', JSON.stringify(paid, null, 2));

const flagship: any = courses.find((c: any) => c.id === 'ai-strategy-leaders');
writeFileSync('docs/archive/ai-strategy-leaders.v1.static-source.json', JSON.stringify(flagship, null, 2));

const live = JSON.parse(readFileSync('docs/archive/ai-strategy-leaders.live-firestore-2026-10-14.json', 'utf8'));
const strip = (c: any) =>
  c.curriculum.map((m: any) => ({ module: m.module, topics: m.topics.map((t: any) => ({ title: t.title, description: t.description, videoUrl: t.videoUrl || '' })) }));

console.log('paid courses frozen:', paid.map((c: any) => c.id).join(', '));
console.log('v1 flagship: modules', flagship.curriculum.length, '| topics', flagship.curriculum.reduce((a: number, m: any) => a + m.topics.length, 0));
console.log('v1 static source == live Firestore record (titles, descriptions, videos):', isDeepStrictEqual(strip(flagship), strip(live)));
