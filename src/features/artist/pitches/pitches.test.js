import test from 'node:test';
import assert from 'node:assert/strict';
import { cyclePitchStatus, pitchMailto } from './pitches.js';

test('a pitch opens in the artist email app and the status moves sent, replied, follow up', () => {
  const href = pitchMailto({ email: 'booker@venue.test', venueName: 'The Portland Arms', artistName: 'Maya Reid', bio: 'Folk songs.', link: 'https://giginmusic.com/artist/maya' });
  assert.equal(href.startsWith('mailto:booker@venue.test'), true);
  assert.equal(decodeURIComponent(href).includes('Gigin does not send'), false);
  assert.equal(decodeURIComponent(href).includes('Folk songs.'), true);
  assert.equal(cyclePitchStatus('sent'), 'replied');
  assert.equal(cyclePitchStatus('replied'), 'follow-up');
  assert.equal(cyclePitchStatus('follow-up'), 'sent');
});
