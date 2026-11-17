import test from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ_OPENING, QUIZ_STEPS, quizResult, waitlistRequest } from './venueQuiz.js';

test('five quiz questions end in a fit, a gap, or the room-hire waitlist', () => {
  assert.equal(QUIZ_OPENING, 'Let\'s see if Gigin is the right fit for you');
  assert.equal(QUIZ_STEPS.length, 5);
  assert.equal(quizResult({ how: 'own', often: 'week', help: ['find'], who: 'me' }), 'fit');
  assert.equal(quizResult({ how: 'own', often: 'sometimes', help: [], who: 'me' }), 'gaps');
  assert.equal(quizResult({ how: 'own', often: 'week', help: ['tickets'], who: 'me' }), 'gaps');
  assert.equal(quizResult({ how: 'hire', often: 'week', help: [], who: 'me' }), 'waitlist');
  assert.equal(quizResult({ how: 'artist' }), 'artist');
  const body = waitlistRequest({ name: 'Ada', email: 'ada@venue.test', city: 'Cambridge', note: 'Hold dates' });
  assert.equal(body.venueName, 'Room hire waitlist');
  assert.equal(body.message.includes('Hold dates'), true);
});
