import test from 'node:test';
import assert from 'node:assert/strict';
import { wizardStepLabel } from './newGigSteps.js';

test('the new gig bar uses the launch names and the steps stay the same', () => {
  assert.equal(wizardStepLabel('Start'), 'Start');
  assert.equal(wizardStepLabel('Date & time'), 'Date & time');
  assert.equal(wizardStepLabel('Fee & tickets'), 'Fee & tickets');
  assert.equal(wizardStepLabel('Listing'), 'The night');
  assert.equal(wizardStepLabel("Who's playing"), 'Who plays');
  assert.equal(wizardStepLabel('Review'), 'Share');
});
