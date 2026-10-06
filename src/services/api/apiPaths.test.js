import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { joinApiUrl } from '../http/url.js';

const servicesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roots = ['api', 'client-side'].map((name) => path.join(servicesDir, name));
const callPath = /(?:httpClient\s*\.\s*(?:get|post|put|patch|delete)|\b(?:get|post|put|patch|del|request))\s*\(\s*(['"`])([^'"`]*)\1/g;

function sourceFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (entry.endsWith('.js') && !entry.endsWith('.test.js')) found.push(full);
  }
  return found;
}

function postPath(file) {
  const match = readFileSync(file, 'utf8').match(/\bpost\s*\(\s*(['"`])([^'"`]+)\1/);
  assert.ok(match, `no post() path in ${file}`);
  return match[2];
}

test('service calls do not pass a path that already starts with /api/', () => {
  const offenders = [];
  for (const file of roots.flatMap(sourceFiles)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(callPath)) {
      if (match[2].startsWith('/api/')) {
        offenders.push(`${path.relative(servicesDir, file)} ${match[2]}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('access-request and manage-links URLs keep a single /api when the base already ends in /api', () => {
  const base = 'https://gigin-api-staging-gzpoy76paa-ey.a.run.app/api';
  const access = joinApiUrl(base, postPath(path.join(servicesDir, 'api/accessRequests.js')));
  const manage = joinApiUrl(base, postPath(path.join(servicesDir, 'api/manageLinks.js')));
  assert.equal(access, `${base}/access-requests`);
  assert.equal(manage, `${base}/guest-applications/manage-links`);
});
