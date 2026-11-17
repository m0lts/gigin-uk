import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTIST_FAQ, MAIN_HEADLINE, artistJourney, musicianSteps } from './launchSections.js';

test('landing sections follow the feature flags and leave out the network block', () => {
  assert.equal(MAIN_HEADLINE, 'Where the booking happens');
  const steps = musicianSteps({ venueMap: true, artistPage: false, artistGigs: true, artistInvoices: false });
  assert.deepEqual(steps.map((step) => step.title), ['Find venues and get in touch', 'Your gigs and invoices sorted']);
  const journey = artistJourney({ artistPage: true, venueMap: true, actNight: false, artistInvoices: true, reviews: false, artistHome: true });
  const titles = journey.map((section) => section.title);
  assert.equal(titles.includes('One link. Everything a booker needs.'), true);
  assert.equal(titles.includes('Or go and find them.'), true);
  assert.equal(titles.includes('Generate the invoice.'), true);
  assert.equal(titles.includes('Your page, live in two minutes.'), true);
  assert.equal(titles.some((title) => /network/i.test(title)), false);
  assert.equal(titles.includes('Booked, with everything for the night.'), false);
  assert.equal(ARTIST_FAQ.some((item) => /cost|price|free/i.test(item.q + item.a)), false);
});
