import test from 'node:test';
import assert from 'node:assert/strict';
import { VENUE_HEADLINE, landingSections } from './landingCopy.js';

test('the venue landing uses the agreed headline and hides unpaid sections', () => {
  assert.equal(VENUE_HEADLINE, 'Level up your live music');
  const shown = landingSections({ venuePage: true, venueHome: false, discovery: false });
  assert.equal(shown.profile, true);
  assert.equal(shown.dashboard, false);
  assert.equal(shown.network, false);
  assert.equal(shown.prices, false);
  assert.equal(shown.logos, false);
  assert.equal(shown.testimonials, false);
  assert.equal(shown.artistPages, false);
});
