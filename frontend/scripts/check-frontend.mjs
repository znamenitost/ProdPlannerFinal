import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(jsx?)$/.test(name)) acc.push(p);
  }
  return acc;
}

function collectExports(file, text) {
  const rel = relative(SRC, file);
  const map = {};
  for (const m of text.matchAll(/export const (\w+)/g)) map[m[1]] = rel;
  for (const m of text.matchAll(/export function (\w+)/g)) map[m[1]] = rel;
  for (const block of text.matchAll(/export \{([^}]+)\}/g)) {
    for (const part of block[1].split(',')) {
      const bit = part.trim();
      if (!bit) continue;
      const name = bit.includes(' as ') ? bit.split(' as ').pop().trim() : bit;
      map[name] = rel;
    }
  }
  return map;
}

function parseImports(text) {
  const names = new Set();
  const re = /import\s+(?:(\w+)\s*,\s*)?\{([^}]+)\}\s+from\s+['"][^'"]+['"]|import\s+(\w+)\s+from\s+['"][^'"]+['"]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) names.add(m[1]);
    if (m[3]) names.add(m[3]);
    if (m[2]) {
      for (const part of m[2].split(',')) {
        const bit = part.trim();
        if (!bit) continue;
        names.add(bit.includes(' as ') ? bit.split(' as ').pop().trim() : bit);
      }
    }
  }
  return names;
}

const allExports = {};
for (const file of walk(SRC)) {
  Object.assign(allExports, collectExports(file, readFileSync(file, 'utf8')));
}

const errors = [];
const builtins = new Set([
  'React', 'Fragment', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'memo'
]);

for (const file of walk(SRC)) {
  const rel = relative(SRC, file);
  const text = readFileSync(file, 'utf8');

  if (text.includes('\0')) {
    errors.push(`${rel}: corrupted file (null bytes)`);
    continue;
  }

  const scope = new Set([
    ...parseImports(text),
    ...[...text.matchAll(/(?:const|let|function)\s+(\w+)/g)].map((x) => x[1]),
    ...[...text.matchAll(/export default function (\w+)/g)].map((x) => x[1]),
    ...[...text.matchAll(/function (\w+)\s*\(/g)].map((x) => x[1]),
    ...builtins
  ]);

  for (const m of text.matchAll(/\bsx=\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) {
    const name = m[1];
    if (!scope.has(name)) {
      const hint = allExports[name] ? ` (export in ${allExports[name]})` : '';
      errors.push(`${rel}: missing import for '${name}'${hint}`);
    }
  }

  if (/<Stack[^>]*\bflexWrap=/.test(text)) {
    errors.push(`${rel}: Stack prop flexWrap must be in sx`);
  }
}

if (errors.length) {
  console.error('Frontend check failed:\n');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('Frontend check passed.');
