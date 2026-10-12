// Portable test runner: Node 20 doesn't expand globs for `node --test` on Windows,
// and only auto-discovers .js files. Lists tests/*.test.ts and runs them through tsx.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => join('tests', f));

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
