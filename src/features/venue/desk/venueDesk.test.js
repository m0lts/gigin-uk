import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bookedOnGig,
  contactHasPromo,
  durationFromRange,
  filterContacts,
  gigEditDraft,
  settingsDraft,
  settingsPatch,
  staffLabel,
  timesChanged,
} from './venueDesk.js';

test('settings keep the venue facts acts are shown and the two email switches', () => {
  const draft = settingsDraft({
    name: 'Hot Numbers',
    capacity: 60,
    address: 'Cambridge',
    actsShouldKnow: { pa: 'PA, 2 vocal mics', fee: '£80 per act' },
    emailPrefs: { applications: false },
  });
  assert.equal(draft.pa, 'PA, 2 vocal mics');
  assert.equal(draft.emailApplications, false);
  assert.equal(draft.emailPromo, true);
  const patch = settingsPatch(draft);
  assert.equal(patch.name, 'Hot Numbers');
  assert.equal(patch.actsShouldKnow.fee, '£80 per act');
  assert.equal(patch.emailPrefs.promo, true);
});

test('a view-only member is labelled as unable to change the venue', () => {
  assert.equal(staffLabel({ id: 'owner', role: 'owner' }, 'owner'), 'Owner');
  assert.equal(staffLabel({ id: 'sam', permissions: { 'gigs.read': true } }, 'owner'), 'Can view, not change');
  assert.equal(staffLabel({ id: 'sam', permissions: { 'gigs.read': true, 'gigs.update': true } }, 'owner'), 'Can change');
});

test('editing a night warns only when the times move and acts are booked', () => {
  const gig = {
    gigId: 'night',
    gigName: 'Discovery Sessions',
    startTime: '19:30',
    duration: 45,
    applicants: [{ status: 'accepted' }, { status: 'pending' }],
  };
  const draft = gigEditDraft(gig);
  assert.equal(draft.sets[0].end, '20:15');
  assert.equal(durationFromRange('19:30', '20:15'), 45);
  assert.equal(bookedOnGig(gig), 1);
  assert.equal(timesChanged(draft, draft), false);
  assert.equal(timesChanged(draft, { sets: [{ start: '20:00', end: '20:45' }] }), true);
});

test('contact filters separate crew, missing promo, and a name search', () => {
  const contacts = [
    { name: 'Maya Reid', contactType: 'artist', promo: { bio: 'Songs' } },
    { name: 'Sam Okoro', contactType: 'artist' },
    { name: 'In House', contactType: 'soundEngineer' },
  ];
  assert.equal(contactHasPromo(contacts[0]), true);
  assert.equal(filterContacts(contacts, { kind: 'artists', tab: 'promo' }).map((item) => item.name).join(), 'Sam Okoro');
  assert.equal(filterContacts(contacts, { kind: 'crew' })[0].name, 'In House');
  assert.equal(filterContacts(contacts, { query: 'maya' })[0].name, 'Maya Reid');
});
