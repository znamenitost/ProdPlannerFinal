import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const INDEX = join(DIST, 'index.html');
const ASSETS = join(DIST, 'assets');

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

if (!existsSync(INDEX)) {
  console.error('LCP verify failed: dist/index.html not found. Run npm run build first.');
  process.exit(1);
}

const indexHtml = readFileSync(INDEX, 'utf8');
const assetFiles = existsSync(ASSETS) ? readdirSync(ASSETS) : [];

assert(!indexHtml.includes('fonts.googleapis.com'), 'index.html must not reference Google Fonts');
assert(indexHtml.includes('/sprites/fon1.svg'), 'index.html must preload /sprites/fon1.svg');
assert(
  indexHtml.includes('login-employees-bootstrap') || indexHtml.includes('LOGIN_EMPLOYEES_BOOTSTRAP'),
  'index.html must contain login employees bootstrap marker'
);
assert(
  assetFiles.some((name) => name.startsWith('AuthenticatedApp') && name.endsWith('.js')),
  'dist must contain lazy AuthenticatedApp chunk'
);
assert(existsSync(join(DIST, 'sprites', 'fon1.svg')), 'dist/sprites/fon1.svg must exist');

if (failures.length > 0) {
  console.error('LCP verify failed:\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('LCP verify passed.');
