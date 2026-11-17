import test from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ_OPENING, quizResult, waitlistRequest } from './venueQuiz.js';

test('the quiz opens with the fit line and a room-hire answer joins the waitlist', () => {
  assert.equal(QUIZ_OPENING, 'Let\'s see if Gigin is the right fit for you');
  assert.equal(quizResult({ booksLive: true, nights: 'often', roomHire: false }), 'fit');
  assert.equal(quizResult({ booksLive: true, nights: 'sometimes', roomHire: false }), 'gaps');
  assert.equal(quizResult({ booksLive: false, nights: 'never', roomHire: true }), 'waitlist');
  const body = waitlistRequest({ name: 'Ada', email: 'ada@venue.test', city: 'Cambridge', note: 'We hire the room out' });
  assert.equal(body.venueName, 'Room hire waitlist');
  assert.equal(body.message.includes('hire the room'), true);
});
