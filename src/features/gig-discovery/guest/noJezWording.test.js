import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SKIP_DIRS = new Set(['node_modules', 'test', 'tests', '__tests__']);
const TEXT = new Set(['.js', '.jsx', '.html', '.css', '.txt']);

function omitGuestApplyRule(text) {
  return text.replace(
    /const LAUNCH_VENUE_IDS = new Set\(\[[\s\S]*?\n\}\n\nexport function bookerLine/,
    'export function bookerLine',
  );
}

function filesUnder(dir, found) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name) || name.startsWith('exec -l')) continue;
    const path = join(dir, name);
    let info;
    try {
      info = statSync(path);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      filesUnder(path, found);
      continue;
    }
    const ext = name.slice(name.lastIndexOf('.'));
    if (!TEXT.has(ext)) continue;
    if (name.endsWith('.test.js') || name.endsWith('.spec.js')) continue;
    if (name === 'LandingScreens.jsx') continue;
    found.push(path);
  }
}

test('application copy does not name the booker Jez', () => {
  const found = [];
  filesUnder(join(root, 'src'), found);
  filesUnder(join(root, 'gigin-api'), found);
  const hits = [];
  for (const path of found) {
    const rel = relative(root, path).split(sep).join('/');
    let text = readFileSync(path, 'utf8');
    if (rel === 'src/features/gig-discovery/guest/guestFormat.js') text = omitGuestApplyRule(text);
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (/jez/i.test(line)) hits.push(`${rel}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(hits, []);
});
