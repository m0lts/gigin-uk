import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildBookNewTemplatePayload } from './bookNewEventTemplateHelpers.js';

test('buildBookNewTemplatePayload keeps the templateId the save API requires', () => {
  const templateId = '6f1c2a40-0b3e-4c1a-9d2e-1a2b3c4d5e6f';
  const payload = buildBookNewTemplatePayload(
    { gigName: 'Friday jazz' },
    'venue-1',
    templateId,
    'Friday jazz',
  );
  assert.equal(payload.templateId, templateId);
  assert.equal(payload.venueId, 'venue-1');
  assert.equal(payload.templateName, 'Friday jazz');
  assert.equal(payload.bookNewEventTemplate, true);
});

test('new-gig saveTemplate generates a templateId instead of omitting it', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./new-gig/NewGigExperience.jsx', import.meta.url)),
    'utf8',
  );
  const start = source.indexOf('const saveTemplate');
  const end = source.indexOf("if (screen === 'created')");
  assert.ok(start >= 0 && end > start);
  const fn = source.slice(start, end);
  assert.match(fn, /const templateId = uuidv4\(\)/);
  assert.match(fn, /buildBookNewTemplatePayload\([\s\S]*\btemplateId\b[\s\S]*\)/);
  assert.equal(fn.includes('undefined'), false);
});
