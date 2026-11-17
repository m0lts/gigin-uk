import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enquiryReply,
  homeNeeds,
  instagramBio,
  legworkBanner,
  legworkProgress,
  nightHomeChips,
  websiteEmbed,
} from './legwork.js';

test('two steps are already done and copying the rest finishes the guide', () => {
  assert.deepEqual(legworkProgress({}), { done: 2, total: 6, left: 4 });
  assert.equal(legworkBanner(legworkProgress({})).body.includes('4 quick set-ups left'), true);
  assert.equal(legworkProgress({ website: true, instagram: true, reply: true, qr: true }).left, 0);
  assert.equal(legworkBanner(legworkProgress({ website: true, instagram: true, reply: true, qr: true })), null);
});

test('the guide copy names the venue and the real page link', () => {
  const url = 'https://giginmusic.com/venues/hot-numbers';
  assert.equal(websiteEmbed('Hot Numbers', url), '<a href="https://giginmusic.com/venues/hot-numbers">Play at Hot Numbers</a>');
  assert.equal(instagramBio(url), 'Live music most weeks. Want to play? giginmusic.com/venues/hot-numbers');
  assert.equal(enquiryReply(url).includes('giginmusic.com/venues/hot-numbers'), true);
});

test('home rows name new applications and booked acts still missing promo', () => {
  const night = {
    gigId: 'gig-1',
    name: 'Discovery Sessions',
    setCount: 3,
    fresh: 4,
    date: new Date('2026-12-10T12:00:00Z'),
    bookedCount: 2,
    fullyBooked: false,
    applications: [
      { id: 'a', name: 'The Fen Street Trio', status: 'accepted' },
      { id: 'b', name: 'Sent Act', status: 'booked', promo: { submittedAt: '2026-12-01' } },
      { id: 'c', name: 'Waiting Act', status: 'pending' },
    ],
  };
  const needs = homeNeeds([night]);
  assert.equal(needs[0].title, '4 new applications');
  assert.equal(needs[0].action, 'Review');
  assert.equal(needs[1].title, 'Promo missing from The Fen Street Trio');
  assert.equal(needs.some((item) => item.title.includes('Sent Act')), false);
  assert.equal(needs.some((item) => item.title.includes('Waiting Act')), false);
  const chips = nightHomeChips(night);
  assert.equal(chips[0].label, '2 of 3 booked');
  assert.equal(chips[1].label, 'Promo 1 of 2');
});
