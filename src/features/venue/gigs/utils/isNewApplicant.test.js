import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewApplicant, isWaitingApplication, nightNeedsAttention } from './isNewApplicant.js';

test('a new applicant is unopened, not invited, and still waiting', () => {
  assert.equal(isNewApplicant({ status: 'pending', viewed: false }), true);
  assert.equal(isNewApplicant({ status: 'sent' }), true);
  assert.equal(isNewApplicant({}), true);
  assert.equal(isNewApplicant({ status: 'pending', viewed: true }), false);
  assert.equal(isNewApplicant({ status: 'pending', invited: true }), false);
  assert.equal(isNewApplicant({ status: 'accepted' }), false);
  assert.equal(isNewApplicant({ status: 'confirmed', viewed: false }), false);
  assert.equal(isNewApplicant({ status: 'paid', viewed: false }), false);
  assert.equal(isNewApplicant({ status: 'payment processing', viewed: false }), false);
  assert.equal(isNewApplicant({ status: 'declined', viewed: false }), false);
  assert.equal(isNewApplicant({ status: 'withdrawn', viewed: false }), false);
  assert.equal(isNewApplicant(null), false);
});

test('waiting is pending or sent, not a decision', () => {
  assert.equal(isWaitingApplication({ status: 'pending' }), true);
  assert.equal(isWaitingApplication({ status: 'sent' }), true);
  assert.equal(isWaitingApplication({}), true);
  assert.equal(isWaitingApplication({ status: 'accepted' }), false);
  assert.equal(isWaitingApplication({ status: 'declined' }), false);
  assert.equal(isWaitingApplication({ status: 'withdrawn' }), false);
});

test('a fully booked night needs attention only while someone is still waiting', () => {
  const future = { fresh: 1, fullyBooked: true };
  assert.equal(nightNeedsAttention({ ...future, applications: [{ status: 'accepted', viewed: false }] }), false);
  assert.equal(nightNeedsAttention({ ...future, applications: [{ status: 'pending', viewed: false }] }), true);
  assert.equal(nightNeedsAttention({ fresh: 1, fullyBooked: false, applications: [{ status: 'pending' }] }), true);
  assert.equal(nightNeedsAttention({ fresh: 0, fullyBooked: false, applications: [{ status: 'pending', viewed: true }] }), false);
});
